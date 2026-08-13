# Cloudflare 全栈存储改造实施计划（中文对照版）

> 状态：仅为计划文档。不要把本文档视为立即执行实现的授权。
> 适用项目路径：`D:\报表展示页面`。

本文档是 `CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md` 的中文对照执行版本，用于后续新对话按阶段实施。后续任何实现阶段开始前，Codex 必须同时阅读：

```text
D:\报表展示页面\CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md
D:\报表展示页面\CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN_zh-CN.md
D:\报表展示页面\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md
```

改造目标是把当前 Vite 纯前端项目升级为：

```text
Cloudflare Pages 静态前端
  + Cloudflare Pages Functions API
  + Cloudflare D1 结构化数据存储
  + Cloudflare R2 原始文件存储
  + Cloudflare Access 登录认证
```

必须保持现有以下页面可用：

```text
首页 index.html
表格页 table.html
搜索页 search.html
厂牌分析 analysis.html
品种分析 product-analysis.html
靶点分析 target-analysis.html
```

首要兼容边界是现有 `dashboardState` 数据结构：

```js
{
  meta: {},
  newsSections: [],
  tableSections: []
}
```

不得修改 `dashboardConfig.js` 中已有 section key，不得破坏现有 row 结构：

```js
{
  id: "...",
  values: {},
  fields: {},
  links: {}
}
```

远程 API 可以新增兼容字段，例如 `remoteId`，但不能删除、重命名、改变现有页面依赖的字段。

## 0. 已确认的资料库与文件使用规则（2026-08-13 修订）

本节是对本文档全部旧描述的最新约束；如角色、文件类型、文件访问或 Phase 4/5 规划与本节冲突，以本节为准。它不自动授权执行任何尚未获用户单独确认的后续 Phase。

1. 所有上传的原始文件都只保存在私有 R2，**任何角色均不能下载**。不得实现下载接口、公开 URL、预签名 URL 或向浏览器返回 R2 key；页面 PDF 导出不属于文件下载。
2. 资料库及其文件夹、文件、版本、归档和后续 AI 资料接口只允许 admin、editor 使用。viewer 不显示资料库入口，直接访问资料库页面或 `/api/folders*`、`/api/files*`、资料解析接口时必须被拒绝，且只能访问报表看板页面。
3. Excel（`.xlsx`、`.xls`）是唯一的看板数据源。admin 在后续解析/发布流程中核验并发布 Excel 的结构化数据；editor 可以沿用既有权限上传 Excel 或新版本，但不能发布全站看板数据。
4. PDF（`.pdf`）、Word（`.docx`）和 PPT（`.pptx`）只作为后续人工智能助手的受控分析资料，不自动解析进看板，也不自动发送给外部模型。资料文本提取、检索和提问时必须再次校验资料库权限。
5. 保持既有资料库操作边界：admin 管理用户、归档/永久删除文件和发布看板；editor 可创建/重命名文件夹、上传文件与新版本；viewer 不获得资料库只读权限。
6. admin、editor、viewer 均可导出当前已渲染的报表页面 PDF。导出内容只能是页面结构化数据和视觉结果，不能包含或链接任何原始上传文件。

---

## 1. 当前项目快照

计划阶段确认到的仓库信息：

```text
当前分支：main
远端仓库：https://github.com/clordc-14/dashboard.git
项目类型：Vite 多入口静态前端
构建命令：npm run build
构建输出：dist
```

当前页面入口：

```text
index.html
table.html
search.html
analysis.html
product-analysis.html
target-analysis.html
```

当前关键源码文件：

```text
src/main.js
src/tablePage.js
src/searchPage.js
src/analysisPage.js
src/productAnalysisPage.js
src/targetAnalysisPage.js
src/state/storage.js
src/config/dashboardConfig.js
src/config/demoWorkbookState.js
src/parser/excelParser.js
src/parser/sectionMatcher.js
src/parser/normalizer.js
```

当前数据流：

```text
用户上传 Excel
  -> src/main.js 通过 src/parser/excelParser.js 读取 workbook
  -> src/parser/sectionMatcher.js 匹配新闻板块和表格板块
  -> src/parser/normalizer.js 标准化数据
  -> src/state/storage.js 保存 dashboardState 到 IndexedDB/sessionStorage
  -> 各页面读取本地 dashboardState，失败时 fallback 到 demoWorkbookState
```

关键兼容观察：

```text
1. analysisPage.js、productAnalysisPage.js、targetAnalysisPage.js 高度依赖 tableSections 中的 innovativeDrugPool、drugScore 等 key。
2. tablePage.js 依赖 table row 中的 values、fields、links。
3. searchPage.js 会检索 newsSections[].items 和 tableSections[].rows。
4. demoWorkbookState.js 必须保留，作为最终兜底数据。
5. src/state/storage.js 必须保留，作为本地缓存 fallback。
```

---

## 2. 本文档的非执行规则

本文档只是后续实现的交接计划，不代表现在开始执行改造。

后续实现对话必须先做以下动作：

