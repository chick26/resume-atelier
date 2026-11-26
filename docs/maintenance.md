# Resume Atelier 维护指南

在 Node.js 20 或更新版本下执行以下命令。

```sh
npm ci
npm run build
npm run check
```

`npm run build` 将 `src/` 和 `examples/` 打包成仓库根目录的 `main.js`，并按固定顺序合并 `src/styles/` 生成 `styles.css`。`npm run check` 校验安装文件是否和当前源码一致，然后运行测试。提交源码改动时，一并提交重新构建的安装文件。

## 从哪里改

| 想修改 | 源码位置 |
| --- | --- |
| 插件启动、命令、文件菜单和工作台路由 | [src/main.js](../src/main.js) |
| 笔记识别、语言、只读保护和 Markdown 文件读写 | [src/resume/](../src/resume) |
| 工作台布局、预览、正文编辑和栏目排序 | [src/workbench/](../src/workbench) |
| A4／US Letter 尺寸、边距、字号与间距、页界测量 | [src/layout/](../src/layout) |
| 经历头、栏目归组、技能标签和头像链接 | [栏目结构](../src/resume/section-layout.js) · [头像](../src/resume/avatar.js) |
| CSS 主题读取、保存和作用域 | [src/themes/](../src/themes) |
| 设置页、最近文件和本机版式保存 | [src/settings/](../src/settings) |
| Obsidian 阅读视图和原生 PDF 导出 | [src/obsidian/presentation.js](../src/obsidian/presentation.js) |
| 界面文案、纸张样式和示例 | [本地化](../src/localization.js) · [样式](../src/styles) · [示例](../examples) |

工作台通过简历识别模块取得文件及只读状态，交给版式面板和预览区。正文写入由文件模块检查编辑冲突，并通过 Obsidian 的 Vault API 保存。设置、本机试排和最近文件路径由 SettingsStore 串行写入 `data.json`。

插件 ID 和工作台视图类型为 `careeros-resume-layout`，打开命令为 `careeros-resume-layout:open`，已有安装和 CareerOS 集成沿用这些标识。

## 渲染与笔记属性

- `resume_style` 选主题，`resume_density` 选密度。`resume_layout.paper` 支持 `A4` 和 `Letter`，旧稿缺省 A4。`resume_layout.appearance` 可覆盖强调色、栏目与清单间距，以及头像比例、圆角和位置。「恢复主题样式」清除插件认识的这些覆盖值，保留扩展字段。
- `resume_sections` 以二级标题为键，支持 `region: sidebar`、`display: tags` 和 `hidden: true`。默认按正文顺序展示。重名栏目会提示消歧，失配的规则可从栏目面板清理。工作台预览和原生打印使用同一份语义归组，阅读视图只在块内增强，保留全部原文。
- 在自定义主题的 `:scope` 规则中指定 `--resume-structure: sidebar` 或 `--resume-structure: timeline`，即可复用内置结构。单栏可继续使用原来的直接子标题选择器。列归属和显示方式属于稿件，栏宽、线条和默认色彩属于主题。
- 工作台按所选纸张的可用宽高，用浏览器的分栏排版估算自动页界并标出页码。手动分页可用前后留空行的 `---`。验收以原生 PDF 逐页结果为准；从笔记菜单导出时选与工作台相同的纸张、纵向、100%、无附加边距并关闭文件名标题。

## 验证和打包

1. 在干净库的 `.obsidian/plugins/careeros-resume-layout/` 放入根目录的三个安装文件。启用插件，从母版建立副本，在双栏中移动技能、隐藏荣誉、点击纸面改字，再导出两页 PDF。复核母版与来源、侧栏修改的行及 PDF 中的页面与链接。
2. 另建测试库，先安装 `0.7.0` 标签的三个文件，保存设置、主题、最近文件和已确认的投递稿。关闭测试库，只替换三个安装文件后重开，再重载插件。核对旧 HTML 的职位与日期、主题的实际样式和原稿保护。[分步验收记录](v0.8-development-plan.md)
3. 提交构建产物后，用同一提交生成 ZIP。在独立检出中重新执行构建和检查，比对三个安装文件的 SHA-256，并核对 ZIP 解压后只有这三个文件。提交相同时，以下命令生成的压缩包可逐字节比对。

```sh
mkdir -p dist
git archive --format=zip --output=dist/resume-atelier-0.8.0.zip HEAD main.js manifest.json styles.css
unzip -l dist/resume-atelier-0.8.0.zip
```

发布时可将三份安装文件附到 GitHub Release。版本号与 `manifest.json` 对齐，并在 `versions.json` 核对最低桌面版本。[中文 A4 双栏示例](../examples/sample-resume.zh.md) · [英文 Letter 时间轴示例](../examples/sample-resume.en.md)
