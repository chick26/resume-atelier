const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const manifest = require("../manifest.json");
const { layoutFor, dimensions, layoutMetadata, noteLayoutKey } = require("../src/layout/geometry");
const root = path.join(__dirname, "..");
const bundle = readFileSync(path.join(root, "main.js"), "utf8");

class FileView {
  constructor(leaf) {
    this.app = leaf.app;
    this.leaf = leaf;
  }

  async setState(state) {
    this.restoredState = state;
  }
}

class MarkdownView {}

function frontMatterInfo(markdown) {
  const prefix = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0];
  return { exists: !!prefix, contentStart: prefix?.length ?? 0 };
}

async function loadPlugin({ language = "en", data, notes = new Map() } = {}) {
  const sandbox = {
    module: {},
    require(name) {
      assert.equal(name, "obsidian");
      return {
        FileView, MarkdownView, getFrontMatterInfo: frontMatterInfo,
        stringifyYaml: JSON.stringify,
        getLanguage: () => language, normalizePath: value => value,
        Plugin: class {}, PluginSettingTab: class {}, FuzzySuggestModal: class {},
        Modal: class {}, Notice: class {},
      };
    },
  };
  vm.runInNewContext(bundle, sandbox, { filename: "main.js" });
  const Plugin = sandbox.module.exports;
  const plugin = new Plugin();
  const writes = [];
  const persisted = [];
  const workspace = {
    on() {},
    onLayoutReady() {},
    getLeavesOfType: () => [],
  };
  const metadataCache = {
    on() {},
    getFileCache(file) {
      return { frontmatter: file.properties };
    },
    getFirstLinkpathDest(value) {
      return notes.get(value) ?? notes.get(value + ".md");
    },
  };
  const vault = {
    configDir: ".obsidian",
    adapter: { async exists() { return false; } },
    on() {},
    getMarkdownFiles: () => [...notes.values()],
    getAbstractFileByPath: value => notes.get(value),
    getAvailablePath: (name, extension) => name + "." + extension,
    async create(filePath, contents) {
      writes.push({ filePath, contents });
      return { path: filePath };
    },
    async read(file) {
      return file.contents;
    },
    async process(file, transform) {
      file.contents = transform(file.contents);
      return file.contents;
    },
  };
  let viewFactory;
  let command;
  Object.assign(plugin, {
    manifest,
    app: { workspace, metadataCache, vault, fileManager: {
      async processFrontMatter(file, update) { update(file.properties); },
    } },
    loadData: async () => data,
    saveData: async value => { persisted.push(structuredClone(value)); },
    registerView(type, factory) {
      assert.equal(type, manifest.id);
      viewFactory = factory;
    },
    addCommand(value) { command = value; },
    addSettingTab() {},
    registerEvent() {},
    registerMarkdownPostProcessor() {},
  });
  await plugin.onload();
  return { plugin, viewFactory, command, writes, persisted, workspace, vault };
}

function note(filePath, properties, contents = "") {
  return { path: filePath, extension: "md", basename: path.basename(filePath, ".md"), properties, contents };
}

test("the bundled plugin registers its view and restores the old file state", async () => {
  const data = { lastPath: "Resumes/Draft.md", settings: { defaultDensity: "comfortable" } };
  const { plugin, viewFactory, command } = await loadPlugin({ data });
  assert.equal(command.id, "open");
  assert.equal(plugin.settings.defaultDensity, "comfortable");
  const view = viewFactory({ app: plugin.app });
  assert.equal(view.getViewType(), manifest.id);
  assert.equal(view.getDisplayText(), "Resume Atelier");
  await view.setState({});
  assert.equal(view.restoredState.file, data.lastPath);
});

