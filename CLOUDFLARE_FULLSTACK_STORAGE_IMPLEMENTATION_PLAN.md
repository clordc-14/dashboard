# Cloudflare Fullstack Storage Implementation Plan

> Status: planning document only. Do not treat this document as approval to execute implementation.
> Generated for the current project at `D:\报表展示页面`.

This document converts the agreed Cloudflare fullstack storage plan into an execution-ready reference for future Codex conversations. Future implementation turns must read this file and the upstream framework plan before changing code:

```text
C:\Users\崔长润\Downloads\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md
```

The goal is to upgrade the current Vite-only frontend into:

```text
Cloudflare Pages static frontend
  + Cloudflare Pages Functions API
  + Cloudflare D1 structured storage
  + Cloudflare R2 original file storage
  + Cloudflare Access authentication
```

The implementation must preserve the current homepage, table page, search page, brand analysis page, product analysis page, and target analysis page. The primary compatibility boundary is the existing `dashboardState` data shape:

```js
{
  meta: {},
  newsSections: [],
  tableSections: []
}
```

Do not change `dashboardConfig.js` section keys, and do not break the current row shape:

```js
{
  id: "...",
  values: {},
  fields: {},
  links: {}
}
```

Remote APIs may add compatible metadata such as `remoteId`, but must not remove or rename the existing fields used by the current pages.

---

## 1. Current Project Snapshot

Current repo facts from the planning pass:

```text
Branch: main
Remote: https://github.com/clordc-14/dashboard.git
Project type: Vite multi-entry static frontend
Build command: npm run build
Output directory: dist
```

Current user-facing pages:

```text
index.html
table.html
search.html
analysis.html
product-analysis.html
target-analysis.html
```

Important current source files:

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

Current data flow:

```text
User uploads Excel
  -> src/main.js reads workbook through src/parser/excelParser.js
  -> src/parser/sectionMatcher.js matches news/table sections
  -> src/parser/normalizer.js normalizes sections
  -> src/state/storage.js saves dashboardState to IndexedDB/sessionStorage
  -> existing pages load local dashboardState, then fallback to demoWorkbookState
```

Important compatibility observations:

- `analysisPage.js`, `productAnalysisPage.js`, and `targetAnalysisPage.js` depend heavily on `tableSections` keys such as `innovativeDrugPool` and `drugScore`.
- `tablePage.js` expects table rows to contain `values`, `fields`, and `links`.
- `searchPage.js` searches across `newsSections[].items` and `tableSections[].rows`.
- `demoWorkbookState.js` must stay as a final fallback.
- `src/state/storage.js` must stay as local fallback.

---

## 2. Non-Execution Rule For This Document

This document is not an instruction to start implementation immediately.

Future implementation conversations must:

1. Read this document.
2. Read `CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md`.
3. Check `git status --short --branch` before any modification.
4. Create a fresh feature branch before code changes.
5. Execute only the requested phase or phase range.

If a future prompt says "execute Phase N", implement only that phase unless the user explicitly expands scope.

---

## 3. Git Branch Strategy And Merge Protection

### 3.1 Required Pre-Change Checks

Before any code or tracked-file modification, Codex must run:

```bash
git status --short --branch
git branch --show-current
```

If the working tree is not clean, Codex must stop and explain the risk. Do not overwrite or silently incorporate uncommitted user changes. Suggest one of:

```text
1. Commit the existing changes first.
2. Stash the existing changes first.
3. Discard the existing changes only if the user explicitly asks.
4. Continue only if the user explicitly accepts the risk.
```

### 3.2 Feature Branch Creation

Implementation must not happen directly on `main` or `master`.

Required flow:

```bash
git checkout main
git pull origin main
git checkout -b feature/cloudflare-fullstack-storage
```

If `feature/cloudflare-fullstack-storage` already exists, do not reuse it blindly. Use a fresh branch name, for example:

```bash
git checkout -b feature/cloudflare-fullstack-storage-v2
git checkout -b feature/cloudflare-fullstack-storage-20260701
```

### 3.3 Phase Commits

