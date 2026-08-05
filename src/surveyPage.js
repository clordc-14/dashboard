import * as XLSX from "xlsx";
import { createIcons, icons } from "lucide";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import {
  getBrandContacts,
  getSurveyMetrics,
  getSurveyProductName,
  isAffirmative,
  updateResearchSurveyRecord
} from "./researchSurvey.js";
import { loadDashboardState, saveDashboardState } from "./state/storage.js";
import { formatRole, isAdministrator, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#surveyApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
const initialParams = new URLSearchParams(window.location.search);
let dashboardState = demoDashboardData;
let currentUser = { name: "当前用户", role: "viewer" };
let activeView = initialParams.get("view") === "list" ? "list" : "form";
let selectedRecordId = initialParams.get("record") || "";
let listQuery = "";
let onlyMyRecords = false;
let notice = null;

initializeSurveyPage();

async function initializeSurveyPage() {
  const [storedState, user] = await Promise.all([loadDashboardState(), loadCurrentUser()]);
  dashboardState = storedState || demoDashboardData;
  currentUser = user;
  selectedRecordId = pickInitialRecordId(selectedRecordId);
  renderPage();
}

function renderPage() {
  const survey = dashboardState.researchSurvey;
  const metrics = getSurveyMetrics(survey, currentUser.name);

  app.innerHTML = `
    <div class="app-shell survey-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="返回国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>调研信息工作台</h1>
            <p>新药引进信息采集表</p>
          </div>
        </a>
        <div class="topbar-actions">
          <a class="user-greeting" href="/welcome.html"><i data-lucide="circle-user-round"></i><span>欢迎，${escapeHtml(currentUser.name)}</span><small>${formatRole(currentUser)}</small></a>
          <button class="button button-ghost" id="surveyPdfExport" type="button"><i data-lucide="file-down"></i><span>导出文档</span></button>
          ${isAdministrator(currentUser) && survey?.records?.length ? '<button class="button button-primary" id="surveyExcelExport" type="button"><i data-lucide="file-spreadsheet"></i><span>导出表格</span></button>' : ""}
        </div>
      </header>
      <main>
        ${survey?.records?.length ? renderWorkspace(survey, metrics) : renderMissingSurvey()}
      </main>
    </div>
  `;

  bindPageActions();
  createIcons({ icons });
}

function renderWorkspace(survey, metrics) {
  const selectedRecord = getSelectedRecord(survey);
  return `
    <section class="survey-overview">
      <div>
        <span class="eyebrow">调研进度</span>
        <h2>调研信息填写与查阅</h2>
        <p>数据来源：${escapeHtml(survey.source?.sheetName || "网站用表—调研表")}。当前为本设备暂存，正式共享数据将在后端接口接入后同步。</p>
      </div>
      <div class="survey-stat-grid" aria-label="调研进度">
        ${renderStat("调研总项", metrics.totalCount)}
        ${renderStat("已完成", metrics.completeCount)}
        ${renderStat("待完善", metrics.incompleteCount)}
        ${renderStat("您待完善", metrics.currentUserPendingCount)}
      </div>
    </section>
    <div class="survey-view-tabs" role="tablist" aria-label="调研信息功能">
      <button class="survey-view-tab${activeView === "form" ? " is-active" : ""}" type="button" data-view="form" role="tab" aria-selected="${activeView === "form"}"><i data-lucide="clipboard-pen-line"></i><span>调研信息填写</span></button>
      <button class="survey-view-tab${activeView === "list" ? " is-active" : ""}" type="button" data-view="list" role="tab" aria-selected="${activeView === "list"}"><i data-lucide="table-properties"></i><span>全部调研信息</span></button>
    </div>
    ${activeView === "list" ? renderResearchList(survey) : renderResearchForm(survey, selectedRecord)}
  `;
}

function renderMissingSurvey() {
  return `
    <section class="empty-state empty-state-large survey-missing-state">
      <div>
        <i data-lucide="file-up"></i>
        <h2>尚未导入调研表</h2>
        <p>请由管理员在经营看板上传“网站用表—调研表”。导入后，这里会按通用名、厂牌、采购与完成状态自动生成填写任务。</p>
        <a class="button button-primary" href="/"><i data-lucide="arrow-left"></i><span>返回经营看板</span></a>
      </div>
    </section>
  `;
}

function renderResearchForm(survey, record) {
  if (!record) return '<div class="empty-state empty-state-large">未找到可填写的调研记录</div>';

  const currentIndex = survey.records.findIndex((item) => item.id === record.id);
  const contacts = getBrandContacts(survey, record);
  const date = new Date().toLocaleDateString("zh-CN");

  return `
    <section class="survey-workspace">
      <aside class="survey-record-nav" aria-label="调研品种列表">
        <div class="survey-record-nav-heading"><strong>品种清单</strong><small>${survey.records.length} 项</small></div>
        <div class="survey-record-list">
          ${survey.records.map((item, index) => renderRecordNavItem(item, index)).join("")}
        </div>
      </aside>
      <section class="survey-form-card">
        <div class="survey-form-heading">
          <div>
            <span class="eyebrow">${escapeHtml(record.companyName || "未填写厂牌")}</span>
            <h2>${escapeHtml(getSurveyProductName(record))}</h2>
            <p>第 ${currentIndex + 1} / ${survey.records.length} 项 · 填写日期：${date} · 填写人：${escapeHtml(currentUser.name)}</p>
          </div>
          <span class="completion-badge${isAffirmative(record.isComplete) ? " is-complete" : ""}">${isAffirmative(record.isComplete) ? "已完成" : "待完善"}</span>
        </div>
        ${notice ? `<div class="notice notice-${notice.type}"><i data-lucide="${notice.type === "success" ? "circle-check" : "circle-alert"}"></i><span>${escapeHtml(notice.text)}</span></div>` : ""}
        <form id="researchForm" class="research-form">
          <input type="hidden" name="recordId" value="${escapeAttribute(record.id)}" />
          <section class="research-form-section">
            <div class="research-section-heading"><span>一</span><div><h3>基础信息</h3><p>以下信息取自管理员导入的数据源，无需重复填写。</p></div></div>
            <div class="research-field-grid research-field-grid-readonly">
              ${renderReadonlyField("药品名称", getSurveyProductName(record))}
              ${renderReadonlyField("厂牌", record.companyName || "—")}
              ${renderReadonlyField("获批时间", record.approvalDate || "—")}
              ${renderReadonlyField("采购负责人", record.purchase || "未分配")}
            </div>
          </section>
          <section class="research-form-section">
            <div class="research-section-heading"><span>二</span><div><h3>采购与落地情况</h3><p>请补充最新进展；选择“其他”时，在备注中说明。</p></div></div>
            <div class="research-field-grid">
              ${renderSelectField("expectedLaunchTime", "预计上市时间", record.expectedLaunchTime, ["一个月内", "三个月内", "未有消息", "其他"])}
              ${renderSelectField("landedInSichuan", "是否落地四川", record.landedInSichuan, ["是", "否", "推进中", "其他"])}
              ${renderSelectField("southwestArchived", "是否建档", record.southwestArchived, ["是", "否"])}
              ${renderSelectField("isT1", "是否 T1 品种", record.isT1, ["是", "否", "其他"])}
              ${renderSelectField("isExclusive", "是否独家品种", record.isExclusive, ["是", "否", "待定", "其他"])}
              ${renderSelectField("progress", "最新进展", record.progress, ["一、无法动作", "二、等待建档", "三、沟通中（待定）", "四、未合作/无联系人", "五、需求建档", "六、商务不建议/只销售院外药房品种", "七、调货品种", "其他"])}
            </div>
            <label class="research-field research-field-full"><span>采购备注</span><textarea name="purchaseRemark" rows="3" placeholder="填写补充说明、其他选项的具体原因">${escapeHtml(record.purchaseRemark)}</textarea></label>
          </section>
          <section class="research-form-section">
            <div class="research-section-heading"><span>三</span><div><h3>联系人信息</h3><p>同厂牌联系人会在本设备内自动带入；变更请通过申请框提交。</p></div><button class="button button-ghost research-contact-change" id="contactChangeButton" type="button"><i data-lucide="file-pen-line"></i><span>联系人信息变更申请</span></button></div>
            <div class="research-field-grid">
              <label class="research-field"><span>商务联系人</span><input name="businessContact" value="${escapeAttribute(contacts.businessContact)}" placeholder="姓名、电话" /></label>
              <label class="research-field"><span>销售联系人</span><input name="salesContact" value="${escapeAttribute(contacts.salesContact)}" placeholder="姓名、电话" /></label>
            </div>
          </section>
          <div class="research-form-actions">
            <button class="button button-ghost" type="button" data-record-step="previous"${currentIndex <= 0 ? " disabled" : ""}><i data-lucide="chevron-left"></i><span>上一项</span></button>
            <div>
              <button class="button button-ghost" type="submit" name="saveMode" value="draft"><i data-lucide="save"></i><span>保存草稿</span></button>
              <button class="button button-primary" type="submit" name="saveMode" value="complete"><i data-lucide="circle-check-big"></i><span>完成填写</span></button>
            </div>
            <button class="button button-ghost" type="button" data-record-step="next"${currentIndex >= survey.records.length - 1 ? " disabled" : ""}><span>下一项</span><i data-lucide="chevron-right"></i></button>
          </div>
        </form>
      </section>
    </section>
    ${renderContactChangeDialog(record, contacts)}
  `;
}

function renderResearchList(survey) {
  const currentName = normalizeName(currentUser.name);
  const query = listQuery.trim().toLowerCase();
  const records = survey.records.filter((record) => {
    if (onlyMyRecords && normalizeName(record.purchase) !== currentName) return false;
    if (!query) return true;
    return [getSurveyProductName(record), record.companyName, record.purchase, record.progress, record.businessContact, record.salesContact].join(" ").toLowerCase().includes(query);
  });

  return `
    <section class="survey-list-card">
      <div class="survey-list-toolbar">
        <label class="control control-search"><i data-lucide="search"></i><input id="surveyListSearch" type="search" value="${escapeAttribute(listQuery)}" placeholder="搜索品种、厂牌、采购或联系人" /></label>
        <label class="survey-mine-filter"><input id="onlyMyRecords" type="checkbox"${onlyMyRecords ? " checked" : ""} /><span>仅看我的任务</span></label>
        <strong>共 ${records.length} 项</strong>
      </div>
      <div class="table-wrap survey-list-table">
        <table>
          <thead><tr><th>品种</th><th>厂牌</th><th>采购</th><th>落地四川</th><th>是否建档</th><th>最新进展</th><th>是否完善</th><th>操作</th></tr></thead>
          <tbody>
            ${records.length ? records.map(renderResearchListRow).join("") : '<tr><td class="survey-list-empty" colspan="8">没有符合条件的调研记录</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderResearchListRow(record) {
  return `
    <tr>
      <td><strong>${escapeHtml(getSurveyProductName(record))}</strong><small>${escapeHtml(record.approvalDate || "未填写获批时间")}</small></td>
      <td>${escapeHtml(record.companyName || "—")}</td>
      <td>${escapeHtml(record.purchase || "未分配")}</td>
      <td>${escapeHtml(record.landedInSichuan || "—")}</td>
      <td>${escapeHtml(record.southwestArchived || "—")}</td>
      <td>${escapeHtml(record.progress || "—")}</td>
      <td><span class="completion-badge${isAffirmative(record.isComplete) ? " is-complete" : ""}">${isAffirmative(record.isComplete) ? "已完成" : "待完善"}</span></td>
      <td><button class="button button-ghost survey-open-record" type="button" data-record-id="${escapeAttribute(record.id)}"><span>查看 / 填写</span><i data-lucide="arrow-right"></i></button></td>
    </tr>
  `;
}

function renderRecordNavItem(record, index) {
  const selected = record.id === selectedRecordId;
  return `
    <button class="survey-record-item${selected ? " is-active" : ""}" type="button" data-record-id="${escapeAttribute(record.id)}">
      <span class="survey-record-index">${index + 1}</span>
      <span><strong>${escapeHtml(getSurveyProductName(record))}</strong><small>${escapeHtml(record.purchase || "未分配")}</small></span>
      <i data-lucide="${isAffirmative(record.isComplete) ? "circle-check" : "circle-dot"}"></i>
    </button>
  `;
}

function renderContactChangeDialog(record, contacts) {
  return `
    <dialog class="contact-change-dialog" id="contactChangeDialog">
      <form method="dialog" id="contactChangeForm">
        <div class="contact-dialog-heading"><div><span class="eyebrow">变更申请</span><h2>联系人信息变更申请</h2></div><button class="icon-button" value="cancel" aria-label="关闭"><i data-lucide="x"></i></button></div>
        <p>${escapeHtml(record.companyName || "该厂牌")}的联系人修改会先暂存在本设备。待后端审批流接入后，才能提交给管理员并同步至所有品种。</p>
        <label class="research-field"><span>商务联系人（最新）</span><input name="businessContact" value="${escapeAttribute(contacts.businessContact)}" placeholder="姓名、电话" /></label>
        <label class="research-field"><span>销售联系人（最新）</span><input name="salesContact" value="${escapeAttribute(contacts.salesContact)}" placeholder="姓名、电话" /></label>
        <label class="research-field"><span>变更说明</span><textarea name="changeReason" rows="3" placeholder="说明变更原因或来源"></textarea></label>
        <div class="contact-dialog-actions"><button class="button button-ghost" value="cancel">取消</button><button class="button button-primary" id="applyContactChange" value="default">暂存变更</button></div>
      </form>
    </dialog>
  `;
}

function renderReadonlyField(label, value) {
  return `<div class="research-readonly-field"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderSelectField(name, label, value, values) {
  const normalizedValue = String(value || "").trim();
  const options = normalizedValue && !values.includes(normalizedValue) ? [normalizedValue, ...values] : values;
  return `
    <label class="research-field"><span>${label}</span>
      <select name="${name}">
        <option value="">请选择</option>
        ${options.map((option) => `<option value="${escapeAttribute(option)}"${option === normalizedValue ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderStat(label, value) {
  return `<div><strong>${value}</strong><span>${label}</span></div>`;
}

function bindPageActions() {
  document.querySelector("#surveyPdfExport")?.addEventListener("click", () => window.print());
  document.querySelector("#surveyExcelExport")?.addEventListener("click", exportSurveyExcel);

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      notice = null;
      syncUrl();
      renderPage();
    });
  });

  document.querySelectorAll("[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRecordId = button.dataset.recordId;
      activeView = "form";
      notice = null;
      syncUrl();
      renderPage();
    });
  });

  document.querySelectorAll("[data-record-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const records = dashboardState.researchSurvey?.records || [];
      const index = records.findIndex((record) => record.id === selectedRecordId);
      const direction = button.dataset.recordStep === "next" ? 1 : -1;
      const nextRecord = records[index + direction];
      if (!nextRecord) return;
      selectedRecordId = nextRecord.id;
      notice = null;
      syncUrl();
      renderPage();
    });
  });

  document.querySelector("#researchForm")?.addEventListener("submit", saveResearchForm);
  document.querySelector("#contactChangeButton")?.addEventListener("click", () => document.querySelector("#contactChangeDialog")?.showModal());
  document.querySelector("#applyContactChange")?.addEventListener("click", saveContactChange);

  document.querySelector("#surveyListSearch")?.addEventListener("input", (event) => {
    listQuery = event.target.value;
    renderPage();
  });
  document.querySelector("#onlyMyRecords")?.addEventListener("change", (event) => {
    onlyMyRecords = event.target.checked;
    renderPage();
  });
}

