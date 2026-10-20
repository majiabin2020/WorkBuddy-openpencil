# 在 WorkBuddy 中安装并启动 OpenPencil

把下面这段话发给 WorkBuddy（把示例换成你自己的设计需求）：

> 按照 https://github.com/你的账号/WorkBuddy-openpencil 的 INSTALL.md 帮我安装并配置 OpenPencil，打开可编辑画布，做一个单页手机任务管理 APP。

## 给安装代理（AI 助手）的指令

用户要的是一个能用的画布和一版设计，所以一路做完校验并打开画布。这是本地安装；不需要 GitHub 账号、API key、DSH、Rust 编译器、npm 依赖安装，也不需要单独安装 OpenPencil 桌面应用。生图使用 WorkBuddy 内置的图像生成（消耗 WorkBuddy 积分），不需要任何外部生图订阅。

1. 检查 Node.js 22+ 和 Git。缺什么就用用户系统正常的包管理器从官方渠道安装（[Node.js](https://nodejs.org/en/download)、[Git](https://git-scm.com/downloads)）。保留用户已有的 WorkBuddy 设置和无关的 MCP 服务器。setup 会把当前 Node 可执行文件私下记录下来，桌面宿主的 PATH 和终端不一致也能启动。Linux 还需要 fontconfig 和 FreeType 运行库（Ubuntu 上是 `libfontconfig1` 和 `libfreetype6`）。Windows 需要对应的 [Microsoft Visual C++ v14 运行库](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)：原生包导入 `MSVCP140.dll` 和 `VCRUNTIME140.dll`，缺失时安装微软签名包。这些是系统前置条件，由安装代理解决，不要让用户自己找 Rust 二进制。
2. 用 HTTPS 把仓库克隆到一个持久的、用户拥有的位置。不要覆盖别的 checkout，也不要装进临时目录。已有 checkout 时先看本地改动再更新。

   ```sh
   git clone https://github.com/你的账号/WorkBuddy-openpencil.git
   cd WorkBuddy-openpencil
   npm run setup
   ```

   如果 Git 连不上 GitHub，检查用户现有代理设置，把 HTTP 代理通过 `HTTPS_PROXY` 传给本进程。不要改用户的全局 Git 或系统代理。

   没有 npm 运行时依赖。`npm run setup` 会获取并校验本机 OS/CPU 对应的完整运行时（压缩包 SHA-256 和每个载荷文件），然后用隔离测试文档证明面板启动、原生编辑、保存、重开都正常，最后把 `workbuddy_openpencil` 条目**合并**写入 `~/.workbuddy/mcp.json`（不动其它服务器），并通过真实 MCP 握手校验画布工具。成功输出必须包含 `"ok": true`、`"registered": true` 和 `"hostCheck": { "ok": true, ... }`；任何前置条件、下载、冒烟测试或校验失败都不得报告成功。运行时发现阶段不下载任何东西。
3. **信任激活（小白必读）**：WorkBuddy 只有在用户手动信任后才会启用自定义 MCP 连接器。setup 完成后，让用户打开 WorkBuddy 的连接器管理，在自定义连接器里找到 `workbuddy_openpencil` 并点击「信任」，然后**新开一个对话**让画布工具加载。这一步无法自动完成——如实告诉用户怎么做，等确认后再继续设计。
4. 在 WorkBuddy 里调用 `canvas_open_browser`，把返回的 `panelUrl` 通过 WorkBuddy 内置浏览器预览打开（直接呈现 localhost 链接）。仅当用户明确要求时才用外部浏览器。调用 `canvas_status` 和 `get_editor_state` 确认同一个受管文档后再设计。编辑前先读已安装的 `openpencil-design` 技能和节点 schema。如果当前对话还没加载新注册的工具，先用仓库的持久终端入口立即开一块画布：

   ```sh
   npm run canvas
   # 已有文档（复制进恢复会话）：
   npm run canvas -- --file /absolute/path/design.op
   ```

   在持久终端/PTY 里运行并保持 stdin 打开，等它的 `ready: true` JSON 行。把 `panelUrl` 呈现给用户。它的随机 loopback URL 是临时的、仅本地的。该进程从 stdin 每行收一个 JSON 请求，所以代理可以在插件重连前就在**本对话**里完成设计：

   ```json
   {"method":"tools/list"}
   {"name":"get_editor_state","arguments":{}}
   {"name":"canvas_selection","arguments":{}}
   ```

   使用 `batch_design`、`update_node`、布局检查或渲染工具前，先检查返回的原生工具 schema。它们和可见画布用的是同一份 Rust 文档。每次写入都读结果；绝不自动重放失败或超时的变更。进程存活期间不要为同一设计再开第二块画布。原生截图结果写入私有图片文件并以 `imagePath` 返回，用图片查看器打开做视觉 QA。
5. 完成用户要求的设计，检查布局并预览，用 `canvas_save` 保存到绝对 `.op` 路径，再读回验证。除非用户要求多页，演示设计默认单页；实质性需求按设计技能的说明澄清页数。保留有用的画布进程，报告其面板 URL 和保存的文件。`{"quit":true}` 只关闭该会话；恢复草稿在进程关闭后仍在。
6. 分别说明当前对话用的是已注册的 MCP 连接器还是终端入口。WorkBuddy 可能需要重新信任或新开对话才能加载新装的工具；未经核实不得声称工具已出现在当前对话。重连后用 `canvas_open_browser` 加载保存的 `.op` 文件继续设计。

## 支持的运行时构建

| 系统 | CPU | 兼容底线 |
| --- | --- | --- |
| macOS | Apple Silicon、Intel | macOS 15 原生构建 |
| Windows | ARM64、x64 | MSVC 构建；Windows 11 ARM / Windows Server 2025 x64 |
| Linux | x64 | glibc，Ubuntu 22.04+ |
| Linux | ARM64 | glibc，Ubuntu 24.04+ |

Alpine/musl 与其它架构需要自定义完整运行时。不支持的平会明确报错；安装器绝不替换成别的二进制。

## 修复、更新与手动运行时

- 网络中断后重跑 `npm run setup`。已校验的缓存会被复用。
- 桌面端报 `No such file or directory` 而终端正常时，重跑 setup 刷新私有 Node 注册，再跑 `npm run host-check`。启动器读 `~/.workbuddy-openpencil/node-path`，与自定义运行时状态目录相互独立。它不改系统 PATH 或其它 Node 安装。host check 通过证明新连接能加载工具；重连后还要在当前对话里另行验证工具发现。
- 配置无效时先检查再动手。`npm run setup -- --repair-runtime` 显式选用已发布运行时。它保留上一个运行时目录；损坏的不可变缓存必须先移开再干净重试。
- `npm run setup -- --runtime-only` 只安装/校验运行时，不改 WorkBuddy 注册。
- `npm run configure-runtime -- /absolute/complete/runtime` 选择自定义运行时。正常安装与首次使用会保留已有有效选择。
- 更新：检查 checkout、拉取已发布变更、重跑 setup。受管下载跟随新钉住的 release；有效的自定义运行时保持不变。中断的升级保留上一个运行时和配置。升级后让用户重新信任自定义连接器或新开对话。只关画布标签页可能保留之前运行的 bridge 和 UI 资源。不要删无关设置。

运行时下载使用上游钉住的 GitHub Release 资产。私有配置在 `~/.workbuddy-openpencil/` 下；用 `OPENPENCIL_STATE_DIR` 覆盖位置。安装器冒烟测试绝不读写用户正在用的 OpenPencil 文档。

下载遵循 `HTTPS_PROXY` / `https_proxy`、`NO_PROXY` 和已启用的 macOS HTTPS 系统代理，不改系统设置。纯 SOCKS 环境应通过 `HTTPS_PROXY` 暴露 HTTP 代理端口。
