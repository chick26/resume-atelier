const { BASE_TEMPLATE } = require("../layout/geometry");
const TIMELINE_TEMPLATE = "时间轴";

const THEME_LABELS = { [BASE_TEMPLATE]: "经典衬线", "黑白 ATS": "黑白简约（ATS 友好）" };
const BUILT_IN_THEME_MESSAGES = {
  [BASE_TEMPLATE]: "themeClassic",
  "简洁蓝": "themeBlue",
  "现代无衬线": "themeSans",
  "黑白 ATS": "themeAts",
  [TIMELINE_TEMPLATE]: "themeTimeline",
};

const BUILT_IN_TEMPLATE_CSS = {
  [BASE_TEMPLATE]: "",
  [TIMELINE_TEMPLATE]: `:scope {
  --resume-structure: timeline;
  --timeline-date-width: 24mm;
  --title-font: var(--resume-sans-font);
  --color-accent: #3d5968;
}`,
  "简洁蓝": `:scope {
  --color-accent: #254f78;
  --h2-color: var(--color-accent);
  --border-color: #a8bed2;
}

h1 {
  letter-spacing: 0.015em;
}

h2 {
  letter-spacing: 0.055em;
  border-bottom-width: 1pt;
}
`,
  "现代无衬线": `:scope {
  --title-font: var(--resume-sans-font);
  --text-font: var(--resume-sans-font);
  --color-accent: #245269;
  --border-color: #afc5ce;
}

h1,
h2 {
  letter-spacing: 0.025em;
}
`,
  "黑白 ATS": `:scope {
  --title-font: var(--resume-sans-font);
  --text-font: var(--resume-sans-font);
  --color-accent: #202020;
  --text-strong: #161616;
  --text-normal: #202020;
  --text-muted: #3d3d3d;
  --border-color: #8a8a8a;
}

.resume-layout-icon,
.icon,
span[alt="icon"] {
  display: none !important;
}
`,
};
const BUILT_IN_TEMPLATES = Object.keys(BUILT_IN_TEMPLATE_CSS);

module.exports = { BUILT_IN_TEMPLATE_CSS, BUILT_IN_TEMPLATES, THEME_LABELS, BUILT_IN_THEME_MESSAGES };
