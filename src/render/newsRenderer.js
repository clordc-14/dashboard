import { isValidHttpUrl } from "../parser/normalizer.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function renderNewsSections(container, sections = [], tableSections = []) {
  container.replaceChildren();

  sections.forEach((section) => {
    if (section.key === "weeklyFocus") {
      container.append(createWeeklyHighlightsCard(section, tableSections));
      return;
    }

    if (section.key === "lastWeekInnovativeDrugs") {
      container.append(createWeeklyIntroductionProgressCard(section, tableSections));
      return;
    }

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

function createWeeklyHighlightsCard(section, tableSections) {
  const southwestItems = getSouthwestWeeklyItems(tableSections);
  const politicsItems = section.items || [];
  const card = document.createElement("article");
  card.className = "news-column weekly-highlights";

  const header = document.createElement("div");
  header.className = "panel-heading";

  const title = document.createElement("h2");
  title.textContent = "本周要闻";

  const count = document.createElement("span");
  count.className = "count-pill";
  count.textContent = `${southwestItems.length + politicsItems.length} 条`;

  header.append(title, count);
  card.append(header);

  const stack = document.createElement("div");
  stack.className = "weekly-news-stack";
  stack.append(
    createNewsSubsection({
      title: "本周上市新品",
      items: southwestItems,
      emptyText: "本周暂无上市新品",
      renderItem: createSouthwestNewsItem
    }),
    createNewsSubsection({
      title: "时政要闻",
      items: politicsItems,
      emptyText: "暂无时政要闻数据",
      renderItem: (item, index) => createFocusNewsItem(item, index)
    })
  );

  card.append(stack);
  return card;
}

function createWeeklyIntroductionProgressCard(section, tableSections) {
  const archivedItems = getWeeklyNewArchivedItems(tableSections);
  const reviewItems = section.items || [];
  const card = document.createElement("article");
  card.className = "news-column weekly-highlights weekly-progress";

  const header = document.createElement("div");
  header.className = "panel-heading";

  const title = document.createElement("h2");
  title.textContent = section.title || "本周引进进展";

  const count = document.createElement("span");
  count.className = "count-pill";
  count.textContent = `${archivedItems.length + reviewItems.length} 条`;

  header.append(title, count);
  card.append(header);

  const stack = document.createElement("div");
  stack.className = "weekly-news-stack";
  stack.append(
    createNewsSubsection({
      title: "本周新增建档品种",
      items: archivedItems,
      emptyText: "本周暂无新增建档品种",
      renderItem: createWeeklyArchivedNewsItem
    }),
    createNewsSubsection({
      title: "上周上市创新药回顾",
      items: reviewItems,
      emptyText: "暂无上周上市创新药回顾数据",
      renderItem: (item, index) => createDrugReviewItem(item, index)
    })
  );

  card.append(stack);
  return card;
}

function createNewsSubsection({ title, items, emptyText, renderItem }) {
  const section = document.createElement("section");
  section.className = "news-subsection";

  const heading = document.createElement("div");
  heading.className = "news-subsection-heading";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  const count = document.createElement("span");
  count.textContent = `${items.length} 条`;
  heading.append(h3, count);
  section.append(heading);

  const list = document.createElement("div");
  list.className = "news-list";
  if (!items.length) {
    list.append(createEmptyState(emptyText));
  } else {
    items.forEach((item, index) => list.append(renderItem(item, index)));
  }

  section.append(list);
  return section;
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
  number.textContent = String(index + 1);

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

function createWeeklyArchivedNewsItem(item, index) {
  const node = document.createElement("article");
  node.className = "news-item southwest-news-item weekly-archived-news-item";

  const number = document.createElement("span");
  number.className = "news-index";
  number.textContent = String(index + 1);

  const body = document.createElement("div");
  body.className = "southwest-news-body";

  const title = document.createElement("h3");
  title.className = "drug-name";
  title.textContent = item.southwestName || item.productName || "未命名品种";
  body.append(title);

  const tags = document.createElement("div");
  tags.className = "drug-tags southwest-news-tags";
  [
    item.companyName ? `厂牌：${item.companyName}` : "",
    item.approvalDate ? `获批：${item.approvalDate}` : "",
    item.registrationCategory ? `注册分类：${item.registrationCategory}` : "",
    item.target ? `靶点：${item.target}` : "",
    item.purchase ? `采购：${item.purchase}` : ""
  ]
    .filter(Boolean)
    .forEach((value) => {
      const tag = document.createElement("span");
      tag.textContent = value;
      tags.append(tag);
    });
  if (tags.childElementCount) body.append(tags);

  if (item.indication) {
    const indication = document.createElement("p");
    indication.className = "drug-indication southwest-indication";
    indication.textContent = item.indication;
    body.append(indication);
  }

  node.append(number, body);
  return node;
}

function createSouthwestNewsItem(item, index) {
  const node = document.createElement("article");
  node.className = "news-item southwest-news-item";

  const number = document.createElement("span");
  number.className = "news-index";
  number.textContent = getSequence(item, index);

  const body = document.createElement("div");
  body.className = "southwest-news-body";

  const title = document.createElement("h3");
  title.className = "drug-name";
  title.textContent = item.tradeName && item.tradeName !== "/" ? `${item.productName}（${item.tradeName}）` : item.productName;
  body.append(title);

  const tags = document.createElement("div");
  tags.className = "drug-tags southwest-news-tags";
  [
    item.approvalDate ? `获批：${item.approvalDate}` : "",
    item.target ? `靶点：${item.target}` : "",
    item.rating ? `评价：${item.rating}` : ""
  ]
    .filter(Boolean)
    .forEach((value) => {
      const tag = document.createElement("span");
      tag.textContent = value;
      tags.append(tag);
    });
  if (tags.childElementCount) body.append(tags);

  if (item.indication) {
    const indication = document.createElement("p");
    indication.className = "drug-indication southwest-indication";
    indication.textContent = item.indication;
    body.append(indication);
  }

  node.append(number, body);
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

function getSouthwestWeeklyItems(tableSections) {
  const poolSection = tableSections.find((section) => section.key === "innovativeDrugPool");
  if (!poolSection?.rows?.length) return [];

  const today = getBeijingDayStart(new Date());
  const start = today - 7 * DAY_MS;

  return poolSection.rows
    .map((row) => ({
      row,
      approvalTime: getApprovalTime(row)
    }))
    .filter(({ approvalTime }) => approvalTime >= start && approvalTime <= today)
    .sort((left, right) => right.approvalTime - left.approvalTime)
    .slice(0, 8)
    .map(({ row }, index) => ({
      sequence: String(index + 1),
      productName: getRowField(row, "productName") || "未命名品种",
      tradeName: getRowField(row, "tradeName"),
      indication: getRowField(row, "indication"),
      target: getRowField(row, "target"),
      rating: getRowField(row, "rating"),
      approvalDate: formatApprovalDate(getRowField(row, "approvalDate"))
    }));
}

function getWeeklyNewArchivedItems(tableSections) {
  const section = tableSections.find((candidate) => candidate.key === "weeklyNewArchived");
  if (!section?.rows?.length) return [];

  return section.rows.map((row, index) => ({
    sequence: String(index + 1),
    southwestName: getRowField(row, "southwestName") || getRowField(row, "productName") || "未命名品种",
    productName: getRowField(row, "productName"),
    companyName: getRowField(row, "companyName"),
    approvalDate: formatApprovalDate(getRowField(row, "approvalDate")),
    indication: getRowField(row, "indication"),
    registrationCategory: getRowField(row, "registrationCategory"),
    target: getRowField(row, "target"),
    purchase: getRowField(row, "purchase")
  }));
}

function getRowField(row, field) {
  return row.fields?.[field] || row.values?.[field] || "";
}

function getBeijingDayStart(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  })
    .formatToParts(date)
    .reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = Number(part.value);
      return result;
    }, {});

  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function getApprovalTime(row) {
  const parts = getDateParts(getRowField(row, "approvalDate"));
  if (!parts) return 0;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function formatApprovalDate(value) {
  const parts = getDateParts(value);
  if (!parts) return String(value || "");
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function getDateParts(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const serial = Number(text);
  if (Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
    const date = new Date(Math.round((serial - 25569) * DAY_MS));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  const isoMatch = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3])
    };
  }

  const slashMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (slashMatch) {
    const year = Number(slashMatch[3]);
    return {
      year: year < 100 ? 2000 + year : year,
      month: Number(slashMatch[1]),
      day: Number(slashMatch[2])
    };
  }

  return null;
}