Each phase should be committed separately for review and rollback:

```bash
git add .
git commit -m "Phase 1: add Cloudflare backend foundation"
```

Do not combine Phase 1 through Phase 6 into one large commit.

### 3.4 No Auto-Merge Rule

After Codex self-check passes, Codex must stop and ask the user to perform local real-machine verification.

Do not run any of the following without explicit user confirmation that local verification passed and merge is allowed:

```bash
git merge
git push origin main
```

Do not merge a GitHub Pull Request without explicit user confirmation.

Accepted confirmation examples:

```text
本地实机验证通过，可以合并到 main。
我已经本地验证过了，可以 merge。
```

### 3.5 Merge Options After User Approval

Preferred GitHub flow:

```text
1. Push feature branch.
2. Open Pull Request.
3. Wait for Cloudflare Preview Deployment / CI.
4. User verifies locally and/or on preview.
5. User explicitly approves merge.
6. Merge PR.
```

Local merge flow if the user asks for it:

```bash
git checkout main
git pull origin main
git merge --no-ff feature/cloudflare-fullstack-storage
git push origin main
```

Rollback after merge should use `git revert <merge_commit_id>`, not force-push, unless the user explicitly approves history rewriting.

---

## 4. Cloudflare Manual Configuration Checklist

The user must complete or confirm these Cloudflare Dashboard items. Codex must not assume they already exist.

### 4.1 Pages Project

In Cloudflare Dashboard:

```text
Workers & Pages -> Create application -> Pages -> Connect to Git
```

Confirm:

```text
Repository: clordc-14/dashboard
Production branch: main
Build command: npm run build
Build output directory: dist
```

If the Pages project already exists, confirm the same settings.

### 4.2 D1 Database

Create a production D1 database, suggested:

```text
sinopharm-new-drug-dashboard-prod
```

Create a preview/development D1 database if possible, suggested:

```text
sinopharm-new-drug-dashboard-preview
```

Values for `wrangler.toml`:

```text
database_name: the D1 database name shown in Cloudflare Dashboard
database_id: the UUID shown in the D1 database detail page, or returned by wrangler d1 create/list
binding: DB
```

### 4.3 R2 Bucket

Create a production R2 bucket, suggested:

```text
sinopharm-new-drug-files
```

Create a preview/development R2 bucket if possible, suggested:

```text
sinopharm-new-drug-files-preview
```

Values for `wrangler.toml`:

```text
bucket_name: the R2 bucket name
binding: FILES_BUCKET
```

Keep the bucket private. Do not expose original files through public unauthenticated URLs.

### 4.4 Pages Bindings

In the Pages project settings, configure both Preview and Production bindings:

```text
D1 database binding:
  Variable name: DB
  Database: corresponding D1 database

R2 bucket binding:
  Variable name: FILES_BUCKET
  Bucket: corresponding R2 bucket
```

### 4.5 Environment Variables

Production:

```text
ENVIRONMENT=production
ACCESS_TEAM_DOMAIN=https://<team-name>.cloudflareaccess.com
ACCESS_AUD=<Cloudflare Access AUD tag>
MAX_UPLOAD_BYTES=20971520
INITIAL_ADMIN_EMAILS=<comma-separated bootstrap admin Access emails; never commit real values>
```

Preview:

```text
ENVIRONMENT=preview
ACCESS_TEAM_DOMAIN=https://<team-name>.cloudflareaccess.com
ACCESS_AUD=<preview or shared Access AUD tag>
MAX_UPLOAD_BYTES=20971520
INITIAL_ADMIN_EMAILS=<Preview bootstrap admin Access emails; never commit real values>
```

Local development can use `.dev.vars`:

```text
ENVIRONMENT=development
DEV_USER_EMAIL=dev@example.com
DEV_USER_NAME=Local Developer
DEV_USER_ROLE=admin
MAX_UPLOAD_BYTES=20971520
```

Do not commit tokens, API keys, Access secrets, or R2 credentials. `database_id` is configuration, not a secret.

