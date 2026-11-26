const { mountPhotoControls } = require("./photo-controls");

const ACCENTS = [["navy", "#254f78"], ["teal", "#205c63"], ["plum", "#70475e"], ["green", "#456347"], ["ink", "#34383c"]];

function mountAppearanceControls(parent, panel) {
  const { t, view } = panel;
  const colors = parent.createDiv({ cls: "resume-layout-accent" });
  colors.createEl("h3", { text: t("accent") });
  const options = colors.createDiv({ cls: "resume-layout-swatches", attr: { role: "group", "aria-label": t("accent") } });
  const buttons = new Map();
  const set = accent => panel.setAppearance({ ...panel.current.appearance, accent });
  for (const [name, value] of [["useThemeValue", ""], ...ACCENTS]) {
    const label = t(name);
    const button = options.createEl("button", { cls: "resume-color-swatch", attr: { "aria-label": label, title: label } });
    if (value) button.style.setProperty("--resume-swatch", value);
    else button.setText("↺");
    button.addEventListener("click", () => set(panel.current.appearance.accent === value ? undefined : value || undefined));
    buttons.set(value, button);
  }
  const custom = options.createEl("input", { type: "color", attr: { "aria-label": t("customColor"), title: t("customColor") } });
  custom.addEventListener("input", () => panel.setAppearance({ ...panel.current.appearance, accent: custom.value }, false));
  custom.addEventListener("change", () => set(custom.value));
  const photo = mountPhotoControls(parent, view);
  return {
    focusPhoto: photo.focus,
    update(values) {
      photo.update();
      for (const [value, button] of buttons) button.setAttribute("aria-pressed", String((values.accent ?? "") === value));
      const root = view.preview.rendered;
      const active = values.accent ?? (root && root.ownerDocument.defaultView.getComputedStyle(root).getPropertyValue("--color-accent").trim());
      if (/^#[\da-f]{6}$/i.test(active)) custom.value = active;
    },
  };
}

module.exports = { mountAppearanceControls };
