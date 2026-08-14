# 国药西南新药引进网：后续框架调整方案文档

> 目标读者：Codex / 后续开发执行 Agent
> 当前项目类型：Vite 纯前端项目，已部署到 Cloudflare Pages
> 调整目标：在不破坏现有首页、表格页、搜索页、厂牌分析、品种分析、靶点分析的前提下，新增权限登录、文件夹式资料库、大文件存储、Excel/PPT/Word 文件读取、数据入库、在线更新、自动抓取和后续分析能力。所有代码修改必须先在新创建的独立 feature 分支中完成。Codex 完成自检后，用户还会在本地实机环境进行二次验证；只有用户明确确认“可以合并”后，才允许将 feature 分支并入主分支。

## 已确认的资料库范围修订（2026-08-13）

本修订优先于本文档中的旧角色和 Phase 描述：资料库只向 admin、editor 开放，viewer 只能访问报表看板并导出页面 PDF；viewer 的资料库页面和 API 请求必须被拒绝。所有上传文件均禁止下载，R2 必须私有，浏览器不得取得对象 URL、预签名 URL 或 R2 key。支持 `.xlsx`、`.xls` 作为 Excel 看板数据源，`.pdf`、`.docx`、`.pptx` 作为后续 AI 助手分析资料；非 Excel 文件不得自动更新看板或自动发送给外部 AI。既有操作边界不变：editor 可维护文件夹、上传文件/版本，admin 负责归档、永久删除和 Excel 看板发布。后续 Phase 4 的“上传 Excel/表格”控件还应支持从资料库选择 active Excel 文件的固定版本：服务端从私有 R2 内部读取并解析，浏览器只提交文件/版本 ID，不能下载或取得对象 URL；只有 admin 能导入发布，PDF/Word/PPT 不得作为看板来源。所有角色均可导出当前渲染页面 PDF，但该 PDF 不含原始上传附件。

---

## 1. 当前项目现状

当前项目是一个基于 Vite 的纯前端报表展示页面。

### 1.1 当前核心文件

```text
index.html
analysis.html
product-analysis.html
search.html
table.html
target-analysis.html

src/
  main.js
  tablePage.js
  searchPage.js
  analysisPage.js
  productAnalysisPage.js
  targetAnalysisPage.js
  config/
    dashboardConfig.js
    demoWorkbookState.js
  parser/
    excelParser.js
    sectionMatcher.js
    normalizer.js
  render/
    newsRenderer.js
    tableRenderer.js
  state/
    storage.js
  styles/
    base.css
    dashboard.css
```

### 1.2 当前数据流

当前数据流如下：

```text
用户上传 Excel
  ↓
src/main.js 调用 src/parser/excelParser.js 读取 Excel
  ↓
sectionMatcher.js 按配置识别新闻板块 / 表格板块
  ↓
normalizer.js 标准化数据
  ↓
src/state/storage.js 保存到浏览器 IndexedDB / sessionStorage
  ↓
首页、完整表格页、搜索页、厂牌分析、品种分析、靶点分析读取本地 dashboardState
```

### 1.3 当前限制

当前方案只适合单浏览器本地使用，不适合继续扩展为正式资料库系统。主要限制：

```text
1. 无登录权限控制。
2. 数据只保存在当前浏览器本地 IndexedDB / sessionStorage。
3. 换电脑、换浏览器、清缓存后数据会丢失。
4. 无法多人共享同一套资料库。
5. 无法存储大量原始 Excel / PPT / Word 文件。
6. 无法做文件夹式管理。
7. 无法保存文件版本。
8. 无法在数据库中自动抓取资料进行分析。
9. 大文件继续走前端本地解析会遇到浏览器性能和缓存容量问题。
```

---

## 2. 总体改造原则

本次改造不要推倒重写。必须遵守以下原则：

```text
1. 保留现有页面结构和视觉风格。
2. 保留现有 Excel 解析逻辑作为第一阶段可复用能力。
3. 保留当前 dashboardState 数据结构，作为前后端之间的兼容数据格式。
4. 先新增后端 API 和远程存储，再逐步替换本地 IndexedDB。
5. 先完成 Excel 数据入库，再扩展 Word / PPT 文本读取。
6. 先完成基础权限和文件管理，再做 AI / 语义检索 / 自动深度分析。
7. 每个阶段都必须保证 npm run build 通过。
8. 每个阶段都必须保证当前首页、表格页、搜索页、三个分析页仍可打开。
9. 每个阶段先由 Codex 在 feature 分支内完成自检，再由用户在本地实机环境复核。
10. 未收到用户明确合并确认前，不允许将 feature 分支并入 main / master。
```

### 2.1 Git 分支开发、双重验证与人工合并确认策略（强制要求）

为了避免 Codex 大规模修改后直接影响主分支，后续所有改造必须采用“新建 feature 分支开发 + Codex 自检 + 用户本地实机复核 + 用户明确确认后再合并”的工作流。

整体流程如下：

```text
最新 main / master
  ↓
创建新的 feature 分支
  ↓
Codex 只在 feature 分支内修改代码
  ↓
Codex 完成阶段性自检
  ↓
用户在本地实机环境二次验证
  ↓
用户明确告诉 Codex 可以合并
  ↓
再通过 PR 或 merge --no-ff 合并回主分支
```

#### 2.1.1 每次变更前必须创建新的 feature 分支

在任何代码修改前，Codex 必须先执行或指导执行以下步骤：

```bash
git status
git checkout main
git pull origin main
git checkout -b feature/cloudflare-fullstack-storage
```

如果本地默认主分支不是 `main`，则使用当前项目实际主分支，例如 `master`。

如果 `feature/cloudflare-fullstack-storage` 已存在，不要直接复用旧分支，必须创建新的递增分支名，例如：

```bash
git checkout -b feature/cloudflare-fullstack-storage-v2
```

或者使用日期后缀：

```bash
git checkout -b feature/cloudflare-fullstack-storage-20260630
```

强制要求：

```text
1. 本次框架改造不得直接在 main / master 上修改。
2. 每次新的大范围改造都必须从最新 main / master 新建 feature 分支。
3. Codex 不应在旧的、来源不明的、已有大量修改的 feature 分支上继续叠加修改。
4. 如果需要复用已有 feature 分支，必须先说明该分支当前状态，并等待用户确认。
```

#### 2.1.2 工作区不干净时不要直接修改

如果 `git status` 显示已有未提交修改，Codex 不应直接覆盖这些修改。必须先说明当前未提交文件，并建议用户选择：

```text
1. 先 commit 当前修改；
2. 先 stash 当前修改；
3. 放弃当前修改；
4. 继续但明确知道风险。
```

推荐保护命令：

```bash
git stash push -m "backup-before-cloudflare-fullstack-migration"
```

#### 2.1.3 每个阶段单独提交

每完成一个 phase，必须单独提交，方便回滚和 review。

示例：

```bash
git add .
git commit -m "Phase 1: add Cloudflare backend foundation"
```

不要把 Phase 1 到 Phase 6 混在一个巨大 commit 中。

#### 2.1.4 Codex 阶段性自检要求

Codex 每完成一个阶段后，必须先在 feature 分支内完成基础自检。

至少包括：

