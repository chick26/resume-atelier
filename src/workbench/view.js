const { FileView, Notice, setIcon } = require("obsidian");
const { VIEW_TYPE } = require("../identity");
const { sourceParts, withEditedBody } = require("../resume/markdown");
const { LayoutPanel } = require("./layout-panel");
const { PreviewPane } = require("./preview-pane");
const { ThemeEditor } = require("./theme-editor");
const { SourceEditor } = require("./source-editor");
const { SectionsPanel } = require("./sections-panel");
const { ResumePicker } = require("./modals");
const { iconButton } = require("./dom");

class ResumeLayoutView extends FileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.allowNoFile = true;
    this.plugin = plugin;
    this.t = plugin.t;
    this.selected = null;
    this.panelMode = "layout";
    this.layout = new LayoutPanel(this);
    this.themeEditor = new ThemeEditor(this);
    this.preview = new PreviewPane(this);
    this.editor = new SourceEditor(this);
    this.sections = new SectionsPanel(this);
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return this.t("pluginName");
  }

  getIcon() {
    return "file-text";
  }

  async onOpen() {
    const view = this.contentEl;
    view.empty();
    view.addClass(VIEW_TYPE);

    const header = view.createDiv({ cls: "resume-layout-header" });
    const identity = header.createDiv({ cls: "resume-layout-identity" });
    this.pickButton = identity.createEl("button", { cls: "resume-layout-picker" });
    const caption = this.pickButton.createSpan({ cls: "resume-layout-identity-text" });
    this.fileTitle = caption.createSpan({ cls: "resume-layout-title" });
    this.filePath = caption.createSpan({ cls: "resume-layout-path" });
    setIcon(this.pickButton.createSpan({ cls: "resume-layout-picker-icon" }), "chevrons-up-down");
    this.pickButton.addEventListener("click", () => this.openPicker());
    this.openButton = iconButton(identity, "arrow-up-right", this.t("openOriginalNote"), () => void this.openNote());

    const center = this.headerCenter = header.createDiv({ cls: "resume-layout-header-center" });
    this.preview.mountToolbar(center);
    this.layout.mountToolbar(center);

    const actions = header.createDiv({ cls: "resume-layout-actions" });
    this.editButton = actions.createEl("button", {
      text: this.t("editSource"),
      cls: "resume-layout-edit-button",
      attr: { title: this.t("editSourceHelp") },
    });
    this.editButton.addEventListener("click", () => void this.editor.openEditor());
    this.inspectorButton = iconButton(actions, "panel-right", this.t("hidePanel"), () => this.toggleInspector());
    this.hiddenBadge = actions.createEl("button", { cls: "resume-layout-hidden-count" });
    this.hiddenBadge.hidden = true;
    this.hiddenBadge.addEventListener("click", async () => {
      if (!await this.editor.endSourceEdit()) return;
      this.toggleInspector(false);
      this.setPanel("content");
      this.contentTab.focus();
    });
    this.exportButton = actions.createEl("button", { text: this.t("exportPdf"), cls: "mod-cta" });
    this.exportButton.addEventListener("click", () => void this.exportPdf());

    const body = this.body = view.createDiv({ cls: "resume-layout-body" });
    this.preview.mount(body);
    this.layout.mountMarginHandles();

    const inspector = this.inspector = body.createDiv({ cls: "resume-layout-inspector" });
    this.editor.mount(body);
    const tabs = this.tabs = inspector.createDiv({ cls: "resume-layout-panels" });
    this.layoutTab = tabs.createEl("button", { text: this.t("layoutTab") });
    this.layoutTab.addEventListener("click", () => this.setPanel("layout"));
    this.contentTab = tabs.createEl("button", { text: this.t("sections") });
    this.contentTab.addEventListener("click", () => this.setPanel("content"));
    const layout = this.layoutElement = inspector.createDiv();
    this.contentPanel = inspector.createDiv({ cls: "resume-layout-content" });
    this.cssPanel = inspector.createDiv({ cls: "resume-layout-css-panel" });
    this.setPanel(this.panelMode);

    this.layout.mount(layout);
    this.preview.observe();
    this.registerEvent(this.app.metadataCache.on("changed", (file, contents) => {
      const bound = this.file;
      if (!bound) return;
      const application = this.app.metadataCache.getFileCache(file)?.frontmatter?.type === "application";
      if (file !== bound && !application && !this.app.metadataCache.resolvedLinks[bound.path]?.[file.path]) return;
      if (this.editor.edit?.file === bound && file === bound && typeof contents === "string") {
        this.editor.refreshEditedSource(contents);
      }
      void this.show(bound);
    }));
    await this.show(this.file);
  }

  async onClose() {
    await this.layout.waitForLayoutSave();
    await this.editor.endSourceEdit(true);
    this.editor.cancelCursorFollow();
    this.preview.dispose();
    await super.onClose();
  }

  async setState(state, result) {
    // Restore workspaces saved before the layout tab stored an Obsidian file.
    const file = state.file ?? this.plugin.state.lastPath ?? "";
    await super.setState({ ...state, file }, result);
  }

  async onLoadFile(file) {
    await this.show(file);
  }

  async onUnloadFile() {
    await this.layout.waitForLayoutSave();
    if (await this.editor.endSourceEdit(true)) await this.show(null);
  }

  async onRename(file, oldPath) {
    await super.onRename(file, oldPath);
    if (this.file && (file === this.file || this.file.path.startsWith(`${file.path}/`))) {
      this.updateFileTitle();
    }
  }

  async bindFile(file) {
    if (this.file === file) {
      await this.show(file);
    } else {
      if (!await this.editor.endSourceEdit()) return;
      await this.layout.waitForLayoutSave();
      await this.leaf.setViewState({ type: VIEW_TYPE, active: true, state: { file: file.path } });
    }
  }

  async openNote() {
    if (!this.selected) return;
    try {
      await this.plugin.revealNote(this.selected.file, true);
    } catch (error) {
      new Notice(this.t("cannotOpenResume"));
      console.error("Resume Atelier resume note failed to open", error);
    }
  }

  openPicker() {
    new ResumePicker(this, this.plugin.catalog.resumes()).open();
  }

  createEmptyState(stage) {
    const empty = this.emptyState = stage.createDiv({ cls: "resume-layout-empty" });
    empty.hidden = true;
    const content = empty.createDiv({ cls: "resume-layout-empty-content" });
    content.createEl("p", { text: this.t("emptyWorkbench") });
    const actions = content.createDiv({ cls: "resume-layout-empty-actions" });
    const example = actions.createEl("button", { text: this.t("createExample"), cls: "mod-cta" });
    this.emptyPickerButton = actions.createEl("button", { text: this.t("chooseExisting") });
    this.emptyPickerButton.addEventListener("click", () => this.openPicker());
    example.addEventListener("click", async () => {
      example.disabled = true;
      try {
        const file = await this.plugin.files.createExampleResume();
        if (this.leaf.view === this && !this.file) await this.bindFile(file);
      } catch (error) {
        console.error("Resume Atelier example resume creation failed", error);
        new Notice(this.t("cannotCreateSample"));
      } finally {
        example.disabled = false;
      }
    });
    const refresh = file => {
      if (file.extension === "md" && !empty.hidden) this.updateEmptyChoices();
    };
    for (const event of ["create", "delete"]) this.registerEvent(this.app.vault.on(event, refresh));
  }

  updateEmptyChoices() {
    const hasNotes = this.app.vault.getMarkdownFiles().length > 0;
    this.emptyPickerButton.disabled = !hasNotes;
    this.emptyPickerButton.title = hasNotes ? "" : this.t("noMarkdownNotes");
  }

  toggleInspector(collapsed = !this.inspectorCollapsed) {
    this.inspectorCollapsed = collapsed;
    this.inspector.hidden = collapsed || !this.selected || !!this.editor.edit;
    const label = collapsed ? this.t("showPanel") : this.t("hidePanel");
    this.inspectorButton.setAttribute("aria-label", label);
    this.inspectorButton.setAttribute("aria-expanded", String(!collapsed));
    this.inspectorButton.title = label;
    this.updateHiddenSections(this.hiddenCount ?? 0);
    setIcon(this.inspectorButton, collapsed ? "panel-right-open" : "panel-right-close");
  }

  updateHiddenSections(count) {
    this.hiddenCount = count;
    const text = count ? this.t("sectionsTabHidden", { count }) : this.t("sections");
    if (this.contentTab && this.contentTab.textContent !== text) this.contentTab.setText(text);
    if (!this.hiddenBadge) return;
    this.hiddenBadge.hidden = !this.selected || !count || (!this.inspectorCollapsed && !this.editor.edit && this.panelMode !== "css");
    if (count) this.hiddenBadge.setText(this.t("hiddenExportHint", { count }));
  }

  setPanel(mode) {
    if (this.panelMode === "css" && mode !== "css" && this.themeEditor.draft) {
      this.themeEditor.draft.requestClose(() => this.setPanel(mode));
      return;
    }
    this.panelMode = mode;
    const content = mode === "content";
    const css = mode === "css";
    this.tabs.hidden = css;
    this.layoutTab.setAttribute("aria-pressed", String(!content));
    this.contentTab.setAttribute("aria-pressed", String(content));
    this.layoutElement.hidden = content || css;
    this.contentPanel.hidden = !content;
    this.cssPanel.hidden = !css;
    this.updateExportButton();
    this.updateHiddenSections(this.hiddenCount ?? 0);
    if (content) this.sections.render();
  }

  updateFileTitle() {
    const resume = this.selected;
    const path = resume?.file.path ?? "";
    this.fileTitle.setText(resume?.label ?? this.t("selectResume"));
    const badges = {
      master: [this.t("masterBadge"), this.t("masterHelp")],
      frozen: [this.t("frozenBadge"), this.t("frozenHelp")],
      protected: [this.t("protectedBadge"), this.t("protectedHelp")],
      preview: [this.t("previewBadge"), this.t("previewHelp")],
    };
    const badge = badges[resume?.protectionReason ?? (resume && !resume.recognized ? "preview" : "")];
    this.filePath.setText(badge?.[0] ?? "");
    this.filePath.title = badge?.[1] ?? "";
    this.filePath.hidden = !badge;
    this.preview.staleBanner.hidden = !resume?.stale;
    this.pickButton.title = path || this.t("selectResumeOrNote");
    this.pickButton.setAttribute("aria-label", resume ? this.t("changeResume", { name: resume.label }) : this.t("selectResume"));
  }

  async show(file) {
    if (!this.preview.paper) return;
    const version = this.preview.beginRender();
    const prior = this.selected;
    let resume = this.plugin.catalog.resume(file, true);
    let markdown;
    let body;
    if (resume) {
      try {
        const edit = this.editor.edit?.file === file ? this.editor.edit : null;
        markdown = edit ? withEditedBody(edit.saved, edit.text) : await this.app.vault.cachedRead(file);
        if (version !== this.preview.renderVersion) return;
        body = edit?.text ?? sourceParts(markdown).body;
        resume = this.plugin.catalog.resumeForContent(resume, body);
      } catch (error) {
        if (version === this.preview.renderVersion) this.preview.setPageMeasurement(this.t("previewUnavailable"));
        console.error("Resume Atelier resume preview failed", error);
        return;
      }
    }
    const sameFile = resume && prior?.file === file;
    if (resume) {
      resume.protectionReason = this.plugin.catalog.protectionReason(resume);
      resume.protected = !!resume.protectionReason;
    }
    this.selected = resume;

    this.layout.selectResume(resume, prior, sameFile);
    this.updateFileTitle();
    this.headerCenter.hidden = this.exportButton.hidden = this.openButton.hidden = !resume;
    this.editButton.hidden = !resume;
    this.editor.syncSourceControls();
    this.preview.paper.hidden = !resume;
    this.emptyState.hidden = !!resume;
    this.updateExportButton();

    if (!resume) {
      this.preview.clearPreview();
      this.sourceMarkdown = null;
      this.updateEmptyChoices();
      this.preview.setPageMeasurement("");
      this.sections.render();
      return;
    }

    this.plugin.state.rememberFile(file.path);
    if (!sameFile) {
      this.sourceMarkdown = null;
      this.preview.setPageMeasurement(this.t("loading"));
    }
    this.layout.updateTemplateControls();
    await this.preview.render({ resume, markdown, body, version, sameFile });
  }

  updateExportButton() {
    this.exportButton.disabled = !this.selected || this.preview.renderedFile !== this.selected.file || !!this.themeEditor.draft || !!this.exporting;
    this.exportButton.title = this.themeEditor.draft ? this.t("finishThemeBeforeExport") : "";
  }

  async exportPdf() {
    const resume = this.selected;
    if (!resume || this.exportButton.disabled) return;
    const { file } = resume;
    const layout = { ...this.layout.current };
    this.exporting = true;
    this.updateExportButton();
    try {
      if (!await this.editor.saveSource()) return;
      await this.layout.waitForLayoutSave();
      if (file !== this.selected?.file) return;
      this.plugin.files.assertEditorInSync(file, await this.app.vault.read(file));
      await this.plugin.presentation.openNativeExport(file, this.leaf, layout);
    } catch (error) {
      new Notice(error.message || this.t("nativeExportFailed"));
      console.error("Resume Atelier PDF export failed", error);
    } finally {
      this.exporting = false;
      this.updateExportButton();
    }
  }
}

module.exports = { ResumeLayoutView };
