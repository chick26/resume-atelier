# Resume Atelier · 简历工坊

Create a résumé in Obsidian with a live page preview beside your Markdown. Adjust the page as you write, then export through Obsidian’s native PDF dialog.

[Download plugin](https://github.com/chick26/resume-atelier/releases/latest) · [Manual installation](#manual-installation) · [简体中文](#简体中文)

![A single-column A4 résumé beside its Markdown source in Resume Atelier](docs/images/workbench.png)

## What you can do

- **Jump between the draft and the page.** Double-click a line on the preview to edit its Markdown. While editing, click the page or move the text cursor to follow the same passage.
- **Reuse a Markdown draft.** Display a list as tags or hide an entire section for one application. Single-column and timeline themes use the same Markdown in source order.
- **Fine-tune the page.** Choose A4 or US Letter, drag the margins, choose an accent color and spacing preset, or import a scoped CSS theme.

## Manual installation

Requires Obsidian desktop 1.7.2 or later. The interface is available in English and Simplified Chinese.

1. Download and unpack `resume-atelier-*.zip` from the **Assets** section on GitHub. [Download plugin](https://github.com/chick26/resume-atelier/releases/latest)
2. Create `.obsidian/plugins/resume-atelier/` inside your vault. Place `main.js`, `manifest.json`, and `styles.css` directly in that folder. The `.obsidian` folder may be hidden in your file manager.
3. Enable **Resume Atelier** in **Settings → Community plugins**.

## Open your first résumé

Right-click a folder and choose **New resume**. Open the workbench again from the left ribbon or run **Resume Atelier → Open workbench** in the command palette.

To start with a sample, save it in your vault, then right-click the note and choose **Lay out this resume**. [English · Letter timeline](examples/sample-resume.en.md) · [中文 · A4 单栏](examples/sample-resume.zh.md)

1. Double-click text on the page to edit the corresponding line. Start with `# Name`, use `##` for sections and write entries as `### Senior Designer · Example Studio | 2022 – Present`. For a master or confirmed application résumé, choose **Copy and edit**. A regular note stays in preview until you choose **Use resume layout**.
2. Under **Layout → Theme**, choose **Modern Sans** to put dates below the title on the left, **Right-aligned dates** to align dates to the right, or **Light timeline** for dates above the title. Use **Sections** to reorder sections, display a list as tags or hide a section. The hidden count remains visible when the panel is closed.
3. To add a vault image, choose **Customize → Add photo** or use **Photo** beside the editor. After picking the image, keep typing. Click the portrait or **Photo** to change its ratio and corners. Press **Esc** to return to your text.
4. Choose **A4** or **US Letter** and inspect the page labels. A standalone `---` with blank lines adds a manual break. **Export PDF** opens Obsidian’s native dialog. From the original note’s menu, select the same paper, portrait, 100% scale, no filename title and no extra margins.

The Markdown toolbar shows the photo button and save status. Use `⌘B` or `Ctrl+B` for bold, `Enter` to continue a list, and `Tab` or `Shift+Tab` to change indentation.

## 简体中文

简历工坊把 Markdown 编辑器和纸面预览放在同一个工作台。你可以复用同一份经历，在职位副本里换主题、调整栏目顺序或隐藏栏目，再用 Obsidian 原生功能导出 PDF。

### 手动安装

需要 Obsidian 桌面版 1.7.2 或更新版本。界面提供简体中文和英文。

1. 在 GitHub 的 **Assets** 区下载 `resume-atelier-*.zip` 并解压。[下载插件](https://github.com/chick26/resume-atelier/releases/latest)
2. 在 Obsidian 库内创建 `.obsidian/plugins/resume-atelier/`，把 `main.js`、`manifest.json` 和 `styles.css` 直接放进去。`.obsidian` 可能是隐藏目录。
3. 在「设置 → 第三方插件」启用 **Resume Atelier**。

### 开始排版

在文件树右键目标文件夹，选「新建简历」。再次打开工作台时，点左侧功能区的「打开简历工坊」，或在命令面板运行「Resume Atelier → 打开工作台」。

想用示例试排，可以先把示例保存到库里，再右键笔记选「排版这份简历」。[中文 · A4 单栏](examples/sample-resume.zh.md) · [English · Letter 时间轴](examples/sample-resume.en.md)

1. 双击纸面文字即可编辑对应源码行。用 `# 姓名` 写姓名，`##` 分栏目，`### 高级产品设计师 · 示例工作室 | 2022 – 至今` 写经历。母版或已确认的投递稿先选「创建副本并编辑」。普通笔记可先试排，选「应用简历排版」后才写入。
2. 在「版式 → 视觉主题」中选样式。「现代无衬线」的日期在标题下方左对齐，「日期靠右」把日期放在右侧，「轻量时间轴」把日期放在标题上方。在「栏目」可调整顺序、把列表显示为标签，或隐藏本次投递用不到的栏目。收起面板后顶栏仍会提醒已隐藏几栏。
3. 在「微调 → 添加头像」或正文工具栏的「头像」选库内图片，选完即可接着打字。点纸面照片或工具栏「头像」就能调比例、圆角。按 `Esc` 回到正文。
4. 选 A4 或 US Letter 后查看纸面页标。前后各留空行的 `---` 表示手动分页。「导出 PDF」打开 Obsidian 原生窗口。从原笔记菜单导出时，选相同纸张、纵向、100% 缩放，关闭文件名标题，附加页边距选「无」。

正文编辑栏显示「头像」和保存状态。用 `⌘B` 或 `Ctrl+B` 加粗，`Enter` 续写列表，`Tab` 和 `Shift+Tab` 调整缩进。

## Development

For source and build instructions, see the maintainer guide. [Maintainer guide](docs/maintenance.md)

## License

Resume Atelier is available under the MIT license. The Classic Serif theme and bundled icons are adapted from LapisCV v2.0.1 by YiNN and BingyanStudio. [MIT License](LICENSE) · [LapisCV](https://github.com/BingyanStudio/LapisCV/releases/tag/v2.0.1)