test("the sample notes used by the UI come from the downloadable Markdown files", async () => {
  for (const [language, title, commandName] of [
    ["en", "Sample Resume", "Open workbench"],
    ["zh", "示例简历", "打开工作台"],
  ]) {
    const { plugin, command, writes } = await loadPlugin({ language });
    assert.equal(command.name, commandName);
    await plugin.files.createExampleResume();
    assert.equal(writes[0].filePath, title + ".md");
    assert.equal(writes[0].contents, readFileSync(path.join(root, "examples", `sample-resume.${language}.md`), "utf8"));
    assert.match(writes[0].contents, /^### .+ · .+ \| .+$/m);
  }
});

test("older settings, local layouts and the recent note survive a folder rename", async () => {
  const data = {
    settings: { autoSaveLayout: false, defaultTemplate: "黑白 ATS", interfaceLanguage: "zh" },
    layouts: { "Resumes/Draft.md": { preview: true, template: "紧凑", top: 15 } },
    lastPath: "Resumes/Draft.md",
  };
  const { plugin, persisted } = await loadPlugin({ data });
  assert.equal(plugin.t("pluginName"), "Resume Atelier");
  plugin.state.moveLayouts("Archive", "Resumes");
  await plugin.state.saveQueue;
  assert.equal(persisted[0].lastPath, "Archive/Draft.md");
  assert.deepEqual(persisted[0].layouts, { "Archive/Draft.md": data.layouts["Resumes/Draft.md"] });
  assert.equal(persisted[0].settings.autoSaveLayout, false);
  assert.equal(persisted[0].settings.defaultTemplate, "黑白 ATS");
  assert.equal(Object.hasOwn(persisted[0].settings, "interfaceLanguage"), false);
});

test("saved metadata keeps the layout identity and clamps geometry", async () => {
  const stored = { resume_style: "黑白 ATS", resume_density: "compact",
    resume_layout: { top: 40, bottom: 12, left: 4, right: 11, fontSize: 9, lineHeight: 1.4 } };
  const meta = layoutMetadata(stored);
  const file = note("Resume.md", { type: "resume-draft", ...stored, language: "zh" });
  const { plugin } = await loadPlugin();
  const layout = plugin.layouts.noteLayout(plugin.catalog.resume(file));
  assert.equal(meta.stored, true);
  assert.equal(layout.template, "黑白 ATS");
  assert.equal(layout.density, "compact");
  assert.equal(layout.top, 30);
  assert.equal(layout.left, 5);
  assert.notEqual(noteLayoutKey(meta),
    noteLayoutKey({ template: layout.template, density: layout.density, geometry: dimensions(layout) }));
  assert.notEqual(layoutFor([], {}).lineHeight, layoutFor(["lapis-cv-zh"], {}).lineHeight);
});

test("atomic source edits preserve the YAML and reject concurrent edits", async () => {
  const yaml = "\ufeff---\r\ntype: resume-draft\r\ncustom: keep\r\n---\r\n";
  const before = "## Experience\n- Original\n";
  const after = "## Experience\n- Updated\n";
  const file = note("Resume.md", { type: "resume-draft" }, yaml + before.replaceAll("\n", "\r\n"));
  const { plugin } = await loadPlugin({ notes: new Map([[file.path, file]]) });
  await plugin.files.writeSourceBody(file, before, after);
  assert.equal(file.contents, yaml + after.replaceAll("\n", "\r\n"));
  await assert.rejects(plugin.files.writeSourceBody(file, before, "Lost update"), { code: "CONFLICT" });
  assert.equal(file.contents, yaml + after.replaceAll("\n", "\r\n"));
});

test("layout save, undo and editable copies preserve paper, section rules and geometry extensions", async () => {
  const body = "# Example\n\n## Skills\n- Writing\n";
  const rules = { Skills: { region: "sidebar", display: "tags", future: ["keep"] }, Honors: { hidden: true } };
  const initial = { type: "resume-draft", custom: "untouched",
    resume_layout: { top: 10, paper: "Letter", future: { spacing: 2 } }, resume_sections: rules };
  const file = note("Source.md", structuredClone(initial), body);
  const { plugin, writes } = await loadPlugin({ notes: new Map([[file.path, file]]) });
  plugin.files.onLayoutChange = () => {};
  const selected = () => plugin.catalog.resume(file);
  const readLayout = () => plugin.layouts.noteLayout(selected());
  const original = readLayout();
  assert.equal(original.paper, "Letter");
  const expected = noteLayoutKey(selected());
  await plugin.files.writeNoteLayout(file, expected, { ...original, left: 17 });
  assert.equal(file.properties.resume_layout.left, 17);
  assert.equal(file.properties.resume_layout.paper, "Letter");
  assert.deepEqual(file.properties.resume_sections, rules);
  assert.deepEqual(file.properties.resume_layout.future, { spacing: 2 });
  await plugin.files.writeNoteLayout(file, noteLayoutKey(selected()), original);
  assert.equal(file.properties.resume_layout.left, original.left);
  assert.equal(file.properties.custom, "untouched");
  const beforeExternal = noteLayoutKey(selected());
  file.properties.resume_sections = { ...rules, Honors: { hidden: false } };
  await assert.rejects(plugin.files.writeNoteLayout(file, beforeExternal, original));
  assert.equal(file.properties.resume_sections.Honors.hidden, false);
  file.properties.resume_protected = true;
  await assert.rejects(plugin.files.writeNoteLayout(file, noteLayoutKey(selected()), original));
  await plugin.files.copyForEditing(selected(), readLayout());
  const contents = writes[0].contents;
  const end = contents.indexOf("\n---\n", 4);
  const copy = JSON.parse(contents.slice(4, end));
  assert.equal(contents.slice(end + 5), body);
  assert.deepEqual(copy.resume_sections, file.properties.resume_sections);
  assert.deepEqual(copy.resume_layout, structuredClone(file.properties.resume_layout));
  assert.equal(copy.type, "resume-draft");
  assert.equal(copy.draft_source, "[[Source.md]]");
  assert.equal(copy.resume_protected, undefined);
  assert.equal(file.contents, body);
});

test("an application with frozen materials protects the linked resume", async () => {
  const resume = note("Draft.md", { type: "resume-draft" }, "# Keep this draft");
  const application = note("Application.md", { type: "application", status: "ready", resume: "[[Draft]]" });
  const { plugin } = await loadPlugin({ notes: new Map([[resume.path, resume], [application.path, application]]) });
  const selected = plugin.catalog.resumeForNote(application);
  assert.equal(selected.file, resume);
  assert.equal(plugin.catalog.protectionReason(selected), "frozen");
  await assert.rejects(plugin.files.writeSourceBody(resume, resume.contents, "Changed"), /editable resume/);
  assert.equal(resume.contents, "# Keep this draft");
});

test("native PDF export uses A4 and restores the vault preferences on error", async () => {
  const file = note("Draft.md", { type: "resume-draft" });
  const { plugin, vault, workspace } = await loadPlugin({ notes: new Map([[file.path, file]]) });
  const original = { includeName: true, pageSize: "Letter", landscape: true };
  let config = original;
  vault.getConfig = () => config;
  vault.setConfig = (_, value) => { config = value; };
  const view = new MarkdownView();
  view.file = file;
  view.printToPdf = () => {
    assert.equal(config.pageSize, "A4");
    assert.equal(config.landscape, false);
    throw new Error("Unavailable exporter");
  };
  workspace.getLeavesOfType = () => [{ view, getViewState: () => ({ state: { file: file.path } }) }];
  const studio = { view: { file } };
  await assert.rejects(plugin.presentation.openNativeExport(file, studio, layoutFor([], {})), /Unavailable exporter/);
  assert.equal(config, original);
  assert.equal(plugin.presentation.printRequest, null);
});

test("margin handles measure the displayed paper at both zooms and preserve locks, cancellation and undo", async () => {
  const { plugin, viewFactory } = await loadPlugin();
  const file = note("Draft.md", { type: "resume-draft" });
  const view = viewFactory({ app: plugin.app });
  const panel = view.layout;
  view.selected = { file, classes: [], recognized: true };
  panel.update = () => {};
  const saves = [];
  panel.queueLayoutSave = target => saves.push(target);
  const handles = new Map();
  let width;
  view.preview.paper = { getBoundingClientRect: () => ({ width }) };
  view.preview.guide = { createSpan({ cls }) {
    const events = new Map();
    handles.set(cls.split("is-")[1], events);
    return { style: { setProperty() {} }, addClass() {}, removeClass() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height: 10 }),
      setPointerCapture() {}, hasPointerCapture: () => false,
      addEventListener: (name, callback) => events.set(name, callback) };
  } };
  panel.mountMarginHandles();
  for (const zoom of [1, 0.6]) {
    width = 210 * 96 / 25.4 * zoom;
    for (const [side, opposite] of [["top", "bottom"], ["bottom", "top"], ["left", "right"], ["right", "left"]]) {
      panel.current = layoutFor([], {});
      panel.savedLayout = panel.lastCommittedLayout = { ...panel.current };
      panel.alignLocks();
      const before = panel.current[side];
      const delta = (side === "right" || side === "bottom" ? -1 : 1) * 4 * width / 210;
      const fire = (name, offset) => handles.get(side).get(name)({
        button: 0, pointerId: 1, clientX: 80 + offset, clientY: 80 + offset, preventDefault() {},
      });
      fire("pointerdown", 0);
      fire("pointermove", delta);
      assert.equal(panel.current[side], before + 4, side);
      assert.equal(panel.current[opposite], before + 4, opposite);
      fire("pointercancel", delta);
      assert.equal(panel.current[side], before);
      assert.equal(saves.length, 0);
      fire("pointerdown", 0);
      fire("pointermove", delta);
      fire("pointerup", delta);
      assert.equal(saves.pop(), file);
      panel.undoLayoutChange();
      assert.equal(panel.current[side], before);
      assert.equal(saves.pop(), file);
    }
  }
});
