const { Notice } = require("obsidian");
const { copySourceText } = require("./dom");

class ThemeEditor {
  constructor(view) {
    this.view = view;
    this.t = view.t;
    this.layout = view.layout;
    this.themes = view.plugin.themes;
    this.draft = null;
  }

  open(mode, id = this.layout.current.template) {
    const theme = this.themes.templates.get(id);
    if (mode === "edit" && (!theme || theme.builtIn)) return;
    this.draft = {
      original: mode === "edit" ? theme : null,
      text: (mode !== "new" && theme?.css) || ":scope { --color-accent: #254f78; }",
    };
    const panel = this.view.cssPanel;
    panel.empty();
    const back = panel.createEl("button", { text: this.t("backToLayout") });
    panel.createEl("h3", { text: { new: this.t("newTheme"), copy: this.t("copyTheme"), edit: this.t("editTheme") }[mode] });
    const form = panel.createEl("form", { cls: "resume-layout-modal-form" });
    const name = form.createEl("label", { text: this.t("themeName") });
    const copyBase = mode === "copy"
      ? this.themes.themeName(theme).replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 43).trimEnd() : "";
    const input = name.createEl("input", {
      type: "text",
      value: mode === "edit" ? theme.label : mode === "copy" ? this.t("themeCopyName", { name: copyBase }) : "",
      attr: { maxlength: "48", required: true },
    });
    const cssLabel = form.createEl("label", { text: "CSS" });
    const editor = cssLabel.createEl("textarea", { cls: "resume-layout-css-editor", attr: { rows: "12", spellcheck: "false" } });
    editor.value = this.draft.text;
    editor.addEventListener("input", () => {
      this.draft.text = editor.value;
      this.layout.update();
    });
    form.createDiv({ cls: "resume-layout-hint", text: this.t("themeScopeHelp") });
    const examples = form.createEl("details", { cls: "resume-layout-css-examples" });
    examples.createEl("summary", { text: this.t("cssReference") });
    const snippets = [
      ":scope { --color-accent: #254f78; --border-color: #a8bed2; }",
      ':scope { --title-font: Georgia, serif; --text-font: Arial, sans-serif; }',
      ".resume-layout-icon { display: none !important; }",
    ];
    for (const snippet of snippets) {
      examples.createEl("pre", { text: snippet });
      examples.createEl("button", { text: this.t("copySnippet"), attr: { type: "button" } })
        .addEventListener("click", () => void copySourceText(editor, this.t, snippet));
    }
    const feedback = form.createDiv({ cls: "resume-layout-hint", attr: { role: "status" } });
    const actions = form.createDiv({ cls: "resume-layout-template-actions" });
    const cancel = actions.createEl("button", { text: this.t("cancel"), attr: { type: "button" } });
    const save = actions.createEl("button", { text: this.t("saveTheme"), cls: "mod-cta", attr: { type: "submit" } });
    let afterClose;
    const close = () => {
      this.draft = null;
      this.view.setPanel("layout");
      panel.empty();
      this.layout.updateTemplateControls();
      this.layout.templateSelect.focus();
      afterClose?.();
    };
    const initialName = input.value;
    const initialCss = editor.value;
    const confirm = panel.createDiv({ cls: "resume-layout-template-actions" });
    confirm.hidden = true;
    const keep = confirm.createEl("button", { text: this.t("keepEditing") });
    const discard = confirm.createEl("button", { text: this.t("discardThemeConfirm"), cls: "mod-warning" });
    const requestClose = this.draft.requestClose = next => {
      afterClose = next;
      if (initialName === input.value && initialCss === editor.value) return close();
      confirm.hidden = false;
      keep.focus();
    };
    keep.addEventListener("click", () => {
      afterClose = undefined;
      confirm.hidden = true;
      (initialCss === editor.value ? input : editor).focus();
    });
    discard.addEventListener("click", close);
    back.addEventListener("click", () => requestClose());
    cancel.addEventListener("click", () => requestClose());
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (save.disabled) return;
      save.disabled = cancel.disabled = back.disabled = true;
      feedback.setText("");
      try {
        const file = this.view.selected?.file;
        const templateId = await this.themes.saveTemplate(input.value.trim(), editor.value, this.draft.original);
        close();
        if (mode !== "edit" && file && this.view.selected?.file === file) {
          this.layout.current.template = templateId;
          this.layout.commit();
        }
        new Notice(this.t("themeSaved"));
      } catch (error) {
        feedback.setText(error.message);
        save.disabled = cancel.disabled = back.disabled = false;
      }
    });
    this.view.setPanel("css");
    this.layout.update();
    (mode === "edit" ? editor : input).focus();
  }
}

module.exports = { ThemeEditor };