```text
1. npm run build 通过。
2. 当前首页可以打开。
3. table.html 可以打开。
4. search.html 可以打开。
5. analysis.html 可以打开。
6. product-analysis.html 可以打开。
7. target-analysis.html 可以打开。
8. 新增 API 基础功能通过本地或 Cloudflare preview 验证。
9. 没有把敏感配置、密钥、R2/D1 凭证写入代码。
10. 输出本阶段修改文件清单、验证结果和剩余风险。
```

注意：Codex 自检通过不等于可以合并主分支。Codex 只能说明“feature 分支当前自检通过，等待用户本地实机验证”。

#### 2.1.5 用户本地实机二次验证要求

Codex 自检通过后，用户会在本地真实环境中再次验证。

用户验证内容至少包括：

```text
1. 在用户本地机器拉取 / 切换到对应 feature 分支。
2. 运行 npm install 和 npm run build。
3. 运行本地开发服务，例如 npm run dev。
4. 手动打开首页。
5. 手动打开完整表格页。
6. 手动打开搜索页。
7. 手动打开厂牌分析页。
8. 手动打开品种分析页。
9. 手动打开靶点分析页。
10. 验证新增资料库、上传、API、权限、远程数据读取等本阶段新增功能。
11. 检查是否存在明显 UI 破坏、控制台错误、数据丢失或权限异常。
```

只有用户完成本地实机验证，并明确回复类似以下内容后，才允许进入合并步骤：

```text
本地实机验证通过，可以合并到 main。
```

或者：

```text
我已经本地验证过了，可以 merge。
```

如果用户没有明确确认，Codex 不得主动合并，不得自动执行 `git merge`，也不得建议“现在直接合并”。

#### 2.1.6 合并主分支必须等待用户明确指令

只有满足以下全部条件后，才允许合并到主分支：

```text
1. 所有修改都发生在新创建的 feature 分支上。
2. Codex 自检通过。
3. 用户本地实机验证通过。
4. 用户明确告诉 Codex 可以合并。
5. 当前没有未处理的敏感配置、密钥、环境变量泄露问题。
```

合并建议使用：

```bash
git checkout main
git pull origin main
git merge --no-ff feature/cloudflare-fullstack-storage
git push origin main
```

如果项目使用 GitHub Pull Request 流程，则推荐：

```text
1. push feature 分支到 GitHub；
2. 创建 Pull Request；
3. 等待 Cloudflare Preview Deployment；
4. Codex / CI 先完成 preview 基础验证；
5. 用户在本地实机和 / 或 Cloudflare Preview 上手动验证；
6. 用户明确确认可以合并；
7. 再 merge PR 到 main。
```

#### 2.1.7 回滚策略

如果 feature 分支验证失败：

```bash
git checkout main
git branch -D feature/cloudflare-fullstack-storage
```

如果已经合并到 main 后才发现问题，优先使用 revert，而不是强制改写主分支历史：

```bash
git revert <merge_commit_id>
git push origin main
```

不要在主分支上使用：

```bash
git push --force
```

除非用户明确确认且确认没有其他人基于该分支协作。


---

## 3. 推荐目标架构

推荐使用 Cloudflare 轻量全栈架构。

```text
Browser Frontend
  ↓
Cloudflare Pages 静态前端
  ↓
Cloudflare Pages Functions / Worker API
  ↓
Auth Middleware 权限控制
  ↓
Cloudflare D1：用户、角色、文件夹、文件元数据、解析后的结构化数据
Cloudflare R2：Excel / PPT / Word 原始文件、历史版本、大文件对象
Cloudflare Queues / Workflows：异步解析任务，可第二阶段引入
Cloudflare Vectorize：后续语义搜索 / 自动抓取相关资料，可第三阶段引入
```

### 3.1 MVP 阶段推荐技术选择

第一阶段不要一次性引入过多复杂组件。MVP 推荐：

```text
Cloudflare Pages          继续部署当前前端
Pages Functions           新增后端 API
Cloudflare D1             存结构化数据
Cloudflare R2             存原始文件
Cloudflare Access         控制谁可以登录访问
D1 users.role             控制 admin / editor / viewer 业务权限
```

### 3.2 为什么选择这个方案

```text
1. 当前项目已经部署在 Cloudflare Pages，继续使用 Cloudflare 技术栈迁移成本最低。
2. D1 适合保存文件夹、文件元数据、解析后的表格行、用户角色、审计日志。
3. R2 适合保存大量 Excel、PPT、Word 原始文件。
4. Pages Functions 可以直接和当前 Vite 项目放在同一个仓库。
5. Cloudflare Access 可以避免自己从零实现账号密码登录。
6. dashboardState 兼容层可以最大程度复用现有厂牌分析、品种分析、靶点分析逻辑。
```

---

### 3.3 MVP 成本与免费额度原则

MVP 阶段默认优先使用 Cloudflare 免费额度完成验证，包括 Pages、Pages Functions、D1、R2 和 Access。只有当 R2 存储、D1 读写、Workers 请求量、Access 用户数或后续 AI / Vectorize 能力超出免费额度后，才需要评估升级或按量付费。

## 4. 权限登录设计

### 4.1 登录方式

推荐使用 Cloudflare Access 做第一层登录认证。

用户访问网站时：

```text
用户打开页面
  ↓
Cloudflare Access 判断是否允许访问
  ↓
允许后进入网站
  ↓
后端 API 从 Access JWT / Header 中识别用户 email
  ↓
D1 users 表判断用户角色
```

### 4.2 应用内部角色

在数据库中维护业务角色：

```text
admin   管理员：可以管理用户、文件夹、文件、Excel 解析/发布、所有数据和删除记录
editor  编辑者：可以新建/重命名文件夹、上传和新增文件版本；不能管理用户、归档/删除文件或发布看板数据
viewer  查看者：只能查看已发布的首页、表格、搜索和分析结果，并导出当前页面 PDF；不能访问资料库或文件元数据
```

### 4.3 角色分配与保护规则

Cloudflare Access 与应用角色必须分层：

```text
1. Cloudflare Access policy 只决定谁可以访问站点，不能直接替代 admin/editor/viewer。
2. 用户首次通过 Access 访问 API 时写入 D1 users；默认 role=viewer。
3. 仅在首次创建 users 记录时，环境变量 INITIAL_ADMIN_EMAILS 中的邮箱可成为 admin。真实邮箱绝不写入仓库。
4. 只有 admin 能在应用内分配角色；用户必须先至少登录一次 Access，才会出现在管理列表中。
5. admin 不能修改自己的角色，且不能降级/移除最后一名 admin。
6. 角色变更必须写 audit_logs，包含操作者、目标用户、旧角色、新角色和时间。
7. 每个受保护 API 都从 D1 获取当前角色，前端隐藏按钮不是授权依据。
```

### 4.4 本地开发登录策略

为了方便 Codex 和本地开发，API middleware 需要支持 dev fallback。

```text
生产环境：从 Cloudflare Access header 读取用户信息。
本地环境：如果没有 Access header，则使用 X-Dev-User-Email 或默认 dev@example.com。
```

必须避免生产环境允许伪造用户。建议通过环境变量区分：

```text
ENVIRONMENT=development | production
```

---

## 5. 数据库设计：Cloudflare D1

新增目录：

