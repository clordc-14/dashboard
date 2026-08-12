# Phase 2 执行提示词修订附录

本附录与附件中的 Phase 2 执行提示词一起使用；如有冲突，本附录和附件中明确限定为 **Phase 2** 的规则优先于两份较早的全量实施计划。它不授权 Phase 3 或之后的工作。

## 1. 已修正的执行前提

1. 当前任务由用户明确提供、且仅用于审阅的未跟踪 `*.md` 实施文档，不属于来源不明的代码或配置变更。Codex 可保留它们、不暂存也不覆盖它们，并继续完成只读核对；所有其他未跟踪或已修改的文件仍按原提示词停止并要求用户选择。
2. 如果 `feature/cloudflare-fullstack-storage` 可证明包含完整 Phase 1、与当前 `main` 没有额外代码差异、未被废弃且无无关改动，则可继续使用它，即使它已被合并。若任一条件不满足，必须从已核验的 Phase 1 提交创建 `feature/cloudflare-fullstack-storage-phase2-v2`，不得从未经核验的 `main` 猜测基线。
3. 本附录不授权 `git add`、commit、push、合并、远程 D1 migration、生产数据修改或 R2 操作。

## 2. Phase 2 范围优先级

Phase 2 只能实现 RBAC、已登录用户管理、文件夹 CRUD、资料库文件夹界面及相关本地验证。较早方案中关于上传、文件列表/元数据、R2、Dashboard 导入、remote-first、在线编辑、搜索 API 或自动分析的描述，均延后到后续 Phase，不得因旧方案中的示例而提前实现。

特别是 `files.html` 在本阶段只展示和管理文件夹：不得出现上传、下载、文件版本、文件元数据读写或 R2 object 读写。

## 3. 必须补充的服务端安全规则

1. 所有写接口只接受同源 `application/json` 请求：当请求携带 `Origin` 时必须与请求 URL 的 origin 一致；不得开放跨域 CORS。该检查是 Access 与 RBAC 之外的写操作保护。
2. 所有接口统一使用参数绑定、JSON 错误结构和正确的 400/401/403/404/409/405 状态码；不得把数据库原始错误或 Access token 细节返回给浏览器。
3. `GET /api/users` 必须固定排序、限制页长（建议最大 50）、校验 `role` 和不透明 cursor，并以参数绑定实现 email/name 搜索；响应应包含 `users` 与可选的 `nextCursor`。
4. 文件夹名称必须在服务端 trim、限制长度、拒绝空值和控制字符。客户端不得提交或决定 `path`、`ownerId`、审计 actor 或当前角色。创建子文件夹前必须确认父级存在；根目录与子目录查询都应返回可靠的面包屑数据。
5. 删除文件夹前必须在服务端确认不存在子文件夹，也不存在任何 `files` 元数据记录。Phase 2 不删除或访问 R2；以任意文件记录阻止删除，比仅检查 active status 更符合现有外键关系并避免孤儿元数据。
6. 角色修改、文件夹创建、重命名和删除都必须写入 `audit_logs`；审计 actor 只能来自 `context.data.currentUser`，before/after JSON 要反映实际持久化值。
7. 角色更新与其审计日志必须在同一 D1 `batch()` 中完成。最后一位 admin 的保护必须在单条条件更新中再次判断，而不是只依赖先查询再更新，从而避免并发请求同时降级管理员。未发生实际修改时不得伪造审计事件。
8. 前端所有 API 返回的姓名、邮箱、文件夹名称必须先转义后插入模板；UI 控件隐藏只是体验，不是授权边界。

## 4. 认证与本地开发补充

1. `INITIAL_ADMIN_EMAILS` 只在首次写入 users 记录时决定默认角色；已存在 users 的 D1 role 永远优先，不能因后续环境变量变化被覆盖。
2. 仅 `ENVIRONMENT=development` 可使用开发身份 header 或 `DEV_USER_*`。Preview/Production 必须忽略这些输入并要求有效 Access JWT。
3. 任何真实邮箱不得进入源代码、migration、README、测试快照或示例响应。开发身份必须来自未提交的 `.dev.vars` 或请求头；没有配置时可使用运行时生成的保留域名身份。

## 5. 完成标准补充

在原有 build、migration 与 API 矩阵外，必须验证：

- 角色筛选、搜索、分页 cursor 的非法输入均被安全处理；
- 空白/非法文件夹名、缺失父级、含子目录或任意文件记录的删除请求均被拒绝；
- 非同源或非 JSON 的写请求被拒绝；
- 角色和文件夹的审计 before/after 与 actor 正确；
- 不新增任何 `/api/files/*`、`/api/dashboard/*` 或 `/api/dataset-rows/*` Phase 3+ 路由。

完成时须保留原提示词要求的 Cloudflare Dashboard 待办、Preview 后续步骤、Production 禁止项、未提交 Git 状态和建议 commit message。
