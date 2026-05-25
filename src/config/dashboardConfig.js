export const dashboardConfig = {
  upload: {
    acceptedExtensions: ["xlsx", "xls"],
    maxFileSize: 20 * 1024 * 1024
  },
  newsSections: [
    {
      key: "weeklyFocus",
      title: "本周重点信息",
      matchTitle: "本周重点信息",
      type: "news",
      aliases: ["本周重点", "重点信息", "周重点"]
    },
    {
      key: "lastWeekInnovativeDrugs",
      title: "上周上市创新药回顾",
      matchTitle: "上周上市创新药回顾",
      type: "news",
      aliases: ["上市创新药回顾", "上周创新药", "创新药回顾"]
    }
  ],
  tableSections: [
    {
      key: "archivedProducts",
      title: "已建档品种明细",
      matchTitle: "已建档品种明细",
      aliases: ["已建档品种", "建档品种", "品种明细"]
    },
    {
      key: "needLeaderSupport",
      title: "需领导协助引进（未合作厂牌）",
      matchTitle: "需领导协助引进（未合作厂牌）",
      aliases: ["需领导协助引进", "领导协助", "未合作厂牌"]
    },
    {
      key: "introductionProgress",
      title: "新药引进进展",
      matchTitle: "新药引进进展",
      aliases: ["引进进展", "项目进展", "跟进进展", "其他表格板块 1", "其他表格板块1"],
      autoFillFromUnmatched: true
    },
    {
      key: "innovativeDrugPool",
      title: "上市创新药品种池",
      matchTitle: "上市创新药品种池",
      aliases: ["创新药品种池", "创新药品种", "重点关注品种", "其他表格板块 2", "其他表格板块2"],
      autoFillFromUnmatched: true
    },
    {
      key: "partnerCommunication",
      title: "合作厂牌沟通记录",
      matchTitle: "合作厂牌沟通记录",
      aliases: ["厂牌沟通", "合作沟通", "厂牌跟进", "其他表格板块 3", "其他表格板块3"],
      autoFillFromUnmatched: true
    }
  ]
};

const archivedProductColumns = [
  { key: "sequence", label: "序号", field: "sequence" },
  { key: "productName", label: "品种名称", field: "productName" },
  { key: "companyName", label: "厂牌", field: "companyName" },
  { key: "brandType", label: "厂牌类型", field: "brandType" },
  { key: "approvalDate", label: "获批时间", field: "approvalDate" },
  { key: "indication", label: "获批适应症", field: "indication" },
  { key: "diseaseArea", label: "疾病领域", field: "diseaseArea" },
  { key: "registrationCategory", label: "注册分类", field: "registrationCategory" },
  { key: "drugType", label: "药品类型", field: "drugType" },
  { key: "therapyType", label: "药品治疗类型", field: "therapyType" },
  { key: "targetCount", label: "靶点数目", field: "targetCount" },
  { key: "target", label: "靶点", field: "target" },
  { key: "purchase", label: "采购", field: "purchase" },
  { key: "rating", label: "评价", field: "rating" }
];