```text
migrations/
  0001_initial_schema.sql
```

### 5.1 users 表

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Phase 2 追加 `0002_user_management.sql`，新增 `role_updated_at`、`role_updated_by` 和 `idx_users_role`，并保持已有 users 记录可读。角色值在服务端只允许 `admin`、`editor`、`viewer`；不依赖客户端字符串或 UI 状态。

### 5.2 folders 表

用于模拟文件夹结构。

```sql
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

CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON folders(owner_id);
```

### 5.3 files 表

用于保存文件元数据，不保存原始文件内容。

```sql
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

CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
```

文件状态建议：

```text
uploaded    已上传原始文件
parsing     正在解析
ready       解析完成，可用于分析
failed      解析失败
archived    已归档
```

### 5.4 file_versions 表

用于支持“更新文件而不是覆盖文件”。

```sql
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

CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
```

### 5.5 datasets 表

一个上传文件可以解析出一个或多个 dataset。

Phase 4 还需增加 `dashboard_imports`，用于记录一次看板发布所使用的来源。资料库来源必须固定到文件版本，而不是只记录最新文件：

```sql
CREATE TABLE IF NOT EXISTS dashboard_imports (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  file_version_id TEXT,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('local', 'library')),
  imported_by TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(file_version_id) REFERENCES file_versions(id),
  FOREIGN KEY(imported_by) REFERENCES users(id)
);
```

```sql
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE INDEX IF NOT EXISTS idx_datasets_file_id ON datasets(file_id);
```

`type` 可选：

```text
workbook_dashboard
news_section
table_section
document_text
```

### 5.6 dataset_rows 表

保存新闻条目和表格行。为兼容现有前端，保留 JSON 数据。

```sql
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

CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_section_key ON dataset_rows(section_key);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_row_type ON dataset_rows(row_type);
```

`row_type` 可选：

```text
news
table
```

### 5.7 document_chunks 表

用于 Word / PPT / 后续文档语义检索。

```sql
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

CREATE INDEX IF NOT EXISTS idx_document_chunks_file_id ON document_chunks(file_id);
```

### 5.8 audit_logs 表

所有在线修改都要记录审计日志。

```sql
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
```

---

## 6. R2 文件存储设计

### 6.1 R2 bucket

建议 bucket 名：

```text
sinopharm-new-drug-files
```

### 6.2 R2 key 设计

```text
folders/{folderId}/files/{fileId}/v{version}/{safeFileName}
```

示例：

```text
folders/fld_001/files/file_001/v1/2026-new-drug-report.xlsx
folders/fld_001/files/file_001/v2/2026-new-drug-report-updated.xlsx
```

### 6.3 文件名处理

上传前必须生成 safeFileName：

```text
1. 保留原始文件名用于展示。
2. R2 key 中使用安全文件名，避免特殊字符导致路径问题。
3. 建议保留扩展名。
```

---

## 7. API 设计

新增目录建议：

```text
functions/
  _middleware.ts
  api/
    auth/
      me.ts
    users/
      index.ts
      [id]/role.ts
    folders/
      index.ts
      [id].ts
    files/
      index.ts
      upload.ts
      [id].ts
      [id]/version.ts
    dashboard/
      latest.ts
    dataset-rows/
      [id].ts
    search.ts
```

如 Codex 认为 Pages Functions 动态路由过于分散，也可以使用 Hono 做统一入口，但第一阶段优先保持简单。

### 7.1 Auth API

```text
GET /api/auth/me
```

返回：

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

### 7.2 用户与角色管理 API

```text
GET   /api/users?query=<email-or-name>&role=<role>&cursor=<cursor>
PATCH /api/users/:id/role
```

`PATCH /api/users/:id/role`：

```json
{ "role": "editor" }
```

设计要求：

```text
1. 仅当前 role=admin 的用户可调用；editor/viewer 返回 403。
2. 服务端白名单只接受 admin/editor/viewer。
3. 拒绝操作者修改自己的角色，拒绝将最后一名 admin 变为非 admin，返回 409。
4. 角色更新同时维护 role_updated_at、role_updated_by、updated_at，并与 audit_logs 写入同一 D1 batch/事务边界。
5. 不提供创建账号、邀请或 Access policy 编辑 API；这仍由 Cloudflare Dashboard 管理。
```

### 7.3 Folder API

```text
GET    /api/folders?parentId=xxx
POST   /api/folders
PATCH  /api/folders/:id
DELETE /api/folders/:id
```

创建文件夹请求：

```json
{
  "parentId": null,
  "name": "2026创新药资料"
}
```

### 7.4 File API

MVP 可先实现普通上传，后续再做 multipart upload。

```text
GET    /api/files?folderId=xxx
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
POST   /api/files/:id/version
```

普通上传流程：

```text
前端 FormData 上传文件
  ↓
API 校验权限、文件类型、大小
  ↓
API 写入 R2
  ↓
API 写入 D1 的 files / file_versions 表
  ↓
API 触发解析
  ↓
返回 file 记录
```

支持文件类型：

```text
.xlsx
.xls
.docx
.pptx
```

第一阶段优先支持：

```text
.xlsx
.xls
```

### 7.5 Dashboard API

```text
GET /api/dashboard/latest
POST /api/dashboard/import
POST /api/dashboard/import-from-library
```

`/api/dashboard/import-from-library` 是后续 Phase 4 的资料库数据源入口：仅 admin 可调用，请求只包含 `fileId` 和 `fileVersionId`。服务端必须再次校验资料库权限、文件状态和 `.xlsx` / `.xls` 类型，再从私有 R2 内部读取固定版本并解析；不得向浏览器返回原始文件、R2 key 或对象 URL。导入审计和 dashboard import 记录必须保存来源文件/版本 ID。

目标：返回和当前 `demoWorkbookState` / `dashboardState` 尽量一致的结构。

返回结构：

```json
{
  "meta": {
    "mode": "remote",
    "updatedAt": "2026-06-30T00:00:00.000Z",
    "recognizedNewsSections": 0,
    "recognizedTableSections": 0,
    "warnings": []
  },
  "newsSections": [],
  "tableSections": []
}
```

这一点非常重要：只要保持结构兼容，现有首页、搜索页、分析页就可以少改很多。

### 7.6 Dataset Row API

用于在线编辑，不重新上传文件。

```text
PATCH /api/dataset-rows/:id
```

请求：

```json
{
  "data": {
    "fields": {},
    "values": {}
  }
}
```

处理逻辑：

```text
1. 校验用户必须是 admin 或 editor。
2. 读取旧 row。
3. 更新 data_json。
4. 写 audit_logs。
5. 返回更新后的 row。
```

### 7.7 Search API

第一阶段可以基于 D1 LIKE 搜索。

```text
GET /api/search?q=关键词
```

第二阶段再接 Vectorize 做语义搜索。

---

## 8. 解析设计

### 8.1 Excel 解析策略

当前已有解析能力：

```text
src/parser/excelParser.js
src/parser/sectionMatcher.js
src/parser/normalizer.js
src/config/dashboardConfig.js
```

第一阶段建议不要完全重写。先把现有逻辑抽成可复用模块。

推荐新增：

```text
src/parser/buildDashboardState.js
```