```text
1. 阅读本文档。
2. 阅读英文计划文档。
3. 阅读 Downloads 中的原始框架调整文档。
4. 在任何代码修改前运行 git status --short --branch。
5. 在代码修改前创建全新的 feature 分支。
6. 只执行用户本次明确要求的 phase 或 phase 范围。
```

如果未来用户只说“执行 Phase N”，则只实现 Phase N，不自动继续后续 phase。

---

## 3. Git 分支策略与合并保护

### 3.1 修改前必须检查

任何代码或 tracked 文件修改前，必须运行：

```bash
git status --short --branch
git branch --show-current
```

如果工作区不干净，Codex 必须停止并说明风险。不得覆盖或静默吸收用户未提交改动。只能建议用户选择：

```text
1. 先提交现有修改。
2. 先 stash 现有修改。
3. 只有用户明确要求时才放弃现有修改。
4. 用户明确接受风险后才继续。
```

### 3.2 创建 feature 分支

本次改造不得直接在 `main` 或 `master` 上实现。

必须按以下流程：

```bash
git checkout main
git pull origin main
git checkout -b feature/cloudflare-fullstack-storage
```

如果 `feature/cloudflare-fullstack-storage` 已存在，不要盲目复用。创建新的分支名，例如：

```bash
git checkout -b feature/cloudflare-fullstack-storage-v2
git checkout -b feature/cloudflare-fullstack-storage-20260701
```

### 3.3 每个阶段独立提交

每个 phase 应单独提交，便于 review 和回滚：

```bash
git add .
git commit -m "Phase 1: add Cloudflare backend foundation"
```

不要把 Phase 1 到 Phase 6 混成一个巨大提交。

### 3.4 禁止自动合并

Codex 自检通过后，必须停下来提示用户进行本地实机验证。

没有收到用户明确确认“本地实机验证通过，可以合并”之前，不得执行：

```bash
git merge
git push origin main
```

也不得合并 GitHub Pull Request。

可接受的用户确认示例：

```text
本地实机验证通过，可以合并到 main。
我已经本地验证过了，可以 merge。
```

### 3.5 用户批准后的合并方式

推荐 GitHub Pull Request 流程：

```text
1. push feature 分支。
2. 创建 Pull Request。
3. 等待 Cloudflare Preview Deployment 或 CI。
4. 用户在本地和/或 preview 环境验证。
5. 用户明确批准合并。
6. 合并 PR。
```

如果用户明确要求本地 merge：

```bash
git checkout main
git pull origin main
git merge --no-ff feature/cloudflare-fullstack-storage
git push origin main
```

合并后如果发现问题，优先使用：

```bash
git revert <merge_commit_id>
```

不要 force push，除非用户明确同意改写历史。

---

## 4. Cloudflare 控制台手动配置清单

以下内容需要用户在 Cloudflare Dashboard 中创建或确认。Codex 不得默认它们已经存在。

### 4.1 Pages Project

在 Cloudflare Dashboard 中：

```text
Workers & Pages -> Create application -> Pages -> Connect to Git
```

确认：

```text
Repository: clordc-14/dashboard
Production branch: main
Build command: npm run build
Build output directory: dist
```

如果 Pages project 已存在，也要确认上述配置一致。

### 4.2 D1 Database

建议创建 production D1 database：

```text
sinopharm-new-drug-dashboard-prod
```

建议另建 preview/development D1 database：

```text
sinopharm-new-drug-dashboard-preview
```

`wrangler.toml` 中的值来源：

```text
database_name: Cloudflare Dashboard 中显示的 D1 数据库名称
database_id: D1 数据库详情页中的 UUID，或 wrangler d1 create/list 返回的 id
binding: DB
```

### 4.3 R2 Bucket

建议创建 production R2 bucket：

```text
sinopharm-new-drug-files
```

建议另建 preview/development R2 bucket：

```text
sinopharm-new-drug-files-preview
```

`wrangler.toml` 中的值来源：

```text
bucket_name: R2 bucket 名称
binding: FILES_BUCKET
```

R2 bucket 必须保持 private。不要把原始文件暴露为无需鉴权的公开 URL。

### 4.4 Pages Bindings

在 Pages project settings 中，为 Preview 和 Production 分别配置：

```text
D1 database binding:
  Variable name: DB
  Database: 对应环境的 D1 database

R2 bucket binding:
  Variable name: FILES_BUCKET
  Bucket: 对应环境的 R2 bucket
```

### 4.5 环境变量

Production：

```text
ENVIRONMENT=production
ACCESS_TEAM_DOMAIN=https://<team-name>.cloudflareaccess.com
ACCESS_AUD=<Cloudflare Access AUD tag>
MAX_UPLOAD_BYTES=20971520
INITIAL_ADMIN_EMAILS=<用逗号分隔的初始管理员 Access 邮箱；不提交真实值>
```

Preview：

```text
ENVIRONMENT=preview
ACCESS_TEAM_DOMAIN=https://<team-name>.cloudflareaccess.com
ACCESS_AUD=<preview 或共用 Access AUD tag>
MAX_UPLOAD_BYTES=20971520
INITIAL_ADMIN_EMAILS=<对应 Preview 的初始管理员 Access 邮箱；不提交真实值>
```

本地开发可使用 `.dev.vars`：

