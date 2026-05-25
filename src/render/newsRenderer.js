import { isValidHttpUrl } from "../parser/normalizer.js";

export function renderNewsSections(container, sections = []) {
  container.replaceChildren();

  sections.forEach((section) => {
    const card = document.createElement("article");
    card.className = "news-column";

    const header = document.createElement("div");
    header.className = "panel-heading";

    const title = document.createElement("h2");
    title.textContent = section.title;

    const count = document.createElement("span");
    count.className = "count-pill";
    count.textContent = `${section.items.length} 条`;

    header.append(title, count);
    card.append(header);

    const list = document.createElement("div");
    list.className = "news-list";

    if (!section.items.length) {
      list.append(createEmptyState("暂无新闻数据"));
    } else {
      section.items.forEach((item, index) => list.append(createNewsItem(item, section, index)));
    }

    card.append(list);
    container.append(card);
  });
}

function createNewsItem(item, section, index) {
  if (section.key === "lastWeekInnovativeDrugs") {
    return createDrugReviewItem(item, index);
  }

  return createFocusNewsItem(item, index);
}

function createFocusNewsItem(item, index) {
  const node = document.createElement("article");
  node.className = "news-item focus-news-item";

  const number = document.createElement("span");
  number.className = "news-index";
  number.textContent = getSequence(item, index);

  const title = isValidHttpUrl(item.sourceUrl) ? document.createElement("a") : document.createElement("span");
  title.className = "news-title focus-news-title";
  title.textContent = item.title;
  if (title.tagName === "A") {
    title.href = item.sourceUrl;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.title = "打开原链接";
  }

  const date = document.createElement("span");
  date.className = "news-date-chip";
  date.innerHTML = '<i data-lucide="calendar-days"></i><span></span>';
  date.querySelector("span").textContent = item.publishDate || "未标注日期";

  node.append(number, title, date);

  if (item.summary) {
    const summary = document.createElement("p");
    summary.className = "news-summary";
    summary.textContent = item.summary;
    node.append(summary);
  }
  return node;
}

function createDrugReviewItem(item, index) {
  const node = document.createElement("article");
  node.className = "news-item drug-review-item";

  const top = document.createElement("div");
  top.className = "drug-review-top";

  const number = document.createElement("span");
  number.className = "news-index";
  number.textContent = getSequence(item, index);

  const body = document.createElement("div");
  body.className = "drug-review-body";

  const title = document.createElement("h3");
  title.className = "drug-name";
  title.textContent = item.productName || item.title;
  body.append(title);

  const tags = document.createElement("div");
  tags.className = "drug-tags";
  [item.companyName, item.registrationCategory].filter(Boolean).forEach((value) => {
    const tag = document.createElement("span");
    tag.textContent = value;
    tags.append(tag);
  });
  if (tags.childElementCount) body.append(tags);

  top.append(number, body);
  node.append(top);

  if (item.indication) {
    const indication = document.createElement("p");
    indication.className = "drug-indication";
    indication.textContent = item.indication;
    node.append(indication);
  }

  const progress = document.createElement("div");
  progress.className = "drug-progress-row";

  const progressNote = document.createElement("div");
  progressNote.className = "progress-note";
  progressNote.innerHTML = '<span class="field-label">进展提炼</span><strong></strong>';
  progressNote.querySelector("strong").textContent = item.progress || "未填写";

  const update = document.createElement("div");
  update.className = "update-chip";
  update.innerHTML = '<span>更新时间</span><time></time>';
  update.querySelector("time").textContent = item.updatedAt || item.publishDate || "未标注";

  progress.append(progressNote, update);
  node.append(progress);

  return node;
}

function getSequence(item, index) {
  return item.sequence || String(index + 1);
}

function createEmptyState(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}
