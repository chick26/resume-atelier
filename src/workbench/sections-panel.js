const { Notice, setIcon } = require("obsidian");
const { editableBody, sourceParts, splitSectionBody } = require("../resume/markdown");
const { sectionRuleIssues } = require("../resume/structure");
const { runWithNotice } = require("./dom");

class SectionsPanel {
  constructor(view) {
    this.view = view;
    this.t = view.t;
    this.contentUndo = new WeakMap();
  }

  render() {
    const panel = this.view.contentPanel;
    if (!panel || this.view.panelMode !== "content") return;
    panel.empty();
    const resume = this.view.selected;
    if (!resume || this.view.sourceMarkdown === null || this.view.sourceMarkdown === undefined) return;

    const source = this.view.sourceMarkdown;
    const editable = !resume.protected;
    const sections = editable ? splitSectionBody(sourceParts(source).body).sections
      : this.previewHeadings().map(heading => ({ title: heading.textContent.replace(/[\uE000-\uF8FF]/gu, "").trim() }));
    if (editable) {
      this.renderSectionActions(panel, resume, source, sections);
      const issues = sectionRuleIssues(sections, this.view.layout.current.sections);
      for (const title of issues.duplicate) panel.createDiv({ cls: "resume-layout-hint", text: this.t("duplicateSectionRule", { title }) });
      for (const title of issues.missing) panel.createDiv({ cls: "resume-layout-hint", text: this.t("missingSectionRule", { title }) });
    }
    const list = panel.createDiv({ cls: "resume-layout-section-list" });
    sections.forEach(({ title }, index) => this.renderSection(list, title, index, sections.length, source, editable));
    if (editable && sections.length > 1) this.enableSectionDrag(list, resume.file, source);
    if (!sections.length) panel.createDiv({ cls: "resume-layout-modal-hint", text: editable
      ? this.t("createSectionsHelp") : this.t("emptySections") });
  }

  renderSectionActions(panel, resume, source, sections) {
    const actions = panel.createDiv({ cls: "resume-layout-content-actions" });
    const draft = this.sectionDraft?.file === resume.file ? this.sectionDraft : null;
    const add = actions.createEl("button", { text: draft ? this.t("cancelNewSection") : this.t("newSection"), cls: draft ? "" : "mod-cta" });
    add.setAttribute("aria-expanded", String(!!draft));
    add.addEventListener("click", () => {
      this.sectionDraft = draft ? null : { file: resume.file, title: "" };
      this.render();
      if (!draft) this.view.contentPanel.querySelector("input")?.focus();
    });
    const history = this.contentUndo.get(resume.file);
    const prior = history?.at(-1);
    if (prior?.after === editableBody(source)) {
      actions.createEl("button", { text: this.t("undoLast") }).addEventListener("click", () => {
        void runWithNotice(async () => {
          await this.view.plugin.files.writeSourceBody(resume.file, prior.after, prior.before);
          history.pop();
          if (this.view.selected?.file === resume.file) await this.view.show(resume.file);
          new Notice(this.t("sectionChangeUndone"));
        });
      });
    }
    if (!draft) return;

    const form = panel.createEl("form", { cls: "resume-layout-modal-form" });
    const label = form.createEl("label", { text: this.t("sectionName") });
    const name = label.createEl("input", { type: "text", value: draft.title, attr: { required: true } });
    name.addEventListener("input", () => { draft.title = name.value; });
    const suggestions = resume.classes.includes("lapis-cv-zh")
      ? ["个人简介", "核心技能", "工作经历", "项目经历", "教育背景", "专业证书"]
      : ["Profile", "Skills", "Work Experience", "Projects", "Education", "Certifications"];
    const chosen = new Set(sections.map(section => section.title.toLowerCase()));
    const pills = form.createDiv({ cls: "resume-layout-section-suggestions" });
    const feedback = form.createDiv({ cls: "resume-layout-hint", attr: { role: "status" } });
    const submit = async title => {
      if (draft.submitting) return;
      draft.submitting = true;
      this.sectionDraft = null;
      try {
        await this.addSection(title, source);
        this.jumpToSection(sections.length);
      } catch (error) {
        this.sectionDraft = draft;
        feedback.setText(error.message);
      } finally {
        draft.submitting = false;
      }
    };
    for (const title of suggestions) {
      if (chosen.has(title.toLowerCase())) continue;
      pills.createEl("button", { text: title, type: "button" }).addEventListener("click", () => void submit(title));
    }
    form.createEl("button", { text: this.t("addSection"), type: "submit" });
    form.addEventListener("submit", event => {
      event.preventDefault();
      void submit(name.value.trim());
    });
  }

  previewHeadings() {
    if (this.view.selected?.protected) return [...(this.view.preview.rendered?.querySelectorAll("h2") ?? [])];
    return this.view.preview.sourceHeadings ?? [];
  }

  jumpToSection(index) {
    const reducedMotion = this.view.preview.paper.ownerDocument.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.previewHeadings()[index]?.scrollIntoView({ block: "center", behavior: reducedMotion ? "instant" : "smooth" });
  }