```text
ENVIRONMENT=development
DEV_USER_EMAIL=dev@example.com
DEV_USER_NAME=Local Developer
DEV_USER_ROLE=admin
MAX_UPLOAD_BYTES=20971520
```

不得提交 token、API key、Access secret、R2 credentials 等敏感信息。`database_id` 属于配置值，不是密钥。

`INITIAL_ADMIN_EMAILS` 只用于首次创建 users 记录时引导出管理员；后续角色只以 D1 为准。它不能替代 Cloudflare Access policy，也不能让未获 Access 准入的用户登录。

### 4.6 Cloudflare Access

需要保护：

```text
Production custom domain: https://<your-domain>/*
Pages project domain: https://<project>.pages.dev/*
如果使用 preview deployment 域名，也应保护 preview 域名
```

允许访问的用户通过 Access policy 配置：

```text
指定邮箱、公司邮箱域名或 Cloudflare Access group
```

Pages Functions 在非 development 环境仍必须校验 `Cf-Access-Jwt-Assertion`。边缘 Access 保护不能替代 API 内部校验。

### 4.7 D1 Migrations

本地：

```bash
npx wrangler d1 migrations apply DB --local
```

Preview：

```bash
npx wrangler d1 migrations apply DB --preview
```

Production：

```bash
npx wrangler d1 migrations apply DB --remote
```

生产迁移前必须确认目标 DB。如果 DB 已有重要数据，应先备份或导出。

### 4.8 部署后 API 验证

部署后按以下顺序验证：

```text
1. 打开受保护站点并完成 Cloudflare Access 登录。
2. GET /api/auth/me 返回 Access 用户和 D1 角色。
3. 确认 INITIAL_ADMIN_EMAILS 中至少一名首次登录用户为 admin；用 admin 将已登录用户改为 editor/viewer，确认 audit_logs 有记录。
4. 创建文件夹，确认 D1 folders 表中出现记录。
5. 上传小 Excel 文件，确认：
   - R2 中存在 object
   - D1 files 和 file_versions 中存在记录
6. 导入 dashboardState，确认 /api/dashboard/latest 返回 meta/newsSections/tableSections。
7. 确认 R2 文件无法通过未鉴权公开 URL 访问。
```

---

## 5. 目标架构

```text
Browser
  -> Cloudflare Pages 静态 Vite 应用
  -> /api/* Pages Functions
  -> Auth middleware 校验 Cloudflare Access JWT
  -> D1 保存用户、文件夹、文件元数据、datasets、rows、audit logs
  -> R2 保存原始 Excel/Word/PPT 文件和历史版本
```

MVP 职责分工：

```text
Frontend:
  - 保持当前页面和 UI 可用。
  - 继续优先使用现有 Excel 前端解析。
  - 在需要时上传原始文件。
  - 把解析后的 dashboardState 提交给后端。
  - 优先读取远程 dashboardState，失败时走本地 fallback。

Pages Functions:
  - 认证用户。
  - 执行业务角色权限。
  - 把元数据和结构化 rows 存到 D1。
  - 把原始文件存到 R2。
  - 重建 dashboardState 兼容响应。
  - 记录在线编辑审计日志。
```

---

## 6. API 设计

### 6.1 Auth

```text
GET /api/auth/me
```

响应：

```json
{
  "user": {
    "id": "usr_xxx",
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin"
  }
}
```

行为：

```text
development: 允许 dev fallback user
preview/production: 必须有有效 Cloudflare Access JWT
D1 users 表决定最终业务角色
未知 Access 用户：MVP 默认插入为 viewer，或根据实现选择返回 403
```

MVP 推荐默认：

```text
通过 Access 认证但 D1 中不存在的用户，自动插入 users 表，role=viewer。
在 Phase 2 前可通过受控 D1 运维操作恢复角色；Phase 2 起由 admin 在用户管理 UI 中分配角色。
```

### 6.2 用户与角色管理

角色模型：

```text
Cloudflare Access：决定用户能否到达应用。
D1 users.role：决定已登录用户在应用内可执行的操作。

admin：管理用户角色、所有文件夹和文件、Excel 解析/发布、在线编辑与删除操作。
editor：创建/重命名文件夹、上传及新增文件版本；不能管理用户角色、归档/删除文件或发布看板数据。
viewer：只能查看已发布的报表、表格、搜索与分析结果，以及导出当前页面 PDF；不能访问资料库或文件元数据。
```

用户生命周期与安全规则：

```text
1. Access 用户首次访问时自动创建 D1 users 记录；默认 role=viewer。
2. 首次创建时，email 在 INITIAL_ADMIN_EMAILS 中的用户得到 admin；真实邮箱只在 Cloudflare 环境变量中配置。
3. 用户管理页只列出已经通过 Access 登录、因而已存在 D1 记录的用户；MVP 不提供绕过 Access 的邀请或创建账号能力。
4. 只有 admin 可以改变角色。服务端必须校验角色白名单，不能信任前端输入。
5. admin 不能修改自己的角色，且不能降级或移除最后一名 admin。
6. 每次成功的角色变更写入 audit_logs，记录操作者、目标用户、before_json、after_json 和时间。
7. 每个 API 请求都从 D1 读取当前角色，因此角色变更在下一次请求立即生效；前端只负责刷新 UI，不能作为权限依据。
```