`INITIAL_ADMIN_EMAILS` is used only while creating a user's first D1 record to bootstrap an administrator. After that, D1 is authoritative for roles. It never replaces a Cloudflare Access policy or grants site access by itself.

### 4.6 Cloudflare Access

Protect:

```text
Production custom domain: https://<your-domain>/*
Pages project domain: https://<project>.pages.dev/*
Preview deployment domains if used
```

Allowed users should be configured through Access policies:

```text
Specific emails, company email domain, or Cloudflare Access group
```

Pages Functions must still verify `Cf-Access-Jwt-Assertion` in non-development environments. Access protection at the edge is not enough by itself.

### 4.7 D1 Migrations

Local:

```bash
npx wrangler d1 migrations apply DB --local
```

Preview:

```bash
npx wrangler d1 migrations apply DB --preview
```

Production:

```bash
npx wrangler d1 migrations apply DB --remote
```

Before production migrations, confirm the target DB and take a backup/export if the database already contains important data.

### 4.8 Deployed API Verification

After deployment:

```text
1. Open the protected site and complete Cloudflare Access login.
2. GET /api/auth/me returns the Access user and D1 role.
3. Confirm an INITIAL_ADMIN_EMAILS user becomes admin on first login; use that admin to change a signed-in user's role and confirm the audit log.
4. Create a folder and confirm the row appears in D1 folders.
5. Upload a small Excel file and confirm:
   - object exists in R2
   - files and file_versions rows exist in D1
6. Import dashboardState and confirm /api/dashboard/latest returns meta/newsSections/tableSections.
7. Confirm R2 files are not accessible through unauthenticated public URLs.
```

---

## 5. Target Architecture

```text
Browser
  -> Cloudflare Pages static Vite app
  -> Pages Functions under /api/*
  -> Auth middleware verifies Cloudflare Access JWT
  -> D1 stores users, folders, metadata, datasets, rows, audit logs
  -> R2 stores original Excel/Word/PPT files and versions
```

MVP responsibility split:

```text
Frontend:
  - Keep current UI/pages alive.
  - Keep current Excel parsing first.
  - Upload original files where relevant.
  - Send parsed dashboardState to backend.
  - Read remote dashboardState with local fallback.

Pages Functions:
  - Authenticate user.
  - Enforce roles.
  - Store metadata and structured rows in D1.
  - Store original files in R2.
  - Reconstruct dashboardState-compatible responses.
  - Audit online edits.
```

---

## 6. API Design

### 6.1 Auth

```text
GET /api/auth/me
```

Response:

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

Behavior:

```text
development: allow dev fallback user
preview/production: require valid Cloudflare Access JWT
D1 users table decides final app role
unknown Access user: insert as viewer or return 403 based on chosen implementation default
```

Recommended default for MVP:

```text
Unknown authenticated Access user is inserted as viewer.
Before Phase 2, controlled D1 operations may recover a role; from Phase 2, admins assign roles through the user-management UI.
```

### 6.2 User And Role Management

Role model:

```text
Cloudflare Access decides whether a person can reach the application.
D1 users.role decides what an authenticated person may do inside the application.

admin: manage user roles, all folders/files, imports, online edits, and destructive actions.
editor: create/rename folders, upload and version files, import, and edit rows; cannot manage roles or delete records.
viewer: read authorized data and file metadata only; may not perform mutations.
```

User lifecycle and safety rules:

```text
1. The first authenticated Access request creates a D1 users record with role=viewer by default.
2. An address in INITIAL_ADMIN_EMAILS receives admin only when its users record is first created; real email values live only in Cloudflare environment configuration.
3. The management page lists only Access users that have already signed in and therefore have a D1 record. MVP does not invite users or create accounts outside Access.
4. Only admin may change a role. The server validates the role allowlist and never trusts the client.
5. An admin cannot change their own role and cannot demote or remove the last remaining admin.
6. Every successful role change writes actor, subject, before_json, after_json, and timestamp to audit_logs.
7. Every API request reads the current D1 role, so a role change applies on the next request; client-side UI is never an authorization boundary.
```

