import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { ensureRuntime } from '../plugins/openpencil/scripts/runtime-install.mjs';
import { CanvasController } from '../plugins/openpencil/scripts/canvas-controller.mjs';

// Keep one managed canvas alive for interactive exploration. Prints a JSON
// line with the local panelUrl, then serves browser edits until SIGTERM/SIGINT
// or the time limit; saves the document before exiting.
const usage = 'Usage: node scripts/demo-canvas.mjs [--file ABS.op] [--minutes N]';
const args = process.argv.slice(2);
let filePath = join(homedir(), '.workbuddy-openpencil', 'demo.op');
let minutes = 20;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    filePath = resolve(args[++i]);
    if (!isAbsolute(filePath)) throw new Error(usage);
  } else if (args[i] === '--minutes' && args[i + 1]) {
    minutes = Number(args[++i]);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) throw new Error(usage);
  } else throw new Error(usage);
}
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('OpenPencil requires Node.js 22 or later.');

const runtime = await ensureRuntime();
await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
await writeFile(filePath, JSON.stringify({ version: '0.8.5', children: [
  { type: 'frame', id: 'demo-root', name: 'WorkBuddy OpenPencil demo', width: 420, height: 320, children: [] },
] }));

const canvas = new CanvasController({ runtimeRoot: runtime.root });
const opened = await canvas.open({ filePath });
console.log(JSON.stringify({ ready: true, panelUrl: opened.structuredContent.panelUrl, filePath, runtime: runtime.version }));
await canvas.call('canvas_save', { filePath });

let closing = false;
const shutdown = async signal => {
  if (closing) return;
  closing = true;
  try { await canvas.call('canvas_save', { filePath }); } catch {}
  try { await canvas.close(); } catch {}
  console.log(JSON.stringify({ ready: false, signal, saved: filePath }));
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
setTimeout(() => shutdown('timeout'), minutes * 60_000);
setInterval(() => {}, 1 << 30);
