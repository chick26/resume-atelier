const { BASE_TEMPLATE } = require("../layout/geometry");
const TIMELINE_TEMPLATE = "时间轴";

const THEME_LABELS = { [BASE_TEMPLATE]: "经典衬线", "黑白 ATS": "黑白简约（ATS 友好）" };
const BUILT_IN_THEME_MESSAGES = {
  [BASE_TEMPLATE]: "themeClassic",
  "简洁蓝": "themeBlue",
  "现代无衬线": "themeSans",
  "日期靠右": "themeRightAlignedDates",
  "黑白 ATS": "themeAts",
  [TIMELINE_TEMPLATE]: "themeTimeline",
};

const MODERN_TYPOGRAPHY_CSS = `:scope {
  --title-font: var(--resume-sans-font);
  --text-font: var(--resume-sans-font);
  --color-accent: #23476b;
  --border-color: color-mix(in srgb, var(--color-accent), transparent 48%);
}

h1, h2 {
  letter-spacing: 0.025em;
}

h3.resume-entry-heading a {
  font-size: inherit;
}

a {
  text-decoration: underline;
  text-decoration-thickness: 0.45pt;
  text-underline-offset: 0.13em;
  text-decoration-color: color-mix(in srgb, var(--color-accent), transparent 45%);
}
`;

const MODERN_CSS = `${MODERN_TYPOGRAPHY_CSS}
h3.resume-entry-heading:has(> .entry-date) {
  flex-flow: column nowrap;
  align-items: flex-start;
  gap: 0.35mm;
}

h3.resume-entry-heading > .entry-date {
  flex: none;
  margin-inline-start: 0;
}
`;

const BUILT_IN_TEMPLATE_CSS = {
  [BASE_TEMPLATE]: "",
  [TIMELINE_TEMPLATE]: `${MODERN_CSS}

:scope { --timeline-inset: 4.5mm; }

h3.resume-entry-heading:has(> .entry-date) {
  position: relative;
  padding-inline-start: var(--timeline-inset);
}

h3.resume-entry-heading > .entry-date {
  order: -1;
  font-size: calc(var(--text-size) * 0.92);
  font-weight: 500;
  line-height: 1.3;
  color: var(--color-accent);
}

h3.resume-entry-heading:has(> .entry-date)::before {
  content: "";
  position: absolute;
  inset-inline-start: 0.45mm;
  inset-block-start: 1.1mm;
  inline-size: 1.45mm;
  block-size: 1.45mm;
  border-radius: 50%;
  background: var(--color-accent);
}

h3.resume-entry-heading:has(> .entry-date)::after {
  content: "";
  position: absolute;
  inset-inline-start: 1.08mm;
  inset-block: 3mm 0.4mm;
  border-inline-start: 0.5pt solid var(--border-color);
}

h3.resume-entry-heading:has(> .entry-date) + :is(p, ul, ol),
h3.resume-entry-heading:has(> .entry-date) + p + :is(ul, ol),
div:has(> h3.resume-entry-heading > .entry-date) + div > :is(p, ul, ol),
div:has(> h3.resume-entry-heading > .entry-date) + div:has(> p) + div > :is(ul, ol) {
  margin-inline-start: var(--timeline-inset) !important;
}
`,
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
  "现代无衬线": MODERN_CSS,
  "日期靠右": `${MODERN_TYPOGRAPHY_CSS}
:scope { --resume-date-offset: auto; }

h3.resume-entry-heading > .entry-date {
  text-align: end;
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