Phase 2 API:

```text
GET   /api/users?query=<email-or-name>&role=<role>&cursor=<cursor>
PATCH /api/users/:id/role
```

`PATCH /api/users/:id/role` request and response:

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

Create request:

```json
{
  "parentId": null,
  "name": "2026创新药资料"
}
```

Rules:

```text
viewer: read only
editor/admin: create and rename
delete: admin only, and only if folder contains no child folders and no active files
```

### 6.4 Files

```text
GET    /api/files?folderId=<id>
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
POST   /api/files/:id/version
```

Upload request:

```text
multipart/form-data
  folderId=<folder id>
  file=<xlsx/xls/docx/pptx>
```

Upload response:

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

R2 key format:

```text
folders/{folderId}/files/{fileId}/v{version}/{safeFileName}
```

Supported MVP extensions:

```text
.xlsx
.xls
.docx
.pptx
```

Only `.xlsx` / `.xls` need dashboard import support in Phase 4.

### 6.5 Dashboard

```text
POST /api/dashboard/import
GET  /api/dashboard/latest
```

Import request:

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

Latest response must stay compatible:

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

Rules:

```text
POST requires admin/editor.
GET requires authenticated user.
GET returns 404 when no remote dashboard exists, so frontend can fallback.
Rows/items include remoteId while preserving existing id/values/fields/links.
```

### 6.6 Dataset Rows

```text
PATCH /api/dataset-rows/:id
```

Request:

```json
{
  "data": {
    "values": {},
    "fields": {},
    "links": {}
  }
}
```

Rules:

```text
admin/editor only
read old data_json
merge compatible row shape
write new data_json
write audit_logs before_json and after_json
return updated row
```

Response:

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

## 7. D1 Migration Design

Create:

```text
migrations/0001_initial_schema.sql
```

Required tables:

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

Indexes:

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

## 8. Phase-by-Phase Implementation

### Phase 0: Safety Baseline

Purpose:

```text
Create a safe implementation branch and confirm baseline build before changing code.
```

File changes:

```text
None.
```

Commands:

```bash
git status --short --branch
git checkout main
git pull origin main
git checkout -b feature/cloudflare-fullstack-storage
git branch --show-current
npm install
npm run build
```

Self-check:

```text
1. Current branch is not main/master.
2. npm run build passes.
3. Existing six Vite entries are still present.
4. No business logic changed.
5. The admin/editor/viewer matrix, the owner of bootstrap-admin configuration, and the boundary between Access policies and application roles are agreed.
```

User local verification:

```text
1. Confirm feature branch name.
2. Run npm install.
3. Run npm run build.
4. Confirm main/master was not modified directly.
```

Commit:

```text
No commit is required unless package lock changes from npm install.
```

---

### Phase 1: Cloudflare Backend Foundation

Purpose:

```text
Add Cloudflare Pages Functions foundation, auth middleware, D1 schema, and /api/auth/me.
```

File changes:

```text
Add:
  wrangler.toml
  migrations/0001_initial_schema.sql
  functions/_middleware.js
  functions/api/auth/me.js
  functions/lib/auth.js
  functions/lib/db.js
  functions/lib/http.js

Modify:
  package.json
  package-lock.json
```

Package additions:

```text
wrangler as devDependency
jose for Access JWT verification
nanoid for IDs, if not using crypto.randomUUID()
```

Implementation notes:

```text
1. Use .js Pages Functions to avoid TypeScript setup in MVP.
2. Middleware attaches authenticated user to request context.
3. In ENVIRONMENT=development, allow dev fallback.
4. In ENVIRONMENT=preview/production, require Cloudflare Access JWT.
5. users table determines role; unknown Access users default to viewer.
6. INITIAL_ADMIN_EMAILS can grant admin only when a matching user's first D1 record is created; D1 remains authoritative afterwards.
7. /api/auth/me returns normalized current user.
```

`wrangler.toml` initial placeholders:

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

API:

```text
GET /api/auth/me
```

Self-check:

