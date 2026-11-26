const PHOTO_RATIOS = { "1:1": 1, "3:4": 4 / 3, "4:5": 1.25 };
const PHOTO_CORNERS = { square: "0", rounded: "2mm", round: "50%" };
const GAP_LIMITS = { sectionGap: 12, listGap: 4 };
const APPEARANCE_KEYS = ["accent", ...Object.keys(GAP_LIMITS), "avatarRatio", "avatarShape", "avatarPosition"];

function appearanceFor(value = {}) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  if (typeof value.accent === "string" && /^#[a-f\d]{6}$/i.test(value.accent)) result.accent = value.accent.toLowerCase();
  for (const [key, max] of Object.entries(GAP_LIMITS)) {
    if (Number.isFinite(value[key])) result[key] = Math.max(0, Math.min(max, value[key]));
  }
  if (Object.hasOwn(PHOTO_RATIOS, value.avatarRatio)) result.avatarRatio = value.avatarRatio;
  if (Object.hasOwn(PHOTO_CORNERS, value.avatarShape)) result.avatarShape = value.avatarShape;
  if (value.avatarPosition === "sidebar") result.avatarPosition = "sidebar";
  return result;
}

function savedAppearance(current, previous) {
  const result = previous && typeof previous === "object" && !Array.isArray(previous) ? { ...previous } : {};
  for (const key of APPEARANCE_KEYS) delete result[key];
  return Object.assign(result, appearanceFor(current));
}

function applyAppearance(root, values = {}) {
  const overrides = {
    "--color-accent": values.accent,
    "--resume-heading-top": values.sectionGap == null ? null : `${values.sectionGap}mm`,
    "--resume-list-gap": values.listGap == null ? null : `${values.listGap}mm`,
    "--resume-avatar-height-factor": PHOTO_RATIOS[values.avatarRatio],
    "--resume-avatar-radius": PHOTO_CORNERS[values.avatarShape],
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) root.style.removeProperty(key);
    else root.style.setProperty(key, String(value));
  }
  root.classList.toggle("resume-portrait-ratio", !!values.avatarRatio && values.avatarRatio !== "1:1");
}

module.exports = { PHOTO_RATIOS, PHOTO_CORNERS, GAP_LIMITS, appearanceFor, savedAppearance, applyAppearance };
