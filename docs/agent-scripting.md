# Driving the canvas from agent scripts

Practical notes from running the full pipeline (skeleton → content → generated
image → verified save) against a live OpenPencil runtime. Use
[`scripts/canvas-driver.mjs`](../scripts/canvas-driver.mjs) as the entry point;
[`examples/dogfood-detail-page.mjs`](../examples/dogfood-detail-page.mjs) is a
complete worked example.

## Session plumbing

- Open one managed session per process with `withCanvas(filePath, work)`. The
  controller checkpoints and closes on exit; a crashed process leaves recovery
  drafts, not a broken document.
- Native tools go through `canvas.dispatch` as `tools/call`. Replies differ by
  tool: some return `structuredContent`, others return a JSON document or plain
  text inside `content[].text`. Always normalize with `parseToolResult`.
- `canvas_status` (a bridge-level tool, not upstream) returns the live document
  `version` and `selection.pageId`. Both are required by `canvas_import_image`.

## Build protocol

1. `get_guidelines` with `topic: "mobile"` (or the relevant topic) before
   creating frames. The status bar is pre-inserted by the engine as the first
   child of the phone root (fixed 62px) — never draw, move or fill it.
2. `design_skeleton` creates the root plus section frames. Its reply is a
   JSON document (not structuredContent) with `rootId` and a comma-separated
   `sectionIds` string that maps by index to the `sections` array you passed.
3. Fill sections with `batch_design` `script` batches (QuickJS sandbox):
   `I(parent, node)` only for new trees, ≤25 recorded operations per batch,
   loops and data arrays allowed. The batch is transactional — on failure fix
   the whole batch and resend; after a timeout inspect the canvas first, a
   write may already have applied. Never auto-retry a mutation.
4. Finish a content-driven page by switching the root to
   `height: "fit_content"` (`update_node` on the root id).
5. Text containers: a decorated frame (pill, button, badge) must carry its
   content; an empty styled frame renders as a blank box. Buttons need an
   explicit `cornerRadius` (8–12) or they read as placeholders.

## Image import recipe

1. Persist the generated asset under the project's asset directory with a
   non-overwriting filename; check `size <= 8 MiB` (PNG/JPEG/WebP).
2. Locate the target node by name — `find_node_by_name` returns the runtime's
   real node id (a script-side `id` hint on an inserted node is not the
   runtime id, e.g. `n2`).
3. Call `canvas_import_image` with the absolute `filePath`, that `nodeId`,
   `active pageId` and a fresh `expectedVersion` from `canvas_status`. The
   reply reports `embedded: true` and a `sha256`; a version mismatch needs a
   fresh status read, not a blind retry.
4. Verify the saved `.op` on disk: the image lives in the tree as
   `src: "data:image/png;base64,…"` — no local paths, no `blob:` URLs.

## QA without eyes

- `lint_document` reports structural issues; tonal-surface warnings
  (`invisible-container` for low-contrast chip fills) are expected in warm
  tonal designs.
- `get_screenshot` returns `image_base64`; when visual inspection is not
  available, verify regions programmatically (e.g. Pillow/numpy: the hero band
  should be photo-like — high standard deviation — and the buy bar should be
  dominated by the accent color).
- Confirm the saved document byte size roughly accounts for the embedded
  image (~1.6MB image ⇒ ~2.2MB document).

## Cross-column heading alignment

Multi-section boards (numbered top-level frames like `01 时空长轴`) are laid
out independently, so each section's first heading drifts to a different
global y — the structure tree is NOT the cause and must not be flattened.
Alignment is pure coordinate arithmetic: global y = sum of y along the parent
chain; shift the heading and everything below it back by the difference.

- `node scripts/align-check.mjs <file.op>` reports per-section global heading
  y against the first section's baseline (exit 1 when misaligned).
- `--fix` aligns every section to the baseline (or `--target <y>`), shifting
  the topmost `subheading｜` heading and all content below it; transparent
  `group` containers (no own x/y) have qualifying children shifted in place.
  A `.align-backup-<ts>.op` copy is kept next to the file.
- Unit note: the test document uses 1 unit = 1 mm and the full-canvas
  screenshot renders 1 px = 1 mm, so coordinate deltas are directly measurable
  in pixel space (verify with Pillow/numpy row profiles before/after).

## Known pitfalls

| Symptom | Cause / fix |
| --- | --- |
| `section hero not found: {}` | `design_skeleton` returned a JSON string, not an object — parse the text content. |
| `node n2 not found` after reopen | Node ids are renumbered between sessions; re-find by name. |
| Guarded save refuses | The disk snapshot moved (another writer). Read status, review, then retry with fresh values — never force. |
| Canvas shows a demo placeholder | Some driver script wrote a seed document over the design. Seed only when the file does not exist (`demo-canvas.mjs` does this). |
