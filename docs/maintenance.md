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
| A4 尺寸、边距、密度和版式解析 | [src/layout/](../src/layout) |
| CSS 主题读取、保存和作用域 | [src/themes/](../src/themes) |
| 设置页、最近文件和本机版式保存 | [src/settings/](../src/settings) |
| Obsidian 阅读视图和原生 PDF 导出 | [src/obsidian/presentation.js](../src/obsidian/presentation.js) |
| 界面文案、纸张样式和示例 | [本地化](../src/localization.js) · [样式](../src/styles) · [示例](../examples) |

工作台通过简历识别模块取得文件及只读状态，交给版式面板和预览区。正文写入由文件模块检查编辑冲突，并通过 Obsidian 的 Vault API 保存。设置、本机试排和最近文件路径由 SettingsStore 串行写入 `data.json`。

插件 ID 和工作台视图类型为 `careeros-resume-layout`，打开命令为 `careeros-resume-layout:open`。笔记属性使用 `resume_style`、`resume_density` 和 `resume_layout`。这些标识也用于已有安装和 CareerOS 集成。

## 验证和打包

1. 在测试库安装根目录的 `main.js`、`styles.css` 和 `manifest.json`。
2. 打开 [中文示例](../examples/sample-resume.zh.md) 或 [英文示例](../examples/sample-resume.en.md)。验证编辑正文、点击预览定位、栏目操作和版式保存。
3. 用工作台打开原生 PDF 导出，核对当前笔记和纸张设置。再执行单插件重载，核对工作台标签页和所选文件。
4. 发布时将上述三个安装文件附到 GitHub Release，标签与 `manifest.json` 中的版本一致。最低支持版本有变化时更新 `versions.json`。