Phase 2 API：

```text
GET   /api/users?query=<email-or-name>&role=<role>&cursor=<cursor>
PATCH /api/users/:id/role
```

`PATCH /api/users/:id/role` 请求与响应：

```json
{ "role": "editor" }
```

```json
{
  "user": {
    "id": "usr_xxx",
    "email": "user@example.com",
    "name": "User Name",
    "role": "editor",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-02T00:00:00.000Z",
    "roleUpdatedAt": "2026-01-02T00:00:00.000Z"
  }
}
```

### 6.3 Folders

```text
GET    /api/folders?parentId=<id|null>
POST   /api/folders
PATCH  /api/folders/:id
DELETE /api/folders/:id
```

创建请求：

```json
{
  "parentId": null,
  "name": "2026创新药资料"
}
```

规则：

```text
viewer: 403，不得读取资料库文件夹
editor/admin: 可创建、重命名
delete: 仅 admin，且只能删除无子文件夹、无 active 文件的空文件夹
```

### 6.4 Files

```text
GET    /api/files?folderId=<id>
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
POST   /api/files/:id/version
```

上传请求：

```text
multipart/form-data
  folderId=<folder id>
  file=<xlsx/xls/docx/pptx>
```

上传响应：

```json
{
  "file": {
    "id": "file_xxx",
    "folderId": "fld_xxx",
    "name": "report.xlsx",
    "ext": "xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "size": 12345,
    "version": 1,
    "status": "uploaded",
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
}
```

R2 key 格式：

```text
folders/{folderId}/files/{fileId}/v{version}/{safeFileName}
```

MVP 支持扩展名：

```text
.xlsx
.xls
.pdf
.docx
.pptx
```

Phase 4 只需要 `.xlsx` / `.xls` 支持 dashboard import。

### 6.5 Dashboard

```text
POST /api/dashboard/import
GET  /api/dashboard/latest
```

导入请求：

```json
{
  "fileId": "file_xxx",
  "dashboardState": {
    "meta": {},
    "newsSections": [],
    "tableSections": []
  }
}
```

Latest 响应必须保持兼容：

```json
{
  "meta": {
    "mode": "remote",
    "updatedAt": "2026-07-01T00:00:00.000Z",
    "recognizedNewsSections": 0,
    "recognizedTableSections": 0,
    "warnings": []
  },
  "newsSections": [],
  "tableSections": []
}
```

规则：

```text
POST 需要 admin/editor。
GET 需要已认证用户。
GET 在没有远程 dashboard 时返回 404，让前端 fallback。
rows/items 新增 remoteId，同时保留原 id/values/fields/links。
```

### 6.6 Dataset Rows

```text
PATCH /api/dataset-rows/:id
```

请求：

```json
{
  "data": {
    "values": {},
    "fields": {},
    "links": {}
  }
}
```

规则：

```text
仅 admin/editor 可调用。
读取旧 data_json。
合并兼容 row shape。
写入新的 data_json。
写 audit_logs 的 before_json 和 after_json。
返回更新后的 row。
```

响应：

```json
{
  "row": {
    "id": "innovativeDrugPool-1",
    "remoteId": "row_xxx",
    "values": {},
    "fields": {},
    "links": {}
  }
}
```

---

## 7. D1 Migration 设计

新增：

```text
migrations/0001_initial_schema.sql
```

