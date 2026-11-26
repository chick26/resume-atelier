const { Component, MarkdownRenderer } = require("obsidian");
const { paperSize, PX_PER_MM, ZOOM_OPTIONS, applyMargins, applyTypography } = require("../layout/geometry");
const { measurePageStarts, pageBreakCounts } = require("../layout/pagination");
const { sourceParts, sourceText } = require("../resume/markdown");
const { splitSectionBody } = require("../resume/structure");
const { SectionLayout } = require("../resume/section-layout");
const { decorateResumeMarkup, locatePreviewBlocks } = require("../resume/rendered-markup");
const { applyTemplate } = require("../themes/scoped-css");

class PreviewPane {
  constructor(view) {
    this.view = view;
    this.app = view.app;
    this.t = view.t;
    this.rendered = null;
    this.renderer = null;
    this.renderVersion = 0;
  }

  mountToolbar(center) {
    this.zoomSelect = center.createEl("select", { cls: "dropdown resume-layout-zoom", attr: { "aria-label": this.t("previewZoom") } });
    for (const [value, label] of Object.entries(ZOOM_OPTIONS)) {
      this.zoomSelect.createEl("option", { value, text: this.t(label) });
    }
    const zoom = this.app.loadLocalStorage("careeros-resume-zoom");
    this.zoomSelect.value = Object.hasOwn(ZOOM_OPTIONS, zoom) ? zoom : "page";
    this.zoomSelect.addEventListener("change", () => {
      this.app.saveLocalStorage("careeros-resume-zoom", this.zoomSelect.value);
      this.measure();
    });
    const status = this.pageStatus = center.createDiv({ cls: "resume-layout-page-status" });
    this.measurement = status.createSpan({ attr: { role: "status", "aria-live": "polite" } });
    this.fill = status.createSpan({ cls: "resume-layout-page-progress", attr: { "aria-hidden": "true" } });
  }

