const { setIcon } = require("obsidian");
const { headerPhoto } = require("../resume/avatar");
const { mountPhotoControls } = require("./photo-controls");

function mountSourceTools(editor, pane, tools, field) {
  const { t, view } = editor;
  const doc = pane.ownerDocument;
  const photo = tools.createEl("button", { attr: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" } });
  setIcon(photo.createSpan({ attr: { "aria-hidden": "true" } }), "image");
  photo.createSpan({ text: t("photo") });
  const panel = pane.createDiv({ cls: "resume-layout-photo-popover", attr: { role: "dialog", "aria-label": t("photo") } });
  panel.hidden = true;
  const controls = mountPhotoControls(panel, view);

  function dismiss(event) {
    if (!panel.contains(event.target) && !photo.contains(event.target)) close();
  }

  function close() {
    if (panel.hidden) return;
    doc.removeEventListener("pointerdown", dismiss, true);
    doc.removeEventListener("focusin", dismiss, true);
    panel.hidden = true;
    photo.setAttribute("aria-expanded", "false");
  }

  function position() {
    if (panel.hidden) return;
    const bounds = pane.getBoundingClientRect();
    const anchor = photo.getBoundingClientRect();
    const top = anchor.bottom - bounds.top + 5;
    const left = Math.min(anchor.left - bounds.left, pane.clientWidth - panel.offsetWidth - 8);
    panel.style.top = `${top}px`;
    panel.style.left = `${Math.max(8, left)}px`;
    panel.style.maxHeight = `${Math.max(0, pane.clientHeight - top - 8)}px`;
  }

  function openPhoto() {
    if (!editor.edit || field.readOnly || editor.edit.conflicted) return;
    if (!panel.hidden) {
      close();
      field.focus();
      return;
    }
    if (!headerPhoto(field.value).photo && !(view.preview.renderedBody === field.value && view.preview.sectionLayout?.portrait)) {
      editor.changePhoto(true);
      return;
    }
    controls.update();
    panel.hidden = false;
    photo.setAttribute("aria-expanded", "true");
    doc.addEventListener("pointerdown", dismiss, true);
    doc.addEventListener("focusin", dismiss, true);
    position();
    controls.focus();
  }

  function syncAvailability() {
    photo.disabled = !editor.edit || field.readOnly || !!editor.edit.conflicted;
    if (photo.disabled) close();
  }

  photo.addEventListener("click", openPhoto);
  panel.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
    field.focus({ preventScroll: true });
  });
  const observer = new doc.defaultView.ResizeObserver(position);
  observer.observe(pane);
  view.register(() => {
    observer.disconnect();
    close();
  });
  return { syncAvailability, close, openPhoto, updatePhoto: controls.update };
}

module.exports = { mountSourceTools };