  renderSection(container, title, index, count, source, editable) {
    title ||= this.t("untitledSection");
    const row = container.createDiv({ cls: "resume-layout-section-row" });
    if (editable && count > 1) {
      row.classList.add("is-sortable");
      const grip = row.createSpan({ cls: "resume-layout-section-grip", attr: { "aria-hidden": "true" } });
      setIcon(grip, "grip-vertical");
    }
    const jump = row.createEl("button", {
      text: title, cls: "resume-layout-section-label",
      attr: { title: this.t("findSectionOnPage", { title }) },
    });
    jump.addEventListener("click", () => this.jumpToSection(index));
    if (!editable) return;
    for (const [delta, message, icon] of [[-1, "moveSectionUp", "arrow-up"], [1, "moveSectionDown", "arrow-down"]]) {
      if (index + delta < 0 || index + delta >= count) continue;
      const label = this.t(message, { title });
      const button = row.createEl("button", { attr: { "aria-label": label, title: label } });
      setIcon(button, icon);
      button.addEventListener("click", () => void runWithNotice(() => this.moveSection(index, index + delta, source)));
    }
  }

  enableSectionDrag(list, file, source) {
    const rows = Array.from(list.children);
    let gesture;
    let indicator;
    const findRow = element => {
      const row = element?.closest(".resume-layout-section-row");
      return row?.parentElement === list ? row : null;
    };
    const atPointer = event => {
      const row = findRow(list.ownerDocument.elementFromPoint(event.clientX, event.clientY));
      if (!row) return null;
      const { top, height } = row.getBoundingClientRect();
      return { row, after: event.clientY >= top + height / 2 };
    };
    const markTarget = target => {
      indicator?.row.classList.remove("is-drop-before", "is-drop-after");
      indicator = target;
      indicator?.row.classList.add(indicator.after ? "is-drop-after" : "is-drop-before");
    };
    const clear = () => {
      gesture?.row.classList.remove("is-dragging");
      gesture = null;
      markTarget(null);
    };
    list.addEventListener("pointerdown", event => {
      const row = findRow(event.target);
      if (!row || event.button !== 0 || event.target.closest("button")) return;
      clear();
      event.preventDefault();
      gesture = { row, pointerId: event.pointerId, from: rows.indexOf(row) };
      list.setPointerCapture(event.pointerId);
      row.classList.add("is-dragging");
    });
    list.addEventListener("pointermove", event => {
      if (gesture?.pointerId !== event.pointerId) return;
      const target = atPointer(event);
      markTarget(target?.row === gesture.row ? null : target);
    });
    list.addEventListener("pointerup", event => {
      if (gesture?.pointerId !== event.pointerId) return;
      const { from } = gesture;
      const target = atPointer(event);
      clear();
      if (!target) return;
      const insertion = rows.indexOf(target.row) + Number(target.after);
      const to = insertion - Number(from < insertion);
      if (to >= 0 && to !== from && this.view.selected?.file === file) {
        void runWithNotice(() => this.moveSection(from, to, source));
      }
    });
    list.addEventListener("pointercancel", clear);
  }

  addSection(title, source) {
    return this.changeContent(source, body => {
      if (!title || /[\r\n]/.test(title)) throw new Error(this.t("sectionNameRequired"));
      if (splitSectionBody(body).sections.some(section => section.title.toLowerCase() === title.toLowerCase())) {
        throw new Error(this.t("sectionNameDuplicate"));
      }
      const newline = body.includes("\r\n") ? "\r\n" : "\n";
      const separator = body.endsWith(newline.repeat(2)) || !body ? "" : body.endsWith(newline) ? newline : newline.repeat(2);
      return body + separator + `## ${title}` + newline;
    }, this.t("sectionAdded"));
  }

  async moveSection(from, to, source) {
    if (from === to) return;
    await this.changeContent(source, body => {
      const { intro, sections } = splitSectionBody(body);
      if (!sections[from] || !sections[to]) throw new Error(this.t("sectionsChanged"));
      sections.splice(to, 0, sections.splice(from, 1)[0]);
      const newline = body.includes("\r\n") ? "\r\n" : "\n";
      return intro + sections.map(({ markdown }, index) => {
        if (index === sections.length - 1 || markdown.endsWith(newline.repeat(2))) return markdown;
        return markdown + (markdown.endsWith(newline) ? newline : newline.repeat(2));
      }).join("");
    }, this.t("sectionsReordered"));
  }

  async changeContent(source, transform, message) {
    const resume = this.view.selected;
    if (!resume || source == null || source !== this.view.sourceMarkdown || this.view.plugin.catalog.isProtected(resume)) {
      throw new Error(this.t("noteChanged"));
    }
    const { prefix, body } = sourceParts(source);
    const next = prefix + transform(body);
    await this.view.plugin.files.writeContent(resume.file, source, next);
    const before = editableBody(source);
    const history = this.contentUndo.get(resume.file) ?? [];
    if (history.length && history.at(-1).after !== before) history.length = 0;
    history.push({ before, after: editableBody(next) });
    if (history.length > 5) history.shift();
    this.contentUndo.set(resume.file, history);
    if (this.view.selected?.file === resume.file) await this.view.show(resume.file);
    new Notice(message);
  }
}

module.exports = { SectionsPanel };
