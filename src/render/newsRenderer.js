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
      section.items.forEach((item) => list.append(createNewsItem(item)));
    }

    card.append(list);
    container.append(card);
  });
}

function createNewsItem(item) {
  const node = document.createElement("article");
  node.className = "news-item";

  const titleLine = document.createElement("div");
  titleLine.className = "news-title-row";

  const title = isValidHttpUrl(item.sourceUrl) ? document.createElement("a") : document.createElement("span");
  title.className = "news-title";
  title.textContent = item.title;
  if (title.tagName === "A") {
    title.href = item.sourceUrl;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
  }

  titleLine.append(title);
  node.append(titleLine);

  if (item.summary) {
    const summary = document.createElement("p");
    summary.className = "news-summary";
    summary.textContent = item.summary;
    node.append(summary);
  }

  const meta = document.createElement("div");
  meta.className = "news-meta";

  const date = document.createElement("span");
  date.textContent = item.publishDate || "未标注日期";
  meta.append(date);

  if (item.sourceName) {
    const source = document.createElement("span");
    source.textContent = item.sourceName;
    meta.append(source);
  }

  if (isValidHttpUrl(item.sourceUrl)) {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = item.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = '<i data-lucide="external-link"></i><span>查看来源</span>';
    meta.append(link);
  }

  node.append(meta);
  return node;
}

function createEmptyState(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}
