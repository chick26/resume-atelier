const { Notice } = require("obsidian");
const {
  PAPER_SIZES, paperSize, DENSITIES, MARGINS, MARGIN_PAIRS, TYPOGRAPHY, FIELDS, layoutFor, dimensions, geometryForSave, noteLayoutKey, sameLayout,
} = require("../layout/geometry");
const { iconButton } = require("./dom");

class LayoutPanel {
  constructor(view) {
    this.view = view;
    this.t = view.t;
    this.controls = new Map();
    this.draftLayouts = new WeakMap();
    this.layoutUndo = new WeakMap();
    this.fitUndo = new WeakMap();
    this.resetUndo = new WeakMap();
  }

  mountToolbar(center) {
    this.fitButton = center.createEl("button", { text: this.t("fitOnePage"), cls: "resume-layout-fit-button" });
    this.fitButton.hidden = true;
    this.fitButton.addEventListener("click", () => this.fitToPage());
  }

  mountMarginHandles() {
    this.marginHandles = new Map();
    for (const margin of MARGINS) this.addMarginHandle(margin);
  }

  mount(layout) {
    this.addTemplateControls(layout);
    const fineTune = layout.createEl("details", { cls: "resume-layout-fine-tune" });
    fineTune.createEl("summary", { text: this.t("fineTune") });
    const marginHeading = fineTune.createDiv({ cls: "resume-layout-section-heading" });
    marginHeading.createEl("h3", { text: this.t("margins") });
    const locks = fineTune.createDiv({ cls: "resume-layout-locks" });
    this.lockButtons = new Map();
    for (const [side, label] of [["top", this.t("linkVertical")], ["left", this.t("linkHorizontal")]]) {
      const lock = locks.createEl("button", { text: label });
      lock.addEventListener("click", () => this.toggleMarginLock(side));
      this.lockButtons.set(side, lock);
    }
    const margins = fineTune.createDiv({ cls: "resume-layout-fields" });
    for (const field of MARGINS) this.addControl(margins, field);

    const typeHeading = fineTune.createDiv({ cls: "resume-layout-section-heading" });
    typeHeading.createEl("h3", { text: this.t("typography") });
    const typography = fineTune.createDiv({ cls: "resume-layout-fields" });
    for (const field of TYPOGRAPHY) this.addControl(typography, field);

    const guide = fineTune.createEl("label", { cls: "resume-layout-toggle" });
    const guideToggle = guide.createEl("input", { type: "checkbox" });
    guideToggle.checked = true;
    guideToggle.addEventListener("change", () => this.view.preview.guide.toggleClass("is-guides-muted", !guideToggle.checked));
    guide.createSpan({ text: this.t("showMarginGuides") });
    this.resetButton = fineTune.createEl("button", { cls: "resume-layout-reset", text: this.t("resetFineTuning") });
    this.resetButton.addEventListener("click", () => this.resetLayout());
    this.layoutActions = layout.createDiv({ cls: "resume-layout-save" });
    this.applyTemplateButton = this.layoutActions.createEl("button", { text: this.t("applyLayout") });
    this.applyTemplateButton.addEventListener("click", () => void this.saveNoteLayout());
    this.layoutHint = this.layoutActions.createDiv({ cls: "resume-layout-hint", attr: { role: "status" } });
    this.undoLayoutButton = this.layoutActions.createEl("button", { text: this.t("undo"), attr: { "aria-label": this.t("undoLayout") } });
    this.undoLayoutButton.addEventListener("click", () => this.undoLayoutChange());
  }

  selectResume(resume, prior, sameFile) {
    if (!sameFile) this.fitButton.hidden = true;
    if (!resume) return;
    const { file } = resume;
    const canonical = this.view.plugin.layouts.noteLayout(resume);
    const key = noteLayoutKey(resume);
    const ownWrite = sameFile && this.layoutWrite?.file === file && this.layoutWrite.key === key;
    const changedMetadata = sameFile && noteLayoutKey(prior) !== key;
    if (!ownWrite && (!sameFile || changedMetadata || prior.protected !== resume.protected
      || !sameLayout(canonical, this.savedLayout))) {
      const draft = this.draftLayouts.get(file);
      const useDraft = !resume.protected && draft?.key === key;
      if (!useDraft) this.draftLayouts.delete(file);
      if (changedMetadata && !useDraft) this.layoutUndo.delete(file);
      this.savedLayout = canonical;
      this.current = useDraft ? { ...draft.layout } : this.view.plugin.layouts.previewLayout(resume);
      this.lastCommittedLayout = { ...this.current };
      this.layoutFeedback = resume.stored ? this.t("saved") : "";
      this.alignLocks();
    }
  }

