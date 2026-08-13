import { createIcons, icons } from "lucide";
import {
  ApiError,
  archiveFile,
  createFolder,
  deleteFolder,
  listFiles,
  listFolders,
  renameFolder,
  uploadFile,
  uploadFileVersion
} from "./services/apiClient.js";
import { formatRole, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#filesApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
let currentUser = { name: "当前用户", role: "viewer" };
let currentFolderId = getFolderIdFromUrl();
let library = { currentFolder: null, breadcrumbs: [{ id: null, name: "根目录" }], folders: [], files: [] };
let notice = null;
let isLoading = true;

initializeLibrary();

async function initializeLibrary() {
  currentUser = await loadCurrentUser();
  await loadLibrary();
}

async function loadLibrary() {
  isLoading = true;
  renderPage();

  try {
    const folderLibrary = await listFolders(currentFolderId);
    const fileLibrary = currentFolderId ? await listFiles(currentFolderId) : { files: [] };
    library = { ...folderLibrary, files: fileLibrary.files || [] };
    notice = null;
  } catch (error) {
    library = { currentFolder: null, breadcrumbs: [{ id: null, name: "根目录" }], folders: [], files: [] };
    notice = toNotice(error, "无法加载资料库，请稍后重试。");
  } finally {
    isLoading = false;
    renderPage();
  }
}

function renderPage() {
  const canManage = ["admin", "editor"].includes(currentUser.role);
  const canDelete = currentUser.role === "admin";
  const canUpload = canManage && Boolean(library.currentFolder?.id);

  app.innerHTML = `
    <div class="app-shell library-shell">
      <header class="topbar library-topbar">
        <a class="brand" href="/" aria-label="返回国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div><h1>国药西南新药引进网</h1><p>资料库</p></div>
        </a>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/"><i data-lucide="layout-dashboard"></i><span>经营看板</span></a>
          <a class="user-greeting" href="/welcome.html"><i data-lucide="circle-user-round"></i><span>欢迎，${escapeHtml(currentUser.name)}</span><small>${formatRole(currentUser)}</small></a>
        </div>
      </header>
      <main class="library-main">
        <section class="library-heading">
          <div><span class="eyebrow">共享资料</span><h2>资料库</h2><p>Office 原始文件以私有方式保存；可在文件夹内上传新文件或新增版本。</p></div>
          ${canManage ? `<div class="library-heading-actions"><button class="button button-ghost" id="createFolderButton" type="button"><i data-lucide="folder-plus"></i><span>新建文件夹</span></button>${canUpload ? '<button class="button button-primary" id="uploadFileButton" type="button"><i data-lucide="upload"></i><span>上传文件</span></button>' : '<span class="library-upload-guidance">请先进入或创建一个文件夹后上传。</span>'}</div>` : '<span class="readonly-badge"><i data-lucide="eye"></i>当前为只读模式</span>'}
        </section>
        ${renderNotice()}
        <nav class="library-breadcrumbs" aria-label="资料库路径">
          ${(library.breadcrumbs || []).map((item, index) => `${index ? '<i data-lucide="chevron-right" aria-hidden="true"></i>' : ""}<button type="button" data-folder-id="${escapeAttribute(item.id || "")}"${index === library.breadcrumbs.length - 1 ? " disabled" : ""}>${escapeHtml(item.name)}</button>`).join("")}
        </nav>
        <section class="library-panel" aria-busy="${isLoading}">
          <div class="library-panel-heading"><div><h3>${escapeHtml(library.currentFolder?.name || "根目录")}</h3><p>${isLoading ? "正在读取资料…" : `共 ${library.folders.length} 个文件夹，${library.files.length} 个文件`}</p></div></div>
          ${isLoading ? renderLoading() : renderLibraryContents(canManage, canDelete)}
        </section>
      </main>
    </div>
    ${renderFolderDialog()}
    ${renderFileDialog()}
    ${renderArchiveDialog()}
    ${renderDeleteDialog()}
  `;

  bindPageActions();
  createIcons({ icons });
}

function renderLibraryContents(canManage, canDelete) {
  const empty = !library.folders.length && !library.files.length;

  return `
    ${empty ? `<div class="library-empty"><i data-lucide="folder-open"></i><h3>${library.currentFolder ? "这里还没有资料" : "从文件夹开始整理资料"}</h3><p>${library.currentFolder ? (canManage ? "上传 Office 文件或新建子文件夹。" : "管理员或编辑者上传资料后会显示在这里。") : (canManage ? "先新建或进入一个文件夹，再上传文件。" : "管理员或编辑者创建文件夹后会显示在这里。")}</p></div>` : ""}
    <section class="library-content-section">
      <div class="library-content-heading"><h4><i data-lucide="folder"></i>文件夹</h4><span>${library.folders.length} 个</span></div>
      ${renderFolders(canManage, canDelete)}
    </section>
    <section class="library-content-section">
      <div class="library-content-heading"><h4><i data-lucide="file-text"></i>文件</h4><span>${library.files.length} 个</span></div>
      ${renderFiles(canManage, canDelete)}
    </section>
  `;
}

function renderFolders(canManage, canDelete) {
  if (!library.folders.length) return '<p class="library-content-empty">当前目录没有子文件夹。</p>';

  return `<div class="folder-grid">${library.folders.map((folder) => `
    <article class="folder-card">
      <button class="folder-open-button" type="button" data-open-folder="${escapeAttribute(folder.id)}"><i data-lucide="folder"></i><span><strong>${escapeHtml(folder.name)}</strong><small>更新于 ${formatDate(folder.updatedAt)}</small></span><i data-lucide="chevron-right"></i></button>
      ${(canManage || canDelete) ? `<div class="folder-card-actions">${canManage ? `<button class="icon-button" type="button" data-rename-folder="${escapeAttribute(folder.id)}" title="重命名 ${escapeAttribute(folder.name)}" aria-label="重命名 ${escapeAttribute(folder.name)}"><i data-lucide="pencil"></i></button>` : ""}${canDelete ? `<button class="icon-button is-danger" type="button" data-delete-folder="${escapeAttribute(folder.id)}" title="删除 ${escapeAttribute(folder.name)}" aria-label="删除 ${escapeAttribute(folder.name)}"><i data-lucide="trash-2"></i></button>` : ""}</div>` : ""}
    </article>
  `).join("")}</div>`;
}

function renderFiles(canManage, canArchive) {
  if (!library.files.length) return '<p class="library-content-empty">当前目录没有已上传文件。</p>';

  return `
    <div class="file-list-wrap"><table class="file-list"><thead><tr><th scope="col">名称</th><th scope="col">大小</th><th scope="col">类型</th><th scope="col">状态</th><th scope="col">更新于</th>${canManage || canArchive ? '<th scope="col"><span class="visually-hidden">操作</span></th>' : ""}</tr></thead>
      <tbody>${library.files.map((file) => `<tr>
        <td><span class="file-name"><i data-lucide="file"></i><strong>${escapeHtml(file.name)}</strong></span></td>
        <td>${formatFileSize(file.size)}</td><td><span class="file-ext">.${escapeHtml(file.ext)}</span></td><td><span class="file-status">${escapeHtml(formatFileStatus(file.status))}</span></td><td>${formatDate(file.updatedAt)}</td>
        ${canManage || canArchive ? `<td><div class="file-row-actions">${canManage ? `<button class="icon-button" type="button" data-version-file="${escapeAttribute(file.id)}" title="上传 ${escapeAttribute(file.name)} 的新版本" aria-label="上传 ${escapeAttribute(file.name)} 的新版本"><i data-lucide="upload"></i></button>` : ""}${canArchive ? `<button class="icon-button is-danger" type="button" data-archive-file="${escapeAttribute(file.id)}" title="归档 ${escapeAttribute(file.name)}" aria-label="归档 ${escapeAttribute(file.name)}"><i data-lucide="archive"></i></button>` : ""}</div></td>` : ""}
      </tr>`).join("")}</tbody>
    </table></div>
  `;
}

function renderLoading() {
  return '<div class="library-empty"><i data-lucide="loader-circle" class="is-spinning"></i><h3>正在加载</h3><p>正在读取当前目录。</p></div>';
}

function renderNotice() {
  if (!notice) return "";
  const icon = notice.type === "error" ? "circle-alert" : "circle-check";
  return `<div class="notice notice-${notice.type}"><i data-lucide="${icon}"></i><span>${escapeHtml(notice.text)}</span></div>`;
}

function renderFolderDialog() {
  return `
    <dialog class="management-dialog" id="folderDialog">
      <form id="folderForm" method="dialog">
        <div class="management-dialog-heading"><div><span class="eyebrow" id="folderDialogEyebrow">资料库</span><h2 id="folderDialogTitle">新建文件夹</h2></div><button class="icon-button" type="button" data-close-dialog="folderDialog" aria-label="关闭"><i data-lucide="x"></i></button></div>
        <label class="management-field"><span>文件夹名称</span><input id="folderNameInput" name="name" maxlength="120" required autocomplete="off" /></label>
        <p class="management-dialog-note" id="folderDialogNote">将在当前目录下创建文件夹。</p>
        <div class="management-dialog-actions"><button class="button button-ghost" type="button" data-close-dialog="folderDialog">取消</button><button class="button button-primary" id="folderSubmitButton" type="submit">确认创建</button></div>
      </form>
    </dialog>
  `;
}

function renderDeleteDialog() {
  return `
    <dialog class="management-dialog" id="deleteFolderDialog">
      <form id="deleteFolderForm" method="dialog">
        <div class="management-dialog-heading"><div><span class="eyebrow">管理员操作</span><h2>删除文件夹</h2></div><button class="icon-button" type="button" data-close-dialog="deleteFolderDialog" aria-label="关闭"><i data-lucide="x"></i></button></div>
        <p id="deleteFolderMessage">确认删除此文件夹吗？此操作无法撤销。</p>
        <p class="management-dialog-note">包含子文件夹或任意文件记录的文件夹不能删除。</p>
        <div class="management-dialog-actions"><button class="button button-ghost" type="button" data-close-dialog="deleteFolderDialog">取消</button><button class="button button-danger" type="submit">确认删除</button></div>
      </form>
    </dialog>
  `;
}

function renderFileDialog() {
  return `
    <dialog class="management-dialog" id="fileDialog">
      <form id="fileForm" method="dialog">
        <div class="management-dialog-heading"><div><span class="eyebrow" id="fileDialogEyebrow">私有资料</span><h2 id="fileDialogTitle">上传文件</h2></div><button class="icon-button" type="button" data-close-dialog="fileDialog" aria-label="关闭"><i data-lucide="x"></i></button></div>
        <label class="management-field"><span>Office 文件</span><input id="fileInput" name="file" type="file" accept=".xlsx,.xls,.docx,.pptx" required /></label>
        <p class="management-dialog-note" id="fileDialogNote">支持 .xlsx、.xls、.docx、.pptx；大小由服务器限制（默认 20 MB）。文件内容不会生成公开链接。</p>
        <div class="management-dialog-actions"><button class="button button-ghost" type="button" data-close-dialog="fileDialog">取消</button><button class="button button-primary" id="fileSubmitButton" type="submit">开始上传</button></div>
      </form>
    </dialog>
  `;
}

function renderArchiveDialog() {
  return `
    <dialog class="management-dialog" id="archiveFileDialog">
      <form id="archiveFileForm" method="dialog">
        <div class="management-dialog-heading"><div><span class="eyebrow">管理员操作</span><h2>归档文件</h2></div><button class="icon-button" type="button" data-close-dialog="archiveFileDialog" aria-label="关闭"><i data-lucide="x"></i></button></div>
        <p id="archiveFileMessage">确认归档此文件吗？</p>
        <p class="management-dialog-note">归档后该文件将从默认列表中隐藏；历史版本与私有存储对象会被保留。</p>
        <div class="management-dialog-actions"><button class="button button-ghost" type="button" data-close-dialog="archiveFileDialog">取消</button><button class="button button-danger" type="submit">确认归档</button></div>
      </form>
    </dialog>
  `;
}

function bindPageActions() {
  document.querySelectorAll("[data-folder-id]").forEach((button) => {
    button.addEventListener("click", () => navigateToFolder(button.dataset.folderId || null));
  });
  document.querySelectorAll("[data-open-folder]").forEach((button) => {
    button.addEventListener("click", () => navigateToFolder(button.dataset.openFolder));
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`)?.close());
  });
  document.querySelector("#createFolderButton")?.addEventListener("click", () => openFolderDialog("create"));
  document.querySelector("#uploadFileButton")?.addEventListener("click", () => openFileDialog("upload"));
  document.querySelectorAll("[data-rename-folder]").forEach((button) => {
    button.addEventListener("click", () => openFolderDialog("rename", button.dataset.renameFolder));
  });
  document.querySelectorAll("[data-delete-folder]").forEach((button) => {
    button.addEventListener("click", () => openDeleteDialog(button.dataset.deleteFolder));
  });
  document.querySelectorAll("[data-version-file]").forEach((button) => {
    button.addEventListener("click", () => openFileDialog("version", button.dataset.versionFile));
  });
  document.querySelectorAll("[data-archive-file]").forEach((button) => {
    button.addEventListener("click", () => openArchiveDialog(button.dataset.archiveFile));
  });
  document.querySelector("#folderForm")?.addEventListener("submit", submitFolderForm);
  document.querySelector("#deleteFolderForm")?.addEventListener("submit", submitDeleteForm);
  document.querySelector("#fileForm")?.addEventListener("submit", submitFileForm);
  document.querySelector("#archiveFileForm")?.addEventListener("submit", submitArchiveFileForm);
}

function navigateToFolder(id) {
  currentFolderId = id || null;
  const url = new URL(window.location.href);
  if (currentFolderId) url.searchParams.set("folder", currentFolderId);
  else url.searchParams.delete("folder");
  window.history.pushState(null, "", `${url.pathname}${url.search}`);
  loadLibrary();
}

function openFolderDialog(mode, folderId = null) {
  const dialog = document.querySelector("#folderDialog");
  const folder = library.folders.find((item) => item.id === folderId);
  const input = document.querySelector("#folderNameInput");
  document.querySelector("#folderForm").dataset.mode = mode;
  document.querySelector("#folderForm").dataset.folderId = folder?.id || "";
  document.querySelector("#folderDialogTitle").textContent = mode === "rename" ? "重命名文件夹" : "新建文件夹";
  document.querySelector("#folderDialogEyebrow").textContent = mode === "rename" ? "资料库整理" : "资料库";
  document.querySelector("#folderDialogNote").textContent = mode === "rename" ? "重命名不会改变文件夹层级。" : "将在当前目录下创建文件夹。";
  document.querySelector("#folderSubmitButton").textContent = mode === "rename" ? "确认重命名" : "确认创建";
  input.value = folder?.name || "";
  dialog.showModal();
  input.focus();
}

async function submitFolderForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = new FormData(form).get("name");
  const isRename = form.dataset.mode === "rename";
  const submit = document.querySelector("#folderSubmitButton");
  submit.disabled = true;

  try {
    if (isRename) await renameFolder(form.dataset.folderId, name);
    else await createFolder({ parentId: currentFolderId, name });
    document.querySelector("#folderDialog")?.close();
    notice = { type: "success", text: isRename ? "文件夹已重命名，操作已记录。" : "文件夹已创建，操作已记录。" };
    await loadLibrary();
  } catch (error) {
    notice = toNotice(error, "文件夹操作失败，请重试。");
    document.querySelector("#folderDialog")?.close();
    renderPage();
  }
}

function openDeleteDialog(folderId) {
  const folder = library.folders.find((item) => item.id === folderId);
  if (!folder) return;
  const dialog = document.querySelector("#deleteFolderDialog");
  document.querySelector("#deleteFolderForm").dataset.folderId = folder.id;
  document.querySelector("#deleteFolderMessage").textContent = `确认删除“${folder.name}”吗？此操作无法撤销。`;
  dialog.showModal();
}

async function submitDeleteForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("[type='submit']");
  submit.disabled = true;

  try {
    await deleteFolder(form.dataset.folderId);
    document.querySelector("#deleteFolderDialog")?.close();
    notice = { type: "success", text: "文件夹已删除，操作已记录。" };
    await loadLibrary();
  } catch (error) {
    notice = toNotice(error, "删除文件夹失败，请重试。");
    document.querySelector("#deleteFolderDialog")?.close();
    renderPage();
  }
}

function openFileDialog(mode, fileId = "") {
  const dialog = document.querySelector("#fileDialog");
  const form = document.querySelector("#fileForm");
  const file = library.files.find((item) => item.id === fileId);
  const isVersion = mode === "version";

  form.reset();
  form.dataset.mode = mode;
  form.dataset.fileId = file?.id || "";
  document.querySelector("#fileDialogEyebrow").textContent = isVersion ? "文件版本" : "私有资料";
  document.querySelector("#fileDialogTitle").textContent = isVersion ? "上传新版本" : "上传文件";
  document.querySelector("#fileDialogNote").textContent = isVersion
    ? `将为“${file?.name || "当前文件"}”创建新版本。支持 .xlsx、.xls、.docx、.pptx；文件不会生成公开链接。`
    : "支持 .xlsx、.xls、.docx、.pptx；大小由服务器限制（默认 20 MB）。文件内容不会生成公开链接。";
  document.querySelector("#fileSubmitButton").textContent = isVersion ? "上传新版本" : "开始上传";
  dialog.showModal();
}

async function submitFileForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = document.querySelector("#fileInput");
  const file = input.files?.[0];
  const isVersion = form.dataset.mode === "version";
  const submit = document.querySelector("#fileSubmitButton");

  try {
    validateFileForUpload(file);
    submit.disabled = true;
    if (isVersion) await uploadFileVersion(form.dataset.fileId, file);
    else await uploadFile(currentFolderId, file);
    document.querySelector("#fileDialog")?.close();
    notice = { type: "success", text: isVersion ? "新版本已上传，操作已记录。" : "文件已上传，操作已记录。" };
    await loadLibrary();
  } catch (error) {
    notice = toNotice(error, "文件上传失败，请重试。");
    document.querySelector("#fileDialog")?.close();
    renderPage();
  } finally {
    submit.disabled = false;
  }
}

function openArchiveDialog(fileId) {
  const file = library.files.find((item) => item.id === fileId);
  if (!file) return;
  const dialog = document.querySelector("#archiveFileDialog");
  document.querySelector("#archiveFileForm").dataset.fileId = file.id;
  document.querySelector("#archiveFileMessage").textContent = `确认归档“${file.name}”吗？`;
  dialog.showModal();
}

async function submitArchiveFileForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("[type='submit']");
  submit.disabled = true;

  try {
    await archiveFile(form.dataset.fileId);
    document.querySelector("#archiveFileDialog")?.close();
    notice = { type: "success", text: "文件已归档，操作已记录。" };
    await loadLibrary();
  } catch (error) {
    notice = toNotice(error, "文件归档失败，请重试。");
    document.querySelector("#archiveFileDialog")?.close();
    renderPage();
  }
}

function getFolderIdFromUrl() {
  const value = new URL(window.location.href).searchParams.get("folder");
  return value || null;
}

function toNotice(error, fallback) {
  if (error?.status === 400) return { type: "error", text: "提交的信息不符合要求，请检查后重试。" };
  if (error?.status === 401) return { type: "error", text: "登录状态已失效，请重新登录后重试。" };
  if (error?.status === 403) return { type: "error", text: "当前身份没有执行此操作的权限。" };
  if (error?.status === 404) return { type: "error", text: "目标文件或文件夹不存在，列表已刷新。" };
  if (error?.status === 409) return { type: "error", text: error.message || "当前文件夹暂时不能执行该操作。" };
  if (error?.status === 413) return { type: "error", text: "文件超过了允许的大小限制。" };
  if (error?.status === 415) return { type: "error", text: "仅支持 .xlsx、.xls、.docx、.pptx 文件。" };
  if (error?.status >= 500) return { type: "error", text: "服务器暂时无法完成此操作，请稍后重试或检查管理员配置。" };
  return { type: "error", text: error?.message || fallback };
}

function validateFileForUpload(file) {
  if (!file) throw new Error("请选择要上传的文件。");
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (!["xlsx", "xls", "docx", "pptx"].includes(ext)) {
    throw new ApiError(415, "仅支持 .xlsx、.xls、.docx、.pptx 文件。");
  }

}

function formatFileSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "未知";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileStatus(status) {
  return {
    uploaded: "已上传",
    archived: "已归档"
  }[status] || "处理中";
}

function formatDate(value) {
  if (!value) return "尚未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
