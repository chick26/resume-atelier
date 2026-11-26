# Resume Atelier · 简历工坊

Create a polished résumé in Obsidian with a live A4 preview beside your Markdown. Adjust the page as you write, then export through Obsidian’s native PDF dialog.

[Download the latest release](https://github.com/chick26/resume-atelier/releases/latest) · [Manual installation](#manual-installation) · [简体中文](#简体中文)

![Resume Atelier showing an A4 résumé preview beside its Markdown editor, with the experience date editor open](docs/images/workbench.png)

## What you can do

- **Jump between the draft and the page.** Click the preview to find the corresponding Markdown, or move the cursor in the editor to follow your place on the page.
- **Format experience entries.** Add a title, optional subtitle, and right-aligned date from the editor toolbar.
- **Fine-tune the layout.** Switch themes, import CSS, or drag the margins. Use **Fit to one page** to tighten a layout that overflows.

## Manual installation

Requires Obsidian desktop 1.5.0 or later. The plugin interface follows Obsidian and is available in English and Simplified Chinese.

1. Download `main.js`, `manifest.json`, and `styles.css` from the release’s **Assets** section. [Latest release](https://github.com/chick26/resume-atelier/releases/latest)
2. In your vault, create the folder `.obsidian/plugins/careeros-resume-layout/` if it’s missing, then copy the three files directly into it. The `.obsidian` folder may be hidden in your file manager.
3. Enable **Resume Atelier** in **Settings → Community plugins**.

## Open your first résumé

Run **Resume Atelier → Open workbench** from the command palette and choose a Markdown note. In an empty vault, choose **Create sample resume** to try the layout with example content.

Use **Edit text** to work beside the preview. For a regular note opened in preview, choose **Apply layout to this note** when you’re ready to save its layout. Use **Export PDF** when you’re ready to share the résumé.

## 简体中文

简历工坊把 Markdown 编辑器和 A4 预览放在同一个工作台。光标会带着预览跟随，点击纸面也能定位到正文。你可以快速插入带右对齐日期的经历条目，拖动页边距，或把版式收紧至一页后导出 PDF。

### 手动安装

支持 Obsidian 桌面版 1.5.0 或更新版本。界面语言自动跟随 Obsidian。

1. 在 Release 页面的 **Assets** 区下载 `main.js`、`manifest.json` 和 `styles.css`。 [下载最新版](https://github.com/chick26/resume-atelier/releases/latest)
2. 在 Obsidian 库内创建 `.obsidian/plugins/careeros-resume-layout/`，把三个文件直接放进去。`.obsidian` 可能是隐藏目录。
3. 在「设置 → 第三方插件」启用 **Resume Atelier**。

### 开始排版

从命令面板运行「Resume Atelier → 打开工作台」，选择一份 Markdown 笔记。空库可点击「新建示例简历」。普通笔记可以先试排，满意后点击「将版式写入此笔记」。完成后用「导出 PDF」打开 Obsidian 原生导出窗口。

## License

Resume Atelier is available under the MIT license. The Classic Serif theme and bundled icons are adapted from LapisCV v2.0.1 by YiNN and BingyanStudio. [MIT License](LICENSE) · [LapisCV](https://github.com/BingyanStudio/LapisCV/releases/tag/v2.0.1)
