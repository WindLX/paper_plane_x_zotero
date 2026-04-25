# Paper Plane X Zotero Plugin

这个目录是 Paper Plane X 的 Zotero 插件工程，用来把 Zotero 文献条目和后端系统连接起来。

当前插件主要提供：

- 从 Zotero 条目向后端上传论文
- 拉取后端论文详情并显示在侧边栏
- 编辑 `quick_scan` / `synthesis_data` / `analysis_report`
- 同步项目关联信息

## 1. 开发依赖

- Zotero 7
- Node.js LTS
- npm

## 2. 本地开发

```bash
cd paper_plane_x_zotero
npm install
npm start
```

常用命令：

```bash
npm run build
npm test
```

## 3. 后端连接

插件通过首选项中的后端基础地址与 Paper Plane X 后端通信。

当前主要依赖：

- 后端 `/api/v1/papers`
- 后端 `/api/v1/projects`

如果插件能启动但无法同步，优先检查：

- 后端是否可访问
- 基础 URL 是否配置正确
- 条目是否存在本地 PDF

## 4. 代码结构

```text
src/
├── domain/paper/                 # 后端 Paper 数据模型与 mapper
├── features/paper/sidebar/       # 侧边栏 UI
├── features/paper/quickScanEditor/
│                                 # JSON 编辑器与校验
├── infra/zotero/                 # Zotero API 适配
└── features/preferences/         # 插件偏好设置
```

## 5. 当前维护重点

这个插件不是一个通用 Zotero 模板项目，后续文档和代码都以 Paper Plane X 真实功能为准。

也就是说：

- README 不再保留模板仓库的大段样例说明
- 以当前后端 API 和当前插件功能为主
- 新功能优先更新这里的使用说明，而不是依赖模板文档
