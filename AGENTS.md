# WorkBuddy OpenPencil

This repository owns the WorkBuddy connector packaging, local MCP bridge, and design
workflows. The Rust editor and MCP tool implementations belong to
`ZSeven-W/openpencil`; the DSH integration belongs to `ZSeven-W/dsh-openpencil`.
This is a WorkBuddy adaptation of the MIT-licensed `ZSeven-W/codex-openpencil`.

- Keep the runtime dependency-free and compatible with Node.js 22+.
- Run `npm run check` and `npm test` before committing.
- Use `npm run smoke -- --binary PATH` with a Rust OpenPencil host binary.
  This starts an isolated file-backed host; it must not edit the user's live canvas.
- Do not bundle machine-local paths, ports, credentials, or generated user designs.
- Never retry a failed mutation automatically: a timeout may follow an applied edit.
- Keep individual source files under 800 lines. Use English source comments.
- Conventional commits; new feature branches use `wb/`.
