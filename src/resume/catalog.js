const { RESUME_CLASS } = require("../identity");
const { layoutMetadata } = require("../layout/geometry");
const { guessChinese } = require("./markdown");

const PROTECTED_APPLICATION_STATES = new Set(["ready", "applied", "interviewing", "offer", "rejected", "withdrawn", "closed"]);

class ResumeCatalog {
  constructor(app, settings, t, uiLanguage) {
    this.app = app;
    this.settings = settings;
    this.t = t;
    this.uiLanguage = uiLanguage;
    this.detectedLanguages = new WeakMap();
  }

  resume(file, allowAny = false, properties) {
    if (file?.extension !== "md") return null;
    const frontmatter = properties ?? this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const declaredClasses = [frontmatter?.cssclasses].flat().filter((entry) => typeof entry === "string")
      .flatMap((entry) => entry.split(/[\s,]+/)).filter(Boolean);
    const classes = [...declaredClasses];
    const metadata = layoutMetadata(frontmatter);
    const master = classes.includes("lapis-cv-master") || frontmatter.type === "master-resume";
    const markedResume = classes.includes("lapis-cv") && classes.includes(RESUME_CLASS);
    const recognized = markedResume || !!(metadata.template || metadata.geometry || metadata.density || Object.keys(metadata.sections).length)
      || master || ["resume-draft", "tailored-resume"].includes(frontmatter.type);
    if (!recognized && !allowAny) return null;
    for (const required of ["lapis-cv", RESUME_CLASS]) {
      if (!classes.includes(required)) classes.push(required);
    }
    const explicitLanguage = classes.includes("lapis-cv-zh") || !!frontmatter.language;
    if ((frontmatter.language === "zh" || (!explicitLanguage && this.detectedLanguages.get(file)))
      && !classes.includes("lapis-cv-zh")) classes.push("lapis-cv-zh");
    if (master && !classes.includes("lapis-cv-master")) classes.push("lapis-cv-master");
    const chinese = classes.includes("lapis-cv-zh");
    const job = this.linkedFile(frontmatter.job, file.path);
    const jobProperties = job && this.app.metadataCache.getFileCache(job)?.frontmatter;
    const title = jobProperties?.title;
    const label = master ? this.t(chinese ? "zhMaster" : "enMaster")
      : frontmatter.type === "tailored-resume"
        ? this.t(chinese ? "zhTailored" : "enTailored", { title: title || file.parent?.name || file.basename })
      : file.basename;
    const source = master ? this.linkedFile(frontmatter.source, file.path) : null;
    return {
      file, classes, declaredClasses, label, master, source, explicitLanguage, recognized, ...metadata,
      sourceLink: master && frontmatter.source, explicitProtection: frontmatter.resume_protected === true,
      stale: frontmatter.stale === true, status: frontmatter.status, company: jobProperties?.company,
    };
  }

  resumeForContent(resume, body) {
    if (!resume.explicitLanguage) {
      this.detectedLanguages.set(resume.file, guessChinese(body));
      return this.resume(resume.file, true);
    }
    return resume;
  }

  linkedFile(value, originPath) {
    const path = typeof value === "string" && value.match(/^\[\[([^|#\]]+)/)?.[1];
    return path ? this.app.metadataCache.getFirstLinkpathDest(path, originPath) : null;
  }

  resumeForNote(file) {
    if (file?.extension !== "md") return null;
    const direct = this.resume(file);
    if (direct) return direct;

    const properties = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (properties?.type === "application") {
      return this.resume(this.linkedFile(properties.resume, file.path));
    }
    const masters = this.resumes().filter(resume => resume.source === file);
    return masters.length === 1 ? masters[0] : null;
  }

  resumes(all = false) {
    return this.app.vault.getMarkdownFiles().map((file) => this.resume(file, all)).filter(Boolean)
      .sort((a, b) => Number(b.master) - Number(a.master) || a.label.localeCompare(b.label, this.uiLanguage));
  }

  protectionReason(resume) {
    if (resume.master) return "master";
    if (resume.explicitProtection || resume.status === "source-preserved"
      || this.settings.protectedFolders.some(folder => resume.file.path.startsWith(`${folder}/`))) return "protected";
    const frozen = this.app.vault.getMarkdownFiles().some(file => {
      const properties = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (properties?.type !== "application") return false;
      if ([properties.frozen_resume_markdown, properties.submitted_resume]
        .some(link => this.linkedFile(link, file.path) === resume.file)) return true;
      return PROTECTED_APPLICATION_STATES.has(properties.status)
        && this.linkedFile(properties.resume, file.path) === resume.file;
    });
    return frozen ? "frozen" : null;
  }

  isProtected(resume) {
    return !!this.protectionReason(resume);
  }
}

module.exports = { ResumeCatalog };
