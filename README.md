# 国药西南新药引进网

基于设计文档实现的纯前端报表展示项目，支持上传 `.xlsx` / `.xls` 文件，解析新闻板块和表格板块，并生成首页看板与完整表格详情页。

## 本地运行

```bash
npm install
npm run dev
```

开发服务默认访问：

```text
http://127.0.0.1:5173/
```

生产构建：

```bash
npm run build
```

## 目录

```text
index.html
table.html
src/
  main.js
  tablePage.js
  parser/
    excelParser.js
    sectionMatcher.js
    normalizer.js
  render/
    newsRenderer.js
    tableRenderer.js
  config/
    dashboardConfig.js
  state/
    storage.js
  styles/
    base.css
    dashboard.css
```

## Excel 识别规则

- 优先按 sheet 名匹配设计文档中的板块标题。
- 如果 sheet 名不匹配，会在单元格内容中查找板块标题，并提取标题下方区域。
- 新闻链接只保留合法的 `http` / `https` 地址。
- 页面只保存解析后的会话数据，不展示原始 Excel 文件路径或下载链接。