```text
1. npm run build passes.
2. npx wrangler pages dev dist can start locally.
3. GET /api/auth/me returns dev user in development.
4. Production/preview path rejects missing Access JWT.
5. Bootstrap admin values come only from environment configuration; no real email is hard-coded.
6. No secret values are committed.
```

User local verification:

```text
1. Run local Pages dev.
2. Open /api/auth/me.
3. Confirm dev user response.
4. After Cloudflare setup, confirm real Access user email and D1 role.
```

Commit:

```bash
git add .
git commit -m "Phase 1: add Cloudflare backend foundation"
```

---

### Phase 2: RBAC, Folder API, Library, And User Management

Purpose:

```text
Add visual role assignment, server-side RBAC, folder CRUD APIs, and a library UI without touching analysis logic.
```

File changes:

```text
Add:
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

Modify:
  functions/lib/auth.js
  functions/lib/db.js
  vite.config.js
  src/main.js
  src/styles/dashboard.css
```

Frontend notes:

```text
1. Add a "资料库" entry in the homepage topbar; only admin also sees "User Management".
2. users.html is a compact administration table with name/email, current role, creation time, last role-update time, and actions.
3. Admin assigns admin/editor/viewer with a row-level role selector and confirmation dialog; MVP does not create or invite accounts outside Access.
4. The current administrator's selector is disabled; the last admin is also protected server-side with a 409 response.
5. files.html renders folder list and breadcrumb; viewer is read-only, editor/admin can create and rename, and only admin sees deletion.
6. UI is only an affordance: every mutation must be checked again by requireRole/requireAdmin in Pages Functions.
```

API:

```text
GET    /api/folders?parentId=<id|null>
POST   /api/folders
PATCH  /api/folders/:id
DELETE /api/folders/:id
GET    /api/users?query=<email-or-name>&role=<role>&cursor=<cursor>
PATCH  /api/users/:id/role
```

Role API and migration requirements:

```text
1. 0002_user_management.sql adds users.role_updated_at, users.role_updated_by, and idx_users_role while keeping existing users readable.
2. PATCH accepts only admin/editor/viewer and requires the acting user to be admin.
3. Reject self-role changes and attempts to make the final admin a non-admin.
4. Update role_updated_at, role_updated_by, and updated_at with the role and write audit_logs in the same D1 batch/transaction boundary.
5. Folder creation, rename, and deletion use the same authorization helper instead of copying checks into endpoints.
```

Self-check:

```text
1. npm run build passes; /files.html and /users.html are included in Vite build.
2. Admin can search signed-in users, change viewer to editor, and observe the persisted role after refresh.
3. Editor/viewer PATCH /api/users/:id/role receives 403.
4. An admin cannot change their own role, and the final admin cannot be demoted (409).
5. Admin/editor can create folders; viewer cannot create/delete; editor cannot delete.
6. Every role change has correct audit_logs before/after data.
7. Existing six pages still build and render.
```

User local verification:

```text
1. Sign in as the bootstrap admin, open User Management, and confirm only users that signed in through Access are listed.
2. Change a viewer to editor, then sign in as each role and confirm UI and API boundaries.
3. Confirm self-demotion and final-admin removal are rejected.
4. Open the library, create and enter a child folder, and verify viewer/editor/admin differences.
```

Commit:

```bash
git add .
git commit -m "Phase 2: add RBAC management and library page"
```

---

### Phase 3: File Upload To R2

Purpose:

```text
Store original uploaded files in R2 and file metadata in D1.
```

File changes:

```text
Add:
  functions/api/files/index.js
  functions/api/files/upload.js
  functions/api/files/[id].js
  functions/api/files/[id]/version.js
  functions/lib/files.js
  functions/lib/r2.js

Modify:
  src/filesPage.js
  src/services/apiClient.js
  src/styles/dashboard.css
```

API:

```text
GET    /api/files?folderId=<id>
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
POST   /api/files/:id/version
```

Implementation notes:

