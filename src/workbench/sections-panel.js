const { Notice, setIcon } = require("obsidian");
const { editableBody, sourceParts, splitSectionBody } = require("../resume/markdown");
const { sectionRuleIssues } = require("../resume/structure");
const { changeSectionRule, ruleFor } = require("../resume/section-layout");
const { runWithNotice } = require("./dom");

class SectionsPanel {
  constructor(view) {
    this.view = view;
    this.t = view.t;
  }

  render() {
    const panel = this.view.contentPanel;
    if (!panel || this.view.panelMode !== "content") return;
    panel.empty();
    const resume = this.view.selected;
    if (!resume || this.view.sourceMarkdown === null || this.view.sourceMarkdown === undefined) return;

    const source = this.view.sourceMarkdown;
    const editable = resume.recognized && !resume.protected;
    const sections = splitSectionBody(sourceParts(source).body).sections;
    const issues = sectionRuleIssues(sections, this.view.layout.current.sections);
    const actions = panel.createDiv({ cls: "resume-layout-content-actions" });
    if (editable) this.renderSectionActions(actions, resume, source, sections);
    if (this.view.layout.layoutUndo.get(resume.file)?.length) {
      actions.createEl("button", { text: this.t("undoLast") })
        .addEventListener("click", () => void this.view.layout.undoLayoutChange());
    }
    for (const title of issues.duplicate) panel.createDiv({ cls: "resume-layout-hint", text: this.t("duplicateSectionRule", { title }) });
    for (const title of issues.missing) {
      const row = panel.createDiv({ cls: "resume-layout-rule-warning" });
      row.createSpan({ text: this.t("missingSectionRule", { title }) });
      row.createEl("button", { text: this.t("clearRule") }).addEventListener("click", () => {
        const layout = this.view.layout;
        const sections = { ...layout.current.sections };
        delete sections[title];
        layout.current.sections = sections;
        layout.commit();
        this.render();
      });
    }
    const list = panel.createDiv({ cls: "resume-layout-section-list" });
    sections.forEach(({ title }, index) =>
      this.renderSection(list, title, index, sections.length, source, editable, !!title && !issues.duplicate.includes(title)));
    if (editable && sections.length > 1) this.enableSectionDrag(list, resume.file, source);
    if (!sections.length) panel.createDiv({ cls: "resume-layout-modal-hint", text: editable
      ? this.t("createSectionsHelp") : this.t("emptySections") });
  }

  renderSectionActions(actions, resume, source, sections) {
    const panel = this.view.contentPanel;
    const draft = this.sectionDraft?.file === resume.file ? this.sectionDraft : null;
    const add = actions.createEl("button", { text: draft ? this.t("cancelNewSection") : this.t("newSection"), cls: draft ? "" : "mod-cta" });
    add.setAttribute("aria-expanded", String(!!draft));
    add.addEventListener("click", () => {
      this.sectionDraft = draft ? null : { file: resume.file, title: "" };
      this.render();
      if (!draft) this.view.contentPanel.querySelector("input")?.focus();
    });
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
      pills.createEl("button", { text: title, attr: { type: "button" } }).addEventListener("click", () => void submit(title));
    }
    form.createEl("button", { text: this.t("addSection"), attr: { type: "submit" } });
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

  renderSection(container, title, index, count, source, editable, unique) {
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
    if (unique) {
      const layout = this.view.layout.current;
      const rule = ruleFor(layout.sections, title);
      const flow = this.view.preview.sectionLayout;
      if (flow?.mode === "sidebar") {
        const sidebar = rule.region === "sidebar";
        this.ruleButton(row, title, sidebar ? "sectionToMain" : "sectionToSidebar", "panel-left", "region", sidebar ? "main" : "sidebar");
      }
      if (flow?.sections[index]?.lists.length || rule.display === "tags") {
        const tags = rule.display === "tags";
        this.ruleButton(row, title, tags ? "sectionAsList" : "sectionAsTags", "tags", "display", tags ? undefined : "tags");
      }
      const hidden = rule.hidden === true;
      jump.disabled = hidden;
      row.classList.toggle("is-muted-section", hidden);
      this.ruleButton(row, title, hidden ? "showSection" : "hideSection", hidden ? "eye-off" : "eye", "hidden", hidden ? undefined : true);
    }
    if (!editable) return;
    for (const [delta, message, icon] of [[-1, "moveSectionUp", "arrow-up"], [1, "moveSectionDown", "arrow-down"]]) {
      if (index + delta < 0 || index + delta >= count) continue;
      const label = this.t(message, { title });
      const button = row.createEl("button", { attr: { "aria-label": label, title: label } });
      setIcon(button, icon);
      button.addEventListener("click", () => void runWithNotice(() => this.moveSection(index, index + delta, source)));
    }
  }

  ruleButton(row, title, message, icon, key, value) {
    const label = this.t(message, { title });
    const button = row.createEl("button", { attr: { "aria-label": label, title: label, "aria-pressed": String(value === undefined || (key === "region" && value === "main")) } });
    setIcon(button, icon);
    button.addEventListener("click", () => {
      const layout = this.view.layout;
      layout.current.sections = changeSectionRule(layout.current.sections, title, key, value);
      layout.commit();
      this.render();
    });
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
    if (!resume?.recognized || source == null || source !== this.view.sourceMarkdown || this.view.plugin.catalog.isProtected(resume)) {
      throw new Error(this.t("noteChanged"));
    }
    const { prefix, body } = sourceParts(source);
    const next = prefix + transform(body);
    await this.view.plugin.files.writeContent(resume.file, source, next);
    const before = editableBody(source);
    this.view.layout.recordChange(resume.file, { kind: "body", before, after: editableBody(next) });
    if (this.view.selected?.file === resume.file) await this.view.show(resume.file);
    new Notice(message);
  }
}

module.exports = { SectionsPanel };
