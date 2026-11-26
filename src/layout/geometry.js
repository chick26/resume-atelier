const { appearanceFor, savedAppearance, applyAppearance } = require("./appearance");
const PAPER_SIZES = { A4: { width: 210, height: 297 }, Letter: { width: 215.9, height: 279.4 } };
function paperSize(layout) {
  return PAPER_SIZES[layout.paper] ?? PAPER_SIZES.A4;
}
const PX_PER_MM = 96 / 25.4;
const BASE_TEMPLATE = "LapisCV";
const DENSITIES = {
  comfortable: { lineHeight: { en: 1.48, zh: 1.6 } },
  standard: { lineHeight: { en: 1.37, zh: 1.48 } },
  compact: { lineHeight: { en: 1.29, zh: 1.38 } },
};
const ZOOM_OPTIONS = { page: "fitPageZoom", width: "fitWidthZoom", actual: "actualZoom" };
const MARGIN_PAIRS = { top: "bottom", bottom: "top", left: "right", right: "left" };
const MARGINS = [
  { key: "top", min: 5, max: 30, step: 0.5, unit: "mm" },
  { key: "bottom", min: 5, max: 30, step: 0.5, unit: "mm" },
  { key: "left", min: 5, max: 30, step: 0.5, unit: "mm" },
  { key: "right", min: 5, max: 30, step: 0.5, unit: "mm" },
];
const TYPOGRAPHY = [
  { key: "fontSize", min: 8, max: 12, step: 0.05, unit: "pt" },
  { key: "lineHeight", min: 1.15, max: 1.8, step: 0.01, unit: "" },
];
const FIELDS = [...MARGINS, ...TYPOGRAPHY];

function layoutFor(classes, saved) {
  const language = classes.includes("lapis-cv-zh") ? "zh" : "en";
  const density = Object.hasOwn(DENSITIES, saved?.density) ? saved.density : "standard";
  const defaults = {
    top: 10,
    bottom: 10,
    left: 13.5,
    right: 13.5,
    fontSize: language === "zh" ? 8.85 : 9.05,
    lineHeight: DENSITIES[density].lineHeight[language],
    density,
    template: saved?.template ?? BASE_TEMPLATE,
    paper: saved?.paper === "Letter" ? "Letter" : "A4",
    sections: saved?.sections ?? {},
    appearance: appearanceFor(saved?.appearance),
  };

  for (const { key, min, max } of FIELDS) {
    if (Number.isFinite(saved?.[key])) {
      defaults[key] = Math.min(max, Math.max(min, saved[key]));
    }
  }
  return defaults;
}

function dimensions(layout) {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, layout[key]]));
}

function geometryForSave(layout, previous) {
  const geometry = { ...previous, ...dimensions(layout), paper: layout.paper };
  const appearance = savedAppearance(layout.appearance, previous?.appearance);
  if (Object.keys(appearance).length) geometry.appearance = appearance;
  else delete geometry.appearance;
  return geometry;
}

function layoutMetadata(frontmatter) {
  const template = typeof frontmatter.resume_style === "string" ? frontmatter.resume_style.trim() : "";
  const density = Object.hasOwn(DENSITIES, frontmatter.resume_density) ? frontmatter.resume_density : "";
  const value = frontmatter.resume_layout;
  const geometry = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  const stored = !!template && !!density && FIELDS.every(({ key }) => Number.isFinite(geometry?.[key]));
  const rules = frontmatter.resume_sections;
  const sections = rules && typeof rules === "object" && !Array.isArray(rules) ? rules : {};
  return { template, density, geometry, sections, stored };
}

function noteLayoutKey({ template, density, geometry, sections }) {
  return JSON.stringify([template, density, geometry?.paper ?? "A4", sections ?? {}, appearanceFor(geometry?.appearance), ...FIELDS.map(({ key }) => geometry?.[key] ?? null)]);
}

function sameLayout(left, right) {
  return left?.template === right?.template && left?.density === right?.density
    && left?.paper === right?.paper && JSON.stringify(left?.sections) === JSON.stringify(right?.sections)
    && JSON.stringify(appearanceFor(left?.appearance)) === JSON.stringify(appearanceFor(right?.appearance))
    && FIELDS.every(({ key }) => left?.[key] === right?.[key]);
}

function applyTypography(element, layout) {
  applyAppearance(element, layout.appearance);
  element.style.setProperty("--text-size", `${layout.fontSize}pt`);
  element.style.setProperty("--line-height", String(layout.lineHeight));
  element.dataset.resumeDensity = layout.density;
}

function applyMargins(element, layout) {
  const paper = paperSize(layout);
  element.style.setProperty("--resume-paper-width", `${paper.width}mm`);
  element.style.setProperty("--resume-paper-height", `${paper.height}mm`);
  for (const { key } of MARGINS) element.style.setProperty(`--resume-margin-${key}`, `${layout[key]}mm`);
}


module.exports = { PAPER_SIZES, paperSize, PX_PER_MM, BASE_TEMPLATE, DENSITIES, ZOOM_OPTIONS, MARGIN_PAIRS, MARGINS, TYPOGRAPHY, FIELDS, layoutFor, dimensions, geometryForSave, layoutMetadata, noteLayoutKey, sameLayout, applyTypography, applyMargins };
