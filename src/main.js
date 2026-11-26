const { MarkdownView, Notice, Plugin } = require("obsidian");
const { VIEW_TYPE } = require("./identity");
const { obsidianLanguage, createTranslator } = require("./localization");
const { SettingsStore } = require("./settings/store");
const { ResumeLayoutSettingTab } = require("./settings/tab");
const { ResumeCatalog } = require("./resume/catalog");
const { ResumeFiles } = require("./resume/files");
const { ThemeLibrary } = require("./themes/library");
const { ResumeLayouts } = require("./layout/resolution");
const { ResumePresentation } = require("./obsidian/presentation");
const { ResumeLayoutView } = require("./workbench/view");

const EXAMPLES = {
  en: require("../examples/sample-resume.en.md"),
  zh: require("../examples/sample-resume.zh.md"),
};

class ResumeLayoutPlugin extends Plugin {
  get settings() {
    return this.state.settings;
  }

  async onload() {
    const data = await this.loadData();
    const language = obsidianLanguage();
    this.t = createTranslator(language);
    this.state = new SettingsStore(data, settings => this.saveData(settings), this.t);
    this.catalog = new ResumeCatalog(this.app, this.settings, this.t, language);
    const refresh = () => this.presentation.scheduleReadingStyles();
    this.themes = new ThemeLibrary(this.app, this.manifest.id, this.catalog, this.t, refresh);
    this.layouts = new ResumeLayouts(this.state, this.themes);
    this.files = new ResumeFiles(this.app, this.catalog, this.state, this.t, EXAMPLES[language], refresh);
    this.presentation = new ResumePresentation(this.app, this.catalog, this.layouts, this.themes, this.t);
    await this.themes.loadTemplates();

    this.registerView(VIEW_TYPE, leaf => new ResumeLayoutView(leaf, this));
    this.addSettingTab(new ResumeLayoutSettingTab(this.app, this));
    this.addCommand({ id: "open", name: this.t("openCommand"), callback: () => void this.open() });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      const target = this.catalog.resumeForNote(file);
      if (!target && file?.extension !== "md") return;
      menu.addItem((item) => item
        .setTitle(target ? target.file === file ? this.t("layoutThisResume") : this.t("layoutLinkedResume") : this.t("previewAsResume"))
        .setIcon("file-text")
        .onClick(() => void this.open((target?.file ?? file).path)));
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.state.moveLayouts(file.path, oldPath)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.state.removeLayouts(file.path)));
    this.app.workspace.onLayoutReady(refresh);
    this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
    this.registerEvent(this.app.workspace.on("file-open", refresh));
    this.registerEvent(this.app.workspace.on("layout-change", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerMarkdownPostProcessor((element, context) => this.presentation.postProcess(element, context));
  }

  onunload() {
    this.presentation?.dispose();
  }

  async open(path, allowPreview = false) {
    const { workspace, vault } = this.app;
    let file;
    if (path) {
      file = vault.getAbstractFileByPath(path);
      if (file?.extension !== "md") {
        new Notice(this.t("noteNotFound"));
        return;
      }
    } else {
      file = this.catalog.resumeForNote(workspace.getActiveViewOfType(MarkdownView)?.file)?.file;
      const recent = this.state.lastPath && vault.getAbstractFileByPath(this.state.lastPath);
      if (!file && recent?.extension === "md") file = recent;
      if (!file) {
        const notes = vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime);
        for (const note of notes) {
          const properties = this.app.metadataCache.getFileCache(note)?.frontmatter;
          if (properties?.type !== "application" || properties.status !== "preparing") continue;
          file = this.catalog.resumeForNote(note)?.file;
          if (file) break;
        }
        file ??= notes.find(note => this.catalog.resume(note));
        if (allowPreview) file ??= notes[0];
      }
    }
    let [leaf] = workspace.getLeavesOfType(VIEW_TYPE);
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { file: file?.path ?? "" } });
    }
    await workspace.revealLeaf(leaf);
    if (!(leaf.view instanceof ResumeLayoutView)) return;
    if (file && leaf.view.file !== file) await leaf.view.bindFile(file);
    else if (file && path) await leaf.view.show(file);
    if (!leaf.view.file && !allowPreview && vault.getMarkdownFiles().length) leaf.view.openPicker();
    return leaf.view;
  }

  showSettings() {
    this.app.setting.open();
    this.app.setting.openTabById(this.manifest.id);
  }

  async openTheme(mode, id) {
    this.app.setting.close();
    const view = await this.open(undefined, true);
    if (!view?.selected) {
      new Notice(this.t("themeNeedsNote"));
      return;
    }
    if (!await view.editor.endSourceEdit()) return;
    view.toggleInspector(false);
    view.themeEditor.open(mode, id);
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.presentation.scheduleReadingStyles();
    for (const { view } of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (view instanceof ResumeLayoutView && view.file) void view.show(view.file);
    }
    return this.state.saveSettings();
  }

  async revealNote(file, focus) {
    const { vault, workspace } = this.app;
    if (vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t("originalNoteMissing"));
    let leaf = workspace.getLeavesOfType("markdown").find((item) => item.getViewState().state?.file === file.path);
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "preview" } });
    }
    await workspace.revealLeaf(leaf);
    workspace.setActiveLeaf(leaf, { focus });
  }
}

module.exports = ResumeLayoutPlugin;
