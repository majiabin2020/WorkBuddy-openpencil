<p align="center">
  <img src="./plugins/openpencil/assets/icon.png" alt="OpenPencil" width="120" />
</p>

<h1 align="center">WorkBuddy OpenPencil</h1>

<p align="center">
  <strong>The WorkBuddy adaptation of OpenPencil — create, inspect, and refine editable <code>.op</code> designs from a conversation.</strong><br />
  <sub>One-prompt setup • Interactive canvas • Selection prompts • Native Rust engine • WorkBuddy-credit image generation</sub>
</p>

<p align="center">
  <a href="./README.md"><b>English</b></a> · <a href="./README.zh.md">简体中文</a>
</p>

<p align="center">
  <a href="./INSTALL.md"><img src="https://img.shields.io/badge/Node.js-22%2B-43853d?logo=node.js&amp;logoColor=white" alt="Node.js 22+" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/codex-openpencil?color=64748b" alt="License" /></a>
</p>

<br />

**WorkBuddy OpenPencil** is a community adaptation of the MIT-licensed
[ZSeven-W/codex-openpencil](https://github.com/ZSeven-W/codex-openpencil) for the
[WorkBuddy](https://www.workbuddy.cn) desktop client. The canvas engine, MCP tool
catalog and portable `.op` format are unchanged; the host integration differs:

- **Registration** merges a `workbuddy_openpencil` entry into WorkBuddy's custom
  MCP connector config (`~/.workbuddy/mcp.json`) — no Codex CLI or paid
  subscription required. The user activates it by trusting the custom connector.
- **Canvas opening** presents the returned local `panelUrl` through WorkBuddy's
  built-in browser preview.
- **Image generation** uses the host's built-in image model (Chinese prompts,
  billed in WorkBuddy credits), with automatic stock-search fallback.

See the [Chinese README](./README.zh.md) for the full guide, or
[INSTALL.md](./INSTALL.md) for agent-driven setup instructions.

## Commands

```sh
npm run setup          # acquire runtime, register the WorkBuddy connector, verify
npm run host-check     # verify the registered entry and canvas tool catalog
npm run doctor         # diagnose a connection to an existing desktop editor
npm run canvas         # persistent-terminal canvas entry point
npm test               # full regression suite
```

## Acknowledgements

Upstream: [ZSeven-W/codex-openpencil](https://github.com/ZSeven-W/codex-openpencil)
(MIT); Rust engine: [ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil).
This is an independent community adaptation — not an official WorkBuddy, OpenPencil
or OpenAI product. Original license notices and third-party attributions are
preserved in [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
