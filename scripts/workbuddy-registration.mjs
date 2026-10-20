import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const repoRoot = () => resolve(fileURLToPath(new URL('../', import.meta.url)));

export const SERVER_NAME = 'workbuddy_openpencil';
export const CONFIG_PATH = () => process.env.WORKBUDDY_MCP_CONFIG || join(homedir(), '.workbuddy', 'mcp.json');
// `root` is the repository root; the launcher lives under plugins/openpencil.
const launcherPath = root => join(root, 'plugins', 'openpencil', 'scripts',
  process.platform === 'win32' ? 'launch-mcp.cmd' : 'launch-mcp');
const pluginCwd = root => join(root, 'plugins', 'openpencil');

// Read the current registration without throwing when the file or entry is
// absent; a corrupt config is surfaced as an explicit error so setup never
// silently overwrites a broken file with a fresh one.
export async function readRegistration(configPath = CONFIG_PATH()) {
  let raw;
  try { raw = await readFile(configPath, 'utf8'); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${configPath} is not valid JSON. Fix or back up that file before running setup again.`); }
  const entry = parsed?.mcpServers?.[SERVER_NAME];
  if (!entry || typeof entry.command !== 'string' || !entry.command) return null;
  return entry;
}

// Merge-only write: existing servers and unknown keys are preserved verbatim.
// The entry points at the portable launcher so Node version selection stays
// identical to what the host would otherwise resolve.
export async function registerWorkbuddyMcp({ configPath = CONFIG_PATH(), root = repoRoot() } = {}) {
  if (!isAbsolute(root)) throw new Error('Repository root must be an absolute path.');
  const launcher = launcherPath(root);
  let parsed = {};
  try {
    parsed = JSON.parse(await readFile(configPath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      if (error instanceof SyntaxError || /not an object/.test(error.message)) {
        throw new Error(`${configPath} is not valid JSON. Fix or back up that file before running setup again.`);
      }
      throw error;
    }
  }
  if (typeof parsed.mcpServers !== 'object' || parsed.mcpServers === null || Array.isArray(parsed.mcpServers)) parsed.mcpServers = {};
  parsed.mcpServers[SERVER_NAME] = { command: launcher, args: [], cwd: pluginCwd(root) };
  const temporary = join(configPath, `..`, `.mcp-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, configPath).catch(async error => {
    await rm(temporary, { force: true });
    throw error;
  });
  return { ok: true, server: SERVER_NAME, configPath, command: launcher, cwd: pluginCwd(root) };
}