  syncFitButton(overflow, breaks) {
    const undo = this.fitUndo.get(this.view.selected.file);
    const canUndo = undo && sameLayout(undo.after, this.current);
    this.fitButton.hidden = !!this.view.themeEditor.draft || (!canUndo && (!overflow || !!breaks));
    this.fitButton.setText(canUndo ? this.t("undoFit") : this.t("fitOnePage"));
  }

  addTemplateControls(panel) {
    const controls = panel.createDiv({ cls: "resume-layout-template-controls" });
    const themeRow = controls.createDiv({ cls: "resume-layout-theme-row" });
    const theme = themeRow.createEl("label", { text: this.t("theme") });
    this.templateSelect = theme.createEl("select", { cls: "dropdown" });
    iconButton(themeRow, "settings", this.t("manageSettings"), () => this.view.plugin.showSettings());
    this.templateSelect.addEventListener("change", () => {
      this.current.template = this.templateSelect.value;
      this.commit();
    });
    const paperLabel = controls.createEl("label", { text: this.t("paperSize") });
    this.paperSelect = paperLabel.createEl("select", { cls: "dropdown" });
    for (const value of Object.keys(PAPER_SIZES)) this.paperSelect.createEl("option", { value, text: value === "Letter" ? "US Letter" : value });
    this.paperSelect.addEventListener("change", () => {
      this.current.paper = this.paperSelect.value;
      this.commit();
    });
    controls.createSpan({ text: this.t("density") });
    const density = controls.createDiv({ cls: "resume-layout-density", attr: { role: "group", "aria-label": this.t("density") } });
    this.densityButtons = new Map();
    for (const value of Object.keys(DENSITIES)) {
      const button = density.createEl("button", { text: this.t(value) });
      button.addEventListener("click", () => this.setDensity(value));
      this.densityButtons.set(value, button);
    }
    this.templateHint = controls.createDiv({ cls: "resume-layout-hint", attr: { role: "status" } });
  }

  setDensity(value) {
    if (!this.view.selected || this.current.density === value) return;
    const { classes, file } = this.view.selected;
    if (this.current.lineHeight === layoutFor(classes, { density: this.current.density }).lineHeight) {
      this.current.lineHeight = layoutFor(classes, { density: value }).lineHeight;
    }
    this.current.density = value;
    this.resetUndo.delete(file);
    this.commit();
  }

  updateTemplateControls() {
    if (!this.view.selected) return;
    this.templateSelect.replaceChildren();
    for (const theme of this.view.plugin.themes.templates.values()) {
      this.templateSelect.createEl("option", { value: theme.id, text: this.view.plugin.themes.themeName(theme) });
    }
    this.templateSelect.value = this.current.template;
    const declared = this.view.selected.template;
    this.templateHint.setText(declared && !this.view.plugin.themes.templateId(declared) && declared !== "紧凑"
      ? this.t("missingTheme", { name: declared }) : "");
    this.update();
  }

  async saveNoteLayout(showNotice = true) {
    const resume = this.view.selected;
    if (!resume || resume.protected || this.applyingLayout) return false;
    const layout = { ...this.current };
    const properties = { template: layout.template, density: layout.density, geometry: geometryForSave(layout, resume.geometry), sections: layout.sections };
    this.layoutWrite = { file: resume.file, key: noteLayoutKey(properties) };
    this.applyingLayout = true;
    this.updateLayoutActions();
    try {
      await this.view.plugin.files.writeNoteLayout(resume.file, noteLayoutKey(resume), layout);
      if (this.view.selected?.file === resume.file) {
        this.view.selected = { ...this.view.selected, ...properties, stored: true, recognized: true };
        this.savedLayout = layout;
        this.layoutFeedback = this.t("saved");
        this.rememberDraft();
        this.updateLayoutActions();
      }
      if (showNotice) new Notice(this.t("layoutSaved"));
      return true;
    } catch (error) {
      this.layoutFeedback = error.message || this.t("layoutSaveFailed");
      if (showNotice) new Notice(this.layoutFeedback);
      return false;
    } finally {
      this.layoutWrite = null;
      this.applyingLayout = false;
      this.updateLayoutActions();
    }
  }

