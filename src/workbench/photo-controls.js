const { PHOTO_RATIOS, changePhotoRatio } = require("../layout/appearance");
const { headerPhoto } = require("../resume/avatar");

function mountPhotoControls(parent, view) {
  const { t, layout } = view;
  const root = parent.createDiv({ cls: "resume-layout-photo-controls" });
  const add = root.createEl("button", { text: t("addPhoto") });
  add.addEventListener("click", () => view.editor.changePhoto(true));
  const fields = root.createDiv({ cls: "resume-layout-appearance-fields" });
  const select = (key, values) => {
    const row = fields.createEl("label", { text: t(key) });
    const input = row.createEl("select", { cls: "dropdown" });
    for (const [value, text] of values) input.createEl("option", { value, text });
    return input;
  };
  const ratio = select("avatarRatio", Object.keys(PHOTO_RATIOS).map(value => [value, value]));
  const shape = select("avatarShape", ["square", "rounded", "round"].map(value => [value, t(value)]));
  const round = shape.querySelector('[value="round"]');
  const ellipse = shape.createEl("option", { value: "legacy-round", text: t("legacyEllipse") });
  ellipse.disabled = true;
  const position = select("avatarPosition", [["", t("headerRight")], ["sidebar", t("sidebar")]]);
  const actions = fields.createDiv({ cls: "resume-layout-photo-actions" });
  for (const [key, pick] of [["replacePhoto", true], ["removePhoto", false]]) {
    actions.createEl("button", { text: t(key) }).addEventListener("click", () => {
      view.editor.toolbar.close();
      view.editor.changePhoto(pick);
    });
  }
  ratio.addEventListener("change", () => {
    const next = changePhotoRatio(layout.current.appearance, ratio.value, shape.value === "legacy-round" ? "round" : shape.value);
    layout.setAppearance(next);
  });
  shape.addEventListener("change", () => layout.setAppearance({ ...layout.current.appearance, avatarShape: shape.value }));
  position.addEventListener("change", () => layout.setAppearance({ ...layout.current.appearance, avatarPosition: position.value || undefined }));

  function update() {
    const resume = view.selected;
    const currentFile = view.preview.renderedFile === resume?.file;
    const flow = currentFile ? view.preview.sectionLayout : null;
    const body = view.editor.edit?.text ?? (currentFile ? view.preview.renderedBody : null);
    const sourcePhoto = body != null && headerPhoto(body).photo;
    const hasPhoto = !!(sourcePhoto || (body === view.preview.renderedBody && flow?.portrait));
    const writable = resume?.recognized && !resume.protected && !view.editor.edit?.conflicted;
    root.hidden = !(hasPhoto || writable);
    fields.hidden = !hasPhoto;
    add.hidden = hasPhoto || !writable;
    if (!hasPhoto) return;
    const values = layout.current.appearance;
    const img = flow?.portrait?.querySelector("img");
    const css = img && img.ownerDocument.defaultView.getComputedStyle(img);
    const factor = parseFloat(css?.height) / parseFloat(css?.width);
    const closest = Object.keys(PHOTO_RATIOS).reduce((a, b) =>
      Math.abs(PHOTO_RATIOS[b] - factor) < Math.abs(PHOTO_RATIOS[a] - factor) ? b : a, "1:1");
    ratio.value = values.avatarRatio ?? closest;
    const radius = css?.borderTopLeftRadius ?? (ratio.value === "1:1" ? "50%" : "2mm");
    const circular = radius.includes("%") ? parseFloat(radius) >= 50 : parseFloat(radius) >= parseFloat(css?.width) / 2;
    const effectiveShape = values.avatarShape ?? (circular ? "round" : parseFloat(radius) > 0 ? "rounded" : "square");
    round.hidden = ratio.value !== "1:1";
    ellipse.hidden = !(round.hidden && effectiveShape === "round");
    shape.value = ellipse.hidden ? effectiveShape : "legacy-round";
    position.parentElement.hidden = flow?.mode !== "sidebar";
    position.value = values.avatarPosition ?? "";
    actions.hidden = !writable || !sourcePhoto;
  }
  return { update, focus: () => (fields.hidden ? add : ratio).focus({ preventScroll: true }) };
}

module.exports = { mountPhotoControls };