内容：把 `main.js` 中的 `buildDashboardState(workbook)` 函数提取出来。

目标：

```js
export function buildDashboardState(workbook) {
  // 复用 matchWorkbookSections / normalizeNewsSection / normalizeTableSection
}
```

这样前端上传和后端解析都可以复用同一套逻辑。

### 8.2 MVP 解析方案

为了降低第一阶段难度，可以采用过渡方案：

```text
1. 前端继续解析 Excel，生成 dashboardState。
2. 前端同时把原始文件上传到 R2。
3. 前端把 dashboardState 提交给 /api/dashboard/import。
4. 后端把 dashboardState 拆入 datasets / dataset_rows。
```

新增 API：

```text
POST /api/dashboard/import
```

这个过渡方案优点：

```text
1. 最大程度复用当前已验证的 Excel 解析逻辑。
2. Codex 改动风险低。
3. 能快速实现远程存储和多人共享。
4. 后续再把解析迁移到后端或异步任务。
```

注意：这只是 MVP 过渡方案。最终目标仍然是上传原始文件后由后端异步解析。

### 8.3 第二阶段后端异步解析

第二阶段引入：

```text
Cloudflare Queue / Workflow
```

流程：

```text
文件上传完成
  ↓
files.status = uploaded
  ↓
创建 parse-file 任务
  ↓
files.status = parsing
  ↓
Worker 读取 R2 文件
  ↓
解析 Excel / Word / PPT
  ↓
写入 datasets / dataset_rows / document_chunks
  ↓
files.status = ready
```

### 8.4 Word / PPT 解析策略

Word / PPT 不要在第一阶段做复杂理解。

第一阶段：

```text
只保存原始文件到 R2。
```

第二阶段：

```text
DOCX：提取段落文本，写入 document_chunks。
PPTX：提取 slide 文本，写入 document_chunks。
```

第三阶段：

```text
将 document_chunks 做 embedding，写入 Vectorize，用于语义检索和自动抓取。
```

---

## 9. 前端改造设计

### 9.1 新增 API Client

新增：

```text
src/services/apiClient.js
```

示例方法：

```js
export async function getCurrentUser() {}
export async function fetchDashboardState() {}
export async function listFolders(parentId) {}
export async function createFolder(payload) {}
export async function listFiles(folderId) {}
export async function uploadFile(folderId, file, dashboardState) {}
export async function updateDatasetRow(rowId, data) {}
```

所有 fetch 需要统一处理：

```text
1. 非 2xx 响应。
2. 401 未登录。
3. 403 无权限。
4. JSON 解析错误。
5. 网络异常。
```

### 9.2 替换数据读取方式

当前页面使用：

```js
loadDashboardState()
```

调整为：

```js
fetchDashboardState()
```

建议第一阶段保留 fallback：

```js
const remoteState = await fetchDashboardState().catch(() => null);
dashboardState = remoteState || (await loadDashboardState()) || demoDashboardData;
```

需要改的页面：

```text
src/main.js
src/tablePage.js
src/searchPage.js
src/analysisPage.js
src/productAnalysisPage.js
src/targetAnalysisPage.js
```

### 9.3 新增用户管理页面

新增：

```text
users.html
src/usersPage.js
```

页面只对 admin 显示和开放：

```text
1. 使用紧凑表格显示姓名/邮箱、当前角色、创建时间、最近角色更新时间。
2. 提供邮箱/姓名搜索和角色筛选；只显示已经完成至少一次 Access 登录的 D1 users。
3. 每行使用角色选择器与明确确认对话框；保存后重新读取服务端返回的用户记录。
4. 当前管理员本人的角色选择器禁用；最后一名 admin 的降级由服务端拒绝并显示明确错误。
5. 成功操作后提示审计已记录；不显示 Access secret、JWT 或其他敏感数据。
6. 非 admin 不显示入口；即使手动访问 users.html，API 也必须返回 403。
```

### 9.4 新增资料库页面

新增：

```text
files.html
src/filesPage.js
```

页面能力：

```text
1. 显示当前用户和角色。
2. 左侧显示文件夹树。
3. 右侧显示文件列表。
4. 支持新建文件夹。
5. 支持上传 Excel / Word / PPT。
6. 显示文件状态 uploaded / parsing / ready / failed。
7. 支持点击文件查看元数据。
8. 支持上传新版本。
```

首页顶部新增入口：

```text
资料库
```

### 9.5 上传按钮调整

当前首页只有“上传 Excel”。建议调整为：

```text
上传 Excel：保留，但上传后进入远程保存流程。
资料库：新文件管理入口。
```

MVP 中首页上传 Excel 后：

```text
1. 前端解析 Excel，生成 dashboardState。
2. 保存到后端 D1。
3. 原始 Excel 保存到 R2。
4. 当前页面刷新 remote dashboardState。
```

后续还要增加第二条来源：

```text
管理员在“从资料库选择 Excel”中选择 active 的 .xlsx/.xls 固定版本
  ↓
浏览器仅 POST fileId + fileVersionId
  ↓
服务端在私有 R2 内部读取并解析该版本
  ↓
复用 dashboardState 导入、审计和发布流程
```

该流程不是文件下载；editor 只能上传/新增资料库文件版本，viewer 不可见，PDF/Word/PPT 不可选作看板数据源。

### 9.6 表格页在线编辑

在 `table.html` / `src/tablePage.js` 中新增：

```text
1. 每行显示“编辑”按钮。
2. admin/editor 可编辑。
3. viewer 只读。
4. 编辑后调用 PATCH /api/dataset-rows/:id。
5. 保存成功后刷新当前行。
```

注意：现有 row 可能没有数据库 row id。导入数据库后，需要在返回的 dashboardState 中为每一行加上：

```js
row.id = "drow_xxx"
row.remoteId = "drow_xxx"
```

前端编辑时使用该 id。

---

## 10. 建议目录结构调整

目标目录：

```text
.
├─ index.html
├─ table.html
├─ search.html
├─ analysis.html
├─ product-analysis.html
├─ target-analysis.html
├─ files.html
├─ package.json
├─ vite.config.js
├─ wrangler.toml
├─ migrations/
│  └─ 0001_initial_schema.sql
├─ functions/
│  ├─ _middleware.ts
│  └─ api/
│     ├─ auth/
│     │  └─ me.ts
│     ├─ folders/
│     │  ├─ index.ts
│     │  └─ [id].ts
│     ├─ files/
│     │  ├─ index.ts
│     │  ├─ upload.ts
│     │  ├─ [id].ts
│     │  └─ [id]/version.ts
│     ├─ dashboard/
│     │  ├─ latest.ts
│     │  └─ import.ts
│     ├─ dataset-rows/
│     │  └─ [id].ts
│     └─ search.ts
└─ src/
   ├─ main.js
   ├─ filesPage.js
   ├─ tablePage.js
   ├─ searchPage.js
   ├─ analysisPage.js
   ├─ productAnalysisPage.js
   ├─ targetAnalysisPage.js
   ├─ services/
   │  └─ apiClient.js
   ├─ state/
   │  ├─ storage.js
   │  └─ dashboardState.js
   ├─ parser/
   │  ├─ excelParser.js
   │  ├─ sectionMatcher.js
   │  ├─ normalizer.js
   │  └─ buildDashboardState.js
   ├─ render/
   │  ├─ newsRenderer.js
   │  └─ tableRenderer.js
   ├─ config/
   │  ├─ dashboardConfig.js
   │  └─ demoWorkbookState.js
   └─ styles/
      ├─ base.css
      └─ dashboard.css
```

