# Resume Atelier · 简历工坊

Create a résumé in Obsidian with a live page preview beside your Markdown. Adjust the page as you write, then export through Obsidian’s native PDF dialog.

[Download the latest release](https://github.com/chick26/resume-atelier/releases/latest) · [Manual installation](#manual-installation) · [简体中文](#简体中文)

![Resume Atelier showing an A4 résumé preview beside its Markdown editor, with the experience date editor open](docs/images/workbench.png)

## What you can do

- **Jump between the draft and the page.** Click the preview to find the corresponding Markdown, or move the cursor in the editor to follow your place on the page.
- **Reuse a Markdown draft.** Put Skills in a sidebar, display a list as tags, or hide an entire section for one application. Classic, sidebar and timeline themes use the same text.
- **Fine-tune the page.** Choose A4 or US Letter, drag the margins, adjust the accent and spacing, or import a scoped CSS theme.

## Manual installation

Requires Obsidian desktop 1.5.0 or later. The plugin interface follows Obsidian and is available in English and Simplified Chinese.

1. Download `main.js`, `manifest.json`, and `styles.css` from the release’s **Assets** section. To install a locally built candidate, use the same three files from its ZIP. [Latest published release](https://github.com/chick26/resume-atelier/releases/latest)
2. In your vault, create the folder `.obsidian/plugins/careeros-resume-layout/` if it’s missing, then copy the three files directly into it. The `.obsidian` folder may be hidden in your file manager.
3. Enable **Resume Atelier** in **Settings → Community plugins**.

To upgrade from 0.7.0, close Obsidian, replace those three files in the same folder and reopen your vault. Keep `data.json` and `templates/` to retain your settings, recent note and custom CSS.

## Open your first résumé

Run **Resume Atelier → Open workbench** from the command palette and choose a Markdown note. In an empty vault, choose **Create sample resume** to try the layout with example content.

1. For a master or confirmed application résumé, choose **Copy and edit** to create a draft. On a regular note, try the layout and then choose **Apply layout to this note** to save it.
2. Use `# Name`, an optional contact blockquote, and `##` for each section. Write `### Senior Designer · Example Studio | 2022 – Present` for an experience entry. The toolbar writes the same Markdown and can edit older HTML entries. In **Edit text**, click a line on the page to select its source.
3. Choose **Modern sidebar**, open **Sections** and move Skills to the sidebar. A flat bullet list can become tags. Hide a section for this application or show it again. The Markdown and the native Reading View keep the full text. Switching to **Experience timeline** places dates beside their entries.
4. Use **Choose vault photo** to insert a local image as `![avatar](photo.jpg)`. **Quick styles and photo** controls its crop and position, the accent, and section and list spacing. **Restore theme styling** restores the theme’s values for these controls.
5. Select **A4** or **US Letter** under **Paper size**. The continuous preview shows page numbers, with a solid guide at a manual break (`---` on its own between blank lines) and a dashed guide at an estimated automatic break. **Export PDF** opens Obsidian’s native dialog. For a matching export from the note menu, use the same paper size, portrait, 100% scale, no filename title and no added PDF margins. Check the finished PDF for final pagination.

Save an example in your vault to try the layouts. [English · Letter timeline](examples/sample-resume.en.md) · [中文 · A4 双栏](examples/sample-resume.zh.md)

## 简体中文

简历工坊把 Markdown 编辑器和纸面预览放在同一个工作台。你可以复用同一份经历，在职位副本里选用双栏或时间轴、隐藏栏目，再用 Obsidian 原生功能导出 PDF。

### 手动安装

支持 Obsidian 桌面版 1.5.0 或更新版本。界面语言自动跟随 Obsidian。

1. 在 Release 的 **Assets** 区下载 `main.js`、`manifest.json` 和 `styles.css`。本地候选安装包解压后也是这三个文件。[已发布版本](https://github.com/chick26/resume-atelier/releases/latest)
2. 在 Obsidian 库内创建 `.obsidian/plugins/careeros-resume-layout/`，把三个文件直接放进去。`.obsidian` 可能是隐藏目录。
3. 在「设置 → 第三方插件」启用 **Resume Atelier**。

从 0.7.0 升级时，关闭 Obsidian，在原目录替换这三个文件，再重新打开库。保留 `data.json` 和 `templates/`，其中有设置、最近使用的笔记和自定义主题。

### 开始排版

从命令面板运行「Resume Atelier → 打开工作台」。空库可点击「新建示例简历」。

1. 在母版或已确认的投递稿上选「创建副本并编辑」。普通笔记可以先试排，满意后选「将版式写入此笔记」。
2. 用 `# 姓名` 开头，可接一段引用写联系方式。用 `##` 划分栏目，用 `### 高级产品设计师 · 示例工作室 | 2022 – 至今` 写经历。工具栏使用同一写法，也能编辑旧 HTML 经历块。在「编辑正文」中点击纸面可选中对应源码。
3. 选「双栏现代」，在「栏目」里把技能放进侧栏，将普通项目列表显示为标签，或隐藏本次投递用不到的栏目。源稿和 Obsidian 阅读视图始终可查全文。切到「经历时间轴」即可把日期排在各段经历旁边。
4. 在编辑工具栏用「选择库内头像」插入 `![avatar](photo.jpg)`。「快捷样式与头像」可调头像比例、圆角、位置、强调色、栏目前间距及列表间距。「恢复主题样式」可还原这些选项。
5. 在「纸张」选 A4 或 US Letter。连续纸面上的页码方便定位，实线对应手动分页（前后留空行的 `---`），虚线对应预计的自动分页。「导出 PDF」会打开 Obsidian 原生窗口。如果从笔记菜单导出，请选相同纸张、纵向、100% 缩放，关闭文件名标题，并将附加页边距选为「无」。最终页界以导出的 PDF 为准。

把示例保存到自己的库后即可试排。[中文 · A4 双栏](examples/sample-resume.zh.md) · [English · Letter 时间轴](examples/sample-resume.en.md)

## Development

The maintainer guide covers the source tree and build. The v0.8 plan records the acceptance criteria and verified results for each step. [维护与交接指南](docs/maintenance.md) · [v0.8 开发与验收计划](docs/v0.8-development-plan.md)

## License

Resume Atelier is available under the MIT license. The Classic Serif theme and bundled icons are adapted from LapisCV v2.0.1 by YiNN and BingyanStudio. [MIT License](LICENSE) · [LapisCV](https://github.com/BingyanStudio/LapisCV/releases/tag/v2.0.1)