const archivedProductDemoRows = [
  createArchivedProductRow(1, {
    sequence: "1",
    productName: "磷酸芦可替尼乳膏",
    companyName: "康哲",
    brandType: "内资传统",
    approvalDate: "2026-01-27",
    indication: "用于治疗 12 岁及以上儿童和成人患者伴面部受累的非节段型白癜风",
    diseaseArea: "皮肤疾病药物",
    registrationCategory: "5.1",
    drugType: "化学药品",
    therapyType: "小分子化药",
    targetCount: "2",
    target: "JAK1/2",
    purchase: "喻娜",
    rating: "⭐⭐⭐⭐⭐"
  }),
  createArchivedProductRow(2, {
    sequence: "2",
    productName: "安沐奇塔单抗注射液(益赛拓)",
    companyName: "三生国健",
    brandType: "内资创新",
    approvalDate: "2026-02-10",
    indication: "用于治疗适合系统治疗或光疗的中度至重度斑块状银屑病成人患者。",
    diseaseArea: "皮肤疾病药物",
    registrationCategory: "3.1",
    drugType: "治疗用生物制品",
    therapyType: "单克隆抗体",
    targetCount: "1",
    target: "IL-17A",
    purchase: "郑莹晶",
    rating: "⭐⭐⭐⭐"
  }),
  createArchivedProductRow(3, {
    sequence: "3",
    productName: "瑞拉芙普α注射液",
    companyName: "恒瑞",
    brandType: "内资传统",
    approvalDate: "2026-01-07",
    indication: "联合氟尿嘧啶类和铂类药物用于经充分验证的检测评估PD-L1阳性的胃及胃食管结合部腺癌一线治疗。",
    diseaseArea: "抗肿瘤药物",
    registrationCategory: "1",
    drugType: "治疗用生物制品",
    therapyType: "融合蛋白",
    targetCount: "2",
    target: "PD-L1/TGF-βRII trap",
    purchase: "雷磊",
    rating: "⭐⭐⭐⭐"
  }),
  createArchivedProductRow(4, {
    sequence: "4",
    productName: "宗艾替尼片(圣赫途)",
    companyName: "勃林格",
    brandType: "外资传统",
    approvalDate: "2025-08-29",
    indication: "EGFR突变非小细胞肺癌",
    diseaseArea: "抗肿瘤药物",
    registrationCategory: "5.1",
    drugType: "化学药品",
    therapyType: "小分子化药",
    targetCount: "1",
    target: "EGFR T790M",
    purchase: "朱华",
    rating: "⭐⭐⭐⭐⭐"
  }),
  createArchivedProductRow(5, {
    sequence: "5",
    productName: "注射用德达博妥单抗(达卓优)",
    companyName: "阿斯利康",
    brandType: "外资创新",
    approvalDate: "2025-08-22",
    indication: "HER2阳性胃癌",
    diseaseArea: "抗肿瘤药物",
    registrationCategory: "3.1",
    drugType: "治疗用生物制品",
    therapyType: "抗体偶联药物",
    targetCount: "1",
    target: "TROP2 ADC",
    purchase: "吴姣",
    rating: "⭐⭐⭐⭐⭐"
  }),
  createArchivedProductRow(6, {
    sequence: "6",
    productName: "盐酸阿曲生坦片",
    companyName: "诺华",
    brandType: "外资传统",
    approvalDate: "2025-08-20",
    indication: "慢性肾脏病相关蛋白尿",
    diseaseArea: "泌尿系统疾病药物",
    registrationCategory: "5.1",
    drugType: "化学药品",
    therapyType: "小分子化药",
    targetCount: "1",
    target: "ETA",
    purchase: "吴姣",
    rating: "⭐⭐⭐⭐⭐"
  })
];

function createArchivedProductRow(index, values) {
  return {
    id: `archivedProducts-demo-${index}`,
    values,
    fields: values,
    links: {}
  };
}

