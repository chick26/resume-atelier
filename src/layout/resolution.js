const { BASE_TEMPLATE, layoutFor } = require("./geometry");

class ResumeLayouts {
  constructor(state, themes) {
    this.state = state;
    this.themes = themes;
  }

  noteLayout(resume) {
    return layoutFor(resume.classes, {
      ...resume.geometry,
      density: resume.density || (resume.template === "紧凑" ? "compact" : this.state.settings.defaultDensity),
      template: this.themes.templateId(resume.template) ?? this.themes.templateId(this.state.settings.defaultTemplate) ?? BASE_TEMPLATE,
    });
  }

  previewLayout(resume) {
    const canonical = this.noteLayout(resume);
    const saved = this.state.layouts.get(resume.file.path);
    if (!saved) return canonical;
    if (resume.protected && saved.preview) {
      return layoutFor(resume.classes, {
        ...canonical, ...saved, template: this.themes.templateId(saved.template) ?? canonical.template,
      });
    }
    const values = resume.geometry || resume.density ? canonical : { ...canonical, ...saved };
    return layoutFor(resume.classes, {
      ...values,
      density: resume.density || (resume.template === "紧凑" || (!resume.template && saved.template === "紧凑") ? "compact" : canonical.density),
      template: resume.template ? canonical.template : this.themes.templateId(saved.template) ?? canonical.template,
    });
  }
}

module.exports = { ResumeLayouts };
