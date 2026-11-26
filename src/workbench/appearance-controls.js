const { PHOTO_RATIOS, PHOTO_CORNERS, GAP_LIMITS, appearanceFor } = require("../layout/appearance");

function mountAppearanceControls(parent, panel) {
  const { t } = panel;
  const details = parent.createEl("details", { cls: "resume-layout-fine-tune resume-layout-appearance" });
  details.createEl("summary", { text: t("quickStyles") });
  const body = details.createDiv({ cls: "resume-layout-appearance-fields" });
  const inputs = new Map();
  const label = key => body.createEl("label", { text: t(key) });
  const set = (key, value, save = true) => {
    panel.current.appearance = appearanceFor({ ...panel.current.appearance, [key]: value });
    if (save) panel.commit();
    else panel.update();
  };
  const selects = new Map();
  for (const [key, options] of [
    ["avatarRatio", Object.keys(PHOTO_RATIOS)],
    ["avatarShape", Object.keys(PHOTO_CORNERS)],
    ["avatarPosition", ["sidebar"]],
  ]) {
    const select = label(key).createEl("select", { cls: "dropdown" });
    select.createEl("option", { value: "", text: t(key === "avatarPosition" ? "headerRight" : "useThemeValue") });
    for (const value of options) select.createEl("option", { value, text: key === "avatarRatio" ? value : t(value) });
    select.addEventListener("change", () => set(key, select.value || undefined));
    selects.set(key, select);
  }
  const color = label("accent").createEl("input", { type: "color" });
  color.addEventListener("input", () => set("accent", color.value, false));
  color.addEventListener("change", () => set("accent", color.value));
  for (const [key, max] of Object.entries(GAP_LIMITS)) {
    const row = label(key);
    const value = row.createEl("output");
    const input = row.createEl("input", { type: "range", attr: { min: "0", max: String(max), step: "0.1", "aria-label": t(key) } });
    input.addEventListener("input", () => set(key, input.valueAsNumber, false));
    input.addEventListener("change", () => set(key, input.valueAsNumber));
    inputs.set(key, { input, value });
  }
  const reset = body.createEl("button", { text: t("resetAppearance") });
  reset.addEventListener("click", () => {
    panel.current.appearance = {};
    panel.commit();
  });
  function update(values) {
    const root = panel.view.preview.rendered;
    const css = root?.ownerDocument.defaultView.getComputedStyle(root);
    const accent = values.accent || css?.getPropertyValue("--color-accent").trim();
    color.value = /^#[\da-f]{6}$/i.test(accent) ? accent : "#1f4478";
    for (const [key, { input, value }] of inputs) {
      const variable = key === "sectionGap" ? "--resume-heading-top" : "--resume-list-gap";
      const current = values[key] ?? parseFloat(css?.getPropertyValue(variable));
      input.value = String(Number.isFinite(current) ? current : 0);
      const text = values[key] == null ? t("useThemeValue") : `${values[key]} mm`;
      value.textContent = text;
      input.setAttribute("aria-valuetext", text);
    }
    for (const [key, select] of selects) select.value = values[key] ?? "";
    reset.disabled = !Object.keys(values).length;
  }

  function openForPhoto() {
    details.open = true;
    details.scrollTop = 0;
    selects.get("avatarRatio").focus({ preventScroll: true });
  }
  return { details, update, openForPhoto };
}

module.exports = { mountAppearanceControls };