---

## 11. wrangler.toml 建议

新增：

```toml
name = "sinopharm-new-drug-dashboard"
compatibility_date = "2026-06-30"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "sinopharm_new_drug_db"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[r2_buckets]]
binding = "FILES_BUCKET"
bucket_name = "sinopharm-new-drug-files"

[vars]
ENVIRONMENT = "development"
```

生产环境需要在 Cloudflare Dashboard 中设置：

```text
ENVIRONMENT=production
INITIAL_ADMIN_EMAILS=<逗号分隔的初始管理员 Access 邮箱；不得提交真实值>
```

Preview 与 Production 必须分别设置 `INITIAL_ADMIN_EMAILS`，并在首位管理员完成 Access 登录后验证其 D1 role；该变量仅用于 bootstrap，后续角色分配通过 admin 用户管理页完成。

---

### 11.1 Cloudflare 控制台手动配置清单（Codex 必须先提示用户）

在开始实现 Cloudflare Pages Functions、D1、R2、Access 相关功能前，Codex 必须先输出一份 Cloudflare 控制台配置操作清单，明确哪些操作需要用户手动完成，哪些信息需要用户创建后再填回代码或 `wrangler.toml`。

Codex 不得默认以下资源已经存在：

```text
Cloudflare Pages project
Cloudflare D1 database
Cloudflare R2 bucket
Cloudflare Access application / policy
Pages Functions bindings
Preview / Production environment variables
D1 migration 执行结果
```

Codex 在实现或部署前，必须提示用户确认以下配置：

```text
1. Cloudflare Pages 项目
   - 确认当前项目已经连接到正确的 GitHub 仓库。
   - 确认生产分支是 main 或项目实际主分支。
   - 确认 build command，例如 npm run build。
   - 确认 build output directory，例如 dist。

2. Cloudflare D1 database
   - 在 Cloudflare Dashboard 中创建 D1 database。
   - 建议 database_name 使用 sinopharm_new_drug_db。
   - 获取 database_id。
   - 将 database_name 和 database_id 填入 wrangler.toml。
   - 确认 Pages 项目中 D1 binding 名称为 DB。
   - 确认 migration 已执行到目标 D1 database。

3. Cloudflare R2 bucket
   - 在 Cloudflare Dashboard 中创建 R2 bucket。
   - 建议 bucket_name 使用 sinopharm-new-drug-files。
   - 确认 Pages 项目中 R2 binding 名称为 FILES_BUCKET。
   - 确认代码中只保存 R2 key，不直接公开无鉴权文件 URL。

4. Environment variables
   - Preview / 本地开发环境使用 ENVIRONMENT=development。
   - Production 环境使用 ENVIRONMENT=production。
   - 生产环境不得允许通过 X-Dev-User-Email 伪造用户。
   - 如后续有密钥、token、Access 配置，不得写入代码仓库，必须使用 Cloudflare 环境变量或 Secret。

5. Cloudflare Access
   - 为 Pages 生产域名配置 Cloudflare Access。
   - 配置允许访问的邮箱、邮箱域名或用户组。
   - 确认 Access 登录后，后端可以从 Access header / JWT 中识别用户 email。
   - 本地开发可以使用 dev fallback，但生产环境必须强制校验 Access 身份。

6. Pages Functions bindings
   - 确认 Preview 环境和 Production 环境都绑定了 D1。
   - 确认 Preview 环境和 Production 环境都绑定了 R2。
   - 绑定名称必须与代码保持一致：
     - D1 binding: DB
     - R2 binding: FILES_BUCKET

7. D1 migrations
   - Codex 需要告诉用户如何执行 migration。
   - Codex 需要区分本地 D1、Preview D1 和 Production D1。
   - 生产 D1 migration 执行前必须提醒用户确认目标环境，避免误操作。

8. 部署后验证
   - 验证 /api/auth/me 是否能返回当前用户。
   - 验证 /api/folders 是否能连接 D1。
   - 验证 /api/files/upload 是否能写入 R2 和 D1 files metadata table。
   - 验证 /api/dashboard/latest 是否能读取远程 dashboardState。
   - 验证没有把 R2 文件暴露为公开无鉴权 URL。
```

建议 Codex 在 Phase 1 开始前先输出类似以下清单：

```text
在我开始修改 Cloudflare 相关代码前，请你先确认或准备以下 Cloudflare 配置：

1. 是否已经有 Cloudflare Pages 项目？
2. Pages 项目是否连接到当前 GitHub 仓库？
3. 是否已经创建 D1 database？如果有，请提供 database_name 和 database_id。
4. 是否已经创建 R2 bucket？如果有，请确认 bucket_name。
5. Pages 项目是否已经绑定 D1，binding 名称是否为 DB？
6. Pages 项目是否已经绑定 R2，binding 名称是否为 FILES_BUCKET？
7. Preview 和 Production 是否都配置了 ENVIRONMENT？
8. 是否已经配置 Cloudflare Access 保护生产域名？
9. 允许访问的邮箱、域名或用户组是什么？
10. 是否允许我先实现本地 dev fallback，再等你完成 Cloudflare 控制台配置后做 preview / production 验证？
```

如果以上配置尚未完成，Codex 可以继续完成不依赖真实 Cloudflare 资源的本地代码改造，但必须明确标注：

```text
当前只能完成代码层实现和本地 mock / fallback 验证。
D1 / R2 / Access 的真实联调需要用户完成 Cloudflare 控制台配置后再验证。
```

---

## 12. Codex 分阶段执行计划

### Phase 0：保护当前项目并创建全新的独立开发分支

目标：保证后续改造不会直接影响主分支，并且可以随时回滚。

任务：

```text
1. 先运行 git status，确认当前工作区状态。
2. 如果存在未提交修改，先提醒用户处理，不要直接覆盖。
3. 切换到主分支：git checkout main。
4. 拉取最新主分支：git pull origin main。
5. 创建全新的开发分支：git checkout -b feature/cloudflare-fullstack-storage。
6. 如果该分支已存在，不要复用旧分支，创建 feature/cloudflare-fullstack-storage-v2 或带日期后缀的新分支。
7. 确认当前分支不是 main / master。
8. 运行 npm install。
9. 运行 npm run build，确认当前项目在改造前可构建。
10. 不修改现有分析逻辑。
11. 确认 admin/editor/viewer 权限矩阵、INITIAL_ADMIN_EMAILS 的 Preview/Production 配置责任人，以及 Access policy 与应用角色的边界。
```

建议命令：

```bash
git status
git checkout main
git pull origin main
git checkout -b feature/cloudflare-fullstack-storage
git branch --show-current
npm install
npm run build
```

Codex 验收：

```text
当前分支不是 main，而是 feature/cloudflare-fullstack-storage 或同类新创建 feature 分支。
npm run build 通过。
dist 正常生成。
没有任何业务代码在 main 分支上被直接修改。
角色分配设计与初始管理员恢复责任已得到用户确认。
```

用户复核：

