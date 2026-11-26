const { Notice, PluginSettingTab, Setting } = require("obsidian");
const { BASE_TEMPLATE } = require("../layout/geometry");
const { vaultFolder } = require("../resume/files");

class ResumeLayoutSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.t = plugin.t;
  }

  display() {
    const el = this.containerEl;
    const plugin = this.plugin;
    const settings = plugin.settings;
    el.empty();
    el.addClass("resume-layout-settings");
    new Setting(el).setName(this.t("workbench")).setDesc(this.t("workbenchHelp"))
      .addButton(button => button.setButtonText(this.t("openWorkbench")).setCta().onClick(() => {
        this.app.setting.close();
        void plugin.open();
      }));
    new Setting(el).setName(this.t("layoutDefaults")).setHeading();
    new Setting(el).setName(this.t("defaultTheme")).setDesc(this.t("defaultThemeHelp"))
      .addDropdown(dropdown => {
        for (const theme of plugin.themes.templates.values()) dropdown.addOption(theme.id, plugin.themes.themeName(theme));
        dropdown.setValue(plugin.themes.templateId(settings.defaultTemplate) ?? BASE_TEMPLATE)
          .onChange(value => plugin.updateSetting("defaultTemplate", value));
      });
    new Setting(el).setName(this.t("defaultDensity")).setDesc(this.t("defaultDensityHelp"))
      .addDropdown(dropdown => {
        for (const value of ["standard", "comfortable", "compact"]) dropdown.addOption(value, this.t(value));
        dropdown.setValue(settings.defaultDensity).onChange(value => plugin.updateSetting("defaultDensity", value));
      });

    new Setting(el).setName(this.t("themes")).setHeading();
    new Setting(el).setName(this.t("customThemes"))
      .addButton(button => button.setButtonText(this.t("newTheme")).onClick(() => void plugin.openTheme("new")))
      .addButton(button => button.setButtonText(this.t("importCss")).onClick(() => this.importTheme()));
    if (plugin.themes.deletedTemplate) {
      new Setting(el).setName(this.t("themeDeleted", { name: plugin.themes.deletedTemplate.theme.label }))
        .addButton(button => button.setButtonText(this.t("undoDelete")).onClick(() => this.run(() => plugin.themes.restoreTemplate())));
    }
    for (const theme of plugin.themes.templates.values()) this.addThemeRow(el, theme);

    new Setting(el).setName(this.t("copiesAndProtection")).setHeading();
    new Setting(el).setName(this.t("copyLocation")).setDesc(this.t("copyLocationHelp"))
      .addDropdown(dropdown => dropdown.addOption("alongside", this.t("sameFolder")).addOption("folder", this.t("customFolder"))
        .setValue(settings.draftLocationMode).onChange(async value => {
          await plugin.updateSetting("draftLocationMode", value);
          this.display();
        }));
    if (settings.draftLocationMode === "folder") {
      const row = new Setting(el).setName(this.t("draftFolderPath"));
      row.addText(text => text.setValue(settings.draftFolder).onChange(value => {
        try {
          const folder = vaultFolder(value, this.t);
          row.setDesc("");
          void plugin.updateSetting("draftFolder", folder);
        } catch (error) {
          row.setDesc(error.message);
        }
      }));
    }
    new Setting(el).setName(this.t("autoSaveLayout"))
      .setDesc(this.t("autoSaveLayoutHelp"))
      .addToggle(toggle => toggle.setValue(settings.autoSaveLayout).onChange(value => plugin.updateSetting("autoSaveLayout", value)));

    const advanced = el.createEl("details");
    advanced.createEl("summary", { text: this.t("advanced") });
    const row = new Setting(advanced).setName(this.t("extraProtectedFolders"));
    const description = this.t("extraProtectedFoldersHelp");
    row.setDesc(description).addTextArea(text => text.setValue(settings.protectedFolders.join("\n")).onChange(value => {
      try {
        const folders = [...new Set(value.split("\n").map(folder => vaultFolder(folder, this.t)).filter(Boolean))];
        row.setDesc(description);
        void plugin.updateSetting("protectedFolders", folders);
      } catch (error) {
        row.setDesc(error.message);
      }
    }));
    void this.showDeletedCache(advanced);
  }

  addThemeRow(parent, theme) {
    const plugin = this.plugin;
    const label = theme.id === BASE_TEMPLATE ? this.t("themeClassicCredit") : plugin.themes.themeName(theme);
    const row = new Setting(parent).setName(label);
    if (theme.builtIn) {
      row.addButton(button => button.setButtonText(this.t("copyAndCustomize")).onClick(() => void plugin.openTheme("copy", theme.id)));
      return;
    }
    const references = plugin.themes.templateUsers(theme.id).length;
    row.setDesc(references ? this.t(references === 1 ? "themeUseOne" : "themeUseMany", { count: references }) : this.t("themeUnused"))
      .addButton(button => button.setButtonText(this.t("previewAndEdit")).onClick(() => void plugin.openTheme("edit", theme.id)))
      .addButton(button => button.setButtonText(this.t("exportCss")).onClick(() => this.exportTheme(theme)))
      .addButton(button => button.setButtonText(this.t("delete")).setDisabled(!!references)
        .setTooltip(references ? this.t("deleteInUseHint") : this.t("deleteUnusedHint"))
        .onClick(() => {
          row.controlEl.empty();
          row.setDesc(this.t("deleteThemeQuestion", { name: theme.label }))
            .addButton(cancel => cancel.setButtonText(this.t("cancel")).onClick(() => this.display()))
            .addButton(confirm => confirm.setButtonText(this.t("confirmDelete")).setWarning()
              .onClick(() => this.run(() => plugin.themes.deleteTemplate(theme.id))));
        }));
  }

  async run(action) {
    try {
      await action();
      this.display();
    } catch (error) {
      new Notice(error.message || this.t("themeOperationFailed"));
    }
  }

  importTheme() {
    const input = this.containerEl.createEl("input", { type: "file", attr: { accept: ".css,text/css", hidden: true } });
    input.addEventListener("change", () => {
      const file = input.files[0];
      input.remove();
      if (!file) return;
      void this.run(async () => {
        const css = await file.text();
        if (!/\.css$/i.test(file.name) || !css.trim()) throw new Error(this.t("chooseCssFile"));
        await this.plugin.themes.saveTemplate(file.name.replace(/\.css$/i, ""), css);
        new Notice(this.t("themeImported"));
      });
    }, { once: true });
    input.addEventListener("cancel", () => input.remove(), { once: true });
    input.click();
  }

  exportTheme(theme) {
    const win = this.containerEl.ownerDocument.defaultView;
    const url = win.URL.createObjectURL(new win.Blob([theme.css], { type: "text/css" }));
    const link = this.containerEl.createEl("a", { attr: { href: url, download: `${theme.label}.css`, hidden: true } });
    link.click();
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }

  async showDeletedCache(advanced) {
    try {
      const files = await this.plugin.themes.deletedThemeFiles();
      if (!files.length || !advanced.isConnected) return;
      const row = new Setting(advanced).setName(this.t("clearDeletedThemeCache"))
        .setDesc(this.t(files.length === 1 ? "fileCountOne" : "fileCountMany", { count: files.length }));
      let confirmed = false;
      row.addButton(button => button.setButtonText(this.t("clear")).setWarning().onClick(() => {
        if (!confirmed) {
          confirmed = true;
          button.setButtonText(this.t("confirmClear"));
          return;
        }
        button.setDisabled(true);
        return this.run(() => this.plugin.themes.clearDeletedFiles(files));
      }));
    } catch (error) {
      console.error("Could not read deleted resume themes", error);
    }
  }
}

module.exports = { ResumeLayoutSettingTab };