async function saveResearchForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.submitter;
  const values = Object.fromEntries(new FormData(form).entries());
  const recordId = values.recordId;
  delete values.recordId;
  if (submitter?.value === "complete") values.isComplete = "是";

  await persistRecordChanges(recordId, values, submitter?.value === "complete" ? "已将该品种标记为完成。" : "草稿已保存到本设备。");
}

async function saveContactChange(event) {
  event.preventDefault();
  const dialog = document.querySelector("#contactChangeDialog");
  const form = document.querySelector("#contactChangeForm");
  const values = Object.fromEntries(new FormData(form).entries());
  const recordId = selectedRecordId;
  await persistRecordChanges(recordId, values, "联系人变更已暂存；正式提交和审批需在后端接入后启用。");
  dialog?.close();
}

async function persistRecordChanges(recordId, changes, message) {
  const survey = dashboardState.researchSurvey;
  const nextSurvey = updateResearchSurveyRecord(survey, recordId, changes);
  dashboardState = { ...dashboardState, researchSurvey: nextSurvey };
  await saveDashboardState(dashboardState);
  notice = { type: "success", text: message };
  renderPage();
}

function exportSurveyExcel() {
  const survey = dashboardState.researchSurvey;
  if (!survey?.records?.length) return;

  const rows = survey.records.map((record) => ({
    序号: record.sequence,
    通用名: record.genericName,
    商品名: record.tradeName,
    厂牌: record.companyName,
    获批时间: record.approvalDate,
    采购: record.purchase,
    落地四川: record.landedInSichuan,
    是否建档: record.southwestArchived,
    最新进展: record.progress,
    是否T1: record.isT1,
    是否独家: record.isExclusive,
    采购备注: record.purchaseRemark,
    商务联系人: record.businessContact,
    销售联系人: record.salesContact,
    是否完善: record.isComplete,
    预计上市时间: record.expectedLaunchTime
  }));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "调研信息");
  XLSX.writeFile(workbook, `调研信息_${formatDateForFileName()}.xlsx`);
}

function pickInitialRecordId(candidate) {
  const records = dashboardState.researchSurvey?.records || [];
  if (records.some((record) => record.id === candidate)) return candidate;
  const userPending = records.find((record) => normalizeName(record.purchase) === normalizeName(currentUser.name) && !isAffirmative(record.isComplete));
  return userPending?.id || records.find((record) => !isAffirmative(record.isComplete))?.id || records[0]?.id || "";
}

function getSelectedRecord(survey) {
  return survey.records.find((record) => record.id === selectedRecordId) || survey.records[0];
}

function syncUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("view", activeView);
  if (selectedRecordId) url.searchParams.set("record", selectedRecordId);
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function formatDateForFileName() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
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