```text
用户确认当前 feature 分支名称正确。
用户确认本地可以正常 npm install / npm run build。
用户确认 main / master 没有被直接修改。
```

注意：Phase 0 只负责建立安全开发环境，不涉及合并主分支。


---

### Phase 1：新增 Cloudflare 后端基础

任务：

```text
1. 在写代码前，先输出 Cloudflare 控制台手动配置清单。
2. 明确提示用户需要创建或确认 Pages project、D1 database、R2 bucket、Access application、Pages bindings 和环境变量。
3. 新增 wrangler.toml。
4. 新增 migrations/0001_initial_schema.sql。
5. 新增 functions/_middleware.ts。
6. 新增 GET /api/auth/me。
7. 新增基础 DB helper 和 JSON response helper。
8. 在用户首次 Access 登录时创建 users 记录；默认 viewer，INITIAL_ADMIN_EMAILS 仅在首次创建时引导 admin，真实邮箱不写入代码。
9. 如果真实 D1 / R2 / Access 尚未配置完成，只做本地 dev fallback 和代码层验证，不假装已经完成真实云端联调。
```

验收：

```text
Codex 已输出 Cloudflare 手动配置清单。
用户知道哪些 Cloudflare 配置需要自己在 Dashboard 中完成。
wrangler.toml 中的 DB / FILES_BUCKET binding 名称明确。
GET /api/auth/me 能返回当前用户。
本地开发无 Access header 时能使用 dev user。
生产环境不允许伪造用户。
初始管理员来自 Cloudflare 环境变量而非硬编码，且 /api/auth/me 返回 D1 中的当前 role。
npm run build 通过。
```

---

### Phase 2：实现 RBAC、用户管理、文件夹 API 和资料库页面

任务：

```text
1. 新增 authorization helper、audit helper、0002_user_management.sql、GET /api/users 和 PATCH /api/users/:id/role。
2. 新增 users.html 与 src/usersPage.js；首页顶部仅向 admin 显示“用户管理”入口。
3. 管理页提供搜索、角色筛选、行级角色选择器和确认对话框；只管理已经 Access 登录过的 D1 users。
4. 服务端只允许 admin 改角色，拒绝自我改角色与最后一名 admin 降级，并记录 audit_logs。
5. 实现 folders CRUD API，并使其复用 authorization helper：viewer 只读，editor/admin 可创建/重命名，admin 才可删除。
6. 新增 src/services/apiClient.js、files.html、src/filesPage.js，首页顶部增加“资料库”入口。
```

验收：

```text
可以新建文件夹。
可以查看文件夹列表。
可以进入子文件夹。
admin 可以将已登录用户分配为 viewer/editor/admin，且能在刷新后看到持久化角色。
editor/viewer 无法调用角色 API；admin 无法自我降权或移除最后一名 admin。
viewer 不能创建 / 删除；editor 可以创建但不能删除；admin 可以创建和删除。
角色变更写入 audit_logs。
npm run build 通过。
```

---

### Phase 3：实现文件上传到 R2

任务：

```text
1. 实现 POST /api/files/upload。
2. 支持 .xlsx / .xls / .pdf / .docx / .pptx。
3. 原始文件保存到 R2。
4. 文件元数据保存到 D1 的 files / file_versions 表。
5. 资料库页面支持上传文件到当前文件夹。
6. 文件列表展示 name、size、ext、status、updated_at。
7. 所有文件 API 复用 RBAC：viewer 对资料库一律 403，editor/admin 可上传和新版本，只有 admin 可归档/删除；操作者写入 metadata/audit。
```

验收：

```text
可以上传 Excel 文件。
可以在 D1 的 files 表中看到记录。
可以在 R2 中看到原始文件。
D1 binding 使用 DB。
R2 binding 使用 FILES_BUCKET。
如果 D1 / R2 尚未在 Cloudflare Dashboard 绑定完成，Codex 必须明确说明只能完成本地代码验证，不能声称真实云端上传已验证通过。
文件状态初始为 uploaded。
viewer 上传与 editor 删除必须返回 403；admin 归档/删除必须记录审计。
npm run build 通过。
```

---

### Phase 4：远程保存 dashboardState

任务：

```text
1. 从 src/main.js 中提取 buildDashboardState 到 src/parser/buildDashboardState.js。
2. 新增 POST /api/dashboard/import。
3. 新增 POST /api/dashboard/import-from-library；请求只允许 `{ fileId, fileVersionId }`，由服务端从私有 R2 内部读取固定的 active `.xlsx` / `.xls` 版本并解析。
4. 前端本地上传 Excel 后，继续沿用现有前端解析逻辑生成 dashboardState，并将 dashboardState 提交给 /api/dashboard/import。
5. 前端增加“从资料库选择 Excel”入口；只有 admin 可见，且 PDF/Word/PPT 不可选。资料库来源的解析失败不得替换当前已发布看板。
6. 后端把 newsSections / tableSections 拆入 datasets / dataset_rows，并在 dashboard import/audit 中记录来源类型和来源文件/版本 ID。
7. 实现 GET /api/dashboard/latest。
8. 两个导入 API 都只允许 admin，并为导入/发布写入操作者审计；editor/viewer 必须得到 403，浏览器不得得到原始文件、R2 key 或对象 URL。
```

验收：

```text
上传 Excel 后，数据不再只存在 IndexedDB。
刷新页面后可以从 /api/dashboard/latest 获取远程数据。
返回结构与当前 dashboardState 兼容。
首页、完整表格、搜索、厂牌分析、品种分析、靶点分析都可使用远程数据。
admin 可从资料库选择一个 Excel 固定版本并发布；审计记录可追溯该文件/版本，且流程中不产生原始文件下载。
npm run build 通过。
```

---

### Phase 5：替换页面数据源

任务：

```text
1. 新增 src/state/dashboardState.js。
2. 统一封装 loadDashboardStateWithFallback()。
3. 优先 fetch /api/dashboard/latest。
4. 失败时 fallback 到 IndexedDB。
5. 再失败时 fallback 到 demoWorkbookState。
6. 修改 main.js、tablePage.js、searchPage.js、analysisPage.js、productAnalysisPage.js、targetAnalysisPage.js。
7. 401/403 不能成为权限绕过：用户管理、资料库、上传、导入和编辑均保持拒绝；只读分析页是否展示本地/demo 数据需明确产品策略。
```

验收：

```text
API 正常时读取远程数据。
API 异常时页面仍能显示本地或 demo 数据。
不破坏现有 UI。
npm run build 通过。
```

---

### Phase 6：在线编辑数据

任务：

```text
1. 确保 /api/dashboard/latest 返回的 table row 带 remoteId。
2. 实现 PATCH /api/dataset-rows/:id。
3. 在 tablePage.js 增加编辑模式。
4. admin/editor 可以编辑。
5. viewer 只读。
6. 编辑保存后写 audit_logs。
7. 每次 PATCH 都从 D1 获取当前 role，避免浏览器缓存角色在被管理员降级后继续授权。
```

验收：

```text
可以在页面直接修改表格行。
修改后刷新页面仍然存在。
不需要重新上传 Excel。
修改记录进入 audit_logs。
npm run build 通过。
```

---

### Phase 7：文档文本读取

任务：