  mount(parent) {
    this.stage = parent.createDiv({ cls: "resume-layout-stage", attr: { "aria-label": this.t("previewLabel") } });
    this.stage.addEventListener("click", event => {
      if (this.sectionLayout?.portrait?.contains(event.target)) {
        event.preventDefault();
        if (this.view.editor.edit) this.view.editor.toolbar.openPhoto();
        else {
          this.view.toggleInspector(false);
          this.view.setPanel("layout");
          this.view.layout.fineTune.open = true;
          this.view.layout.appearance.focusPhoto();
        }
        return;
      }
      if (this.view.editor.edit) void this.view.editor.focusSourceFromPreview(event);
    });
    this.stage.addEventListener("dblclick", event => {
      if (!this.view.editor.edit && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        void this.view.editor.focusSourceFromPreview(event, true);
      }
    });
    this.staleBanner = this.stage.createDiv({ cls: "resume-layout-stale", text: this.t("contentStale") });
    this.staleBanner.hidden = true;
    this.view.createEmptyState(this.stage);
    this.paper = this.stage.createDiv({ cls: "resume-layout-paper" });
    this.guide = this.paper.createDiv({ cls: "resume-layout-guide", attr: { "aria-hidden": "true" } });
    for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
      this.guide.createSpan({ cls: `resume-layout-crop is-${corner}` });
    }
    this.guides = this.paper.createDiv({ cls: "resume-layout-page-guides", attr: { "aria-hidden": "true" } });
  }

  observe() {
    this.observer = new this.stage.ownerDocument.defaultView.ResizeObserver(() => this.measure());
    this.observer.observe(this.stage);
  }

  beginRender() {
    return ++this.renderVersion;
  }

  dispose() {
    this.beginRender();
    this.observer?.disconnect();
    this.clearPreview();
  }

  clearPreview() {
    this.guides?.replaceChildren();
    if (this.rendered) {
      this.observer?.unobserve(this.rendered);
      this.rendered.remove();
      this.rendered = null;
    }
    if (this.renderer) {
      this.view.removeChild(this.renderer);
      this.renderer = null;
    }
    this.renderedFile = null;
    this.renderedBody = null;
    this.sourceHeadings = [];
    this.sectionLayout = null;
    this.view.editor.clearPreviewSelection();
  }

  async render({ resume, markdown, body, version, sameFile }) {
    const { file } = resume;
    const next = this.paper.createDiv({
      cls: "resume-layout-rendered resume-layout-surface resume-layout-styled markdown-rendered resume-layout-buffer",
    });
    next.classList.add(...resume.classes);
    const renderer = this.view.addChild(new Component());
    let swapped = false;
    try {
      this.stylePreview(next);
      // The file's YAML is already separated. A second leading delimiter belongs to the body.
      await MarkdownRenderer.render(this.app, sourceParts(body).hasYaml ? `\n${body}` : body, next, file.path, renderer);
      if (version !== this.renderVersion) return;
      const bindings = locatePreviewBlocks(next, sourceText(body));
      const headingByLine = new Map(bindings.filter(({ element }) => element.matches("h2")).map(({ line, element }) => [line, element]));
      const sections = splitSectionBody(body).sections;
      const headings = sections.map(({ startLine }) => headingByLine.get(startLine));
      const titles = new Map(sections.flatMap(({ title }, index) => headings[index] ? [[headings[index], title]] : []));
      const flow = new SectionLayout(next, [...next.children].filter(node => !node.matches("style")), titles);
      decorateResumeMarkup(next);
      flow.apply(this.view.layout.current);
      this.stylePreview(next);

      const scrollTop = sameFile ? this.stage.scrollTop : 0;
      this.clearPreview();
      next.removeClass("resume-layout-buffer");
      this.rendered = next;
      this.sourceHeadings = headings;
      this.sectionLayout = flow;
      this.view.editor.previewBlocks = bindings;
      this.renderedFile = file;
      this.renderer = renderer;
      this.view.sourceMarkdown = markdown;
      this.renderedBody = sourceText(body);
      this.view.layout.updateContextControls();
      this.view.sections.render();
      this.observer.observe(next);
      this.stage.scrollTop = scrollTop;
      swapped = true;
      this.view.updateExportButton();
      this.measure();
      this.view.editor.queueCursorFollow();
    } catch (error) {
      if (version === this.renderVersion) {
        this.setPageMeasurement(this.t("previewUnavailable"));
        console.error("CareerOS resume preview failed", error);
      }
    } finally {
      if (!swapped) {
        next.remove();
        this.view.removeChild(renderer);
      }
    }
  }

  updateLayout(layout) {
    applyMargins(this.paper, layout);
    if (this.rendered) this.stylePreview(this.rendered);
    if (this.renderedFile === this.view.selected?.file) this.sectionLayout?.apply(layout);
  }

  stylePreview(root) {
    const layout = this.view.layout.current;
    applyTypography(root, layout);
    const theme = this.view.plugin.themes.templates.get(layout.template);
    applyTemplate(root, this.view.themeEditor.draft?.text ?? theme?.css);
  }

  setPageMeasurement(label, detail = "") {
    if (this.measurement.textContent !== label) this.measurement.setText(label);
    if (this.pageStatus.title === detail) return;
    this.pageStatus.title = detail;
    if (detail) this.measurement.setAttribute("aria-label", detail);
    else this.measurement.removeAttribute("aria-label");
  }

  measure() {
    if (!this.view.selected || !this.paper || !this.stage.clientWidth) return;
    const margins = this.stage.ownerDocument.defaultView.getComputedStyle(this.stage);
    const width = this.stage.clientWidth - parseFloat(margins.paddingLeft) - parseFloat(margins.paddingRight);
    const height = this.stage.clientHeight - parseFloat(margins.paddingTop) - parseFloat(margins.paddingBottom);
    const paper = paperSize(this.view.layout.current);
    const fitWidth = Math.max(0.12, width / (paper.width * PX_PER_MM));
    const fitHeight = Math.max(0.12, height / (paper.height * PX_PER_MM));
    const zoom = this.zoomSelect.value === "actual" ? 1
      : Math.min(1, fitWidth, this.zoomSelect.value === "page" ? fitHeight : Infinity);
    const scale = zoom.toFixed(4);
    if (this.paper.style.zoom !== scale) this.paper.style.zoom = scale;
    if (!this.rendered || this.renderedFile !== this.view.selected.file) return;

    const { used, printable, overflow } = this.pageMetrics();
    const breaks = this.visiblePageBreaks();
    const starts = overflow || breaks ? measurePageStarts(this.rendered, this.view.layout.current, Number(scale)) : [{ offset: 0, manual: false }];
    const pages = starts.length;
    this.showPageGuides(starts, Number(scale));
    const usage = Math.min(100, Math.round(100 * used / printable));
    const { manual, automatic } = pageBreakCounts(starts);
    let label = this.t("onePage", { usage });
    if (automatic && manual) label = this.t("mixedPages", { pages });
    else if (automatic) label = this.t("overflowPages", { pages, excess: Math.max(0, Math.ceil(used - printable)) });
    else if (manual) label = this.t("estimatedPages", { pages });
    const detail = pages > 1 ? this.t("pageGuideDetail", { pages, manual, automatic })
      : this.t("onePageDetail", { usage, remaining: Math.max(0, Math.floor(printable - used)) });
    this.pageStatus.toggleClass("is-overflowing", automatic > 0);
    this.fill.style.setProperty("--page-usage", `${Math.min(100, used / printable * 100)}%`);
    this.setPageMeasurement(label, detail);
    this.view.layout.syncFitButton(automatic > 0, manual);
  }

  showPageGuides(starts, zoom) {
    if (starts.length < 2) {
      this.guides.replaceChildren();
      return;
    }
    const inset = (this.rendered.getBoundingClientRect().top - this.paper.getBoundingClientRect().top) / zoom;
    starts.forEach((start, index) => {
      const guide = this.guides.children[index] ?? this.guides.createDiv({ cls: "resume-layout-page-guide" });
      guide.style.top = index ? `${Math.max(0, inset + start.offset - 2)}px` : "0";
      guide.dataset.break = index ? (start.manual ? "manual" : "automatic") : "first";
      guide.title = this.t(index ? (start.manual ? "manualGuide" : "automaticGuide") : "previewLabel");
      const page = `${index + 1}/${starts.length}`;
      guide.dataset.page = index ? this.t(start.manual ? "manualPageTag" : "autoPageTag", { page }) : page;
    });
    while (this.guides.childElementCount > starts.length) this.guides.lastElementChild.remove();
  }

  pageMetrics() {
    const scale = Number(this.paper.style.zoom) || 1;
    const used = this.rendered.getBoundingClientRect().height / scale / PX_PER_MM;
    const layout = this.view.layout.current;
    const printable = paperSize(layout).height - layout.top - layout.bottom;
    return { used, printable, overflow: used - printable > 0.2 };
  }

  visiblePageBreaks() {
    return [...this.rendered.querySelectorAll("hr")].filter(rule => rule.getClientRects().length > 0).length;
  }
}

module.exports = { PreviewPane };
