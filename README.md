# Paper Plane X for Zotero

[![Release](https://img.shields.io/github/v/release/WindLX/paper_plane_x)](https://github.com/WindLX/paper_plane_x/releases/latest)
[![Zotero](https://img.shields.io/badge/Zotero-7--10-CC2936.svg)](https://www.zotero.org/)
[![License](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](LICENSE)

Paper Plane X for Zotero 将 Zotero 文献库连接到 [Paper Plane X](https://github.com/WindLX/paper_plane_x)：你可以直接从 Zotero 上传论文、关联研究项目、查看处理状态，并在右侧信息面板中检查和校正结构化研究结果。

插件适用于希望保留 Zotero 文献管理习惯，同时使用 Paper Plane X 完成 PDF 解析、信息抽取、事实核查和跨论文研究的用户。

插件清单明确支持 Zotero 7、8、9 和 10。项目同步菜单同时适配 Zotero 10 的复数 collection selection API 与 Zotero 7 的旧接口。

## 功能概览

- 从条目右键菜单上传单篇或多篇带 PDF 附件的论文。
- 从任意可写 collection 的右键菜单，将一个 Paper Plane X 项目手工同步到该 collection。
- 将已上传论文批量关联到 Paper Plane X 项目。
- 在条目列表中显示后端处理状态。
- 在 Zotero 信息面板中同步、重试和检查分析结果。
- 编辑 `quick_scan`、`synthesis_data` 与 `analysis_report`，并写回后端。
- 支持简体中文和英文界面。

## 安装

### 从插件商店安装（推荐）

1. 打开 [Zotero 中文社区插件商店](https://zotero-chinese.github.io/plugins/)。
2. 搜索 **Paper Plane X**。
3. 按插件商店页面提示直接安装。
4. 返回 Zotero，按提示完成安装或重启。

这是普通用户最简单的安装方式。Zotero 中文社区插件商店是社区服务，并非 Zotero 官方网站。

### 手动安装 Release

1. 打开 [Paper Plane X 最新 Release](https://github.com/WindLX/paper_plane_x/releases/latest)。
2. 在 Assets 中下载 `.xpi` 插件文件。
3. 在 Zotero 中打开 **Tools → Plugins**（工具 → 插件）。
4. 点击右上角齿轮，选择 **Install Plugin From File**。
5. 选择下载的 `.xpi`，按提示完成安装或重启 Zotero。

插件清单包含 Paper Plane X monorepo Release 的自动更新地址。通过 Release 安装后，后续版本可由 Zotero 的插件更新机制检查。

### 配置后端

插件本身不运行论文解析服务。使用前请先启动 [Paper Plane X Backend](https://github.com/WindLX/paper_plane_x/tree/main/paper_plane_x_backend)，并确认 Zotero 能访问它。

进入 **Zotero Preferences → Paper Plane X**，在 **Service Base URL** 中填写后端根地址，例如：

```text
http://127.0.0.1:8000
```

不要添加 `/api/v1`，插件会自动拼接 API 路径。远程部署时建议使用 HTTPS，并避免将未配置访问保护的后端直接暴露到公网。

![Paper Plane X Zotero 设置](docs/assets/screenshots/zotero-settings.png)

## 推荐使用流程

1. 在 Paper Plane X Web 中创建项目，并完成 PDF 解析器和 LLM 配置。
2. 在 Zotero 中确认目标条目包含可访问的 PDF 附件。
3. 选择一个或多个条目，右键执行 **Upload to Paper Plane X**。
4. 等待条目列表的 **Paper Plane Status** 更新为完成状态。
5. 右键执行 **Link Paper to Project**，将论文关联到研究项目。
6. 在右侧 **Paper Plane X** 面板中检查 Quick Scan、Synthesis Data、Analysis Report 与 Fact Check。
7. 仅在人工确认内容后使用 **Update Metadata** 写回修改。

若要把 PPX 项目增补到 Zotero，在目标 collection 上右键选择 **从 Paper Plane X 项目同步到这里**，选择项目并确认。插件会递归检查目标 collection 及其所有子 collection，再检查同一 Zotero library；按 `paper_plane_id`、其次 DOI 复用条目，只补空缺元数据和缺失 PDF，不覆盖或删除已有内容。新增 PDF 的附件标题和实际文件名使用“文献标题 - 第一作者.pdf”；缺少作者时只使用标题，文件名会清理跨平台非法字符并安全截断。映射会保存，但同步只在用户手工触发时运行。若不再需要保存该映射，可在同一 collection 上右键选择 **取消与 Paper Plane X 项目的关联**；此操作只删除映射，不删除条目、PDF 或 collection 成员。

没有 PDF 附件的条目会被跳过；批量上传会显示进度和成功、失败、跳过数量。

## 界面与操作

### 右键菜单

| 操作     | 入口                        | 说明                                           |
| -------- | --------------------------- | ---------------------------------------------- |
| 上传论文 | **Upload to Paper Plane X** | 上传所选条目的 PDF；支持批量操作               |
| 关联项目 | **Link Paper to Project**   | 将已上传论文关联到选定的后端项目；支持批量操作 |

Collection 右键菜单还提供 **从 Paper Plane X 项目同步到这里**。同一项目重新选择 collection 时会更新保存的目标；重复同步不会重复创建已匹配条目或 PDF。存在映射时还会显示 **取消与 Paper Plane X 项目的关联**，经确认后移除当前 collection 的全部 PPX 项目映射。

### 条目状态列

条目列表中的 **Paper Plane Status** 列显示每篇论文的后端处理状态，例如 `COMPLETED` 或“尚未上传”，方便快速识别哪些论文已经进入 Paper Plane X 流水线。

![Zotero 条目列表状态列](docs/assets/screenshots/zotero-items.png)

### Paper Plane X 信息面板

选中条目后，右侧信息面板会显示 **Paper Plane X** 标签页。这是插件的主要工作区：

![Zotero Paper Plane X 信息面板](docs/assets/screenshots/zotero-sidebar.png)

| 操作                           | 作用                                 |
| ------------------------------ | ------------------------------------ |
| **Sync 同步**                  | 从后端拉取最新数据并刷新面板与状态列 |
| **Upload 上传**                | 上传当前条目的 PDF                   |
| **Retry 重试**                 | 请求后端重新执行解析流程             |
| **Update Metadata 更新元数据** | 将面板中人工修改的结构化字段写回后端 |

面板内容包括：

- **摘要**：`paper_id`、处理状态和后端消息；支持人工校正部分处理状态。
- **项目关联**：查看、添加或移除当前论文与后端项目的关联。
- **Quick Scan**：标签、判断、原因和快速摘要。
- **Synthesis Data**：研究缺口、方法、关键结果和综述摘要。
- **Analysis Report**：前置概念、核心公式、推导步骤和相关参考文献。
- **Fact Check**：抽取与分析阶段的事实核查结果，只读展示。

Quick Scan、Synthesis Data 和 Analysis Report 可通过 JSON 编辑器修改。编辑器提供行号、JSON 格式校验和 `Ctrl+S` 保存；无效 JSON 不会提交到后端。

## 数据与安全

- 执行上传时，插件会将条目的 PDF 和生成请求所需的元数据发送到你配置的 Paper Plane X Backend。
- 插件将 Paper Plane X 的论文 ID、状态和消息保存在 Zotero 条目元数据中，用于后续同步和展示。
- PPX 项目到 collection 的同步是单向增补操作，不会因为论文从 PPX 项目移除而删除 Zotero 条目、附件或 collection 成员。
- 结构化分析结果保存在后端，Zotero 面板通过 API 获取或更新这些内容。
- Service Base URL 应指向你信任的服务；处理敏感或受许可限制的论文前，请确认你有权上传和处理文件。
- 不要在 Issue、日志或截图中公开 API Key、私有后端地址或受限论文内容。

## 开发

### 环境要求

- Zotero 7–10
- Node.js 24
- npm
- `just`（可选，用于统一项目命令）

独立开发：

```bash
git clone https://github.com/WindLX/paper_plane_x_zotero.git
cd paper_plane_x_zotero
npm install
npm start
```

`npm start` 会启动开发用 Zotero 实例并启用热加载。常用检查：

```bash
npm run lint:check
npm test
npm run build
```

或使用项目统一命令：

```bash
just lint
just test
just build
just pre-commit
```

构建产物位于 `.scaffold/build/`。日常开发可在子仓库独立进行，但正式版本号和发布产物由 Paper Plane X monorepo 统一管理。

## 项目结构

```text
addon/                  Zotero manifest、界面资源、本地化和样式
src/domain/             论文领域模型与 API 契约
src/features/           上传、关联、状态列、侧栏和设置等功能
src/infra/              Zotero 与后端基础设施适配
test/                   单元测试
zotero-plugin.config.ts 构建、更新地址和 XPI 发布配置
```

## 贡献与 Pull Request

1. 从最新 `main` 创建范围明确的功能或修复分支。
2. 新增用户可见文本时，同时维护 `en-US` 和 `zh-CN` 本地化资源。
3. API 或元数据契约变化时，检查旧版条目的兼容性与失败提示。
4. 为领域映射、校验和数据持久化逻辑补充测试。
5. 用户流程或界面变化时更新 README 和截图。
6. 提交 PR 前运行 `just pre-commit`。

PR 描述应包含变更动机、用户影响、界面截图（如适用）、兼容性说明和验证命令。问题与功能建议请提交至 [GitHub Issues](https://github.com/WindLX/paper_plane_x_zotero/issues)。

如果变更发生在 monorepo 工作区，请先向 Zotero 子仓库提交 PR；子仓库合并后，再向 monorepo 提交更新 submodule commit 的 PR。这样可以保持组件历史和顶层发布引用清晰可追溯。

## 发布

插件版本由 Paper Plane X monorepo 根目录的 `VERSION` 统一管理。创建顶层 `vX.Y.Z` 标签后，GitHub Actions 会执行检查、构建 `.xpi` 与 `update.json`，并将它们上传到同一个 GitHub Release。

请勿在子仓库中单独修改版本或创建正式 Release。维护者应使用 monorepo 的版本同步与发布流程，确保后端、前端、CLI 和 Zotero 插件指向同一版本。

## License

Paper Plane X for Zotero 使用 [GNU Affero General Public License v3.0 or later](LICENSE)。提交代码即表示你同意按该许可证发布贡献。