```text
1. Validate extension and size before R2 write.
2. Use MAX_UPLOAD_BYTES, default 20 MB.
3. Generate safe R2 key.
4. Write to R2 first, then D1 metadata.
5. If D1 write fails after R2 write, attempt best-effort R2 cleanup and return error.
6. Do not expose direct public R2 URLs.
7. DELETE should archive in MVP unless hard delete is explicitly required.
8. Reuse the Phase 2 authorization helper for every file API: viewer is read-only, editor/admin may upload and create versions, and only admin may archive/delete.
9. uploaded_by, version creator, and audit records use the current D1 user id; clients cannot supply user identity.
```

Self-check:

```text
1. npm run build passes.
2. Upload UI appears on files.html.
3. Small file upload creates D1 files and file_versions rows.
4. R2 object exists.
5. Returned file list has name, size, ext, status, updatedAt.
6. No unauthenticated R2 URL is exposed.
7. Viewer upload and editor deletion receive 403; admin archive/delete writes audit_logs.
```

User local verification:

```text
1. Upload a small Excel file in a folder.
2. Confirm it appears in the library page.
3. Confirm D1 metadata.
4. Confirm R2 object exists in Cloudflare Dashboard.
5. Verify upload, version, and deletion boundaries as viewer, editor, and admin.
```

Commit:

```bash
git add .
git commit -m "Phase 3: add R2 file upload"
```

---

### Phase 4: Remote dashboardState Import

Purpose:

```text
Persist parsed dashboardState to D1 and reconstruct remote dashboardState for the existing pages.
```

File changes:

```text
Add:
  src/parser/buildDashboardState.js
  functions/api/dashboard/import.js
  functions/api/dashboard/latest.js
  functions/lib/dashboardState.js

Modify:
  src/main.js
  src/services/apiClient.js
```

Frontend notes:

```text
1. Move buildDashboardState(workbook) out of src/main.js into src/parser/buildDashboardState.js.
2. Homepage upload still parses Excel in browser.
3. Save parsed state to local IndexedDB as before.
4. If user is authenticated and API is available, POST dashboardState to /api/dashboard/import.
5. Remote import failure must not break local parsing success.
6. Import requires editor/admin; the server writes import actor and summary to audit_logs and never accepts imported_by from the client.
```

API:

```text
POST /api/dashboard/import
GET  /api/dashboard/latest
```

D1 mapping:

```text
dashboard_imports:
  one row per import; only one current import

datasets:
  one row per news/table section
  store section_key, title, type, source_json, columns_json

dataset_rows:
  one row per news item or table row
  data_json stores the compatible item/row JSON
```

Reconstruction rules:

```text
1. latest finds current dashboard_import.
2. Load datasets in section order.
3. For news datasets, reconstruct { key,title,type,source,items }.
4. For table datasets, reconstruct { key,title,type,source,columns,rows }.
5. Add remoteId to items/rows.
6. Preserve original id/values/fields/links.
7. meta.mode should be "remote".
```

Self-check:

```text
1. npm run build passes.
2. buildDashboardState export returns same shape as previous inline function.
3. POST import succeeds with demo or parsed state.
4. GET latest returns compatible sections.
5. innovativeDrugPool and drugScore keys are present when imported source contains them.
6. Local IndexedDB fallback still works.
7. Viewer POST import receives 403; editor/admin imports carry correct actor audit data.
```

User local verification:

```text
1. Upload Excel.
2. Confirm existing pages update.
3. Refresh page and confirm remote dashboard can be loaded.
4. Confirm homepage, table, search, brand analysis, product analysis, and target analysis still work.
```

Commit:

```bash
git add .
git commit -m "Phase 4: persist dashboard state remotely"
```

---

### Phase 5: Page Data Source Fallback

Purpose:

```text
Make all existing pages remote-first while preserving IndexedDB/sessionStorage/demo fallback.
```

File changes:

```text
Add:
  src/state/dashboardState.js

Modify:
  src/main.js
  src/tablePage.js
  src/searchPage.js
  src/analysisPage.js
  src/productAnalysisPage.js
  src/targetAnalysisPage.js
```

New client helper:

```js
loadDashboardStateWithFallback()
```