  marginSide(key) {
    return key === "top" || key === "bottom" ? "top" : "left";
  }

  alignLocks() {
    this.marginLocks = { top: this.current.top === this.current.bottom, left: this.current.left === this.current.right };
    this.lockOrigins = {};
  }

  toggleMarginLock(side) {
    this.marginLocks[side] = !this.marginLocks[side];
    const other = MARGIN_PAIRS[side];
    if (this.marginLocks[side] && this.current[side] !== this.current[other]) {
      const field = MARGINS.find(({ key }) => key === side);
      const original = [this.current[side], this.current[other]];
      this.setMargin(field, (this.current[side] + this.current[other]) / 2);
      this.lockOrigins[side] = original;
      this.commit();
    } else if (!this.marginLocks[side] && this.lockOrigins[side]) {
      [this.current[side], this.current[other]] = this.lockOrigins[side];
      delete this.lockOrigins[side];
      this.commit();
      new Notice(this.t("marginLinkUndone"));
    } else {
      this.update();
    }
  }

  setMargin({ key, min, max, step }, raw) {
    const value = Math.min(max, Math.max(min, Math.round(raw / step) * step));
    if (this.current[key] !== value) delete this.lockOrigins[this.marginSide(key)];
    this.current[key] = value;
    if (this.marginLocks[this.marginSide(key)]) this.current[MARGIN_PAIRS[key]] = value;
  }

