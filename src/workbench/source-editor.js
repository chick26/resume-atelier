const { Notice, Scope } = require("obsidian");
const { editableBody, withEditedBody } = require("../resume/markdown");
const { changeSourceIndent, continueSourceList, sourceEditorContext, toggleSourceBold } = require("../editor/formatting");
const { copySourceText, runWithNotice } = require("./dom");
const { SourceRecoveryModal } = require("./modals");
const { mountSourceTools } = require("./source-toolbar");

class SourceEditor {
  constructor(view) {
    this.view = view;
    this.app = view.app;
    this.t = view.t;
    this.edit = null;
  }

  mount(parent) {
    const pane = this.sourcePane = parent.createDiv({ cls: "resume-layout-source" });
    pane.hidden = true;
    const header = pane.createDiv({ cls: "resume-layout-source-header" });
    const tools = header.createDiv({ cls: "resume-layout-source-tools", attr: { role: "group", "aria-label": this.t("formatSource") } });
    const info = header.createDiv({ cls: "resume-layout-source-info" });
    this.sourceStatus = info.createSpan({ cls: "resume-layout-source-status", attr: { role: "status" } });
    this.retrySourceSave = info.createEl("button", { text: this.t("retry"), attr: { "aria-label": this.t("retrySave") } });
    this.retrySourceSave.hidden = true;
    this.retrySourceSave.addEventListener("click", () => void this.saveSource());
    this.sourceConflict = pane.createDiv({ cls: "resume-layout-source-conflict" });
    this.sourceConflict.hidden = true;
    this.sourceConflictMessage = this.sourceConflict.createDiv({ cls: "resume-layout-source-conflict-message" });
    const saveCopy = this.sourceConflict.createEl("button", { text: this.t("saveCopy"), cls: "mod-cta" });
    saveCopy.addEventListener("click", () => void this.resolveSourceConflict(true));
    const copy = this.sourceConflict.createEl("button", { text: this.t("copyMyInput") });
    copy.addEventListener("click", () => void copySourceText(this.sourceField, this.t));
    const loadLatest = this.sourceConflict.createEl("button", { text: this.t("discardAndReload"), cls: "mod-warning" });
    loadLatest.addEventListener("click", () => void this.resolveSourceConflict(false));
    const field = this.sourceField = pane.createEl("textarea", {
      attr: { "aria-label": this.t("sourceLabel"), spellcheck: "false", autocapitalize: "off", autocomplete: "off" },
    });
    this.toolbar = mountSourceTools(this, pane, tools, info, field);
    field.addEventListener("input", () => {
      this.toolbar.close();
      this.editedSourceChanged();
      this.toolbar.update();
    });
    for (const event of ["select", "selectionchange", "pointerup", "keyup", "focus"]) {
      field.addEventListener(event, () => {
        this.toolbar.update();
        this.queueCursorFollow();
      });
    }
    // Handle the editor shortcut before Obsidian's window-level Markdown keymap.
    const scope = new Scope(this.app.scope);
    scope.register(["Mod"], "B", event => {
      if (event.isComposing || field.ownerDocument.activeElement !== field) return;
      const context = sourceEditorContext(field);
      if (!context.bold) return;
      toggleSourceBold(field, context);
      this.toolbar.update();
      return false;
    });
    const popScope = () => this.app.keymap.popScope(scope);
    field.addEventListener("focus", () => this.app.keymap.pushScope(scope));
    field.addEventListener("blur", popScope);
    this.view.register(popScope);
    field.addEventListener("keydown", event => {
      if (event.isComposing) return;
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!field.readOnly && event.key === "Tab" && plain) {
        event.preventDefault();
        event.stopPropagation();
        changeSourceIndent(field, event.shiftKey);
        this.toolbar.update();
        return;
      }
      if (!field.readOnly && event.key === "Enter" && plain && !event.shiftKey && continueSourceList(field)) {
        event.preventDefault();
        event.stopPropagation();
        this.toolbar.update();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.toolbar.close();
        field.blur();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        void this.saveSource();
      }
    });
  }

  async openEditor() {
    const resume = this.view.selected;
    if (!resume || this.view.editButton.disabled) return;
    if (!resume.recognized && !resume.protected) {
      this.view.toggleInspector(false);
      this.view.setPanel("layout");
      this.view.layout.applyTemplateButton.focus();
      new Notice(this.t("applyBeforeEdit"));
      return;
    }
    this.view.editButton.disabled = true;
    try {
      await runWithNotice(async () => {
        if (this.edit) {
          if (await this.endSourceEdit()) await this.view.show(this.view.file);
          return;
        }
        const file = resume.protected ? await this.view.plugin.files.copyForEditing(resume, { ...this.view.layout.current }) : resume.file;
        if (this.view.selected?.file !== resume.file) return;
        if (resume.protected) await this.view.bindFile(file);
        if (this.view.file !== file) return;

        const saved = await this.app.vault.read(file);
        if (this.view.file !== file) return;
        const text = editableBody(saved);
        this.edit = { file, saved, text };
        this.sourceField.value = text;
        this.setSourceStatus("saved");
        this.syncSourceControls();
        this.sourceField.focus();
        const offset = Math.max(0, text.search(/\S/));
        this.sourceField.setSelectionRange(offset, offset);
        this.toolbar.update();
        void this.view.show(file);
      });
    } finally {
      this.view.editButton.disabled = false;
    }
  }

  syncSourceControls() {
    const editing = !!this.edit;
    if (!editing) this.toolbar.close();
    this.sourcePane.hidden = !editing;
    this.view.layout.setAppearanceInEditor(editing);
    this.view.body.toggleClass("is-source-editing", editing);
    this.view.editButton.setText(editing ? this.t("doneEditing") : this.view.selected?.protected ? this.t("copyAndEdit") : this.t("editSource"));
    this.view.editButton.title = editing ? this.t("doneEditingHelp") : this.t("editSourceHelp");
    this.view.inspectorButton.hidden = editing || !this.view.selected;
    this.view.toggleInspector(!!this.view.inspectorCollapsed);
  }

  setSourceStatus(status, state = "", detail) {
    const label = this.t(state === "conflict" ? "sourceSaveConflict" : status);
    const message = detail || (state === "conflict" ? this.t(status) : label);
    this.sourceStatus.setText(label);
    this.sourceStatus.title = message;
    this.sourceStatus.toggleClass("has-error", !!state);
    this.sourceStatus.toggleClass("is-pending", status === "sourcePending" || status === "sourceSaving");
    this.retrySourceSave.hidden = state !== "retry";
    this.sourceConflict.hidden = state !== "conflict";
    this.sourceConflictMessage.setText(state === "conflict" ? message : "");
  }

  markSourceConflict(edit) {
    edit.conflicted = true;
    this.sourceField.ownerDocument.defaultView.clearTimeout(edit.saveTimer);
    this.setSourceStatus("sourceConflict", "conflict");
  }

  async resolveSourceConflict(saveCopy) {
    const edit = this.edit;
    const resume = this.view.selected;
    if (!edit?.conflicted || edit.resolving || resume?.file !== edit.file) return;
    const field = this.sourceField;
    edit.resolving = true;
    field.readOnly = true;
    this.toolbar.update();
    for (const button of this.sourceConflict.querySelectorAll("button")) button.disabled = true;
    try {
      if (saveCopy) {
        const file = await this.view.plugin.files.copyForEditing(resume, { ...this.view.layout.current }, edit.text);
        if (this.edit !== edit) return;
        this.releaseSourceEdit(edit);
        await this.view.bindFile(file);
        await this.openEditor();
        new Notice(this.t("copySaved"));
      } else {
        const latest = await this.app.vault.read(edit.file);
        if (this.edit !== edit) return;
        edit.saved = latest;
        edit.text = editableBody(latest);
        edit.conflicted = false;
        field.value = edit.text;
        this.setSourceStatus("sourceLoaded");
        field.focus();
        await this.view.show(edit.file);
      }
    } catch (error) {
      new Notice(error.message || this.t("sourceConflictFailed"));
      console.error("CareerOS source conflict resolution failed", error);
    } finally {
      edit.resolving = false;
      field.readOnly = false;
      this.toolbar.update();
      for (const button of this.sourceConflict.querySelectorAll("button")) button.disabled = false;
    }
  }

  editedSourceChanged() {
    const edit = this.edit;
    if (!edit) return;
    edit.text = this.sourceField.value;
    const win = this.sourceField.ownerDocument.defaultView;
    win.clearTimeout(edit.previewTimer);
    win.clearTimeout(edit.saveTimer);
    edit.previewTimer = win.setTimeout(() => {
      if (this.edit === edit) void this.view.show(edit.file);
    }, 160);
    if (!edit.conflicted) {
      this.setSourceStatus(edit.text === editableBody(edit.saved) ? "saved" : "sourcePending");
      edit.saveTimer = win.setTimeout(() => { void this.saveSource(); }, 500);
    }
    this.queueCursorFollow();
  }

  refreshEditedSource(contents) {
    const edit = this.edit;
    if (!edit || edit.saving || edit.conflicted || contents === edit.saved) return;
    const text = editableBody(contents);
    const before = editableBody(edit.saved);
    const dirty = edit.text !== before;
    if (dirty && text !== before && text !== edit.text) {
      this.markSourceConflict(edit);
      return;
    }
    edit.saved = contents;
    if (dirty && text !== edit.text) return;
    this.setSourceStatus("saved");
    if (text === edit.text) return;
    edit.text = text;
    const field = this.sourceField;
    const { selectionStart, selectionEnd, scrollTop } = field;
    field.value = text;
    field.setSelectionRange(selectionStart, selectionEnd);
    field.scrollTop = scrollTop;
    this.toolbar.update();
  }

  async saveSource() {
    const edit = this.edit;
    if (!edit) return true;
    this.sourceField.ownerDocument.defaultView.clearTimeout(edit.saveTimer);
    if (edit.conflicted || edit.recovery) return false;
    if (edit.saving) return edit.saving;
    if (edit.text === editableBody(edit.saved)) return true;
    this.setSourceStatus("sourceSaving");
    edit.saving = (async () => {
      try {
        while (edit.text !== editableBody(edit.saved)) {
          edit.saved = await this.view.plugin.files.writeSourceBody(edit.file, editableBody(edit.saved), edit.text);
        }
        this.setSourceStatus("saved");
        return true;
      } catch (error) {
        if (error.code === "CONFLICT") this.markSourceConflict(edit);
        else this.setSourceStatus("sourceSaveFailed", "retry", error.message);
        return false;
      } finally {
        edit.saving = null;
      }
    })();
    return edit.saving;
  }

  async endSourceEdit(recover = false) {
    const edit = this.edit;
    if (!edit) return true;
    if (!await this.saveSource()) {
      if (!recover || edit.recovery) return false;
      try {
        await this.backupSourceEdit(edit);
      } catch (error) {
        console.error("CareerOS resume editor recovery failed", error);
        if (!edit.recovery) {
          edit.recovery = new SourceRecoveryModal(this, edit);
          edit.recovery.open();
        }
        return false;
      }
    }
    this.releaseSourceEdit(edit);
    return true;
  }

  async backupSourceEdit(edit) {
    if (edit.backup) return edit.backup;
    edit.backup = (async () => {
      const path = await this.view.plugin.files.draftPath(edit.file, this.t("backupName", { name: edit.file.basename }));
      await this.app.vault.create(path, withEditedBody(edit.saved, edit.text));
      new Notice(this.t("backupSaved", { path }));
    })();
    try {
      await edit.backup;
    } finally {
      edit.backup = null;
    }
  }

  releaseSourceEdit(edit) {
    if (this.edit !== edit) return;
    const win = this.sourceField.ownerDocument.defaultView;
    win.clearTimeout(edit.previewTimer);
    win.clearTimeout(edit.saveTimer);
    this.edit = null;
    this.highlightedBlock?.classList.remove("resume-layout-current-block");
    this.highlightedBlock = null;
    this.syncSourceControls();
  }

  queueCursorFollow() {
    const field = this.sourceField;
    if (!this.edit || this.cursorFrame !== undefined || field.ownerDocument.activeElement !== field) return;
    this.cursorFrame = field.ownerDocument.defaultView.requestAnimationFrame(() => {
      this.cursorFrame = undefined;
      if (field.ownerDocument.activeElement === field) this.followCursor();
    });
  }

  followCursor() {
    const edit = this.edit;
    if (!edit || !this.view.preview.rendered || edit.file !== this.view.preview.renderedFile || edit.text !== this.view.preview.renderedBody) return;
    const field = this.sourceField;
    const head = field.selectionDirection === "backward" ? field.selectionStart : field.selectionEnd;
    const line = edit.text.slice(0, head).split("\n").length - 1;
    const block = this.previewBlocks?.findLast(location => location.line <= line)?.element;
    if (block === this.highlightedBlock) return;
    this.highlightedBlock?.classList.remove("resume-layout-current-block");
    this.highlightedBlock = block;
    if (!block || block.closest(".resume-layout-section-hidden")) return;
    block.classList.add("resume-layout-current-block");
    const position = block.getBoundingClientRect();
    const viewport = this.view.preview.stage.getBoundingClientRect();
    if (position.top < viewport.top + 24 || position.bottom > viewport.bottom - 24) {
      this.view.preview.stage.scrollTop += position.top - viewport.top - this.view.preview.stage.clientHeight / 3;
    }
  }

  focusSourceFromPreview(event) {
    const edit = this.edit;
    if (!edit || edit.file !== this.view.preview.renderedFile || edit.text !== this.view.preview.renderedBody
      || !this.view.preview.rendered?.contains(event.target) || this.sourceField.readOnly) return;
    const location = this.previewBlocks?.findLast(block => block.element.contains(event.target));
    if (!location) return;
    event.preventDefault();
    const lines = edit.text.split("\n");
    const start = lines.slice(0, location.line).reduce((length, line) => length + line.length + 1, 0);
    const field = this.sourceField;
    field.focus({ preventScroll: true });
    field.setSelectionRange(start, start + lines[location.line].length);
    this.toolbar.update();
    this.scrollSourceTo(start);
    this.highlightedBlock?.classList.remove("resume-layout-current-block");
    this.highlightedBlock = location.element;
    this.highlightedBlock.classList.add("resume-layout-current-block");
  }

  scrollSourceTo(offset) {
    const field = this.sourceField;
    const doc = field.ownerDocument;
    const style = doc.defaultView.getComputedStyle(field);
    const measure = doc.createElement("div");
    Object.assign(measure.style, {
      position: "fixed", left: "-10000px", top: "0", visibility: "hidden",
      boxSizing: "border-box", width: `${field.clientWidth}px`, padding: style.padding,
      font: style.font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
      whiteSpace: "pre-wrap", overflowWrap: "break-word", tabSize: style.tabSize,
    });
    measure.textContent = field.value.slice(0, offset);
    const marker = doc.createElement("span");
    marker.textContent = "\u200b";
    measure.append(marker);
    doc.body.append(measure);
    field.scrollTop = Math.max(0, marker.offsetTop - field.clientHeight / 3);
    measure.remove();
  }


  clearPreviewSelection() {
    this.previewBlocks = null;
    this.highlightedBlock = null;
  }

  cancelCursorFollow() {
    if (this.cursorFrame === undefined) return;
    this.sourceField.ownerDocument.defaultView.cancelAnimationFrame(this.cursorFrame);
    this.cursorFrame = undefined;
  }
}

module.exports = { SourceEditor };