```text
1. 对 .pdf、.docx、.pptx 提取文本。
2. 写入 document_chunks。
3. 资料库页面展示“已提取文本 / 未提取文本 / 提取失败”。
4. 后续人工智能助手只能在 admin/editor 选择已授权资料后检索 document_chunks.content；不得向 viewer 或浏览器返回原始文件。
```

验收：

```text
上传 Word 后可搜索其中的文字。
上传 PPT 后可搜索 slide 文字。
不要求第一阶段支持图片 OCR。
npm run build 通过。
```

---

### Phase 8：自动抓取与分析增强

任务：

```text
1. 新增 /api/analysis/brand。
2. 新增 /api/analysis/product。
3. 新增 /api/analysis/target。
4. 逐步把大量数据分析从前端迁移到后端。
5. 保留现有前端分析页面作为展示层。
```

验收：

```text
分析页可以通过 API 获取计算结果。
大数据量时不需要一次性把所有数据加载到浏览器。
现有分析视觉和交互尽量保持不变。
npm run build 通过。
```

---

### 12.1 每个 Phase 的统一验证与合并口径

无论 Phase 1 到 Phase 8 中某个阶段的“验收”写了哪些具体功能点，都必须统一遵守以下口径：

```text
1. Codex 只能先在 feature 分支内完成自检。
2. Codex 自检至少包括 npm run build、关键页面打开检查、相关 API / 功能检查。
3. Codex 自检通过后，只能输出验证结果、Cloudflare 配置状态和待用户实机验证清单。
4. 用户需要在本地实机环境再次验证对应 phase 的功能。
5. 用户未明确确认“本地实机验证通过，可以合并”前，不允许合并到 main / master。
6. 如果用户本地实机验证发现问题，应继续在同一个 feature 分支内修复，再重新走 Codex 自检和用户复核。
```

这意味着文档中所有 phase 的“验收通过”，默认都指：

```text
Codex 自检通过 + 用户本地实机验证通过
```

而不是只依赖 Codex 自己的构建或页面检查结果。

---

## 13. 关键兼容要求

Codex 修改时必须注意：

```text
1. 不要删除 demoWorkbookState.js，它是兜底数据。
2. 不要删除 src/state/storage.js，它是 fallback。
3. 不要一次性重写 analysisPage.js、productAnalysisPage.js、targetAnalysisPage.js。
4. 不要改变 dashboardConfig.js 的 section key，除非同步迁移全部分析逻辑。
5. 不要改变现有 row.fields / row.values 的基本结构。
6. 远程 API 返回的 dashboardState 必须兼容当前页面。
7. 每次阶段性修改后必须运行 npm run build。
```

---

## 14. 推荐新增 package 依赖

第一阶段尽量少加依赖。

建议：

```text
nanoid：生成 id；当前 node_modules 中已有依赖链，但建议显式加入 package.json。
```

如果 Pages Functions 使用 TypeScript，则需要确认项目配置。为了降低复杂度，也可以先使用 `.js` 文件实现 Functions。

Word / PPT 解析阶段再考虑引入：

```text
mammoth       DOCX 文本提取
jszip         PPTX 解压读取 XML
fast-xml-parser 或浏览器 DOMParser 替代方案
```

注意：Cloudflare Workers runtime 不是完整 Node.js 环境。引入依赖前必须确认可以在 Workers 环境运行。复杂 Office 解析如果不适配 Workers，应拆到单独解析服务。

---

## 15. 风险与处理策略

### 15.1 大文件风险

风险：普通 Worker API 上传大文件可能遇到请求大小限制。

处理：

```text
MVP：先限制单文件大小，例如 20MB / 50MB。
后续：实现 R2 multipart upload。
```

### 15.2 Worker 解析 Office 文件风险

风险：Word / PPT / 大 Excel 在 Worker 中解析可能超时或内存不足。

处理：

```text
MVP：前端解析 Excel + 后端保存结构化结果。
第二阶段：小文件后端解析。
第三阶段：重解析任务迁移到专门 Node/Python 服务或 Cloudflare Workflow。
```

### 15.3 数据结构破坏风险

风险：远程数据结构不兼容现有分析页。

处理：

```text
/api/dashboard/latest 必须返回当前 dashboardState 兼容结构。
新增 remoteId，但不要移除原字段。
```

### 15.4 权限误配风险

风险：本地开发 fallback 被带到生产。

处理：

```text
生产环境 ENVIRONMENT=production 时，必须强制校验 Cloudflare Access 用户信息。
Access 只负责准入，users.role 才是应用授权来源。所有写 API 在服务端重新读取 role，不能仅依赖前端隐藏按钮。
INITIAL_ADMIN_EMAILS 必须分别在 Preview/Production 配置；角色 API 禁止自我改角色和移除最后一名 admin，所有角色变更写 audit_logs。
```

---

## 16. 最小可交付版本 MVP 定义

MVP 完成后，系统应该具备：

```text
1. 用户需要通过 Cloudflare Access 登录。
2. 系统能识别用户角色 admin/editor/viewer。
3. bootstrap admin 可以在用户管理页为已登录 Access 用户分配 admin/editor/viewer，且系统防止自我锁定和最后一名 admin 被移除。
4. 用户可以新建文件夹。
5. 用户可以上传 Excel 到指定文件夹。
6. 原始 Excel 存到 R2。
7. 文件元数据存到 D1。
8. Excel 解析后的 dashboardState 存到 D1。
9. 首页、完整表格页、搜索页、厂牌分析、品种分析、靶点分析读取远程数据。
10. 用户可以在表格页直接编辑解析后的数据。
11. 修改后刷新页面仍然保留。
12. 角色、文件和数据写操作的审计记录进入 audit_logs。
13. 原本本地 demo / IndexedDB fallback 仍然可用，但不会绕过受保护操作的 401/403。
```

---

## 17. 不在 MVP 中完成的内容

以下功能放到第二阶段或第三阶段：

```text
1. 大文件 multipart upload。
2. Word / PPT 深度解析。
3. PDF / 图片 OCR。
4. Vectorize 语义检索。
5. AI 自动总结分析。
6. 多人实时协同编辑。
7. 文件在线预览 Office 原文。
8. 复杂版本 diff。
9. 定时自动抓取外部网站数据。
```

---

## 18. 给 Codex 的执行要求

Codex 执行时请遵守：

```text
1. 先阅读 README.md、package.json、src/main.js、src/state/storage.js、src/parser/*、src/*AnalysisPage.js。
2. 在任何代码修改前，先执行 git status 并确认当前分支。
3. 不允许直接在 main / master 上进行本次框架改造。
4. 必须先从最新 main / master 创建 feature/cloudflare-fullstack-storage 或同类 feature 分支。
5. 如果工作区存在未提交修改，先说明风险并建议 commit / stash / 放弃修改，不要直接覆盖。
6. 先生成详细 implementation plan，不要直接大规模改代码。
7. 在实现 Cloudflare 相关代码前，必须先输出 Cloudflare 控制台手动配置清单。
8. 不得默认 D1、R2、Access、Pages bindings 已存在；缺失时必须提示用户手动创建或确认。
9. 每个 phase 单独提交或至少单独说明修改范围。
10. 每个 phase 推荐单独 git commit，便于回滚。
11. 优先保持 dashboardState 兼容。
12. 新增 API 前先定义 request / response shape。
13. 所有新增 API 必须有权限校验。
14. 任何 destructive 操作，例如删除文件夹 / 删除文件，必须检查权限。
15. 不要删除当前前端功能。
16. 不要把 R2 文件公开暴露为无鉴权 URL。
17. 不要把 D1 database_id 以外的密钥、token、Access secret 或敏感凭证写入代码仓库。
18. 每个阶段运行 npm run build。
19. Codex 自检通过后，只能提示用户进行本地实机验证；未收到用户明确确认前，不允许合并回主分支。
20. 用户本地实机验证通过并明确发出合并指令后，才可以通过 Pull Request 或 git merge --no-ff 合并回主分支。
21. 如果合并后发现问题，优先 git revert，不要直接 force push 主分支。
```

