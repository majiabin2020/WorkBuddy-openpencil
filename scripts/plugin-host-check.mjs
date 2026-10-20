import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegistration, SERVER_NAME } from './workbuddy-registration.mjs';

// Verify what WorkBuddy will actually launch: the registered entry is spawned
// exactly as configured, then taken through a real MCP handshake. This opens
// no canvas and never starts the Rust editor.
const CONTROLS = ['open_canvas', 'canvas_open_browser', 'canvas_prepare_browser', 'canvas_launch_status',
  'canvas_status', 'canvas_selection', 'canvas_import_image', 'canvas_save',
  'canvas_codegen_status', 'canvas_codegen_complete'];

export async function verifyWorkbuddyRegistration({ configPath, timeout = 20_000 } = {}) {
  const entry = await readRegistration(configPath);
  if (!entry) {
    throw new Error(`WorkBuddy has no ${SERVER_NAME} MCP entry yet. Run "npm run setup" from the repository, then trust the custom connector in WorkBuddy.`);
  }
  try { await access(entry.command, constants.X_OK); }
  catch { throw new Error(`Registered launcher is not executable: ${entry.command}. Run setup again from the repository.`); }
  const child = spawn(entry.command, entry.args ?? [], { cwd: entry.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let id = 0;
  const pending = new Map();
  const lines = createInterface({ input: child.stdout });
  const closed = new Promise(resolve => child.once('close', resolve));
  const fail = error => { for (const request of pending.values()) request.reject(error); pending.clear(); };
  child.on('error', error => fail(new Error(`Could not launch the registered bridge (${error.message}). Run setup again.`)));
  child.on('exit', code => fail(new Error(`The registered bridge exited early (code ${code}). Run "npm run doctor" for details.`)));
  child.stdin.on('error', fail);
  child.stderr.resume();
  lines.on('line', line => {
    let value;
    try { value = JSON.parse(line); } catch { return; }
    const request = pending.get(value.id);
    if (!request) return;
    pending.delete(value.id);
    value.error ? request.reject(new Error(value.error.message)) : request.resolve(value.result);
  });
  function request(method, params) {
    return new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => { pending.delete(current); reject(new Error(`${method} timed out.`)); }, timeout);
      pending.set(current, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: current, method, params })}\n`);
    });
  }
  try {
    await request('initialize', { protocolVersion: '2025-11-25', clientInfo: { name: 'openpencil_setup_check', version: '1' }, capabilities: {} });
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    const listed = await request('tools/list', {});
    const names = new Set((listed?.tools ?? []).map(tool => tool.name));
    if (CONTROLS.some(name => !names.has(name))) {
      throw new Error('The bridge answered with an incomplete OpenPencil tool catalog. Re-run setup and reconnect.');
    }
    return { ok: true, server: SERVER_NAME, command: entry.command, controls: CONTROLS, toolCount: names.size };
  } finally {
    lines.close(); child.stdin.end(); child.kill('SIGTERM');
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
    await closed; clearTimeout(killTimer);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await verifyWorkbuddyRegistration(), null, 2)); }
  catch (error) { console.error(`WorkBuddy OpenPencil host check failed: ${error.message}`); process.exitCode = 1; }
}
