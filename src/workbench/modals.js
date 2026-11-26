const { FuzzySuggestModal, Modal } = require("obsidian");
const { copySourceText } = require("./dom");
const { avatarEdit } = require("../resume/avatar");
const { replaceSourceSelection } = require("../editor/formatting");

class PhotoPicker extends FuzzySuggestModal {
  constructor(editor, field) {
    super(editor.app);
    this.editor = editor;
    this.field = field;
    this.edit = editor.edit;
    this.setPlaceholder(editor.t("searchImages"));
  }

  getItems() {
    return this.app.vault.getFiles().filter(file => /^(?:png|jpe?g|gif|webp|avif|svg)$/i.test(file.extension));
  }

  getItemText(file) { return file.path; }

  onChooseItem(file) {
    if (!this.edit || this.editor.edit !== this.edit || this.field.readOnly) return;
    const { start, end, text } = avatarEdit(this.field.value, this.edit.file.path, file.path);
    this.field.focus({ preventScroll: true });
    replaceSourceSelection(this.field, start, end, text, start + text.length, start + text.length);
  }
}

class SourceRecoveryModal extends Modal {
  constructor(editor, edit) {
    super(editor.app);
    this.editor = editor;
    this.t = editor.t;
    this.edit = edit;
  }

  onOpen() {
    this.setTitle(this.t("recoveryTitle"));
    this.modalEl.addClass("resume-layout-recovery");
    this.contentEl.createEl("p", { text: this.t("recoveryHelp") });
    const input = this.contentEl.createEl("textarea", { attr: { readonly: true, "aria-label": this.t("unsavedText") } });
    input.value = this.edit.text;
    const feedback = this.contentEl.createDiv({ cls: "resume-layout-modal-hint", attr: { role: "status" } });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const copy = actions.createEl("button", { text: this.t("copyClipboard"), cls: "mod-cta" });
    copy.addEventListener("click", () => void copySourceText(input, this.t));
    const retry = actions.createEl("button", { text: this.t("retryBackup") });
    const discard = actions.createEl("button", { text: this.t("discardAndClose"), cls: "mod-warning" });
    discard.addEventListener("click", () => this.finish());
    retry.addEventListener("click", async () => {
      retry.disabled = discard.disabled = true;
      try {
        await this.editor.backupSourceEdit(this.edit);
        this.finish();
      } catch (error) {
        console.error("CareerOS resume editor recovery failed", error);
        feedback.setText(this.t("backupFailed"));
        retry.disabled = discard.disabled = false;
      }
    });
    copy.focus();
  }

  close() {
    // A tab can close while this dialog holds its only surviving edit buffer.
    if (this.resolved) super.close();
  }

  finish() {
    this.resolved = true;
    this.editor.releaseSourceEdit(this.edit);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ResumePicker extends FuzzySuggestModal {
  constructor(view, resumes) {
    super(view.app);
    this.view = view;
    this.t = view.plugin.t;
    this.defaultResumes = resumes;
    this.items = resumes;
    this.setPlaceholder(this.t("searchNotes"));
    this.emptyStateText = this.t("noMatchingNotes");
  }

  getItems() {
    return this.items;
  }

  getSuggestions(query) {
    const useAllNotes = !!query.trim() || !this.defaultResumes.length;
    this.items = useAllNotes ? (this.allNotes ??= this.view.plugin.catalog.resumes(true)) : this.defaultResumes;
    this.emptyStateText = this.items.length ? this.t("noMatchingNotes") : this.t("noMarkdownNotes");
    return super.getSuggestions(query);
  }

  getItemText({ label, company, file, source }) {
    return [label, company, file.path, source?.path].filter(Boolean).join(" ");
  }

  renderSuggestion({ item }, element) {
    const label = item.company ? `${item.label} · ${item.company}` : item.label;
    element.createDiv({ cls: "suggestion-title", text: label });
    element.createDiv({ cls: "suggestion-note", text: item.file.path });
    if (item.source) element.createDiv({ cls: "suggestion-note", text: this.t("sourceNote", { path: item.source.path }) });
  }

  onChooseItem({ file }) {
    void this.view.bindFile(file);
  }
}

module.exports = { SourceRecoveryModal, ResumePicker, PhotoPicker };
