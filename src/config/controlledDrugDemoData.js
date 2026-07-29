export const controlledDrugDemoData = {
  overview: {
    catalogCount: 128,
    marketedCount: 62,
    archivedCount: 52,
    archiveRate: 84,
    salesYear: 2025,
    salesTotal: 8689.898858
  },
  salesPeriods: [
    { year: 2022, values: { narcotic: 802.655972, "psychotropic-one": 94.39558, "psychotropic-two": 4287.922371 }, total: 5184.973923 },
    { year: 2023, values: { narcotic: 982.495784, "psychotropic-one": 260.393943, "psychotropic-two": 4221.996036 }, total: 5464.885763 },
    { year: 2024, values: { narcotic: 1262.207284, "psychotropic-one": 274.339875, "psychotropic-two": 5900.006762 }, total: 7436.553921 },
    { year: 2025, values: { narcotic: 1633.153778, "psychotropic-one": 400.001814, "psychotropic-two": 6656.743266 }, total: 8689.898858 }
  ],
  categories: [
    {
      key: "narcotic",
      title: "麻醉药品",
      color: "#4776d0",
      catalogCount: 32,
      domesticCount: 17,
      archivedCount: 14,
      archiveRate: 82,
      topSalesYear: 2025,
      unarchived: [
        { name: "二氢埃托啡*", management: [{ product: "盐酸二氢埃托啡舌下片", status: "药效极强、滥用风险高，临床应用已受到严格限制" }] },
        { name: "美沙酮*", management: [{ product: "盐酸美沙酮片", status: "主要用于戒毒" }, { product: "盐酸美沙酮口服溶液", status: "待更新" }] },
        { name: "福尔可定*", management: [{ product: "福尔可定片", status: "待更新" }] }
      ],
      topProducts: [
        { name: "盐酸羟考酮注射液", indication: "中度至重度急性疼痛，包括手术后疼痛及需要使用强阿片类药物的重度疼痛", sales: 1094.443406 },
        { name: "盐酸阿芬太尼注射液", indication: "作为麻醉性镇痛剂用于全身麻醉诱导和维持", sales: 119.072035 },
        { name: "枸橼酸舒芬太尼注射液", indication: "用于气管内插管、使用人工呼吸的全身麻醉；作为复合麻醉的镇痛用药；全身麻醉大手术的麻醉诱导和维持", sales: 112.609177 },
        { name: "富马酸泰吉利定注射液（艾苏特）", indication: "用于治疗腹部手术后中重度疼痛，以及骨科手术后中重度疼痛", sales: 112.581062 },
        { name: "盐酸氢吗啡酮注射液（锐宁）", indication: "其他镇痛药无效的急性锐痛和重度疼痛，如严重创伤、烧伤、晚期癌症等疼痛", sales: 105.975936 }
      ]
    },
    {
      key: "psychotropic-one",
      title: "第一类精神药品",
      color: "#55b947",
      catalogCount: 18,
      domesticCount: 9,
      archivedCount: 3,
      archiveRate: 33,
      topSalesYear: 2025,
      unarchived: [
        { name: "γ-羟丁酸*", management: [{ product: "羟丁酸钠注射液", status: "医保乙类品种" }] },
        { name: "司可巴比妥*", management: [{ product: "司可巴比妥钠胶囊", status: "因新型、更安全的镇静药物出现，其临床应用已严重受限。" }] },
        { name: "他喷他多*", management: [{ product: "盐酸他喷他多片", status: "待更新" }] },
        { name: "三唑仑*", management: [{ product: "三唑仑片", status: "待更新" }] },
        { name: "含氢可酮复方口服固体制剂*", management: [{ product: "氢可酮布洛芬片", status: "待更新" }] },
        { name: "含羟考酮复方口服固体制剂*", management: [{ product: "羟考酮纳洛酮缓释片", status: "待更新" }] }
      ],
      topProducts: [
        { name: "盐酸艾司氯胺酮注射液", indication: "用于与镇静麻醉药联合诱导和实施全身麻醉；也可用于抑郁症的治疗", sales: 142.096464 },
        { name: "咪达唑仑注射液（力月西）", indication: "麻醉前给药，全麻醉诱导和维持；镇静，抗惊厥", sales: 133.724606 },
        { name: "盐酸哌甲酯缓释咀嚼片", indication: "用于治疗注意缺陷多动障碍（ADHD）", sales: 78.065089 },
        { name: "盐酸哌甲酯缓释干混悬剂", indication: "用于治疗注意缺陷多动障碍（ADHD）", sales: 38.461753 },
        { name: "咪达唑仑注射液", indication: "麻醉前给药，全麻醉诱导和维持；镇静，抗惊厥", sales: 4.677692 }
      ]
    },
    {
      key: "psychotropic-two",
      title: "第二类精神药品",
      color: "#31bdb5",
      catalogCount: 78,
      domesticCount: 36,
      archivedCount: 35,
      archiveRate: 97,
      topSalesYear: 2025,
      unarchived: [{ name: "氯氮䓬*", management: [{ product: "氯氮䓬片", status: "待更新" }] }],
      topProducts: [
        { name: "酒石酸布托啡诺注射液（诺扬）", indication: "用于中度至重度疼痛，如术后、外伤、癌痛等的镇痛；也可用作麻醉前给药", sales: 2313.589485 },
        { name: "注射用甲苯磺酸瑞马唑仑（瑞倍宁）", indication: "适用于胃镜、结肠镜检查的镇静；也用于全身麻醉的诱导和维持", sales: 777.897085 },
        { name: "地佐辛注射液", indication: "用于需要使用阿片类镇痛药治疗的各种疼痛", sales: 652.125311 },
        { name: "奥沙西泮片", indication: "主要用于短期缓解焦虑、紧张、激动，也可用于催眠，并能缓解急性酒精戒断症状", sales: 510.295306 },
        { name: "盐酸曲马多缓释片（舒敏）", indication: "用于急、慢性疼痛，中、轻度癌症疼痛，骨折或各种术后疼痛、牙痛等", sales: 305.025326 }
      ]
    }
  ]
};
