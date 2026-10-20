import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registerNode } from '../scripts/node-registration.mjs';
import { registerWorkbuddyMcp, readRegistration } from '../scripts/workbuddy-registration.mjs';
import { verifyWorkbuddyRegistration } from '../scripts/plugin-host-check.mjs';

test('installed launcher initializes MCP with a registered Node outside the GUI PATH', async t => {
  const home = await mkdtemp(join(tmpdir(), 'openpencil launch & home '));
  t.after(() => rm(home, { recursive: true, force: true }));
  const state = join(home, '.workbuddy-openpencil');
  let node = process.execPath;
  if (process.platform !== 'win32') {
    await mkdir(join(home, 'bin'));
    node = join(home, 'bin', 'node & current');
    await symlink(process.execPath, node);
  }
  await registerNode(state, node);
  assert.equal(await readFile(join(state, 'node-path'), 'utf8'), `${node}\n`);
  const windows = process.platform === 'win32';
  const launcher = resolve(`plugins/openpencil/scripts/launch-mcp${windows ? '.cmd' : ''}`);
  const env = { ...process.env, HOME: home, USERPROFILE: home,
    PATH: windows ? `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` : '/usr/bin:/bin' };
  // Only the fixed launcher path is interpreted by cmd.exe; MCP inputs use stdin.
  const child = spawn(launcher, [], { env, shell: windows, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
  let stdout = '', stderr = '';
  child.stdout.on('data', value => { stdout += value; });
  child.stderr.on('data', value => { stderr += value; });
  child.stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-11-25', clientInfo: { name: 'launcher-regression', version: '1' }, capabilities: {},
  } })}\n`);
  assert.equal(await closed, 0, stderr);
  const reply = JSON.parse(stdout.trim());
  assert.equal(reply.id, 1);
  assert.equal(reply.result.serverInfo.name, 'workbuddy-openpencil');
  await assert.rejects(registerNode(state, `${node}\ninvalid`), /Invalid Node/);
});

test('workbuddy registration merges without clobbering existing servers', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'openpencil registration '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const configPath = join(dir, 'mcp.json');
  assert.equal(await readRegistration(configPath), null);
  await writeFile(configPath, `${JSON.stringify({ mcpServers: { other: { command: 'keep-me' } } })}\n`);
  const result = await registerWorkbuddyMcp({ configPath, root: dir });
  assert.equal(result.ok, true);
  const parsed = JSON.parse(await readFile(configPath, 'utf8'));
  assert.equal(parsed.mcpServers.other.command, 'keep-me');
  assert.match(parsed.mcpServers.workbuddy_openpencil.command, /launch-mcp$/);
  assert.equal(await (await readRegistration(configPath)).command, parsed.mcpServers.workbuddy_openpencil.command);
  await writeFile(configPath, 'not json');
  await assert.rejects(registerWorkbuddyMcp({ configPath, root: dir }), /not valid JSON/);
  await assert.rejects(readRegistration(configPath), /not valid JSON/);
});

test('host check spawns the registered entry and validates the tool catalog', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'openpencil host check '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fixture = join(dir, 'fake-bridge.mjs');
  const controls = ['open_canvas', 'canvas_open_browser', 'canvas_prepare_browser', 'canvas_launch_status',
    'canvas_status', 'canvas_selection', 'canvas_import_image', 'canvas_save',
    'canvas_codegen_status', 'canvas_codegen_complete'];
  await writeFile(fixture, `import { createInterface } from 'node:readline';
const controls = ${JSON.stringify(controls)};
for await (const line of createInterface({ input: process.stdin })) {
  const q = JSON.parse(line);
  if (!q.id) continue;
  const names = process.env.CASE === 'incomplete' ? controls.filter(n => n !== 'canvas_import_image') : controls;
  const result = q.method === 'initialize' ? {} : { tools: names.map(name => ({ name })) };
  console.log(JSON.stringify({ jsonrpc: '2.0', id: q.id, result }));
}`);
  const configPath = join(dir, 'mcp.json');
  const writeConfig = () => writeFile(configPath, `${JSON.stringify({ mcpServers: { workbuddy_openpencil: {
    command: process.execPath, args: [fixture], cwd: dir } } })}\n`);
  await writeConfig();
  const status = await verifyWorkbuddyRegistration({ configPath, timeout: 3000 });
  assert.equal(status.ok, true);
  assert.equal(status.toolCount, controls.length);
  assert.deepEqual(status.controls, controls);
  await writeFile(configPath, `${JSON.stringify({ mcpServers: {} })}\n`);
  await assert.rejects(verifyWorkbuddyRegistration({ configPath }), /no workbuddy_openpencil MCP entry/);
  await writeConfig();
  await writeFile(fixture, 'process.exit(2);');
  await assert.rejects(verifyWorkbuddyRegistration({ configPath }), /exited early/);
  await writeFile(fixture, `import { createInterface } from 'node:readline';
for await (const line of createInterface({ input: process.stdin })) {
  const q = JSON.parse(line);
  if (!q.id) continue;
  const names = ['open_canvas'];
  const result = q.method === 'initialize' ? {} : { tools: names.map(name => ({ name })) };
  console.log(JSON.stringify({ jsonrpc: '2.0', id: q.id, result }));
}`);
  await assert.rejects(verifyWorkbuddyRegistration({ configPath, timeout: 3000 }), /incomplete/);
});
