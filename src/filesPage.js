import { createIcons, icons } from "lucide";
import { createFolder, deleteFolder, listFolders, renameFolder } from "./services/apiClient.js";
import { formatRole, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#filesApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
let currentUser = { name: "当前用户", role: "viewer" };
let currentFolderId = getFolderIdFromUrl();
let library = { currentFolder: null, breadcrumbs: [{ id: null, name: "根目录" }], folders: [] };
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
    library = await listFolders(currentFolderId);
    notice = null;
  } catch (error) {
    library = { currentFolder: null, breadcrumbs: [{ id: null, name: "根目录" }], folders: [] };
    notice = toNotice(error, "无法加载资料库，请稍后重试。");
  } finally {
    isLoading = false;
    renderPage();
  }
}

function renderPage() {
  const canManage = ["admin", "editor"].includes(currentUser.role);
  const canDelete = currentUser.role === "admin";

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
          <div><span class="eyebrow">共享资料</span><h2>资料库</h2><p>本阶段仅管理文件夹；文件上传、下载和版本功能将在后续阶段接入。</p></div>
          ${canManage ? '<button class="button button-primary" id="createFolderButton" type="button"><i data-lucide="folder-plus"></i><span>新建文件夹</span></button>' : '<span class="readonly-badge"><i data-lucide="eye"></i>当前为只读模式</span>'}
        </section>
        ${renderNotice()}
        <nav class="library-breadcrumbs" aria-label="资料库路径">
          ${(library.breadcrumbs || []).map((item, index) => `${index ? '<i data-lucide="chevron-right" aria-hidden="true"></i>' : ""}<button type="button" data-folder-id="${escapeAttribute(item.id || "")}"${index === library.breadcrumbs.length - 1 ? " disabled" : ""}>${escapeHtml(item.name)}</button>`).join("")}
        </nav>
        <section class="library-panel" aria-busy="${isLoading}">
          <div class="library-panel-heading"><div><h3>${escapeHtml(library.currentFolder?.name || "根目录")}</h3><p>${isLoading ? "正在读取文件夹…" : `共 ${library.folders.length} 个文件夹`}</p></div></div>
          ${isLoading ? renderLoading() : renderFolders(canManage, canDelete)}
        </section>
      </main>
    </div>
    ${renderFolderDialog()}
    ${renderDeleteDialog()}
  `;

  bindPageActions();
  createIcons({ icons });
}

function renderFolders(canManage, canDelete) {
  if (!library.folders.length) {
    return `<div class="library-empty"><i data-lucide="folder-open"></i><h3>这里还没有文件夹</h3><p>${canManage ? "新建一个文件夹，开始整理资料。" : "管理员或编辑者创建文件夹后会显示在这里。"}</p></div>`;
  }

  return `
    <div class="folder-grid">
      ${library.folders.map((folder) => `
        <article class="folder-card">
          <button class="folder-open-button" type="button" data-open-folder="${escapeAttribute(folder.id)}"><i data-lucide="folder"></i><span><strong>${escapeHtml(folder.name)}</strong><small>更新于 ${formatDate(folder.updatedAt)}</small></span><i data-lucide="chevron-right"></i></button>
          ${(canManage || canDelete) ? `<div class="folder-card-actions">${canManage ? `<button class="icon-button" type="button" data-rename-folder="${escapeAttribute(folder.id)}" title="重命名 ${escapeAttribute(folder.name)}" aria-label="重命名 ${escapeAttribute(folder.name)}"><i data-lucide="pencil"></i></button>` : ""}${canDelete ? `<button class="icon-button is-danger" type="button" data-delete-folder="${escapeAttribute(folder.id)}" title="删除 ${escapeAttribute(folder.name)}" aria-label="删除 ${escapeAttribute(folder.name)}"><i data-lucide="trash-2"></i></button>` : ""}</div>` : ""}
        </article>
      `).join("")}
    </div>
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
  document.querySelectorAll("[data-rename-folder]").forEach((button) => {
    button.addEventListener("click", () => openFolderDialog("rename", button.dataset.renameFolder));
  });
  document.querySelectorAll("[data-delete-folder]").forEach((button) => {
    button.addEventListener("click", () => openDeleteDialog(button.dataset.deleteFolder));
  });
  document.querySelector("#folderForm")?.addEventListener("submit", submitFolderForm);
  document.querySelector("#deleteFolderForm")?.addEventListener("submit", submitDeleteForm);
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

function getFolderIdFromUrl() {
  const value = new URL(window.location.href).searchParams.get("folder");
  return value || null;
}

function toNotice(error, fallback) {
  if (error?.status === 403) return { type: "error", text: "当前身份没有执行此操作的权限。" };
  if (error?.status === 409) return { type: "error", text: error.message || "当前文件夹暂时不能执行该操作。" };
  return { type: "error", text: error?.message || fallback };
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