必须包含以下表：

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(parent_id) REFERENCES folders(id),
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ext TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(folder_id) REFERENCES folders(id),
  FOREIGN KEY(uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dashboard_imports (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  imported_by TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(imported_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  import_id TEXT,
  file_id TEXT,
  section_key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  source_json TEXT,
  columns_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(import_id) REFERENCES dashboard_imports(id),
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS dataset_rows (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  row_type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(dataset_id) REFERENCES datasets(id)
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  sheet_name TEXT,
  slide_no INTEGER,
  page_no INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

索引：

```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_imports_current ON dashboard_imports(is_current, created_at);
CREATE INDEX IF NOT EXISTS idx_datasets_import_id ON datasets(import_id);
CREATE INDEX IF NOT EXISTS idx_datasets_file_id ON datasets(file_id);
CREATE INDEX IF NOT EXISTS idx_datasets_section_key ON datasets(section_key);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_section_key ON dataset_rows(section_key);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_row_type ON dataset_rows(row_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_file_id ON document_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
```

---

## 8. 分阶段实施计划

### Phase 0：安全基线

目标：

```text
创建安全实现分支，并在改代码前确认 baseline build。
```

文件改动：

```text
无。
```

命令：

```bash
git status --short --branch
git checkout main
git pull origin main
git checkout -b feature/cloudflare-fullstack-storage
git branch --show-current
npm install
npm run build
```

Codex 自检：

```text
1. 当前分支不是 main/master。
2. npm run build 通过。
3. 现有六个 Vite entry 仍存在。
4. 未修改业务逻辑。
5. 已确认 admin/editor/viewer 权限矩阵、初始管理员邮箱的配置责任人，以及 Access policy 与应用角色的边界。
```

用户本地验证：

```text
1. 确认 feature 分支名。
2. 运行 npm install。
3. 运行 npm run build。
4. 确认 main/master 没有被直接修改。
```

提交：

```text
通常不需要提交，除非 npm install 导致 package-lock 变化。
```

---

### Phase 1：Cloudflare 后端基础

目标：

```text
新增 Cloudflare Pages Functions 基础、auth middleware、D1 schema 和 /api/auth/me。
```

文件改动：

```text
新增：
  wrangler.toml
  migrations/0001_initial_schema.sql
  functions/_middleware.js
  functions/api/auth/me.js
  functions/lib/auth.js
  functions/lib/db.js
  functions/lib/http.js

修改：
  package.json
  package-lock.json
```

依赖：

```text
wrangler 作为 devDependency
jose 用于 Access JWT 校验
如不使用 crypto.randomUUID()，则加入 nanoid
```

实现要点：

```text
1. MVP 先使用 .js Pages Functions，避免额外 TypeScript 配置。
2. Middleware 把认证用户挂到 request context。
3. ENVIRONMENT=development 时允许 dev fallback。
4. ENVIRONMENT=preview/production 时必须校验 Cloudflare Access JWT。
5. users 表决定用户 role。
6. 未知 Access 用户默认插入 viewer；INITIAL_ADMIN_EMAILS 仅在首次创建用户时引导 admin，后续以 D1 role 为准。
7. /api/auth/me 返回标准化 current user。
```

`wrangler.toml` 初始占位：

```toml
name = "sinopharm-southwest-new-drug-dashboard"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "sinopharm-new-drug-dashboard-prod"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[r2_buckets]]
binding = "FILES_BUCKET"
bucket_name = "sinopharm-new-drug-files"
```

API：

```text
GET /api/auth/me
```

Codex 自检：

```text
1. npm run build 通过。
2. npx wrangler pages dev dist 可本地启动。
3. development 环境下 GET /api/auth/me 返回 dev user。
4. production/preview 路径在缺少 Access JWT 时拒绝访问。
5. 初始管理员仅来自环境变量，不存在硬编码真实邮箱。
6. 没有提交 secret。
```

用户本地验证：

```text
1. 启动本地 Pages dev。
2. 打开 /api/auth/me。
3. 确认 dev user 响应。
4. Cloudflare 配置完成后，确认真实 Access 用户 email 和 D1 role。
```

提交：

```bash
git add .
git commit -m "Phase 1: add Cloudflare backend foundation"
```

---

### Phase 2：RBAC、文件夹 API、资料库与用户管理页面

目标：

```text
新增可视化角色分配、服务端 RBAC、folders CRUD API 和资料库 UI，不改动现有分析逻辑。
```

文件改动：

```text
新增：
  functions/api/folders/index.js
  functions/api/folders/[id].js
  functions/api/users/index.js
  functions/api/users/[id]/role.js
  functions/lib/authorization.js
  functions/lib/audit.js
  migrations/0002_user_management.sql
  src/services/apiClient.js
  files.html
  src/filesPage.js
  users.html
  src/usersPage.js

修改：
  functions/lib/auth.js
  functions/lib/db.js
  vite.config.js
  src/main.js
  src/styles/dashboard.css
```

前端要点：

```text
1. 首页 topbar 增加“资料库”入口；仅 admin 额外看到“用户管理”入口。
2. users.html 是紧凑的管理表格，显示姓名/邮箱、当前角色、创建时间、最近角色更新时间和操作。
3. 管理员通过每行角色选择器和确认对话框将既有 Access 用户设为 admin、editor 或 viewer；不提供应用内邀请。
4. 当前管理员自身的角色选择器禁用；最后一名 admin 的降级操作也必须在服务端返回 409。
5. files.html 展示文件夹列表和面包屑；viewer 只读，editor/admin 可创建和重命名，只有 admin 可见删除操作。
6. UI 只用于表达权限，所有写操作必须由 Functions 的 requireRole/requireAdmin 再次校验。
```

API：

```text
GET    /api/folders?parentId=<id|null>
POST   /api/folders
PATCH  /api/folders/:id
DELETE /api/folders/:id
GET    /api/users?query=<email-or-name>&role=<role>&cursor=<cursor>
PATCH  /api/users/:id/role
```

角色 API 与迁移：

```text
1. 0002_user_management.sql 新增 users.role_updated_at、users.role_updated_by 和 idx_users_role；已有 users 数据必须保持可读。
2. PATCH 仅接受 admin/editor/viewer，要求当前操作者为 admin。
3. 拒绝操作者修改自身角色，拒绝将最后一名 admin 改为非 admin。
4. 角色变更同时更新 role_updated_at、role_updated_by、updated_at，并与 audit_logs 写入使用同一 D1 batch/事务边界，避免成功改角色却缺少审计。
5. folders 的创建、重命名和删除使用同一 authorization helper，而不是在各 endpoint 复制判断。
```

Codex 自检：

```text
1. npm run build 通过；/files.html 与 /users.html 已进入 Vite build。
2. admin 可以搜索已登录用户，并将 viewer 改为 editor，再刷新确认角色持久化。
3. editor/viewer 请求 PATCH /api/users/:id/role 返回 403。
4. admin 不能修改自身角色；最后一名 admin 不能被降级，返回 409。
5. admin/editor 可以创建 folder；viewer 不能创建或删除；editor 不能删除。
6. 每次角色变更都有正确的 audit_logs before/after 记录。
7. 现有六个页面仍可构建和渲染。
```

用户本地验证：

```text
1. 以 bootstrap admin 登录，打开“用户管理”，确认只看到已经 Access 登录过的用户。
2. 将一个 viewer 改为 editor，并分别以该用户和 viewer 重新登录验证界面与 API 权限。
3. 验证不能自我降权，也不能移除最后一名 admin。
4. 打开资料库，创建文件夹、进入子文件夹，并验证 viewer/editor/admin 的操作差异。
```

提交：

```bash
git add .
git commit -m "Phase 2: add RBAC management and library page"
```

---

### Phase 3：文件上传到 R2

目标：

```text
把原始上传文件存入 R2，把文件元数据存入 D1。
```

文件改动：

```text
新增：
  functions/api/files/index.js
  functions/api/files/upload.js
  functions/api/files/[id].js
  functions/api/files/[id]/version.js
  functions/lib/files.js
  functions/lib/r2.js

修改：
  src/filesPage.js
  src/services/apiClient.js
  src/styles/dashboard.css
```

API：

```text
GET    /api/files?folderId=<id>
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
POST   /api/files/:id/version
```

实现要点：

```text
1. R2 写入前校验扩展名和大小。
2. 使用 MAX_UPLOAD_BYTES，默认 20 MB。
3. 生成安全 R2 key。
4. 先写 R2，再写 D1 metadata。
5. 如果 D1 写入失败，尝试 best-effort 清理 R2，并返回明确错误。
6. 不暴露公开 R2 URL。
7. MVP 中 DELETE 优先做归档，除非用户明确要求硬删除。
8. 所有文件 API 复用 Phase 2 的 authorization helper：viewer 只读，editor/admin 可上传和新增版本，只有 admin 可归档/删除。
9. uploaded_by、版本创建者与审计记录使用当前 D1 user id，不能接受客户端传入的用户身份。
```

Codex 自检：

```text
1. npm run build 通过。
2. files.html 出现上传 UI。
3. 上传小文件后 D1 files 和 file_versions 有记录。
4. R2 object 存在。
5. 文件列表返回 name、size、ext、status、updatedAt。
6. 没有暴露无需鉴权的 R2 URL。
7. viewer 上传和 editor 删除分别返回 403；admin 的删除/归档产生 audit_logs。
```

用户本地验证：

```text
1. 在某个文件夹上传小 Excel。
2. 确认资料库页面显示该文件。
3. 确认 D1 metadata。
4. 在 Cloudflare Dashboard 确认 R2 object。
5. 分别以 viewer、editor、admin 验证上传、新版本和删除权限边界。
```

提交：

```bash
git add .
git commit -m "Phase 3: add R2 file upload"
```

---

### Phase 4：远程 dashboardState 导入

目标：

```text
把解析后的 dashboardState 持久化到 D1，并为现有页面重建远程 dashboardState。
```

文件改动：

```text
新增：
  src/parser/buildDashboardState.js
  functions/api/dashboard/import.js
  functions/api/dashboard/latest.js
  functions/lib/dashboardState.js

修改：
  src/main.js
  src/services/apiClient.js
```

前端要点：

```text
1. 从 src/main.js 中提取 buildDashboardState(workbook) 到 src/parser/buildDashboardState.js。
2. 首页上传仍在浏览器内解析 Excel。
3. 继续把解析结果保存到本地 IndexedDB。
4. 如果用户已认证且 API 可用，把 dashboardState POST 到 /api/dashboard/import。
5. 远程 import 失败不得影响本地解析成功。
6. import/发布只允许 admin；导入者和导入摘要写入 audit_logs，客户端不能指定 imported_by。
```

API：

```text
POST /api/dashboard/import
GET  /api/dashboard/latest
```

D1 映射：

```text
dashboard_imports:
  每次导入一条记录，只允许一个 current import

datasets:
  每个 news/table section 一条记录
  保存 section_key、title、type、source_json、columns_json

dataset_rows:
  每条 news item 或 table row 一条记录
  data_json 保存兼容 item/row JSON
```

重建规则：

```text
1. latest 查找 current dashboard_import。
2. 按 section 顺序加载 datasets。
3. news datasets 重建 { key,title,type,source,items }。
4. table datasets 重建 { key,title,type,source,columns,rows }。
5. items/rows 增加 remoteId。
6. 保留原 id/values/fields/links。
7. meta.mode 设置为 "remote"。
```

Codex 自检：

```text
1. npm run build 通过。
2. buildDashboardState export 返回与原 inline 函数一致的 shape。
3. POST import 可导入 demo 或解析后的 state。
4. GET latest 返回兼容 sections。
5. 导入源含有 innovativeDrugPool 和 drugScore 时，latest 中仍有这些 key。
6. 本地 IndexedDB fallback 仍可用。
7. viewer/editor POST import 均返回 403；admin 的导入记录包含正确操作者审计。
```

用户本地验证：

```text
1. 上传 Excel。
2. 确认现有页面更新。
3. 刷新页面，确认可加载远程 dashboard。
4. 确认首页、表格、搜索、厂牌分析、品种分析、靶点分析仍可用。
```

提交：

```bash
git add .
git commit -m "Phase 4: persist dashboard state remotely"
```

---

### Phase 5：页面数据源 fallback

目标：

```text
让现有所有页面优先读取远程数据，同时保留 IndexedDB/sessionStorage/demo fallback。
```

文件改动：

```text
新增：
  src/state/dashboardState.js

修改：
  src/main.js
  src/tablePage.js
  src/searchPage.js
  src/analysisPage.js
  src/productAnalysisPage.js
  src/targetAnalysisPage.js
```

新增客户端 helper：

```js
loadDashboardStateWithFallback()
```

fallback 顺序：

```text
1. GET /api/dashboard/latest
2. src/state/storage.js 中的 IndexedDB/sessionStorage
3. demoWorkbookState
```

行为：

```text
1. API 404 表示无远程数据，使用本地 fallback。
2. API 401/403 绝不能被 fallback 当作权限绕过：受保护的用户管理、文件夹、文件、导入和编辑操作必须保留拒绝状态；只有本来允许展示的只读分析页才可按产品策略显示本地/demo 数据。
3. API 500/network failure 使用本地/demo，并输出 warning。
4. 不允许仅因远程数据失败导致空白页。
```

Codex 自检：

```text
1. npm run build 通过。
2. API 成功时六个页面都可渲染。
3. API 404 时六个页面都可渲染。
4. API 报错时六个页面都可渲染。
5. 控制台无未处理 promise rejection。
6. 403 时不显示任何本不属于当前角色的写操作，也不调用会改变远程数据的 fallback。
```

用户本地验证：

```text
1. API 运行时测试。
2. API 不可用时测试。
3. 确认远程数据可用时优先显示远程数据。
4. 确认本地/demo fallback 仍可用。
```

提交：

```bash
git add .
git commit -m "Phase 5: load remote dashboard state with fallback"
```

---

### Phase 6：在线编辑表格行

目标：

```text
允许 admin/editor 在线编辑表格行，并把编辑后的 row JSON 持久化到 D1。
```

文件改动：

```text
新增：
  functions/api/dataset-rows/[id].js

修改：
  functions/lib/audit.js
  src/tablePage.js
  src/services/apiClient.js
  src/styles/dashboard.css
```

API：

```text
PATCH /api/dataset-rows/:id
```

请求：

```json
{
  "data": {
    "values": {},
    "fields": {},
    "links": {}
  }
}
```

实现要点：

```text
1. 仅 admin/editor 可编辑。
2. 读取当前 dataset_rows.data_json。
3. 合并兼容 row data，不丢弃 id/remoteId。
4. 更新 dataset_rows.data_json 和 updated_at。
5. 写 audit_logs，包含 before_json 和 after_json。
6. 返回更新后的 row。
7. 每次请求重新从 D1 获取 role；角色在 Phase 2 被管理员修改后不依赖浏览器缓存继续授权。
```

前端要点：

```text
1. tablePage.js 调用 /api/auth/me 判断 role。
2. admin/editor 对带 remoteId 的 rows 可看到编辑操作。
3. viewer 只读。
4. 没有 remoteId 的本地/demo rows 只读。
5. 保存后更新当前内存中的 dashboardState，使用户立即看到变化。
6. 取消编辑时恢复原 row。
```

Codex 自检：

```text
1. npm run build 通过。
2. admin/editor 可以编辑并保存一行。
3. 刷新后显示修改值。
4. audit_logs 有 before/after JSON。
5. viewer PATCH 返回 403。
6. 无 remoteId 的 rows 不能编辑。
```

用户本地验证：

```text
1. 以 editor/admin 登录。
2. 编辑一条表格行。
3. 刷新并确认持久化。
4. 打开首页/搜索/分析页，确认兼容。
5. 测试 viewer role，确认不能编辑。
```

提交：

```bash
git add .
git commit -m "Phase 6: add online row editing"
```

---

## 9. 每个 phase 后的统一验证

每个 phase 完成后，Codex 必须运行：

```bash
npm run build
```

并根据阶段验证：

```text
1. index.html 可以打开。
2. table.html 可以打开。
3. search.html 可以打开。
4. analysis.html 可以打开。
5. product-analysis.html 可以打开。
6. target-analysis.html 可以打开。
7. Phase 2 之后 files.html 可以打开。
8. 相关 /api endpoints 通过本地或 preview 检查。
9. 没有提交敏感信息。
10. 当前仍在 feature 分支。
```

Codex 可以报告“自检通过”，但这不是合并批准。

---

## 10. 风险与缓解

### 10.1 dashboardState 兼容风险

风险：

```text
远程 rows 丢失 fields、values、links、columns、source 或 section keys。
```

缓解：

```text
D1 中用 JSON 保留原始结构。远程重建 dashboardState 时尽量保持原 shape，只新增 remoteId。
```

### 10.2 Access 配置风险

风险：

```text
开发 fallback user 被带到生产环境。
```

缓解：

```text
只有 ENVIRONMENT=development 时允许 fallback。Preview/production 必须校验 Cloudflare Access JWT。
```

### 10.3 D1/R2 Binding 缺失

风险：

```text
本地 build 通过，但部署 API 因 Pages bindings 缺失而失败。
```

缓解：

```text
明确记录 DB 和 FILES_BUCKET bindings。API 错误信息应清楚指出缺失 binding。
```

### 10.4 大文件上传风险

风险：

```text
Workers 请求限制或内存限制影响大型 Office 文件。
```

缓解：

```text
MVP 通过 MAX_UPLOAD_BYTES 限制大小，默认 20 MB。multipart upload 后续再做。
```

### 10.5 部分上传失败风险

风险：

```text
R2 写入成功，但 D1 metadata 写入失败。
```

缓解：

```text
尝试 best-effort R2 cleanup。返回明确错误。D1 metadata 不存在时不在 UI 显示该文件。
```

### 10.6 在线编辑数据漂移

风险：

```text
在线编辑只改 values 没改 fields，导致分析页读取不到新数据。
```

缓解：

```text
PATCH API 接受 values 和 fields。UI 编辑带 field mapping 的列时，应同步更新 values 和 fields。
```

### 10.7 角色误配与管理员锁定

风险：

```text
所有用户首次登录都成为 viewer，导致没有管理员；或管理员误将自己、最后一名 admin 降级，导致无法继续管理角色。
```

缓解：

```text
1. 在 Preview 和 Production 中分别配置 INITIAL_ADMIN_EMAILS，并在首次 Access 登录后验证至少一名 admin。
2. role API 仅允许 admin 调用；禁止自我改角色；禁止移除最后一名 admin。
3. 角色变更必须写 audit_logs。紧急恢复通过受控 D1 运维操作完成，并记录恢复原因。
4. Access policy 仍是第一层准入；应用内 admin 不能让未通过 Access 的用户进入站点。
```

---

## 11. 合并前检查清单

合并前必须确认：

```text
1. 所有实现提交都在 feature/cloudflare-fullstack-storage 或同类 feature 分支。
2. git status --short --branch 干净。
3. npm run build 通过。
4. 现有六个页面 smoke check 通过。
5. Phase 2 之后 files.html smoke check 通过。
6. /api/auth/me 可用。
7. Folder API 可用。
8. Upload API 可写 D1 和 R2。
9. Dashboard import/latest 可用。
10. Dataset row PATCH 可用。
11. viewer role 只读。
12. admin 可以分配 viewer/editor/admin；editor/viewer 不能调用角色 API；最后一名 admin 保护和审计记录均已验证。
13. 没有提交 secrets、tokens、private keys。
14. Cloudflare Dashboard bindings 已配置，或明确列为待办。
15. 用户已完成本地实机验证。
16. 用户已明确批准合并。
```

只有满足以上条件后，Codex 才能创建/合并 PR，或执行 `git merge --no-ff`。

---

## 12. 后续对话建议 Prompt

### 只执行 Phase 0

```text
请阅读 CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md、CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN_zh-CN.md 和 D:\报表展示页面\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md，然后只执行 Phase 0。不要进入 Phase 1。执行前先检查 git status；如果工作区不干净，先停止并说明风险。
```

### 只执行 Phase 1

```text
请阅读 CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md、CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN_zh-CN.md 和 D:\报表展示页面\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md，然后在当前 feature 分支上只执行 Phase 1。不要改现有分析页面逻辑。完成后运行 npm run build，并输出 Cloudflare 控制台待办、Codex 自检结果和用户本地实机验证清单。
```

### 执行下一个 phase

```text
请基于当前 feature 分支继续执行 Phase N。执行前检查 git status 和当前分支；如果不在 feature/cloudflare-fullstack-storage 或同类 feature 分支上，请停止并说明。完成后运行 npm run build 和本阶段 API/page 自检，不要合并 main。
```

### 用户验证后合并

```text
我已经在本地实机环境验证通过，可以合并到 main。请先检查当前分支、git status、最近 commit 和目标主分支，然后通过 PR 或 git merge --no-ff 合并。合并后说明 merge commit 和回滚方式。
```

---

## 13. 官方文档参考

实施时若本文档与 Cloudflare 最新行为不一致，以 Cloudflare 官方文档为准：

```text
Pages Git integration:
https://developers.cloudflare.com/pages/get-started/git-integration/

Pages Functions bindings:
https://developers.cloudflare.com/pages/functions/bindings/

D1 Wrangler commands:
https://developers.cloudflare.com/d1/wrangler-commands/

R2 bucket creation:
https://developers.cloudflare.com/r2/buckets/create-buckets/

Wrangler configuration:
https://developers.cloudflare.com/workers/wrangler/configuration/

Cloudflare Access self-hosted apps:
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/

Cloudflare Access JWT validation:
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
```
