# Paper Plane X Zotero 插件开发指南

## 作用域与工具链

- 本文件适用于 Zotero 插件独立仓库。若在 monorepo 中开发，同时遵循上级 `AGENTS.md`；冲突时以本文件的项目级规则为准。
- 本项目是兼容 Zotero 7–10 的 TypeScript 插件，使用 npm、`zotero-plugin-scaffold` 和 Zotero 测试环境。以 `package.json`、`package-lock.json`、TypeScript / ESLint / Prettier 配置、`zotero-plugin.config.ts`、本目录 `justfile` 和测试为事实源。
- 常用命令：`just setup`、`just dev`、`just test`、`just lint`、`just format-check`、`just build`、`just pre-commit`。依赖变化只使用 npm 更新 lockfile，不混用 pnpm 或 yarn。
- `just dev` 会启动外部 Zotero 实例，`release` 会产生发布行为或产物；仅在任务明确需要时运行。普通开发验证优先使用 lint、test 和 build。

## 插件生命周期与边界

- 注册菜单、列、面板、样式、observer、listener 和 window 资源时，必须有对应清理，并支持多窗口、窗口重复打开与插件关闭；不得把已销毁 window / document / item 引用保存在长生命周期全局状态中。
- Zotero API 和 DOM 是外部边界。使用现有 adapter / infra 层隔离平台调用，先验证可能失效的对象；不要把 Zotero global、window 或 toolkit 依赖扩散到领域模型和纯逻辑。
- domain 维护数据契约与映射，feature 组织用户用例，infra 适配 Zotero / HTTP / clipboard，shared UI 提供可复用原语。不要在 view renderer 中直接实现网络、持久化或批处理业务逻辑。
- HTTP 调用统一经过现有 API client，具有明确 timeout、错误映射和取消/失效处理；批量操作应隔离单项失败并向用户准确汇总，不静默忽略失败。
- 写入 Zotero item、Extra 字段、tag、preference 或后端数据前，必须保留与现有用户数据的兼容性，不覆盖无关字段。持久化格式变化需提供迁移或明确兼容策略及回归测试。

## TypeScript、UI 与本地化

- 核心路径不使用 `any`、无边界的类型断言、动态属性探测或无说明的 lint / typecheck 禁用。Zotero 无类型或不稳定 API 集中隔离，用明确 interface、type guard、discriminated union 和穷举分支收窄。
- 不使用宽泛 catch 后返回成功、空数据或旧状态。只在 Zotero、HTTP、JSON、clipboard 和生命周期边界转换错误，并让 UI 呈现可恢复操作与可定位信息。
- 用户可见文案同时维护 `en-US` 与 `zh-CN` Fluent 资源；遵循现有 message id 生成流程，不手改生成的 i18n typings。新增控件提供可访问名称、键盘操作、焦点行为和非颜色状态提示。
- 样式使用插件现有 CSS token 和组件原语，兼容 Zotero 亮色、暗色及常见密度；避免污染 host 全局样式，不向不受控 DOM 注入未清洗的 Markdown / HTML。
- 批处理、状态同步和结构化校验逻辑应保持确定性与可测试。核心数学、排序或非直观转换需注释输入假设，并在 `docs/` 中记录规则、兼容边界和验证方式。

## 测试与交付

- 领域映射、校验、元数据读写和纯逻辑添加单元测试；生命周期与 Zotero 集成变化使用现有 harness 覆盖注册、清理、多窗口或失效对象场景。外部 backend 使用 fake，不依赖真实论文库、profile、网络或开发者偏好。
- 小改动至少运行相关 `just test` 与 `just lint`；格式变化运行 `just format-check`；manifest、类型、资源、本地化、依赖或打包变化运行 `just build`。较大改动运行 `just pre-commit`。
- UI 变化在真实 Zotero 开发 profile 中检查目标平台的亮/暗主题和关键交互，并在交付说明中明确手工验证范围；无法启动 Zotero 时明确说明未做运行时 UI 验证。
- 不手改 `.scaffold/build/`、生成 typings、缓存、profile 或发布产物。不得声称未运行的验证已通过；失败需报告命令、失败项和与本次改动的关系。
- 跨 backend API 或 monorepo 发布契约的修改必须同步生产方、消费方、类型、测试、README 和版本协调脚本；不在插件侧用静默 fallback 隐藏协议不一致。
- Markdown 无新段落时不因行宽机械换行；不得在文档、日志、截图和 fixture 中泄露真实后端地址、凭据、Zotero profile 路径或受限论文内容。
