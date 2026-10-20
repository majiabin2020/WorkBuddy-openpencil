---
name: openpencil-setup
description: Connect and diagnose the local Rust OpenPencil editor for the WorkBuddy OpenPencil connector. Use for initial setup, missing tools, or a disconnected local canvas.
---

# Connect OpenPencil

The connector opens a managed interactive Rust canvas or connects to an existing
desktop editor. First canvas use automatically downloads the matching complete
runtime from pinned public GitHub Release assets and validates its SHA-256,
payload manifest, version and platform before configuring or starting it.

## Interactive canvas

1. In WorkBuddy, call `canvas_open_browser`, optionally with the user's existing
   absolute `.op` path, then present its returned `panelUrl` through the
   WorkBuddy built-in browser preview (localhost URL) so the user can edit
   immediately. Use an external browser only when the user explicitly requests
   one. The source is copied into a recovery draft. If only `open_canvas` is
   available, its returned `panelUrl` works the same way. Do not claim an
   embedded canvas was verified when only a browser tab was opened, and do not
   launch an OS browser or use a deep-link workaround.
2. Missing runtime configuration triggers installation automatically. Allow the
   initial download to finish; do not repeatedly call either opener after a host
   timeout. For preflight or a slow connection, run
   `node plugins/openpencil/scripts/runtime-install.mjs` from the repository,
   then call `canvas_open_browser`. Failed downloads do not configure partial
   runtimes. Existing invalid configurations are reported without switching
   runtimes. Configuration stays private in `~/.workbuddy-openpencil/runtime.json`.
   A complete custom package can be selected with
   `OPENPENCIL_EDITOR_RUNTIME_DIR`; it needs a matching native server, editable
   WASM, CanvasKit and integrity manifest. A desktop binary alone is insufficient.
3. Present the returned local `panelUrl`, then verify `canvas_status` and
   `get_editor_state`: they must describe the same managed document before editing.
4. Each conversation keeps one canvas. Use another chat for a different document.
   Recovery drafts survive in `~/.workbuddy-openpencil/sessions/`. A stopped
   session's URL is temporary; reopen its recovery file in a new session.
5. After upgrading the connector, ask the user to re-trust the custom MCP server
   or start a new conversation so its tools reload.

## New install

Follow the repository's `INSTALL.md`. `npm run setup` verifies an isolated
native edit/save/reopen before registering anything, records the current Node
executable privately, merges the `workbuddy_openpencil` entry into
`~/.workbuddy/mcp.json` without touching other servers, and verifies the
registered bridge through a real MCP handshake (`npm run host-check`).

WorkBuddy activates custom MCP connectors only after the user trusts them: after
setup, the user must open WorkBuddy's connector management, find the custom
server `workbuddy_openpencil`, and click Trust, then start a new conversation so
the canvas tools load. Setup cannot complete that step automatically — explain
it plainly and wait for the user to confirm before designing.

If this conversation has not loaded the newly registered MCP tools yet,
`npm run canvas` in the repository provides the same editable canvas and accepts
native tool requests through a persistent terminal's stdin. Use that entry point
to complete the design now, then explain that re-trusting and a new conversation
loads the installed tools. Never mistake a successful install for a verified
live canvas.

## Existing desktop editor

1. Try `get_editor_state` through this connector's OpenPencil tools. A response
   proves the actual connection; an installed package alone does not.
2. If unavailable, run `node plugins/openpencil/scripts/mcp-bridge.mjs --doctor`
   from the repository. The doctor reads the editor's `~/.openpencil/.op-mcp-port`
   and verifies the instance identity. The launcher uses the Node.js 22+
   executable registered by setup, then known local Node locations if needed; it
   never downloads a runtime to solve discovery.
3. For a missing editor, use the official [OpenPencil installation instructions](https://github.com/ZSeven-W/openpencil).
   When launch is within the user's request, run `op start`, then enable MCP
   in the editor's Agent Settings. An old `op` binary may not discover the
   current Rust editor; trust the bridge doctor and editor state over that
   binary's status.
4. For an intentional headless/web endpoint without a live discovery record,
   set `OPENPENCIL_MCP_PORT` in the MCP process environment or append
   `--port PORT` to the bundled server args. Only local loopback ports are
   accepted. Do not guess a port or rewrite unrelated WorkBuddy server
   configuration.
5. If MCP discovery failed at session startup, ask the user to re-trust and
   start a new conversation after the editor is reachable. Verify
   `get_editor_state` again and report the active document/page before editing.

A stale identity error requires reopening the intended editor or fixing its MCP
setting. The bridge refuses to silently fall back to a different canvas. Keep
discovery tokens out of chat, logs, committed files, and reports.

After either canvas opener, all native tools target that managed session instead of the
discovered desktop editor. Report the target before edits; never silently take
over a different document.