  addMarginHandle(field) {
    const { key } = field;
    const handle = this.view.preview.guide.createSpan({
      cls: `resume-layout-margin-handle is-${key}`,
      attr: { title: this.t("dragMargin", { side: this.t(key) }) },
    });
    this.marginHandles.set(key, handle);
    const vertical = key === "top" || key === "bottom";
    const direction = key === "left" || key === "top" ? 1 : -1;
    const coordinate = event => vertical ? event.clientY : event.clientX;
    let drag;
    handle.addEventListener("pointerdown", event => {
      if (!this.view.selected || event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      drag = { coordinate: coordinate(event), layout: { ...this.current }, file: this.view.selected.file };
      handle.addClass("is-dragging");
    });
    handle.addEventListener("pointermove", event => {
      const box = handle.getBoundingClientRect();
      const fraction = vertical ? (event.clientX - box.left) / box.width : (event.clientY - box.top) / box.height;
      handle.style.setProperty("--guide-position", `${100 * Math.max(0.08, Math.min(0.92, fraction))}%`);
      if (!drag || drag.file !== this.view.selected?.file) return;
      const pixelsPerMm = this.view.preview.paper.getBoundingClientRect().width / paperSize(drag.layout).width;
      if (!pixelsPerMm) return;
      const value = drag.layout[key] + direction * (coordinate(event) - drag.coordinate) / pixelsPerMm;
      this.resetUndo.delete(drag.file);
      this.setMargin(field, value);
      this.update();
    });
    const end = (event, save) => {
      handle.removeClass("is-dragging");
      if (drag && drag.file === this.view.selected?.file) {
        if (save) this.commit();
        else {
          this.current = drag.layout;
          this.update();
        }
      }
      drag = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    handle.addEventListener("pointerup", event => end(event, true));
    handle.addEventListener("pointercancel", event => end(event, false));
  }

  addControl(container, field) {
    const row = container.createDiv({ cls: "resume-layout-field" });
    const caption = row.createDiv({ cls: "resume-layout-field-caption" });
    const label = this.t(field.key);
    caption.createSpan({ text: label });
    const value = caption.createSpan({ cls: "resume-layout-value", attr: { "aria-hidden": "true" } });
    const input = row.createEl("input", {
      type: "range",
      attr: {
        min: String(field.min),
        max: String(field.max),
        step: String(field.step),
        "aria-label": field.unit === "mm"
          ? this.t("marginLabel", { side: label }) : this.t("typographyLabel", { field: label }),
      },
    });
    const handle = this.marginHandles.get(field.key);
    if (handle) {
      input.addEventListener("focus", () => handle.classList.add("is-focused"));
      input.addEventListener("blur", () => handle.classList.remove("is-focused"));
    }
    input.addEventListener("input", () => {
      if (!this.view.selected) return;
      this.resetUndo.delete(this.view.selected.file);
      if (handle) this.setMargin(field, input.valueAsNumber);
      else this.current[field.key] = input.valueAsNumber;
      this.update();
    });
    input.addEventListener("change", () => this.commit());
    this.controls.set(field.key, { field, input, value });
  }

  updateLayoutActions() {
    if (!this.layoutActions || !this.view.selected) return;
    const { protected: readOnly, recognized, file } = this.view.selected;
    const needsManualSave = recognized && !this.view.plugin.settings.autoSaveLayout && !sameLayout(this.current, this.savedLayout);
    this.applyTemplateButton.hidden = readOnly || (recognized && !needsManualSave);
    this.applyTemplateButton.setText(recognized ? this.t("saveLayout") : this.t("applyLayout"));
    this.applyTemplateButton.disabled = this.applyingLayout;
    this.undoLayoutButton.hidden = readOnly || !recognized || !(this.layoutUndo.get(file)?.length);
    const hint = readOnly ? this.t("localPreviewHelp")
      : this.applyingLayout || this.queuedLayout ? this.t("layoutSaving")
      : !recognized ? this.t("previewOnly")
      : needsManualSave ? this.t("layoutUnsaved")
      : this.layoutFeedback || "";
    this.layoutHint.setText(hint);
  }

  update() {
    if (!this.view.selected || !this.current) return;
    const layout = this.current;
    this.templateSelect.value = layout.template;
    this.paperSelect.value = layout.paper;
    for (const [density, button] of this.densityButtons) button.setAttribute("aria-pressed", String(density === layout.density));
    for (const { field, input, value } of this.controls.values()) {
      const number = layout[field.key];
      const label = field.unit ? `${number} ${field.unit}` : number.toFixed(2);
      input.value = String(number);
      input.setAttribute("aria-valuetext", label);
      value.setText(label);
      const handle = this.marginHandles.get(field.key);
      if (handle) handle.dataset.guideValue = `${this.t(field.key)} ${number.toFixed(1)} mm`;
    }
    for (const [side, button] of this.lockButtons) {
      button.setAttribute("aria-pressed", String(this.marginLocks[side]));
    }
    this.view.preview.updateLayout(layout);
    const { file, classes } = this.view.selected;
    const defaults = layoutFor(classes, { density: layout.density });
    const canUndo = this.resetUndo.has(file);
    this.resetButton.setText(canUndo ? this.t("undoReset") : this.t("resetFineTuning"));
    this.resetButton.hidden = !canUndo && FIELDS.every(({ key }) => layout[key] === defaults[key]);
    this.updateLayoutActions();
    this.view.preview.measure();
  }

  resetLayout() {
    if (!this.view.selected) return;
    const { file, classes } = this.view.selected;
    const prior = this.resetUndo.get(file);
    if (prior) {
      this.resetUndo.delete(file);
      this.current = { ...this.current, ...prior };
    } else {
      this.resetUndo.set(file, dimensions(this.current));
      const defaults = layoutFor(classes, { density: this.current.density });
      this.current = { ...this.current, ...dimensions(defaults) };
    }
    this.alignLocks();
    this.commit();
    new Notice(prior ? this.t("layoutRestored") : this.t("layoutDefaultsRestored"));
  }

  fitToPage() {
    const resume = this.view.selected;
    if (!resume || this.view.preview.renderedFile !== resume.file || this.view.themeEditor.draft) return;
    const { file, classes } = resume;
    const undo = this.fitUndo.get(file);
    if (undo && sameLayout(undo.after, this.current)) {
      this.fitUndo.delete(file);
      this.current = { ...undo.before };
      const history = this.layoutUndo.get(file);
      if (history?.length && sameLayout(history.at(-1), undo.before)) history.pop();
      this.alignLocks();
      this.commit(false);
      return;
    }
    if (!this.view.preview.pageMetrics().overflow || this.view.preview.visiblePageBreaks()) return;

    const before = { ...this.current };
    const language = classes.includes("lapis-cv-zh") ? "zh" : "en";
    const lineHeightFloor = language === "zh" ? 1.32 : 1.24;
    const measure = () => {
      this.view.preview.updateLayout(this.current);
      return this.view.preview.pageMetrics();
    };
    const decrement = (value, step, floor) => value <= floor
      ? value : Math.max(floor, Number((value - step).toFixed(2)));
    this.current.density = "compact";
    this.current.lineHeight = DENSITIES.compact.lineHeight[language];
    let page = measure();
    while (page.overflow && this.current.lineHeight > lineHeightFloor) {
      this.current.lineHeight = decrement(this.current.lineHeight, 0.02, lineHeightFloor);
      page = measure();
    }
    while (page.overflow && (this.current.top > 7.5 || this.current.bottom > 7.5)) {
      this.current.top = decrement(this.current.top, 0.5, 7.5);
      this.current.bottom = decrement(this.current.bottom, 0.5, 7.5);
      page = measure();
    }
    while (page.overflow && this.current.fontSize > 8.4) {
      this.current.fontSize = decrement(this.current.fontSize, 0.05, 8.4);
      page = measure();
    }
    if (page.overflow) {
      this.current = before;
      this.update();
      new Notice(this.t("fitCannotReach", { excess: Math.ceil(page.used - page.printable) }));
      return;
    }
    this.fitUndo.set(file, { before, after: { ...this.current } });
    this.resetUndo.delete(file);
    this.alignLocks();
    this.commit();
  }

  rememberDraft() {
    const resume = this.view.selected;
    if (!resume || resume.protected) return;
    if (sameLayout(this.current, this.savedLayout)) this.draftLayouts.delete(resume.file);
    else this.draftLayouts.set(resume.file, { key: noteLayoutKey(resume), layout: { ...this.current } });
  }

  commit(record = true) {
    if (!this.view.selected) return;
    const { file, protected: readOnly, recognized } = this.view.selected;
    const changed = !sameLayout(this.current, this.lastCommittedLayout);
    if (changed) {
      if (record && recognized && !readOnly && this.lastCommittedLayout) {
        const history = this.layoutUndo.get(file) ?? [];
        history.push(this.lastCommittedLayout);
        if (history.length > 10) history.shift();
        this.layoutUndo.set(file, history);
      }
      this.lastCommittedLayout = { ...this.current };
      this.layoutFeedback = "";
      if (readOnly) this.view.plugin.state.saveLocalLayout(file.path, this.current);
      else {
        this.rememberDraft();
        if (recognized && this.view.plugin.settings.autoSaveLayout) this.queueLayoutSave(file);
      }
    }
    this.update();
  }

  undoLayoutChange() {
    if (!this.view.selected || this.view.selected.protected) return;
    const { file } = this.view.selected;
    const prior = this.layoutUndo.get(file)?.pop();
    if (!prior) return;
    this.resetUndo.delete(file);
    this.current = { ...prior };
    this.alignLocks();
    this.commit(false);
  }

  queueLayoutSave(file) {
    const win = this.view.preview.stage.ownerDocument.defaultView;
    let job = this.queuedLayout;
    if (!job || job.timer === undefined) {
      job = { file };
      job.promise = new Promise(resolve => { job.done = resolve; });
      this.queuedLayout = job;
    } else {
      win.clearTimeout(job.timer);
    }
    const save = async () => {
      if (this.applyingLayout) {
        job.timer = win.setTimeout(save, 50);
        return;
      }
      job.timer = undefined;
      try {
        if (this.view.selected?.file === job.file && this.view.selected.recognized && !this.view.selected.protected
          && this.view.plugin.settings.autoSaveLayout && !sameLayout(this.current, this.savedLayout)) {
          await this.saveNoteLayout(false);
        }
      } finally {
        if (this.queuedLayout === job) this.queuedLayout = null;
        job.done();
        this.updateLayoutActions();
      }
    };
    job.timer = win.setTimeout(save, 400);
  }

  async waitForLayoutSave() {
    while (this.queuedLayout) await this.queuedLayout.promise;
  }
}

module.exports = { LayoutPanel };
