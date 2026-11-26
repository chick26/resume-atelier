const { normalizePath } = require("obsidian");
const { dimensions, layoutMetadata, noteLayoutKey } = require("../layout/geometry");
const { DRAFT_FOLDER } = require("../settings/store");
const { sourceText, sourceParts, editableBody, withEditedBody } = require("./markdown");

function vaultFolder(value, t) {
  const trimmed = value.trim().replace(/^[/\\]+|[/\\]+$/g, "");
  if (!trimmed) return "";
  if (trimmed.split(/[/\\]/).includes("..")) throw new Error(t("vaultFolderRequired"));
  return normalizePath(trimmed);
}


class ResumeFiles {
  constructor(app, catalog, state, t, exampleMarkdown, onLayoutChange) {
    this.app = app;
    this.catalog = catalog;
    this.state = state;
    this.t = t;
    this.exampleMarkdown = exampleMarkdown;
    this.onLayoutChange = onLayoutChange;
  }

  async draftPath(file, name) {
    const { vault } = this.app;
    const folder = this.state.settings.draftLocationMode === "folder"
      ? vaultFolder(this.state.settings.draftFolder || DRAFT_FOLDER, this.t)
      : file?.parent?.path;
    if (!folder || folder === "/") return vault.getAvailablePath(name, "md");
    if (!vault.getAbstractFileByPath(folder)) {
      try {
        await vault.createFolder(folder);
      } catch (error) {
        if (!vault.getAbstractFileByPath(folder)) throw error;
      }
    }
    return vault.getAvailablePath(`${folder}/${name}`, "md");
  }

  async createExampleResume() {
    const path = await this.draftPath(null, this.t("sampleResume"));
    return this.app.vault.create(path, this.exampleMarkdown);
  }

  async copyForEditing(resume, layout, body) {
    if (body === undefined) {
      const source = resume.source ?? resume.file;
      if (resume.sourceLink && !resume.source) throw new Error(this.t("missingMasterSource"));
      body = sourceParts(await this.app.vault.read(source)).body;
    }
    const title = resume.label.replace(/[\\/:*?"<>|]/g, " ").trim().slice(0, 90) || this.t("resume");
    const path = await this.draftPath(resume.file, this.t("draftName", { name: title }));
    const zh = resume.classes.includes("lapis-cv-zh");
    const meta = [
      "---",
      "type: resume-draft",
      `language: ${zh ? "zh" : "en"}`,
      `resume_style: ${JSON.stringify(layout.template)}`,
      `resume_density: ${layout.density}`,
      "resume_layout:",
      ...Object.entries(dimensions(layout)).map(([key, value]) => `  ${key}: ${value}`),
      `draft_source: ${JSON.stringify(`[[${resume.file.path}]]`)}`,
      "cssclasses: [lapis-cv, careeros-resume" + (zh ? ", lapis-cv-zh]" : "]"),
      "---",
      "",
      "",
    ].join("\n");
    return this.app.vault.create(path, meta + body);
  }

  async writeNoteLayout(file, expected, layout) {
    const resume = this.catalog.resume(file, true);
    if (!resume || this.catalog.isProtected(resume) || this.app.vault.getAbstractFileByPath(file.path) !== file) {
      throw new Error(this.t("editableLayoutRequired"));
    }
    this.assertEditorInSync(file, await this.app.vault.read(file));
    await this.app.fileManager.processFrontMatter(file, properties => {
      if (noteLayoutKey(layoutMetadata(properties)) !== expected) {
        throw new Error(this.t("noteLayoutChanged"));
      }
      properties.resume_style = layout.template;
      properties.resume_density = layout.density;
      properties.resume_layout = dimensions(layout);
    });
    if (this.state.layouts.delete(file.path)) this.state.saveSettings();
    this.onLayoutChange();
  }

  async processResumeContent(file, transform) {
    const resume = this.catalog.resume(file, true);
    if (!resume || this.catalog.isProtected(resume) || this.app.vault.getAbstractFileByPath(file.path) !== file) {
      throw new Error(this.t("editableResumeRequired"));
    }
    return this.app.vault.process(file, current => {
      this.assertEditorInSync(file, current);
      return transform(current);
    });
  }

  async writeContent(file, before, after) {
    return this.processResumeContent(file, current => {
      if (current !== before) throw new Error(this.t("fileUpdated"));
      return after;
    });
  }

  async writeSourceBody(file, before, after) {
    return this.processResumeContent(file, current => {
      const body = editableBody(current);
      if (body === after) return current;
      if (body !== before) {
        const error = new Error(this.t("sourceConflict"));
        error.code = "CONFLICT";
        throw error;
      }
      const next = withEditedBody(current, after);
      if (!sourceParts(current).hasYaml && sourceParts(next).hasYaml) {
        throw new Error(this.t("yamlRequired"));
      }
      return next;
    });
  }

  assertEditorInSync(file, source) {
    const expected = sourceText(source);
    const hasPendingEdit = this.app.workspace.getLeavesOfType("markdown").some(({ view }) =>
      view.file === file && view.getMode() === "source" && sourceText(view.editor.getValue()) !== expected,
    );
    if (hasPendingEdit) throw new Error(this.t("sourceBusy"));
  }
}

module.exports = { ResumeFiles, vaultFolder };
