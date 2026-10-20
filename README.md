<p align="center">
  <img src="./plugins/openpencil/assets/icon.png" alt="OpenPencil" width="120" />
</p>

<h1 align="center">WorkBuddy OpenPencil</h1>

<p align="center">
  <strong>OpenPencil 的 WorkBuddy 适配版 —— 在对话中创建、检查并修改可编辑的 <code>.op</code> 设计。</strong><br />
  <sub>一句话安装 &bull; 交互式画布 &bull; 选区提示词修改 &bull; 原生 Rust 引擎 &bull; WorkBuddy 积分生图</sub>
</p>

<p align="center">
  <a href="./README.en.md">English</a> · <a href="./README.md"><b>简体中文</b></a>
</p>

<p align="center">
  <a href="./INSTALL.md"><img src="https://img.shields.io/badge/Node.js-22%2B-43853d?logo=node.js&amp;logoColor=white" alt="Node.js 22+" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/codex-openpencil?color=64748b" alt="License" /></a>
</p>

<p align="center">
  <a href="#一句话安装并开始设计">快速开始</a> · <a href="#与-codex-版的差异">与 Codex 版的差异</a> · <a href="./INSTALL.md">安装指南</a> · <a href="#致谢与来源">致谢</a>
</p>

<br />

<p align="center">
  <img src="./docs/images/codex-openpencil-banner.png" alt="对话与 OpenPencil 画布同屏，展示 MŌDE 慕时服装 APP 的购物首页和商品详情页" width="100%" />
</p>
<p align="center"><sub>在 WorkBuddy 中对话设计，在 OpenPencil 画布中继续编辑。</sub></p>

## 这是什么

[WorkBuddy](https://www.workbuddy.cn) 是面向普通人的 AI 办公助手。[codex-openpencil](https://github.com/ZSeven-W/codex-openpencil) 是 OpenPencil 的 Codex 插件。本仓库把它完整适配到 WorkBuddy 客户端：

- 画布能力原封不动：同一套 Rust 编辑器引擎、同一批 MCP 工具、同一份可编辑 `.op` 格式；
- 安装注册改为写入 WorkBuddy 的自定义 MCP 连接器配置（`~/.workbuddy/mcp.json`），不再依赖 Codex CLI 和付费订阅；
- 设计配图默认使用 WorkBuddy 内置生图模型（中文提示词，消耗 WorkBuddy 积分），生图不可用时自动降级为素材搜图。

## 一句话安装并开始设计

> **默认启用 AI 生图，消耗 WorkBuddy 积分。** 设计需要新图片时，WorkBuddy 会使用内置生图能力；说“不要生图”或“只搜图”即可改用搜图素材。

把这句话发给 WorkBuddy：

```text
按照 WorkBuddy-openpencil 仓库里的 INSTALL.md 帮我安装并配置 OpenPencil，打开可编辑画布，做一个单页手机任务管理 APP。
```

也可以手动安装：

```sh
git clone https://github.com/majiabin2020/WorkBuddy-openpencil.git
cd WorkBuddy-openpencil
npm run setup
```

需要 **Node.js 22+ 和 Git**。不需要 GitHub 账号、API Key、Rust 编译器、独立 OpenPencil 桌面端，也不需要安装 npm 依赖。

安装完成后的**关键一步**：打开 WorkBuddy 的连接器管理，在自定义连接器里找到 `workbuddy_openpencil` 并点击「信任」，然后新开一个对话，画布工具就会加载。WorkBuddy 的安全机制要求这一步必须由用户手动确认。

| 平台 | CPU | 系统要求 |
| --- | --- | --- |
| macOS | Apple Silicon、Intel | 基于 macOS 15 原生构建 |
| Windows | ARM64、x64 | 对应架构的 Microsoft Visual C++ v14 运行库 |
| Linux | ARM64、x64 | glibc、fontconfig 和 FreeType；ARM64 为 Ubuntu 24.04+，x64 为 22.04+ |

## 与 Codex 版的差异

| 项 | codex-openpencil（上游） | WorkBuddy-openpencil（本仓库） |
| --- | --- | --- |
| 注册方式 | `codex plugin add` 本地插件市场 | 合并写入 `~/.workbuddy/mcp.json` |
| 启用方式 | 插件自动加载 | 用户在连接器管理中「信任」后新开对话 |
| 画布打开 | Codex 内置浏览器 + 回执交接 | WorkBuddy 内置浏览器预览（localhost URL） |
| 生图 | Codex `image_gen`（需 Plus 订阅额度） | WorkBuddy 内置生图（积分计费，中文提示词） |
| 生图导入 | `canvas_import_image` | 相同（本地图片 ≤8MiB，保持原生可编辑） |
| Rust 引擎 / `.op` 格式 / MCP 工具 | 相同 | 相同 |

私有状态目录为 `~/.workbuddy-openpencil/`（可用 `OPENPENCIL_STATE_DIR` 覆盖）。Rust 运行时仍按上游钉住的 Release 下载并做 SHA-256 校验。

## 常用命令

```sh
npm run setup          # 安装运行时、注册 WorkBuddy 连接器并校验
npm run host-check     # 校验注册条目与画布工具目录（真实 MCP 握手）
npm run doctor         # 诊断与已有桌面编辑器的连接
npm run canvas         # 持久终端入口：不开 WorkBuddy 也能用画布
npm run demo           # 打开/保持一块可交互演示画布（--file 指定 .op）
npm test               # 全部回归测试
```

## Agent 脚本驱动画布

想在对话外用脚本批量建设计（比如 AI 代理自动出图）？看这两份：

- [docs/agent-scripting.md](./docs/agent-scripting.md)——实战手册：会话管理、`design_skeleton`/`batch_design` 构建协议、生图导入配方、无目检 QA 和踩坑对照表；
- [scripts/canvas-driver.mjs](./scripts/canvas-driver.mjs)——通用驱动助手（工具返回归一化、坐标读取、截图落盘）；
- [examples/dogfood-detail-page.mjs](./examples/dogfood-detail-page.mjs)——完整可复现示例（本 README 顶图对应的详情页就是它建的）：

```sh
node examples/dogfood-detail-page.mjs --file /abs/design.op --image /abs/hero.png
```

## 致谢与来源

- 上游项目：[ZSeven-W/codex-openpencil](https://github.com/ZSeven-W/codex-openpencil)（MIT），Rust 引擎：[ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil)。
- 本仓库是独立维护的社区适配，**不是 WorkBuddy 官方项目，也不是 OpenPencil 或 OpenAI 官方插件**。
- 原始 MIT 许可与第三方署名见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。fork 改动范围见 [docs/architecture.md](./docs/architecture.md) 与上游文档。