Fallback order:

```text
1. GET /api/dashboard/latest
2. loadDashboardState() from IndexedDB/sessionStorage
3. demoWorkbookState
```

Behavior:

```text
1. API 404 means no remote data, use local fallback.
2. API 401/403 must never become an authorization bypass: protected user-management, folder, file, import, and editing actions remain denied. Only a product-approved read-only analysis page may render local/demo data.
3. API 500/network failure means use local/demo and log warning.
4. Never show a blank page solely because remote data failed.
```

Self-check:

```text
1. npm run build passes.
2. All six pages render when API succeeds.
3. All six pages render when API 404s.
4. All six pages render when API errors.
5. Console has no uncaught promise rejections.
6. A 403 does not reveal unavailable write controls or invoke a remote mutation fallback.
```

User local verification:

```text
1. Test with API running.
2. Test with API unavailable.
3. Confirm remote data takes priority when available.
4. Confirm demo/local fallback still works.
```

Commit:

```bash
git add .
git commit -m "Phase 5: load remote dashboard state with fallback"
```

---

### Phase 6: Online Row Editing

Purpose:

```text
Allow admin/editor users to edit table rows online and persist the edited row JSON to D1.
```

File changes:

```text
Add:
  functions/api/dataset-rows/[id].js

Modify:
  functions/lib/audit.js
  src/tablePage.js
  src/services/apiClient.js
  src/styles/dashboard.css
```

API:

```text
PATCH /api/dataset-rows/:id
```

Request:

```json
{
  "data": {
    "values": {},
    "fields": {},
    "links": {}
  }
}
```

Implementation notes:

```text
1. Only admin/editor may edit.
2. Load existing dataset_rows.data_json.
3. Merge compatible row data without dropping id/remoteId.
4. Update dataset_rows.data_json and updated_at.
5. Write audit_logs with before_json and after_json.
6. Return the updated row.
7. Reload the current D1 role per request; a Phase 2 role change must not keep authorizing a stale browser role.
```

Frontend notes:

```text
1. tablePage.js calls /api/auth/me to determine role.
2. Admin/editor sees an edit action for rows with remoteId.
3. Viewer is read-only.
4. Rows without remoteId are read-only local/demo rows.
5. Save updates current in-memory dashboardState so the user sees the change immediately.
6. Cancel restores original row.
```

Self-check:

```text
1. npm run build passes.
2. Admin/editor can edit and save one row.
3. Refresh shows the edited value.
4. audit_logs contains before/after JSON.
5. Viewer PATCH receives 403.
6. Rows without remoteId cannot be edited.
```

User local verification:

```text
1. Log in as editor/admin.
2. Edit a table row.
3. Refresh and confirm persistence.
4. Open homepage/search/analysis pages and confirm compatibility.
5. Test viewer role and confirm edit is unavailable or forbidden.
```

Commit:

```bash
git add .
git commit -m "Phase 6: add online row editing"
```

---

## 9. Unified Verification After Every Phase

After each phase, Codex must run:

```bash
npm run build
```

Also verify, as applicable:

```text
1. index.html can open.
2. table.html can open.
3. search.html can open.
4. analysis.html can open.
5. product-analysis.html can open.
6. target-analysis.html can open.
7. files.html can open after Phase 2.
8. Relevant /api endpoints pass local or preview checks.
9. No secrets are committed.
10. Current branch remains the feature branch.
```

Codex may report "self-check passed", but must not treat that as merge approval.

---

## 10. Risks And Mitigations

### 10.1 dashboardState Compatibility

Risk:

```text
Remote rows lose fields, values, links, columns, source, or section keys.
```

Mitigation:

```text
Use JSON preservation in D1. Reconstruct remote dashboardState as close to original as possible. Only add remoteId.
```

### 10.2 Access Misconfiguration

Risk:

```text
Development fallback user accidentally works in production.
```

Mitigation:

```text
Only allow fallback when ENVIRONMENT=development. Preview/production require Cloudflare Access JWT.
```

### 10.3 D1/R2 Binding Missing

