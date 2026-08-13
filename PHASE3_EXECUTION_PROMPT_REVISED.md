# Phase 3 执行提示词（修订版）：File Upload To R2

先完整阅读并严格遵循：
D:\报表展示页面\CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md
D:\报表展示页面\CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN_zh-CN.md
D:\报表展示页面\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md

只执行 Phase 3。禁止进入或提前实现 Phase 4 及以后内容：远程 dashboardState 导入/读取、页面数据源切换、IndexedDB/demo fallback 改动、在线编辑、PDF/Word/PPT 文本解析、搜索/Vectorize/AI 分析，或重写任何现有报表页。

> 后续已确认的范围修订：资料库只允许 admin/editor；viewer 不能访问资料库页面、文件夹/文件 API 或文件 metadata。所有原始上传文件均禁止下载。资料库类型扩展为 `.xlsx`、`.xls`、`.pdf`、`.docx`、`.pptx`；其中仅 Excel 供后续 admin 解析和发布看板，PDF/Word/PPT 仅供后续受控 AI 分析。本提示词仍不授权在 Phase 3 中实现解析、发布、下载、预览或 AI 功能。

## 0. 安全门和分支

本提示词补充并统一三份规划文档的 Phase 3 范围、实现细节和分支规则；发生冲突时，以更严格的安全、权限、私有存储和兼容性要求为准。

任何代码、配置、格式化、依赖或 tracked-file 修改前，依次运行：
git status --short --branch
git branch --show-current
git log --oneline -10

确认 Phase 0/1/2 存在，至少包含 files.html、src/filesPage.js、src/services/apiClient.js、用户管理/RBAC、folder API、authentication/authorization helper 和 0001/0002 migrations。

如果 working tree 不干净，停止开发。列出所有未提交文件与风险，等待用户明确选择提交、stash、丢弃，或明确接受继续风险。不得自动 stash、reset、checkout、覆盖用户改动，或把无关改动混入 Phase 3 commit。

working tree 干净后，必须从经确认的 Phase 2 基线新建 Phase 3 feature 分支，例如 feature/cloudflare-fullstack-storage-phase3-YYYYMMDD。不得在 main/master、来源不明的旧 feature 分支、或仅因名称相似的旧分支上继续开发。报告 source branch、source commit 和新分支名；无法确认 Phase 2 source commit 时停止。

## 1. 目标和范围

唯一目标：把用户上传的原始 Office 文件存入私有 R2，把 logical file 和版本 metadata 存入 D1。

实现：
GET /api/files?folderId=<id>
POST /api/files/upload
GET /api/files/:id
DELETE /api/files/:id
POST /api/files/:id/version

按当前项目实际的 .js/.ts 和 Pages Functions 结构实现，不创建重复实现。预期新增：
functions/api/files/index.js
functions/api/files/upload.js
functions/api/files/[id].js
functions/api/files/[id]/version.js
functions/lib/files.js
functions/lib/r2.js

预期修改：
src/filesPage.js
src/services/apiClient.js
src/styles/dashboard.css

除 Phase 3 必需的最小兼容改动外，不新增 migration、不重构 schema，也不改动 dashboardState、六个报表页、dashboardConfig、行结构或 local fallback。

## 2. DB/R2、安全 key 与私有边界

只使用 DB、FILES_BUCKET 和 MAX_UPLOAD_BYTES。不得硬编码或提交 R2 凭据、Cloudflare token、Access JWT、私钥或真实 INITIAL_ADMIN_EMAILS。FILES_BUCKET 缺失时返回安全且明确的 configuration error，例如 FILES_BUCKET binding is missing。

检查并复用既有 files、file_versions、audit_logs 和 helpers。文件 metadata response 使用 Cache-Control: no-store。所有 API、UI、state、error 和 log 禁止输出 public bucket URL、direct object URL、presigned URL、R2 key 或任何凭据。

R2 key 只能由服务端生成：
folders/{folderId}/files/{fileId}/v{version}/{safeFileName}

原始文件名存 D1 用于展示。服务端生成 safeFileName：Unicode 规范化，移除控制字符和路径分隔符，压缩不安全字符，限制长度，并保留合法扩展名。客户端不能决定完整 key、fileId、folderId 或 version。

## 3. 身份、RBAC、同源和审计

每个文件 API 复用既有 authentication、当前 D1 user/role lookup 和 authorization helper；不得复制 role 判断，也不得信任 uploadedBy、createdBy、userId、actor 或 role。

viewer 不得读取资料库列表、详情或文件 metadata；资料库页面与所有 `/api/folders*`、`/api/files*` 请求均为 403。
editor 可上传和上传版本；editor 归档为 403。
admin 可读取、上传、上传版本和归档。

所有 mutation（包括 multipart）执行同源 CSRF 检查：存在 Origin 时必须等于 request origin。前端隐藏按钮不是授权边界。

所有成功写操作以当前 D1 user id 写 audit_logs：file.create、file.version.create、file.archive。DELETE 只标记 status=archived，不删除 files/file_versions/R2 历史对象。

## 4. API 契约

