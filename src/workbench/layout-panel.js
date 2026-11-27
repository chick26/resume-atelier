const { Notice } = require("obsidian");
const {
  PAPER_SIZES, paperSize, DENSITIES, MARGINS, MARGIN_PAIRS, TYPOGRAPHY, FIELDS, layoutFor, dimensions, geometryForSave, noteLayoutKey, sameLayout,
} = require("../layout/geometry");
const { appearanceFor, withoutGapOverrides } = require("../layout/appearance");
const { ruleFor } = require("../resume/section-layout");
const { iconButton } = require("./dom");
const { mountAppearanceControls } = require("./appearance-controls");

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
    const fineTune = this.fineTune = layout.createEl("details", { cls: "resume-layout-fine-tune" });
    fineTune.createEl("summary", { text: this.t("fineTune") });
    this.appearance = mountAppearanceControls(fineTune, this);
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

  setAppearance(values, save = true) {
    this.resetUndo.delete(this.view.selected.file);
    this.current.appearance = appearanceFor(values);
    if (save) this.commit();
    else this.update();
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
      if (changedMetadata && !useDraft) {
        const bodyChanges = this.layoutUndo.get(file)?.filter(step => step.kind === "body");
        if (bodyChanges) this.layoutUndo.set(file, bodyChanges);
      }
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
    this.templateSelect.addEventListener("change", () => this.selectTemplate(this.templateSelect.value));
    controls.createSpan({ text: this.t("density") });
    const density = controls.createDiv({ cls: "resume-layout-density", attr: { role: "group", "aria-label": this.t("density") } });
    this.densityButtons = new Map();
    for (const value of Object.keys(DENSITIES)) {
      const button = density.createEl("button", { text: this.t(value) });
      button.addEventListener("click", () => this.setDensity(value));
      this.densityButtons.set(value, button);
    }
    controls.createSpan({ text: this.t("paperSize") });
    const paper = controls.createDiv({ cls: "resume-layout-density", attr: { role: "group", "aria-label": this.t("paperSize") } });
    this.paperButtons = new Map();
    for (const value of Object.keys(PAPER_SIZES)) {
      const button = paper.createEl("button", { text: value === "Letter" ? "US Letter" : value });
      button.addEventListener("click", () => { this.current.paper = value; this.commit(); });
      this.paperButtons.set(value, button);
    }
    this.templateHint = controls.createDiv({ cls: "resume-layout-hint", attr: { role: "status" } });
  }

  selectTemplate(template) {
    if (!this.view.selected || this.current.template === template) return;
    this.current.template = template;
    this.commit();
  }

  setDensity(value) {
    if (!this.view.selected) return;
    const overrides = this.current.appearance;
    if (this.current.density === value && overrides.sectionGap == null && overrides.listGap == null) return;
    this.current.appearance = withoutGapOverrides(overrides);
    const { classes, file } = this.view.selected;
    if (this.current.lineHeight === layoutFor(classes, { density: this.current.density }).lineHeight) {
      this.current.lineHeight = layoutFor(classes, { density: value }).lineHeight;
    }
    this.current.density = value;
    this.resetUndo.delete(file);
    this.commit();
  }

  refreshTemplateOptions() {
    this.templateSelect.replaceChildren();
    for (const theme of this.view.plugin.themes.visibleTemplates(this.current.template)) {
      this.templateSelect.createEl("option", { value: theme.id, text: this.view.plugin.themes.themeName(theme) });
    }
    this.templateSelect.value = this.current.template;
  }

  updateTemplateControls() {
    if (!this.view.selected) return;
    this.refreshTemplateOptions();
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
    this.applyTemplateButton.hidden = readOnly || recognized;
    this.applyTemplateButton.disabled = this.applyingLayout;
    this.undoLayoutButton.hidden = !this.layoutUndo.get(file)?.length;
    this.undoLayoutButton.disabled = !!this.undoingBody;
    const hint = readOnly ? this.t("localPreviewHelp")
      : this.applyingLayout || this.queuedLayout ? this.t("layoutSaving")
      : !recognized ? this.t("previewOnly")
      : this.layoutFeedback || "";
    this.layoutHint.setText(hint);
  }

  update() {
    if (!this.view.selected || !this.current) return;
    const layout = this.current;
    if ((layout.template === "简洁蓝") !== !!this.templateSelect.querySelector('option[value="简洁蓝"]')) this.refreshTemplateOptions();
    this.templateSelect.value = layout.template;
    for (const [value, button] of this.paperButtons) button.setAttribute("aria-pressed", String(value === layout.paper));
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
    this.updateContextControls();
    const { file, classes } = this.view.selected;
    const defaults = layoutFor(classes, { density: layout.density });
    const canUndo = this.resetUndo.has(file);
    this.resetButton.setText(canUndo ? this.t("undoReset") : this.t("resetFineTuning"));
    this.resetButton.hidden = !canUndo && !Object.keys(layout.appearance).length && FIELDS.every(({ key }) => layout[key] === defaults[key]);
    this.updateLayoutActions();
    this.view.preview.measure();
  }

  updateContextControls() {
    const preview = this.view.preview;
    const flow = preview.renderedFile === this.view.selected?.file ? preview.sectionLayout : null;
    this.appearance.update(this.current.appearance);
    if (this.view.editor.edit) this.view.editor.toolbar.updatePhoto();
    const hidden = (flow?.sections ?? []).filter(({ title }) =>
      !flow.duplicates.has(title) && ruleFor(this.current.sections, title).hidden === true).length;
    this.view.updateHiddenSections(hidden);
  }

  resetLayout() {
    if (!this.view.selected) return;
    const { file, classes } = this.view.selected;
    const prior = this.resetUndo.get(file);
    if (prior) {
      this.resetUndo.delete(file);
      this.current = { ...this.current, ...prior };
    } else {
      this.resetUndo.set(file, { ...dimensions(this.current), appearance: this.current.appearance });
      const defaults = layoutFor(classes, { density: this.current.density });
      this.current = { ...this.current, ...dimensions(defaults), appearance: {} };
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
      const index = history?.findLastIndex(step => step.kind === "layout" && sameLayout(step.before, undo.before) && sameLayout(step.after, undo.after));
      if (index >= 0) history.splice(index, 1);
      this.alignLocks();
      this.commit(false);
      new Notice(this.t("fitUndone"));
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
    this.current.appearance = withoutGapOverrides(this.current.appearance);
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
    new Notice(this.t("fitSuccess"));
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
      if (record && this.lastCommittedLayout) {
        this.recordChange(file, { kind: "layout", before: this.lastCommittedLayout, after: { ...this.current } });
      }
      this.lastCommittedLayout = { ...this.current };
      this.layoutFeedback = "";
      if (readOnly) this.view.plugin.state.saveLocalLayout(file.path, this.current);
      else {
        this.rememberDraft();
        if (recognized) this.queueLayoutSave(file);
      }
    }
    this.update();
  }

  recordChange(file, step) {
    const history = this.layoutUndo.get(file) ?? [];
    history.push(step);
    if (history.length > 20) history.shift();
    this.layoutUndo.set(file, history);
  }

  async undoLayoutChange() {
    const resume = this.view.selected;
    if (!resume || this.undoingBody) return;
    const { file } = resume;
    const history = this.layoutUndo.get(file);
    const step = history?.at(-1);
    if (!step) return;
    if (step.kind === "layout") {
      history.pop();
      this.resetUndo.delete(file);
      this.fitUndo.delete(file);
      this.current = { ...step.before };
      this.alignLocks();
      this.commit(false);
      this.view.sections.render();
      return;
    }

    this.undoingBody = true;
    try {
      if (resume.protected || !resume.recognized) throw Object.assign(new Error(), { code: "CONFLICT" });
      await this.view.plugin.files.writeSourceBody(file, step.after, step.before);
      const index = history.indexOf(step);
      if (index >= 0) history.splice(index, 1);
      if (this.view.selected?.file === file) await this.view.show(file);
      new Notice(this.t("sectionChangeUndone"));
    } catch (error) {
      if (error.code === "CONFLICT") {
        const index = history.indexOf(step);
        if (index >= 0) history.splice(index, 1);
        new Notice(this.t("undoSourceStale"));
      } else new Notice(error.message);
    } finally {
      this.undoingBody = false;
      this.updateLayoutActions();
      this.view.sections.render();
    }
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
          && !sameLayout(this.current, this.savedLayout)) {
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
