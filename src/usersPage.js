import { createIcons, icons } from "lucide";
import { listUsers, updateUserRole } from "./services/apiClient.js";
import { formatRole, isAdministrator, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#usersApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
let currentUser = { name: "当前用户", role: "viewer" };
let filters = { query: "", role: "" };
let users = [];
let nextCursor = null;
let notice = null;
let isLoading = true;

initializeUsersPage();

async function initializeUsersPage() {
  currentUser = await loadCurrentUser();
  if (isAdministrator(currentUser)) await loadUsers();
  else {
    isLoading = false;
    renderPage();
  }
}

async function loadUsers({ append = false } = {}) {
  isLoading = true;
  renderPage();

  try {
    const payload = await listUsers({ ...filters, cursor: append ? nextCursor : "" });
    users = append ? [...users, ...payload.users] : payload.users;
    nextCursor = payload.nextCursor;
    notice = null;
  } catch (error) {
    if (!append) users = [];
    nextCursor = null;
    notice = toNotice(error, "无法加载用户列表，请稍后重试。");
  } finally {
    isLoading = false;
    renderPage();
  }
}

function renderPage() {
  const isAdmin = isAdministrator(currentUser);
  app.innerHTML = `
    <div class="app-shell management-shell">
      <header class="topbar management-topbar">
        <a class="brand" href="/" aria-label="返回国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div><h1>国药西南新药引进网</h1><p>用户管理</p></div>
        </a>
        <div class="topbar-actions"><a class="button button-ghost" href="/"><i data-lucide="layout-dashboard"></i><span>经营看板</span></a><a class="user-greeting" href="/welcome.html"><i data-lucide="circle-user-round"></i><span>欢迎，${escapeHtml(currentUser.name)}</span><small>${formatRole(currentUser)}</small></a></div>
      </header>
      <main class="management-main">
        ${isAdmin ? renderAdminPage() : renderAccessDenied()}
      </main>
    </div>
    ${isAdmin ? renderRoleDialog() : ""}
  `;

  if (isAdmin) bindPageActions();
  createIcons({ icons });
}

function renderAdminPage() {
  return `
    <section class="management-heading"><div><span class="eyebrow">权限控制</span><h2>用户管理</h2><p>仅显示已通过 Cloudflare Access 登录并写入资料库的用户。角色变更会立即在下一次 API 请求生效。</p></div></section>
    ${renderNotice()}
    <section class="management-panel">
      <form class="management-filters" id="userFilters">
        <label class="control control-search"><i data-lucide="search"></i><input id="userQuery" name="query" type="search" value="${escapeAttribute(filters.query)}" maxlength="120" placeholder="搜索姓名或邮箱" /></label>
        <label class="management-select"><span>角色</span><select id="roleFilter" name="role"><option value="">全部角色</option>${roleOption("admin", "管理员", filters.role)}${roleOption("editor", "编辑者", filters.role)}${roleOption("viewer", "查看者", filters.role)}</select></label>
        <button class="button button-primary" type="submit"><i data-lucide="search"></i><span>查询</span></button>
      </form>
      <div class="management-panel-heading"><div><h3>已登录用户</h3><p>${isLoading ? "正在读取用户信息…" : `当前显示 ${users.length} 位用户`}</p></div><span class="audit-hint"><i data-lucide="shield-check"></i>角色修改将记录审计日志</span></div>
      ${isLoading ? renderLoading() : renderUserTable()}
    </section>
  `;
}

function renderAccessDenied() {
  return `
    <section class="access-denied"><i data-lucide="shield-alert"></i><span class="eyebrow">访问受限</span><h2>仅管理员可以管理用户</h2><p>当前身份为${escapeHtml(formatRole(currentUser))}。即使直接访问本页，服务端也会拒绝用户列表和角色变更请求。</p><a class="button button-primary" href="/files.html"><i data-lucide="folder-open"></i><span>进入资料库</span></a></section>
  `;
}

function renderUserTable() {
  if (!users.length) {
    return '<div class="library-empty"><i data-lucide="users-round"></i><h3>没有匹配的用户</h3><p>用户需至少完成一次 Access 登录后，才会出现在此处。</p></div>';
  }

  return `
    <div class="table-wrap management-table-wrap"><table class="management-table"><thead><tr><th>用户</th><th>当前角色</th><th>创建时间</th><th>最近角色变更</th><th>操作</th></tr></thead><tbody>
      ${users.map((user) => `
        <tr>
          <td><strong>${escapeHtml(user.name || "未命名用户")}</strong><small>${escapeHtml(user.email)}</small></td>
          <td><span class="role-badge role-${escapeAttribute(user.role)}">${escapeHtml(formatRole(user))}</span></td>
          <td>${escapeHtml(formatDate(user.createdAt))}</td>
          <td>${user.roleUpdatedAt ? `${escapeHtml(formatDate(user.roleUpdatedAt))}<small>由 ${escapeHtml(user.roleUpdatedBy || "系统")}</small>` : "尚未变更"}</td>
          <td>${user.id === currentUser.id ? '<span class="self-role-note">当前管理员不可改自身角色</span>' : `<label class="role-control"><span class="sr-only">${escapeHtml(user.name || user.email)} 的角色</span><select data-role-select="${escapeAttribute(user.id)}">${roleOption("admin", "管理员", user.role)}${roleOption("editor", "编辑者", user.role)}${roleOption("viewer", "查看者", user.role)}</select></label>`}</td>
        </tr>
      `).join("")}
    </tbody></table></div>
    ${nextCursor ? '<div class="management-load-more"><button class="button button-ghost" id="loadMoreUsers" type="button"><i data-lucide="chevrons-down"></i><span>加载更多</span></button></div>' : ""}
  `;
}

function renderLoading() {
  return '<div class="library-empty"><i data-lucide="loader-circle" class="is-spinning"></i><h3>正在加载</h3><p>正在读取用户信息。</p></div>';
}

function renderNotice() {
  if (!notice) return "";
  const icon = notice.type === "error" ? "circle-alert" : "circle-check";
  return `<div class="notice notice-${notice.type}"><i data-lucide="${icon}"></i><span>${escapeHtml(notice.text)}</span></div>`;
}

function renderRoleDialog() {
  return `
    <dialog class="management-dialog" id="roleChangeDialog">
      <form id="roleChangeForm" method="dialog">
        <div class="management-dialog-heading"><div><span class="eyebrow">权限调整</span><h2>确认角色变更</h2></div><button class="icon-button" type="button" data-close-dialog="roleChangeDialog" aria-label="关闭"><i data-lucide="x"></i></button></div>
        <p id="roleChangeMessage">确认修改此用户的角色吗？</p>
        <p class="management-dialog-note">变更会在下一次服务端请求生效，并写入审计日志。当前管理员不能修改自己的角色，最后一名管理员也不能被降级。</p>
        <div class="management-dialog-actions"><button class="button button-ghost" type="button" data-close-dialog="roleChangeDialog">取消</button><button class="button button-primary" type="submit">确认变更</button></div>
      </form>
    </dialog>
  `;
}

function bindPageActions() {
  document.querySelector("#userFilters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    filters = { query: String(data.get("query") || "").trim(), role: String(data.get("role") || "") };
    loadUsers();
  });
  document.querySelectorAll("[data-role-select]").forEach((select) => {
    select.addEventListener("change", () => openRoleDialog(select.dataset.roleSelect, select.value));
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(`#${button.dataset.closeDialog}`)?.close();
      renderPage();
    });
  });
  document.querySelector("#roleChangeForm")?.addEventListener("submit", submitRoleChange);
  document.querySelector("#loadMoreUsers")?.addEventListener("click", () => loadUsers({ append: true }));
}

