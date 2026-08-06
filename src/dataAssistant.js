import { controlledDrugDemoData } from "./config/controlledDrugDemoData.js";
import { hivDemoData } from "./config/hivDemoData.js";
import { procurementOriginatorDemoData } from "./config/procurementOriginatorDemoData.js";
import { rareDiseaseDemoData } from "./config/rareDiseaseDemoData.js";
import mascotUrl from "./assets/data-assistant-mascot-head.png";

const MAX_MESSAGES = 14;

export function createAssistantState() {
  return {
    isOpen: false,
    isLoading: false,
    showNudge: false,
    messages: [
      {
        role: "assistant",
        content: "你好，我是数据助手。我会依据当前网站已存的经营数据回答，并标注数据来源。你可以问销售趋势、销售第一品种、厂牌排名、建档覆盖或未建档品种。",
        sources: ["当前网站经营数据"]
      }
    ]
  };
}

export function renderDataAssistant(ui, activeGuide) {
  const examples = getExamples(activeGuide);
  return `
    <div class="data-assistant-launcher${ui.isOpen ? " is-open" : ""}" aria-label="数据助手">
      <section class="data-assistant-panel" aria-labelledby="dataAssistantTitle"${ui.isOpen ? "" : " hidden"}>
        <header class="data-assistant-header">
          <span class="data-assistant-avatar"><img src="${mascotUrl}" alt="" aria-hidden="true"></span>
          <div><small>国药西南新药引进网</small><h2 id="dataAssistantTitle">数据助手</h2><p><i data-lucide="shield-check"></i>仅依据已存数据回答</p></div>
          <button id="dataAssistantClose" class="data-assistant-close" type="button" aria-label="收起数据助手" title="收起数据助手"><span>收起</span><i data-lucide="chevron-down"></i></button>
        </header>
        <div id="dataAssistantMessages" class="data-assistant-messages" aria-live="polite">
          ${ui.messages.map(renderAssistantMessage).join("")}
        </div>
        <div class="data-assistant-examples" aria-label="示例问题">
          <span>试试这样问</span>
          <div>${examples.map((item) => `<button type="button" data-assistant-example="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}</div>
        </div>
        <form id="dataAssistantForm" class="data-assistant-form">
          <label><textarea id="dataAssistantInput" name="question" rows="2" maxlength="240" placeholder="请输入关于经营数据的问题"${ui.isLoading ? " disabled" : ""} required></textarea></label>
          <button type="submit" aria-label="发送问题"${ui.isLoading ? " disabled" : ""}><i data-lucide="${ui.isLoading ? "loader-circle" : "send-horizontal"}"></i></button>
        </form>
      </section>
      ${!ui.isOpen && ui.showNudge ? '<button id="dataAssistantNudge" class="data-assistant-nudge" type="button" aria-label="打开数据助手，了解数据问题">有问题找我了解</button>' : ""}
      <button id="dataAssistantToggle" class="data-assistant-toggle" type="button" aria-expanded="${String(ui.isOpen)}" aria-controls="dataAssistantMessages" title="${ui.isOpen ? "收起数据助手" : "打开数据助手"}">
        <span class="data-assistant-toggle-mascot"><img src="${mascotUrl}" alt="" aria-hidden="true"></span><span>${ui.isOpen ? "收起助手" : "数据助手"}</span>
      </button>
    </div>
  `;
}

export function answerDataQuestion(question, state, activeGuide) {
  const normalizedQuestion = String(question || "").trim();
  if (!normalizedQuestion) {
    return createAnswer("请先输入具体问题，例如“2025 年 HIV 销售额是多少？”", ["当前网站经营数据"]);
  }

  const knowledge = getKnowledge(state);
  const domain = resolveDomain(normalizedQuestion, activeGuide, knowledge);
  const years = extractYears(normalizedQuestion);
  const query = normalizedQuestion.toLowerCase();
  const matchedProduct = findMatchingProduct(normalizedQuestion, domain.products);

  if (isUnarchivedQuestion(query)) {
    return answerUnarchived(domain, knowledge);
  }

  if (isCoverageQuestion(query)) {
    return answerCoverage(domain, knowledge);
  }

  if (matchedProduct && !isRankQuestion(query, ["第一", "最高", "top", "排名"])) {
    return answerProduct(domain, matchedProduct, years);
  }

  if (isTrendQuestion(query)) {
    return answerTrend(domain, years);
  }

  if (isRankQuestion(query, ["厂牌", "厂家", "企业", "公司"])) {
    return answerRank(domain, "brands", years, "厂牌");
  }

  if (isRankQuestion(query, ["适应症", "方案", "类别", "品类", "治疗领域"])) {
    return answerRank(domain, "categories", years, domain.key === "hiv" ? "治疗方案" : "药品类别");
  }

  if (isRankQuestion(query, ["品种", "产品", "药品", "top", "第一", "最高"])) {
    return answerRank(domain, "products", years, "品种");
  }

  const evidence = retrieveEvidence(normalizedQuestion, knowledge).slice(0, 3);
  if (evidence.length) {
    return createAnswer(
      `我从当前已存数据中匹配到以下信息：\n${evidence.map((item) => `• ${item.content}`).join("\n")}\n\n如果你希望得到精确数值，可以补充统计年份、药品名称或分析板块。`,
      evidence.map((item) => item.source)
    );
  }

  return createAnswer("当前已存数据中没有找到能直接支持这个问题的内容。请换一种问法，或先导入包含该信息的表格/报告。", ["当前网站经营数据"]);
}

export function appendAssistantMessage(ui, message) {
  ui.messages = [...ui.messages, message].slice(-MAX_MESSAGES);
}

export async function askDeepSeekAssistant(question, groundedAnswer) {
  const response = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question,
      context: [
        {
          source: (groundedAnswer.sources || []).join("、") || "当前网站经营数据",
          content: groundedAnswer.content
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("DeepSeek 服务当前不可用");
  }

  const payload = await response.json();
  const content = String(payload.answer || "").trim();
  if (!content) throw new Error("DeepSeek 未返回可用回答");

  return createAnswer(content, [...new Set([...(groundedAnswer.sources || []), "DeepSeek整理"])]);
}

function getKnowledge(state) {
  const procurement = state.procurementOriginator || procurementOriginatorDemoData;
  const hiv = state.hiv || hivDemoData;
  const rare = state.rareDisease || rareDiseaseDemoData;
  const controlled = state.controlledDrug || controlledDrugDemoData;
  const innovation = getInnovationKnowledge(state);

  return {
    procurement: createDomain({
      key: "procurement",
      title: "集采原研药品",
      source: procurement.source,
      years: procurement.years,
      trend: procurement.trend,
      brands: procurement.brands,
      categories: procurement.categories,
      products: procurement.products,
      overview: procurement.overview,
      unarchived: []
    }),
    hiv: createDomain({
      key: "hiv",
      title: "HIV药品",
      source: hiv.source,
      years: hiv.years,
      trend: hiv.trend,
      brands: hiv.brands,
      categories: hiv.regimens,
      products: hiv.products,
      overview: hiv.overview,
      coverage: hiv.coverage,
      unarchived: hiv.attentionProducts.filter((item) => item.type === "指南目录未建档")
    }),
    rare: createRareDomain(rare),
    controlled: createControlledDomain(controlled),
    innovation
  };
}

function createDomain(domain) {
  return {
    ...domain,
    brands: domain.brands || [],
    categories: domain.categories || [],
    products: domain.products || [],
    trend: domain.trend || [],
    source: domain.source || "当前网站经营数据"
  };
}

function createRareDomain(dashboard) {
  const years = dashboard.analysisYears || dashboard.salesYears || [];
  const records = dashboard.records || [];
  const brands = aggregateEntries(records, years, (record) => record.brand || "未标注厂牌");
  const categories = aggregateEntries(records, years, (record) => record.indicationShort || record.indication || "未标注适应症");
  const products = records.map((record) => ({
    name: record.genericName,
    brand: record.brand,
    category: record.indicationShort || record.indication,
    sales: record.sales || {}
  }));

  return createDomain({
    key: "rare",
    title: "罕见病药品",
    source: "6年上市罕见病用药",
    years,
    trend: dashboard.trend || [],
    brands,
    categories,
    products,
    overview: dashboard.overview || {},
    unarchived: records.filter((record) => !record.archived).map((record) => ({ name: record.genericName, note: record.indicationShort || record.indication || "未标注适应症" }))
  });
}

function createControlledDomain(dashboard) {
  const categories = (dashboard.categories || []).map((item) => ({
    name: item.title,
    sales: Object.fromEntries((dashboard.salesPeriods || []).map((period) => [period.year, Number(period.values?.[item.key] || 0)]))
  }));
  const products = (dashboard.categories || []).flatMap((category) =>
    (category.topProducts || []).map((item) => ({
      name: item.name,
      brand: category.title,
      category: item.indication,
      sales: { [category.topSalesYear]: item.sales }
    }))
  );

  return createDomain({
    key: "controlled",
    title: "麻精药品",
    source: "麻精经营看板数据",
    years: (dashboard.salesPeriods || []).map((item) => item.year),
    trend: (dashboard.salesPeriods || []).map((item) => ({ year: item.year, sales: item.total })),
    brands: [],
    categories,
    products,
    overview: dashboard.overview || {},
    unarchived: (dashboard.categories || []).flatMap((category) => category.unarchived || [])
  });
}

function getInnovationKnowledge(state) {
  const researchRecords = state.researchSurvey?.records || [];
  const tableRows = state.tableSections?.flatMap((section) => section.rows || []) || [];
  return createDomain({
    key: "innovation",
    title: "创新药",
    source: "创新药经营数据",
    years: [],
    trend: [],
    brands: [],
    categories: [],
    products: [...researchRecords, ...tableRows]
      .map((record) => ({
        name: record.genericName || record.name || record.values?.["通用名"] || record.values?.["品种名称"] || "",
        brand: record.brand || record.values?.["厂牌"] || "",
        category: record.indication || record.values?.["适应症"] || "",
        sales: {}
      }))
      .filter((item) => item.name),
    overview: {},
    unarchived: []
  });
}

function resolveDomain(question, activeGuide, knowledge) {
  const text = question.toLowerCase();
  const candidates = [
    ["hiv", ["hiv", "艾滋", "必妥维", "捷扶康", "吉利德", "多替拉韦", "阿兹夫定"]],
    ["procurement", ["集采", "原研", "安达唐", "美平", "克赛", "拜瑞妥", "开同"]],
    ["rare", ["罕见", "罕病", "诺西那生", "多发性硬化", "脊髓性肌萎缩", "适应症"]],
    ["controlled", ["麻精", "麻醉", "精神药品", "羟考酮", "瑞马唑仑"]],
    ["innovation", ["创新药", "调研"]]
  ];
  const matched = candidates.find(([, words]) => words.some((word) => text.includes(word)));
  if (matched) return knowledge[matched[0]];
  const guideMap = { "集采原研": "procurement", "HIV药品": "hiv", "罕见病": "rare", "麻精": "controlled", "创新药": "innovation" };
  return knowledge[guideMap[activeGuide] || "innovation"];
}

function answerTrend(domain, years) {
  if (!domain.trend.length) return createAnswer(`${domain.title}当前没有可用于趋势分析的年度销售数据。`, [domain.source]);
  const selected = selectTrend(domain.trend, years);
  if (!selected.length) return createAnswer(`${domain.title}在所问年份没有销售趋势数据。`, [domain.source]);
  const values = selected.map((item) => `${item.year} 年 ${formatAmount(item.sales)} 万元${item.forecast ? "（预测）" : item.partial ? "（截至当前统计）" : ""}`);
  const rangeSales = selected.reduce((sum, item) => sum + Number(item.sales || 0), 0);
  const title = selected.length === 1 ? `${selected[0].year} 年` : `${selected[0].year}—${selected.at(-1).year} 年`;
  return createAnswer(`${domain.title}${title}销售额：${values.join("；")}。${selected.length > 1 ? `区间累计为 ${formatAmount(rangeSales)} 万元。` : ""}`, [domain.source]);
}

function answerRank(domain, key, years, label) {
  const entries = domain[key] || [];
  if (!entries.length) return createAnswer(`${domain.title}当前没有可用于${label}排名的数据。`, [domain.source]);
  const selectedYears = resolveYears(domain.years, years);
  const ranking = entries
    .map((item) => ({ ...item, value: sumSales(item.sales, selectedYears) }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
  if (!ranking.length) return createAnswer(`${domain.title}在所问年份没有${label}销售数据。`, [domain.source]);
  const top = ranking[0];
  const topThree = ranking.slice(0, 3).map((item, index) => `第${index + 1}：${item.name}（${formatAmount(item.value)}万元）`);
  const period = formatPeriod(selectedYears);
  return createAnswer(`${domain.title}${period}${label}销售排名中，第一名是${top.name}，销售 ${formatAmount(top.value)} 万元。${topThree.join("；")}。`, [domain.source]);
}

function answerProduct(domain, product, years) {
  const selectedYears = resolveYears(domain.years, years);
  const value = sumSales(product.sales, selectedYears);
  const details = selectedYears
    .filter((year) => Number(product.sales?.[year] || 0) !== 0)
    .map((year) => `${year} 年 ${formatAmount(product.sales[year])} 万元`);
  return createAnswer(`${product.name}${product.brand ? `（${product.brand}）` : ""}${formatPeriod(selectedYears)}销售 ${formatAmount(value)} 万元。${details.length ? `年度数据：${details.join("；")}。` : "当前数据中未录入该时段销售额。"}`, [domain.source]);
}

function answerCoverage(domain, knowledge) {
  if (domain.key === "hiv") {
    const coverage = domain.coverage || knowledge.hiv.coverage || [];
    const details = coverage.map((item) => `${item.shortName}：${item.archived}/${item.guideline}，${item.status}`).join("；");
    return createAnswer(`HIV 指南目录共 ${domain.overview.guidelineCount} 个品种，国药西南已建档 ${domain.overview.archivedCount} 个，覆盖率 ${domain.overview.archiveRate}%。类别覆盖情况：${details}。`, [domain.source, "中国艾滋病诊疗指南（2024版）"]);
  }
  if (domain.key === "rare") {
    return createAnswer(`罕见病板块当前收录 ${domain.records?.length || domain.products.length} 条品种记录。建档情况以网站已导入的“6年上市罕见病用药”数据为准，可继续询问“未建档品种有哪些”。`, [domain.source]);
  }
  if (domain.key === "procurement") {
    return createAnswer(`集采原研源表收录 ${domain.overview.catalogCount} 个有效品种，已建档经营 ${domain.overview.archivedOperatingCount} 个，经营建档率 ${domain.overview.archiveRate}%。`, [domain.source]);
  }
  return createAnswer(`${domain.title}当前没有可直接汇总的建档覆盖字段。`, [domain.source]);
}

function answerUnarchived(domain, knowledge) {
  if (domain.key === "hiv") {
    const items = domain.unarchived || [];
    return createAnswer(`HIV 指南目录未建档品种为：${items.map((item) => `${item.name}（${item.note}）`).join("；")}。文稿判断这两项主要由免费治疗或基层集采供应覆盖，对商业竞争力影响有限。`, [domain.source, "HIV药品经营分析报告"]);
  }
  if (domain.key === "rare") {
    const items = domain.unarchived || [];
    const preview = items.slice(0, 8).map((item) => `${item.name}（${item.note}）`).join("；");
    return createAnswer(`罕见病当前数据中未建档品种共 ${items.length} 个。优先示例：${preview}${items.length > 8 ? "等" : ""}。`, [domain.source]);
  }
  if (domain.key === "controlled") {
    const items = domain.unarchived || [];
    return createAnswer(`麻精板块当前记录的未建档品种包括：${items.slice(0, 8).map((item) => item.name).join("、")}${items.length > 8 ? "等" : ""}。`, [domain.source]);
  }
  return createAnswer(`${domain.title}当前未纳入未建档品种清单数据。`, [domain.source]);
}

function retrieveEvidence(question, knowledge) {
  const words = getSearchWords(question);
  const chunks = Object.values(knowledge).flatMap((domain) => createKnowledgeChunks(domain));
  return chunks
    .map((chunk) => ({ ...chunk, score: words.reduce((score, word) => score + (chunk.searchText.includes(word) ? 2 : 0), 0) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function createKnowledgeChunks(domain) {
  const chunks = [];
  if (domain.overview && Object.keys(domain.overview).length) {
    chunks.push({
      source: domain.source,
      content: `${domain.title}总览：${formatOverview(domain)}`,
      searchText: `${domain.title} ${formatOverview(domain)}`.toLowerCase()
    });
  }
  domain.products.slice(0, 10).forEach((item) => {
    chunks.push({
      source: domain.source,
      content: `${domain.title}重点品种：${item.name}${item.brand ? `，厂牌${item.brand}` : ""}${item.category ? `，类别${item.category}` : ""}`,
      searchText: `${domain.title} ${item.name} ${item.brand || ""} ${item.category || ""}`.toLowerCase()
    });
  });
  domain.brands.slice(0, 8).forEach((item) => {
    chunks.push({
      source: domain.source,
      content: `${domain.title}厂牌：${item.name}`,
      searchText: `${domain.title} 厂牌 ${item.name}`.toLowerCase()
    });
  });
  return chunks;
}

function formatOverview(domain) {
  if (domain.key === "hiv") return `指南目录${domain.overview.guidelineCount}个，已建档${domain.overview.archivedCount}个，覆盖率${domain.overview.archiveRate}%，累计销售${formatAmount(domain.overview.cumulativeSales)}万元。`;
  if (domain.key === "procurement") return `有效品种${domain.overview.catalogCount}个，已建档经营${domain.overview.archivedOperatingCount}个，涉及${domain.overview.manufacturerCount}家原研厂家。`;
  return "当前网站已存经营数据。";
}

function aggregateEntries(records, years, getName) {
  const map = new Map();
  records.forEach((record) => {
    const name = getName(record);
    const entry = map.get(name) || { name, sales: {} };
    years.forEach((year) => {
      entry.sales[year] = Number(entry.sales[year] || 0) + Number(record.sales?.[year] || 0);
    });
    map.set(name, entry);
  });
  return [...map.values()];
}

function findMatchingProduct(question, products) {
  const text = String(question).toLowerCase();
  return products.find((item) => getProductAliases(item.name).some((alias) => alias.length >= 2 && text.includes(alias.toLowerCase()))) || null;
}

function getProductAliases(name) {
  const value = String(name || "").trim();
  const parenthetical = [...value.matchAll(/[（(]([^）)]+)[）)]/g)].map((item) => item[1]);
  return [value, ...parenthetical];
}

function selectTrend(trend, requestedYears) {
  if (!requestedYears.length) return trend;
  const first = Math.min(...requestedYears);
  const last = Math.max(...requestedYears);
  return trend.filter((item) => item.year >= first && item.year <= last);
}

function resolveYears(availableYears, requestedYears) {
  const years = [...availableYears].map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!requestedYears.length) return years;
  const first = Math.min(...requestedYears);
  const last = Math.max(...requestedYears);
  return years.filter((year) => year >= first && year <= last);
}

function extractYears(question) {
  return [...new Set([...String(question).matchAll(/20\d{2}/g)].map((match) => Number(match[0])))].sort((left, right) => left - right);
}

function isTrendQuestion(query) {
  return ["销售", "趋势", "金额", "营收", "多少"].some((word) => query.includes(word)) && !isRankQuestion(query, ["第一", "最高", "top", "排名"]);
}

function isRankQuestion(query, words) {
  return words.some((word) => query.includes(word));
}

function isCoverageQuestion(query) {
  return ["建档率", "覆盖率", "建档", "覆盖"].some((word) => query.includes(word)) && !query.includes("未建档");
}

function isUnarchivedQuestion(query) {
  return query.includes("未建档");
}

function getExamples(activeGuide) {
  const examples = {
    "集采原研": ["2025 年销售额是多少？", "销售第一原研厂家是谁？", "集采后降幅最大的品种有哪些？"],
    "HIV药品": ["HIV 建档覆盖率是多少？", "2024 年销售第一品种是什么？", "哪些品种尚未建档？"],
    "罕见病": ["未建档品种有哪些？", "适应症销售排名如何？", "2025 年销售额是多少？"],
    "麻精": ["2025 年销售额是多少？", "哪类麻精药品销售最高？", "未建档品种有哪些？"],
    "创新药": ["当前创新药经营数据有哪些？", "请列出已存的重点品种", "建档情况如何？"]
  };
  return examples[activeGuide] || examples["创新药"];
}

function renderAssistantMessage(message) {
  const isUser = message.role === "user";
  return `<article class="data-assistant-message ${isUser ? "is-user" : "is-assistant"}">${isUser ? "" : `<span class="data-assistant-message-avatar"><img src="${mascotUrl}" alt="" aria-hidden="true"></span>`}<div><p>${escapeHtml(message.content).replace(/\n/g, "<br>")}</p>${message.sources?.length ? `<small>来源：${[...new Set(message.sources)].map(escapeHtml).join(" · ")}</small>` : ""}</div></article>`;
}

function createAnswer(content, sources) {
  return { role: "assistant", content, sources };
}

function formatAmount(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function sumSales(sales, years) {
  return years.reduce((total, year) => total + Number(sales?.[year] || 0), 0);
}

function formatPeriod(years) {
  if (!years.length) return "";
  return years.length === 1 ? `${years[0]} 年` : `${years[0]}—${years.at(-1)} 年`;
}

function getSearchWords(value) {
  const text = String(value || "").toLowerCase();
  const terms = text.split(/[\s，。、“”‘’？?！!、：:；;（）()]+/).filter((item) => item.length > 1);
  const cjkPairs = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2);
    if (/^[\u4e00-\u9fa5]{2}$/.test(pair)) cjkPairs.push(pair);
  }
  return [...new Set([...terms, ...cjkPairs])];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
