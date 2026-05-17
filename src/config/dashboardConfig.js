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
          title: "重点厂牌完成首轮产品目录沟通",
          summary: "已整理对方重点管线、当前合作诉求和待确认价格区间，进入商务评估阶段。",
          sourceName: "内部周报",
          sourceUrl: "",
          publishDate: "2026-05-17",
          category: "本周重点信息"
        },
        {
          title: "三项待协助事项需管理层确认推进口径",
          summary: "涉及渠道授权、首批采购规模和区域独家条件，建议本周完成会签。",
          sourceName: "引进小组",
          sourceUrl: "",
          publishDate: "2026-05-16",
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
          title: "示例：肿瘤领域创新药新增上市信息待核验",
          summary: "请以上传 Excel 中维护的新闻源为准；系统仅展示合法 http/https 链接。",
          sourceName: "示例数据",
          sourceUrl: "https://example.com/news",
          publishDate: "2026-05-12",
          category: "上周上市创新药回顾"
        }
      ]
    }
  ],
  tableSections: [
    {
      key: "archivedProducts",
      title: "已建档品种明细",
      type: "table",
      source: { sheetName: "示例数据", startRow: 1, endRow: 3, matchType: "demo" },
      columns: [
        { key: "productName", label: "品种名称", field: "productName" },
        { key: "companyName", label: "生产企业 / 厂牌", field: "companyName" },
        { key: "status", label: "当前状态", field: "status" },
        { key: "owner", label: "负责人", field: "owner" },
        { key: "progress", label: "引进进展", field: "progress" }
      ],
      rows: [
        {
          id: "archivedProducts-demo-1",
          values: {
            productName: "SZ-101",
            companyName: "西南示例制药",
            status: "已建档",
            owner: "市场准入部",
            progress: "资料齐全，待商务评估"
          },
          fields: {
            productName: "SZ-101",
            companyName: "西南示例制药",
            status: "已建档",
            owner: "市场准入部",
            progress: "资料齐全，待商务评估"
          },
          links: {}
        },
        {
          id: "archivedProducts-demo-2",
          values: {
            productName: "GSW-224",
            companyName: "华西创新药业",
            status: "重点跟进",
            owner: "业务拓展部",
            progress: "已完成样本资料初审"
          },
          fields: {
            productName: "GSW-224",
            companyName: "华西创新药业",
            status: "重点跟进",
            owner: "业务拓展部",
            progress: "已完成样本资料初审"
          },
          links: {}
        }
      ]
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