function openRoleDialog(userId, role) {
  const user = users.find((item) => item.id === userId);
  if (!user || user.role === role) return;
  const dialog = document.querySelector("#roleChangeDialog");
  const form = document.querySelector("#roleChangeForm");
  form.dataset.userId = user.id;
  form.dataset.role = role;
  document.querySelector("#roleChangeMessage").textContent = `确认将“${user.name || user.email}”由“${formatRole(user)}”调整为“${formatRole({ role })}”吗？`;
  dialog.showModal();
}

async function submitRoleChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("[type='submit']");
  submit.disabled = true;

  try {
    await updateUserRole(form.dataset.userId, form.dataset.role);
    document.querySelector("#roleChangeDialog")?.close();
    notice = { type: "success", text: "用户角色已更新，审计记录已写入。" };
    await loadUsers();
  } catch (error) {
    document.querySelector("#roleChangeDialog")?.close();
    notice = toNotice(error, "角色变更失败，请重试。");
    renderPage();
  }
}

function roleOption(role, label, selectedRole) {
  return `<option value="${role}"${role === selectedRole ? " selected" : ""}>${label}</option>`;
}

function toNotice(error, fallback) {
  if (error?.status === 403) return { type: "error", text: "当前身份没有管理用户的权限。" };
  if (error?.status === 409) return { type: "error", text: error.message || "该角色调整不被允许。" };
  return { type: "error", text: error?.message || fallback };
}

function formatDate(value) {
  if (!value) return "—";
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
