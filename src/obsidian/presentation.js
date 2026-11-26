const { MarkdownView } = require("obsidian");
const { MARGINS, applyMargins, applyTypography } = require("../layout/geometry");
const { applyTemplate } = require("../themes/scoped-css");
const { editableBody } = require("../resume/markdown");
const { decorateResumeMarkup } = require("../resume/rendered-markup");
const { SectionLayout } = require("../resume/section-layout");

class ResumePresentation {
  constructor(app, catalog, layouts, themes, t) {
    this.app = app;
    this.catalog = catalog;
    this.layouts = layouts;
    this.themes = themes;
    this.t = t;
    this.readingClasses = new WeakMap();
  }

  postProcess(element, { sourcePath }) {
    const root = element.closest(".print > .markdown-preview-view");
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (root) {
      this.styleNativePrint(root, file);
      if (root.dataset.careerosPrint) decorateResumeMarkup(element, root.classList.contains("lapis-cv-zh"));
    } else {
      const resume = this.catalog.resume(file);
      if (resume) decorateResumeMarkup(element, resume.classes.includes("lapis-cv-zh"));
    }
  }

  dispose() {
    if (this.readingRefresh !== undefined) window.cancelAnimationFrame(this.readingRefresh);
    this.forEachReadingView((root, file) => {
      if (this.readingClasses.has(root)) this.clearReadingStyle(root, this.catalog.resume(file, true)?.declaredClasses);
    });
  }

  async openNativeExport(file, studioLeaf, layout) {
    const { vault, workspace } = this.app;
    if (vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t("exportNoteMissing"));
    if (typeof vault.getConfig !== "function" || typeof vault.setConfig !== "function") {
      throw new Error(this.t("nativeExportUnavailable"));
    }
    let leaf = workspace.getLeavesOfType("markdown").find(item => item.getViewState().state?.file === file.path);
    const temporary = !leaf;
    try {
      if (!leaf) {
        leaf = workspace.getLeaf("tab");
        await leaf.openFile(file, { active: false, state: { mode: "preview" } });
      }
      await leaf.loadIfDeferred?.();
      // The desktop native exporter captures the file and settings when it opens.
      const noteView = leaf.view;
      if (studioLeaf.view.file !== file || !(noteView instanceof MarkdownView) || noteView.file !== file) {
        throw new Error(this.t("exportNoteOpenFailed"));
      }
      if (typeof noteView.printToPdf !== "function") throw new Error(this.t("nativeExportUnavailable"));
      const previous = vault.getConfig("pdfExportSettings");
      try {
        vault.setConfig("pdfExportSettings", {
          ...previous, includeName: false, pageSize: "A4", landscape: false, margin: "1", downscalePercent: 100,
        });
        this.printRequest = { file, studioLeaf, layout };
        noteView.printToPdf();
      } catch (error) {
        this.printRequest = null;
        throw error;
      } finally {
        vault.setConfig("pdfExportSettings", previous);
      }
    } finally {
      if (temporary) {
        leaf?.detach();
        // Closing the temporary note can activate its neighboring tab.
        if (studioLeaf.view.file === file && workspace.activeLeaf !== studioLeaf) {
          workspace.setActiveLeaf(studioLeaf, { focus: false });
        }
      }
    }
  }

  scheduleReadingStyles() {
    if (this.readingRefresh !== undefined) return;
    this.readingRefresh = window.requestAnimationFrame(() => {
      this.readingRefresh = undefined;
      this.forEachReadingView((root, file, view) => void this.styleReadingNote(root, file, view));
    });
  }

  forEachReadingView(callback) {
    for (const { view } of this.app.workspace.getLeavesOfType("markdown")) {
      if (!(view instanceof MarkdownView)) continue;
      const preview = view.previewMode?.containerEl;
      const root = preview?.matches(".markdown-preview-view") ? preview : view.contentEl.querySelector(".markdown-reading-view > .markdown-preview-view");
      if (root) callback(root, view.file, view);
    }
  }

  async styleReadingNote(root, file, view) {
    let resume = this.catalog.resume(file);
    if (!resume) {
      if (this.readingClasses.has(root)) this.clearReadingStyle(root, this.catalog.resume(file, true)?.declaredClasses);
      return;
    }
    if (!resume.explicitLanguage) {
      try {
        const contents = await this.app.vault.cachedRead(file);
        if (view.file !== file) return;
        resume = this.catalog.resume(file);
        if (!resume) return;
        resume = this.catalog.resumeForContent(resume, editableBody(contents));
      } catch (error) {
        console.error("Could not read resume language", error);
      }
    }
    const added = [...resume.classes.filter(cssClass => !resume.declaredClasses.includes(cssClass)),
      "resume-layout-reading", "resume-layout-styled"];
    for (const cssClass of this.readingClasses.get(root) ?? []) {
      if (!resume.declaredClasses.includes(cssClass) && !added.includes(cssClass)) root.classList.remove(cssClass);
    }
    root.classList.add(...added);
    this.readingClasses.set(root, added);
    const layout = this.layouts.noteLayout(resume);
    applyMargins(root, layout);
    applyTypography(root, layout);
    applyTemplate(root, this.themes.templates.get(layout.template)?.css);
    decorateResumeMarkup(root, resume.classes.includes("lapis-cv-zh"));
  }

  clearReadingStyle(root, declaredClasses = []) {
    for (const cssClass of this.readingClasses.get(root) ?? []) {
      if (!declaredClasses.includes(cssClass)) root.classList.remove(cssClass);
    }
    this.readingClasses.delete(root);
    delete root.dataset.resumeDensity;
    for (const { key } of MARGINS) root.style.removeProperty(`--resume-margin-${key}`);
    root.style.removeProperty("--text-size");
    root.style.removeProperty("--line-height");
    applyTemplate(root, null);
  }

  styleNativePrint(root, file) {
    if (root.dataset.careerosPrint) return;
    const request = this.printRequest;
    const fromStudio = request && request.file === file && request.studioLeaf === this.app.workspace.activeLeaf;
    const resume = this.catalog.resume(file, fromStudio);
    if (!resume) return;
    const layout = fromStudio ? request.layout : this.layouts.noteLayout(resume);
    if (fromStudio) this.printRequest = null;

    // The print root is removed by Obsidian when this export finishes.
    root.dataset.careerosPrint = "true";
    root.classList.add("resume-layout-surface", "resume-layout-styled", ...resume.classes);
    applyTypography(root, layout);
    applyTemplate(root, this.themes.templates.get(layout.template)?.css);
    decorateResumeMarkup(root, resume.classes.includes("lapis-cv-zh"));
    const content = root.querySelector(":scope > .markdown-preview-sizer") ?? root;
    const blocks = [...content.children].filter(node => !node.matches("style, .mod-ui, .mod-frontmatter, .mod-header, .mod-footer"));
    new SectionLayout(content, blocks).apply(layout);
    const { top, right, bottom, left } = layout;
    const style = root.ownerDocument.createElement("style");
    style.textContent = `@media print { @page { size: A4 portrait; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; } }`;
    root.append(style);
  }
}

module.exports = { ResumePresentation };
