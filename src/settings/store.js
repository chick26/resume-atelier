const { Notice } = require("obsidian");
const { BASE_TEMPLATE, DENSITIES } = require("../layout/geometry");

const DRAFT_FOLDER = "resumes/drafts";
const DEFAULT_SETTINGS = {
  defaultTemplate: BASE_TEMPLATE,
  defaultDensity: "standard",
  autoSaveLayout: true,
  draftLocationMode: "alongside",
  draftFolder: DRAFT_FOLDER,
  protectedFolders: [],
};

class SettingsStore {
  constructor(data, saveData, t) {
    this.t = t;
    this.saveData = saveData;
    this.settings = { ...DEFAULT_SETTINGS, ...data?.settings };
    delete this.settings.interfaceLanguage;
    if (!Object.hasOwn(DENSITIES, this.settings.defaultDensity)) this.settings.defaultDensity = DEFAULT_SETTINGS.defaultDensity;
    if (!Array.isArray(this.settings.protectedFolders)) this.settings.protectedFolders = [];
    this.layouts = new Map(Object.entries(data?.layouts ?? {}));
    this.lastPath = data?.lastPath;
    this.saveQueue = Promise.resolve();
  }

  rememberFile(path) {
    if (this.lastPath === path) return;
    this.lastPath = path;
    this.saveSettings();
  }

  saveLocalLayout(path, layout) {
    this.layouts.set(path, { ...layout, preview: true });
    this.saveSettings();
  }

  saveSettings() {
    this.saveQueue = this.saveQueue.then(() => this.saveData({
      settings: this.settings,
      layouts: Object.fromEntries(this.layouts),
      lastPath: this.lastPath,
    })).catch((error) => {
      new Notice(this.t("settingsSaveFailed"));
      console.error("CareerOS resume layout settings failed to save", error);
    });
    return this.saveQueue;
  }

  moveLayouts(newPath, oldPath) {
    const move = (path) => path === oldPath || path?.startsWith(`${oldPath}/`)
      ? newPath + path.slice(oldPath.length)
      : path;
    let changed = false;
    for (const [path, layout] of [...this.layouts]) {
      const destination = move(path);
      if (destination === path) continue;
      this.layouts.delete(path);
      this.layouts.set(destination, layout);
      changed = true;
    }
    const lastPath = move(this.lastPath);
    if (lastPath !== this.lastPath) {
      this.lastPath = lastPath;
      changed = true;
    }
    if (changed) this.saveSettings();
  }

  removeLayouts(folderOrFile) {
    const removed = (path) => path === folderOrFile || path?.startsWith(`${folderOrFile}/`);
    let changed = false;
    for (const path of this.layouts.keys()) {
      if (!removed(path)) continue;
      this.layouts.delete(path);
      changed = true;
    }
    if (removed(this.lastPath)) {
      this.lastPath = undefined;
      changed = true;
    }
    if (changed) this.saveSettings();
  }
}

module.exports = { SettingsStore, DRAFT_FOLDER };
