import { createIcons, icons } from "lucide";
import { formatRole, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#welcomeApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;

initializeWelcomePage();

async function initializeWelcomePage() {
  const user = await loadCurrentUser();
  renderWelcomePage(user);
}

function renderWelcomePage(user) {
  app.innerHTML = `
    <div class="app-shell welcome-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>国药西南新药引进网</h1>
            <p>新药引进协同工作台</p>
          </div>
        </a>
        <span class="user-greeting is-static"><i data-lucide="badge-check"></i><span>${escapeHtml(formatRole(user))}</span></span>
      </header>
      <main class="welcome-main">
        <section class="welcome-hero">
          <div class="welcome-copy">
            <span class="eyebrow">Welcome back</span>
            <h2>欢迎您，${escapeHtml(user.name)}</h2>
            <p>在这里查看经营信息、查阅调研进度，并完成您负责品种的信息填写。</p>
            <div class="welcome-actions">
              <a class="button button-primary" href="/"><i data-lucide="layout-dashboard"></i><span>进入经营看板</span></a>
              <a class="button button-ghost" href="/survey.html"><i data-lucide="clipboard-pen-line"></i><span>填写调研信息</span></a>
            </div>
          </div>
          <div class="welcome-mark" aria-hidden="true"><i data-lucide="heart-handshake"></i></div>
        </section>
        <section class="welcome-shortcuts" aria-label="工作入口">
          ${renderShortcut("经营信息总览", "查看新药引进数据和动态汇总", "layout-dashboard", "/")}
          ${renderShortcut("调研信息填写", "按品种逐项完善采购与联系人信息", "clipboard-pen-line", "/survey.html")}
          ${renderShortcut("调研信息查阅", "检索已收集的调研信息", "table-properties", "/survey.html?view=list")}
        </section>
        <p class="welcome-note">当前页面会读取登录身份；若尚未接入正式身份服务，会以本地测试身份展示。</p>
      </main>
    </div>
  `;
  createIcons({ icons });
}

function renderShortcut(title, description, icon, href) {
  return `
    <a class="welcome-shortcut" href="${href}">
      <span class="welcome-shortcut-icon"><i data-lucide="${icon}"></i></span>
      <span><strong>${title}</strong><small>${description}</small></span>
      <i data-lucide="arrow-up-right"></i>
    </a>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