export const demoDashboardData = {
  meta: {
    mode: "demo",
    updatedAt: "2026-05-17T09:00:00+08:00",
    sheetCount: 0,
    recognizedNewsSections: 2,
    recognizedTableSections: 5,
    warnings: []
  },
  newsSections: [
    {
      key: "weeklyFocus",
      title: "本周重点信息",
      type: "news",
      items: [
        {
          sequence: "1",
          title: "全球首创！阿斯利康高血压新药获批上市",
          summary: "",
          sourceName: "",
          sourceUrl: "https://mp.weixin.qq.com/s/G6_rPsyd3ps_nNX-4EI0Zw",
          publishDate: "2026年5月21日",
          category: "本周重点信息"
        },
        {
          sequence: "2",
          title: "拜耳 1 类新药申报上市，用于预防非心源性缺血性卒中或短暂性脑缺血发作（TIA）后患者的缺血性卒中",
          summary: "",
          sourceName: "",
          sourceUrl: "https://mp.weixin.qq.com/s/fTc1Frvh4tGqflcmvAQlbA",
          publishDate: "2026年5月22日",
          category: "本周重点信息"
        }
      ]
    },
    {
      key: "lastWeekInnovativeDrugs",
      title: "上周上市创新药回顾",
      type: "news",
      items: [
        {
          sequence: "1",
          title: "卡泊三醇倍他米松泡沫剂（恩适达）",
          summary: "",
          sourceName: "",
          sourceUrl: "",
          publishDate: "2026年5月21日",
          category: "上周上市创新药回顾",
          productName: "卡泊三醇倍他米松泡沫剂（恩适达）",
          companyName: "励奥",
          indication: "用于银屑症治疗（指南一线，外用，剂型创新）",
          registrationCategory: "5.1类",
          progress: "已联系，尚未落地，资料未全，等待资料建档中",
          updatedAt: "2026年5月21日"
        },
        {
          sequence: "2",
          title: "注射用重组特立帕肽",
          summary: "",
          sourceName: "",
          sourceUrl: "",
          publishDate: "2026年5月21日",
          category: "上周上市创新药回顾",
          productName: "注射用重组特立帕肽",
          companyName: "信立泰",
          indication: "用于治疗有骨折高发风险的绝经后妇女骨质疏松症（国内首仿长效）",
          registrationCategory: "3.4类",
          progress: "已联系，尚未落地，资料未全，等待资料建档中",
          updatedAt: "2026年5月21日"
        }
      ]
    }
  ],
  tableSections: [
    {
      key: "archivedProducts",
      title: "已建档品种明细",
      type: "table",
      source: { sheetName: "已建档品种明细示例", startRow: 1, endRow: 7, matchType: "demo" },
      columns: archivedProductColumns,
      rows: archivedProductDemoRows
    },
    {
      key: "needLeaderSupport",
      title: "需领导协助引进（未合作厂牌）",
      type: "table",
      source: { sheetName: "示例数据", startRow: 1, endRow: 3, matchType: "demo" },
      columns: [
        { key: "productName", label: "品种名称", field: "productName" },
        { key: "companyName", label: "厂牌", field: "companyName" },
        { key: "cooperationStatus", label: "合作状态", field: "cooperationStatus" },
        { key: "owner", label: "负责人", field: "owner" },
        { key: "remark", label: "备注", field: "remark" }
      ],
      rows: [
        {
          id: "needLeaderSupport-demo-1",
          values: {
            productName: "INN-86",
            companyName: "未合作厂牌 A",
            cooperationStatus: "需协助",
            owner: "采购协同组",
            remark: "需确认区域授权条件"
          },
          fields: {
            productName: "INN-86",
            companyName: "未合作厂牌 A",
            cooperationStatus: "需协助",
            owner: "采购协同组",
            remark: "需确认区域授权条件"
          },
          links: {}
        }
      ]
    },
    ...["introductionProgress", "innovativeDrugPool", "partnerCommunication"].map((key, index) => ({
      key,
      title: ["新药引进进展", "上市创新药品种池", "合作厂牌沟通记录"][index],
      type: "table",
      source: { sheetName: "示例数据", startRow: 1, endRow: 2, matchType: "demo" },
      columns: [
        { key: "productName", label: "品种名称", field: "productName" },
        { key: "status", label: "当前状态", field: "status" },
        { key: "progress", label: "引进进展", field: "progress" },
        { key: "remark", label: "备注", field: "remark" }
      ],
      rows: [
        {
          id: `${key}-demo-1`,
          values: {
            productName: ["示例品种 P1", "示例创新药 I1", "示例沟通事项 C1"][index],
            status: ["跟进中", "待评估", "已联系"][index],
            progress: ["等待资料补充", "纳入重点观察", "已约定下次沟通"][index],
            remark: "上传 Excel 后将替换为真实数据"
          },
          fields: {
            productName: ["示例品种 P1", "示例创新药 I1", "示例沟通事项 C1"][index],
            status: ["跟进中", "待评估", "已联系"][index],
            progress: ["等待资料补充", "纳入重点观察", "已约定下次沟通"][index],
            remark: "上传 Excel 后将替换为真实数据"
          },
          links: {}
        }
      ]
    }))
  ]
};