Risk:

```text
Local build passes, but deployed APIs fail because Pages bindings are missing.
```

Mitigation:

```text
Document DB and FILES_BUCKET bindings clearly. Add startup/endpoint errors that name the missing binding.
```

### 10.4 Large File Uploads

Risk:

```text
Workers request limits or memory limits affect large Office files.
```

Mitigation:

```text
MVP limits file size through MAX_UPLOAD_BYTES, default 20 MB. Multipart upload can be added later.
```

### 10.5 Partial Upload Failure

Risk:

```text
R2 write succeeds but D1 metadata write fails.
```

Mitigation:

```text
Attempt best-effort R2 cleanup. Return clear error. Do not show file in UI unless D1 metadata exists.
```

### 10.6 Editing Data Drift

Risk:

```text
Online row edit changes values but not fields, breaking analysis pages.
```

Mitigation:

```text
Patch API accepts both values and fields. UI should update both when editing a known column with a field mapping.
```

### 10.7 Role Misconfiguration And Admin Lockout

Risk:

```text
Every first-time user receives viewer, leaving no administrator, or an administrator demotes themselves/the final admin and removes the ability to manage roles.
```

Mitigation:

```text
1. Configure INITIAL_ADMIN_EMAILS separately in Preview and Production, then verify at least one administrator after first Access login.
2. Permit the role API only for admin, prohibit self-role changes, and prohibit removing the final admin.
3. Write every role change to audit_logs. Perform emergency recovery only through controlled D1 operations and record the reason.
4. Access policy remains the admission layer; an application admin cannot admit anyone who has not passed Access.
```

---

## 11. Merge Precheck

Before merge, verify:

```text
1. All implementation commits are on feature/cloudflare-fullstack-storage or equivalent feature branch.
2. git status --short --branch is clean.
3. npm run build passes.
4. Existing six pages pass smoke checks.
5. files.html passes smoke check after Phase 2.
6. /api/auth/me works.
7. Folder API works.
8. Upload API writes D1 and R2.
9. Dashboard import/latest works.
10. Dataset row PATCH works.
11. Viewer role is read-only.
12. Admin can assign viewer/editor/admin; editor/viewer cannot invoke the role API; final-admin protection and audit records are verified.
13. No secrets, tokens, or private keys are committed.
14. Cloudflare Dashboard bindings are configured or clearly listed as pending.
15. User has completed local real-machine verification.
16. User has explicitly approved merge.
```

Only then may Codex create/merge a PR or perform `git merge --no-ff`.

---

## 12. Suggested Future Prompts

### Execute Phase 0 Only

```text
请阅读 CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md 和 C:\Users\崔长润\Downloads\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md，然后只执行 Phase 0。不要进入 Phase 1。执行前先检查 git status；如果工作区不干净，先停止并说明风险。
```

### Execute Phase 1 Only

```text
请阅读 CLOUDFLARE_FULLSTACK_STORAGE_IMPLEMENTATION_PLAN.md 和 C:\Users\崔长润\Downloads\CODEX_FRAMEWORK_ADJUSTMENT_PLAN_branch_workflow_cloudflare_config.md，然后在当前 feature 分支上只执行 Phase 1。不要改现有分析页面逻辑。完成后运行 npm run build，并输出 Cloudflare 控制台待办、Codex 自检结果和用户本地实机验证清单。
```

### Execute Next Phase

```text
请基于当前 feature 分支继续执行 Phase N。执行前检查 git status 和当前分支；如果不在 feature/cloudflare-fullstack-storage 或同类 feature 分支上，请停止并说明。完成后运行 npm run build 和本阶段 API/page 自检，不要合并 main。
```

### Merge After User Verification

```text
我已经在本地实机环境验证通过，可以合并到 main。请先检查当前分支、git status、最近 commit 和目标主分支，然后通过 PR 或 git merge --no-ff 合并。合并后说明 merge commit 和回滚方式。
```

---

## 13. Official Documentation References

Use Cloudflare official docs as the source of truth when implementation details differ from this plan:

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