GET /api/files?folderId=<id>：要求认证和有效、存在的 persisted folder id；空/非法为 400，不存在为 404。只返回 status 不等于 archived 的文件，稳定排序。返回至少包含 id、folderId、name、ext、mimeType、size、version、status、createdAt、updatedAt；绝不返回 R2 URL 或 R2 key。

GET /api/files/:id：认证后返回 { file, versions } metadata。versions 至少含 id、version、size、createdBy、createdAt；不含 R2 key、object URL 或下载内容；不存在为 404。

POST /api/files/upload：multipart/form-data，字段 folderId 和 file，只允许 admin/editor。根目录不是 D1 folder，files.folder_id 不可为空：根目录 UI 禁用/隐藏上传并引导进入或创建文件夹；服务端拒绝空 folderId。

写 R2 前服务端验证：multipart content type；file 存在且为 File；folderId 语法及 folder 存在；扩展名；大小；安全文件名；当前权限；同源请求。允许 .xlsx、.xls、.pdf、.docx、.pptx（大小写无关）。MAX_UPLOAD_BYTES 默认 20971520。服务器根据允许扩展名映射 MIME，绝不信任浏览器 file.type。客户端可以做 UX 校验，但服务端必须独立验证。

普通上传顺序：认证与当前 D1 role，校验，生成 fileId/version=1/safe key，写 R2，一个 D1 batch 原子写 files + file_versions + file.create audit，返回 201 { file }。R2 成功且 D1 batch 失败时，best-effort 删除刚写入的 object，返回原 D1 failure 的安全错误；cleanup 失败不能掩盖原错误，更不能报告成功。

POST /api/files/:id/version：仅 admin/editor；multipart 字段为 file。确认文件存在且不是 archived，归档文件返回 409。采用与上传相同的验证；保留历史 R2 objects 和 file_versions。成功时更新 files.version、r2_key、size、mime_type、status=uploaded、updated_at，并写 version row/audit。

必须处理并发：以当前 version 为 expected value，D1 update 使用 WHERE id = ? AND version = ? 或等价 CAS，并与 version row/audit 在一个 D1 batch。冲突时清理本次 R2 object，有限重试或返回 409；不得覆盖既有 object、重用成功 version 或把孤儿 object 当作成功。D1 写入失败时执行相同 cleanup。

DELETE /api/files/:id：仅 admin；editor/viewer 为 403。将 status 改为 archived，保留历史 R2/version。原子写 files 状态和 file.archive audit，成功返回 204 或明确 archive response。

统一错误：400 输入/表单非法、401 未认证、403 无权限或跨源、404 不存在、409 状态/版本冲突、413 超限、415 扩展名不支持、500 安全的内部/配置错误；不得泄露 stack、R2/D1 内部或凭据。

## 5. 前端和 API Client

在现有资料库 UI 上增量实现：当前 folder 文件列表显示 name、size、ext、status、updatedAt；admin/editor 在非根目录可上传；viewer 不显示资料库入口且不能渲染资料库页面；上传成功刷新列表；失败给安全清晰提示；admin 可归档；admin/editor 可新增有效文件版本；默认不显示 archived；不实现下载、公开链接、Office 预览或解析。

在 src/services/apiClient.js 集中封装 listFiles、uploadFile、getFile、uploadFileVersion、archiveFile。FormData 请求绝不手动设置 Content-Type，浏览器负责 multipart boundary；filesPage.js 不散落 raw fetch。

## 6. Cloudflare 验证边界

仅核对 DB、FILES_BUCKET、MAX_UPLOAD_BYTES，不编造或提交配置。真实 Preview/Production binding、Access 或资源不可用时，报告必须写：
Local/code-level validation passed.
Real Cloudflare D1/R2 verification pending manual Cloudflare configuration.

不得把代码路径检查说成真实云端验证通过。

## 7. 自检、提交和报告

实现后运行：
npm run build
git status --short
git diff --stat
git diff
git diff --cached

运行已有相关测试（如有），不为形式引入大型 test framework。检查：admin/editor 文件列表与上传；viewer 访问资料库列表、详情、上传和新版本均为 403；admin/editor 新版本；admin archive + audit；editor/viewer archive 403；缺失文件、非法 folder、非法扩展名、超限文件；R2 成功/D1 失败 cleanup code path。明确区分实际执行和仅代码路径审查。

Smoke check：index.html、table.html、search.html、analysis.html、product-analysis.html、target-analysis.html、files.html、users.html。

确认暂存区没有敏感配置，且仅含 Phase 3 文件后：
git add <Phase 3 files only>
git commit -m "Phase 3: add R2 file upload"

禁止 merge/push main/master，禁止进入 Phase 4。最终报告说明：修改前分支/working tree/Phase 2 source/new branch；新增/修改文件；每个 API 的 implemented/verified/pending；RBAC 实测；D1/R2/私有 URL 验证；build/smoke/security；待用户配置的 DB、FILES_BUCKET、R2、D1 migration、MAX_UPLOAD_BYTES、Access、Preview/Production；当前分支/commit/status；以及 v1/v2、RBAC/archive/audit、页面回归、无公开 R2 URL 的本地实机验证清单。

最后停止：
Phase 3 feature branch self-check is complete.
Please perform local real-machine verification.
No merge will be performed until you explicitly confirm that verification passed.
