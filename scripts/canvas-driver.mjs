import { writeFile } from 'node:fs/promises';
import { ensureRuntime } from '../plugins/openpencil/scripts/runtime-install.mjs';
import { CanvasController } from '../plugins/openpencil/scripts/canvas-controller.mjs';

// Normalize a native tool reply. Tools differ: some return structuredContent,
// others return a JSON document (or plain text) in content[].text — callers
// should not have to care.
export function parseToolResult(reply) {
  if (reply?.result?.isError) throw new Error(reply.result.content?.map(c => c.text).join(' ') || 'tool error');
  if (reply?.result?.structuredContent) return reply.result.structuredContent;
  const text = reply?.result?.content?.map(c => c.text).join('\n') ?? '';
  try { return JSON.parse(text); } catch { return text; }
}

// Open one managed canvas session, hand the caller a `native(name, args)`
// dispatcher for upstream OpenPencil tools plus the controller for canvas_*
// calls, and always checkpoint/close on the way out.
export async function withCanvas(filePath, work) {
  const runtime = await ensureRuntime();
  const canvas = new CanvasController({ runtimeRoot: runtime.root });
  await canvas.open({ filePath });
  let id = 1;
  const native = (name, args = {}) => canvas.dispatch({
    jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name, arguments: args },
  }).then(parseToolResult);
  try { return await work({ canvas, native, runtime }); }
  finally { await canvas.close(); }
}

// Render a node and persist the PNG; get_screenshot returns image_base64.
export async function saveScreenshot(native, nodeId, outPath) {
  const shot = await native('get_screenshot', { nodeId });
  await writeFile(outPath, Buffer.from(shot.image_base64, 'base64'));
  return outPath;
}

// Fresh canvas coordinates for guarded writes: canvas_status carries the live
// document version and the active page id that canvas_import_image requires.
export async function canvasCoordinates(canvas) {
  const status = await canvas.call('canvas_status', {});
  const value = status.structuredContent ?? JSON.parse(status.content?.map(c => c.text).join('\n'));
  return { version: value.version, pageId: value.selection?.pageId, filePath: value.filePath };
}