---

## 19. 第一条 Codex Prompt 建议

可以把下面这段直接发给 Codex：

```text
请阅读当前项目和 CODEX_FRAMEWORK_ADJUSTMENT_PLAN.md。不要立即大规模修改代码。请先输出一个分阶段 implementation plan，说明你会如何把当前 Vite 纯前端项目升级为 Cloudflare Pages + Pages Functions + D1 + R2 架构。要求保持现有首页、表格页、搜索页、厂牌分析、品种分析、靶点分析可用，并优先保持 dashboardState 数据结构兼容。

在 implementation plan 中必须包含 Git 分支策略和合并保护策略：

1. 任何修改前先检查 git status。
2. 必须从最新 main / master 创建全新的 feature/cloudflare-fullstack-storage 或同类 feature 分支。
3. 所有代码修改只能发生在新创建的 feature 分支中。
4. 如果工作区不干净，先说明风险，不要直接覆盖。
5. 每个 phase 完成后，Codex 需要先运行 npm run build 和必要的页面 / API 自检。
6. Codex 自检通过后，不允许直接合并主分支，只能提示用户进行本地实机验证。
7. 用户会在本地真实环境手动验证一次。
8. 只有用户明确回复“本地实机验证通过，可以合并到 main”或同等意思后，才允许通过 Pull Request 或 git merge --no-ff 合并回主分支。
9. 未收到用户明确合并指令前，不得执行 git merge、不得 merge PR、不得 push 到 main / master。

另外，在 implementation plan 中必须单独包含 Cloudflare 控制台配置清单，明确哪些操作需要我手动完成。至少包括：

1. 如何创建或确认 Cloudflare Pages project；
2. 如何创建 D1 database；
3. 如何创建 R2 bucket；
4. wrangler.toml 中 database_id、database_name、bucket_name 应该从哪里获取；
5. Pages 项目中需要配置哪些 bindings；
6. Preview 和 Production 环境变量应该如何设置；
7. Cloudflare Access 需要保护哪个域名或 Pages project；
8. D1 migrations 应该如何执行；
9. 部署后我应该如何验证 API 是否真的连接到了 D1 和 R2。

请先列出 Phase 0 到 Phase 6 的具体文件改动、API 设计、数据库 migration、Cloudflare 手动配置步骤、风险点、Codex 自检方式、用户本地实机验证方式和合并前检查清单。
```

第二条 Codex Prompt：

```text
请开始执行 Phase 0 和 Phase 1。执行任何代码修改前，必须先运行 git status，确认当前分支；如果当前在 main / master，请先从最新主分支创建全新的 feature/cloudflare-fullstack-storage 或同类 feature 分支，所有修改都必须发生在该 feature 分支上。

如果 feature/cloudflare-fullstack-storage 已存在，不要直接复用旧分支，请创建 feature/cloudflare-fullstack-storage-v2 或带日期后缀的新分支。如果工作区存在未提交修改，先说明风险并建议 commit / stash / 放弃修改，不要直接覆盖。

本阶段只新增 Cloudflare 后端基础、wrangler.toml、D1 migration、auth middleware 和 GET /api/auth/me。不要改动现有分析页面逻辑。

在写 Cloudflare 相关代码前，请先输出 Cloudflare 控制台手动配置清单，明确告诉我：
1. 我需要在哪里创建 D1 database；
2. 我需要在哪里创建 R2 bucket；
3. database_id、database_name、bucket_name 从哪里获取；
4. Pages project 里需要绑定哪些资源；
5. Preview / Production 需要设置哪些环境变量；
6. Cloudflare Access 需要如何配置；
7. 如果这些配置还没完成，本阶段哪些内容只能做本地代码验证，哪些内容必须等我完成 Cloudflare Dashboard 配置后才能真实验证。

完成后运行 npm run build，并说明：

1. 当前 Git 分支。
2. 新增文件。
3. 修改文件。
4. Cloudflare 控制台配置待办事项。
5. Codex 已完成的自检结果。
6. 用户接下来应该如何在本地实机验证。
7. 用户接下来应该如何在 Cloudflare 上完成或检查配置。
8. 当前是否仍在 feature 分支。
9. 明确说明：在用户完成本地实机验证并手动确认之前，不要合并到 main / master。
```

第三条 Codex Prompt：用户本地验证通过后再发送

```text
我已经在本地实机环境验证过当前 feature 分支，确认 npm run build、本地页面打开和本阶段新增功能都没有问题。现在可以将该 feature 分支合并到 main。

请在合并前再次确认当前分支、git status、最近 commit 和目标主分支；然后通过 Pull Request 或 git merge --no-ff 合并回 main。合并完成后请说明 merge commit、最终分支状态和回滚方式。
```

---


---

第四条 Codex Prompt：Cloudflare 配置完成后进行真实联调

```text
我已经在 Cloudflare Dashboard 中完成或确认了 Pages project、D1 database、R2 bucket、Pages bindings、ENVIRONMENT 环境变量和 Cloudflare Access 配置。请基于当前 feature 分支继续进行真实 Cloudflare 联调。

请先检查 wrangler.toml 中的 D1 database_name、database_id、R2 bucket_name、DB binding 和 FILES_BUCKET binding 是否与 Cloudflare 配置一致。然后验证：

1. D1 migration 是否已正确执行；
2. /api/auth/me 是否能通过 Cloudflare Access 获取当前用户；
3. /api/folders 是否能读写 D1；
4. /api/files/upload 是否能把原始文件写入 R2，并把文件元数据写入 D1 的 files / file_versions 表；
5. /api/dashboard/latest 是否能从 D1 返回兼容 dashboardState 的数据；
6. R2 文件是否没有被公开暴露为无鉴权 URL。

请完成验证后输出：
1. Cloudflare 配置核对结果；
2. API 验证结果；
3. 发现的问题；
4. 仍需我手动确认的事项；
5. 是否可以进入用户本地实机验证阶段。

注意：即使 Cloudflare 联调通过，也不要直接合并到 main / master，必须等我本地实机验证后明确说可以合并。
```

---

## 20. 最终目标状态

完成全部改造后，项目应该从：

```text
纯前端本地 Excel 看板
```

升级为：

```text
带权限控制的企业资料库 + 数据解析 + 数据分析平台
```

并且继续保留当前已经完成且效果较好的：

```text
厂牌分析
品种分析
靶点分析
首页经营看板
完整表格详情
关键词搜索
```
