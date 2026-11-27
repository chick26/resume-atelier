const { Notice } = require("obsidian");
const { BASE_TEMPLATE } = require("../layout/geometry");
const { BUILT_IN_TEMPLATE_CSS, BUILT_IN_TEMPLATES, THEME_LABELS, BUILT_IN_THEME_MESSAGES } = require("./built-ins");
const { scopedCss } = require("./scoped-css");

const TEMPLATE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,47}$/u;

class ThemeLibrary {
  constructor(app, pluginId, catalog, t, onChange) {
    this.app = app;
    this.catalog = catalog;
    this.t = t;
    this.onChange = onChange;
    this.templateFolder = [app.vault.configDir, "plugins", pluginId, "templates"].join("/");
    this.templates = new Map(Object.entries(BUILT_IN_TEMPLATE_CSS).map(([id, css]) => [id, this.themeRecord(id, css)]));
  }

  themeRecord(id, raw) {
    const metadata = raw.match(/^\/\* Resume Atelier theme: (.+?) \*\/\r?\n/u);
    const builtIn = BUILT_IN_TEMPLATES.includes(id);
    const customLabel = !builtIn && TEMPLATE_NAME.test(metadata?.[1] ?? "") ? metadata[1] : id;
    return {
      id,
      label: THEME_LABELS[id] ?? customLabel,
      css: metadata ? raw.slice(metadata[0].length) : raw,
      raw,
      builtIn,
    };
  }

  visibleTemplates(current) {
    return [...this.templates.values()].filter(theme => theme.id !== "简洁蓝" || theme.id === current);
  }

  themeName(theme) {
    return theme.builtIn ? this.t(BUILT_IN_THEME_MESSAGES[theme.id]) : theme.label;
  }

  async loadTemplates() {
    const adapter = this.app.vault.adapter;
    try {
      if (!await adapter.exists(this.templateFolder)) return;
      const { files } = await adapter.list(this.templateFolder);
      for (const path of files.sort((a, b) => a.localeCompare(b, "zh"))) {
        const leaf = path.split("/").at(-1);
        if (!leaf.endsWith(".css")) continue;
        const id = leaf.slice(0, -4);
        if (TEMPLATE_NAME.test(id) && id !== BASE_TEMPLATE && id !== "紧凑") {
          this.templates.set(id, this.themeRecord(id, await adapter.read(path)));
        }
      }
    } catch (error) {
      console.error("Resume Atelier could not read resume templates", error);
      new Notice(this.t("themesLoadFailed"));
    }
  }

  templateId(name) {
    if (typeof name !== "string" || !name) return undefined;
    if (this.templates.has(name)) return name;
    return [...this.templates.values()].find(theme => theme.label.toLowerCase() === name.toLowerCase())?.id;
  }

  templateUsers(id) {
    return this.app.vault.getMarkdownFiles().filter(file =>
      this.templateId(this.app.metadataCache.getFileCache(file)?.frontmatter?.resume_style) === id,
    );
  }

  async saveTemplate(label, css, original) {
    if (!TEMPLATE_NAME.test(label) || [...BUILT_IN_TEMPLATES, "紧凑"].some(name => name.toLowerCase() === label.toLowerCase())) {
      throw new Error(this.t("invalidThemeName"));
    }
    if (css.trim() && !scopedCss(css, ".resume-template-preview", document)) {
      throw new Error(this.t("invalidThemeCss"));
    }
    const id = original?.id ?? label;
    if ([...this.templates.values()].some(theme =>
      theme.id !== id && [theme.label, theme.id].some(name => name.toLowerCase() === label.toLowerCase()))) {
      throw new Error(this.t("duplicateTheme"));
    }
    const adapter = this.app.vault.adapter;
    const path = `${this.templateFolder}/${id}.css`;
    if (original) {
      if (original.builtIn || await adapter.read(path) !== original.raw) throw new Error(this.t("themeEditStale"));
      if (css !== original.css && this.templateUsers(id).some(file => this.catalog.isProtected(this.catalog.resume(file)))) {
        throw new Error(this.t("themeProtected"));
      }
    } else if (this.templates.has(id) || await adapter.exists(path)) {
      throw new Error(this.t("duplicateTheme"));
    }
    if (!await adapter.exists(this.templateFolder)) await adapter.mkdir(this.templateFolder);
    const raw = label === id ? css : `/* Resume Atelier theme: ${label} */\n${css}`;
    await adapter.write(path, raw);
    this.templates.set(id, this.themeRecord(id, raw));
    this.onChange();
    return id;
  }

  async deleteTemplate(id) {
    const theme = this.templates.get(id);
    if (!theme || theme.builtIn) throw new Error(this.t("customThemeRequired"));
    if (this.templateUsers(id).length) throw new Error(this.t("themeStillInUse"));
    const adapter = this.app.vault.adapter;
    const path = `${this.templateFolder}/${id}.css`;
    const bin = `${this.templateFolder}/.deleted`;
    const deletedPath = `${bin}/${Date.now()}-${id}.css`;
    if (await adapter.read(path) !== theme.raw) throw new Error(this.t("themeDeleteStale"));
    if (!await adapter.exists(bin)) await adapter.mkdir(bin);
    await adapter.rename(path, deletedPath);
    this.deletedTemplate = { theme, path, deletedPath };
    this.templates.delete(id);
    this.onChange();
  }

  async restoreTemplate(deletedPath = this.deletedTemplate?.deletedPath) {
    const files = await this.deletedThemeFiles();
    const id = deletedPath?.split("/").at(-1)?.match(/^\d+-(.+)\.css$/)?.[1];
    if (!files.includes(deletedPath) || !id || !TEMPLATE_NAME.test(id)) throw new Error(this.t("noThemeToRestore"));
    const adapter = this.app.vault.adapter;
    const theme = this.themeRecord(id, await adapter.read(deletedPath));
    const path = `${this.templateFolder}/${id}.css`;
    if (this.templateId(theme.id) || this.templateId(theme.label) || await adapter.exists(path)) {
      throw new Error(this.t("duplicateTheme"));
    }
    await adapter.rename(deletedPath, path);
    this.templates.set(theme.id, theme);
    if (this.deletedTemplate?.deletedPath === deletedPath) this.deletedTemplate = null;
    this.onChange();
    return theme.id;
  }

  async deletedThemeFiles() {
    const { adapter } = this.app.vault;
    const folder = `${this.templateFolder}/.deleted`;
    if (!await adapter.exists(folder)) return [];
    return (await adapter.list(folder)).files.filter(path => path.endsWith(".css"));
  }


  async clearDeletedFiles(paths) {
    const adapter = this.app.vault.adapter;
    for (const path of paths) {
      if (await adapter.exists(path)) await adapter.remove(path);
      if (this.deletedTemplate?.deletedPath === path) this.deletedTemplate = null;
    }
  }
}

module.exports = { ThemeLibrary };
