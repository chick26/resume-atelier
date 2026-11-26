const { Notice, setIcon } = require("obsidian");
const { mountPhotoControls } = require("./photo-controls");
const { headerPhoto } = require("../resume/avatar");
const { legacyEntryAt, updateLegacyEntry, replaceSourceSelection } = require("../editor/formatting");

function createSourcePopovers(pane, register) {
  let opened;
  const dismiss = event => {
    if (opened && !opened.panel.contains(event.target) && !opened.button.contains(event.target)) close();
  };
  const close = () => {
    if (!opened) return;
    const { panel, button, doc } = opened;
    opened = null;
    doc.removeEventListener("pointerdown", dismiss, true);
    doc.removeEventListener("focusin", dismiss, true);
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  const position = () => {
    if (!opened) return;
    const { panel, button } = opened;
    const bounds = pane.getBoundingClientRect();
    const anchor = button.getBoundingClientRect();
    const top = anchor.bottom - bounds.top + 5;
    const left = Math.min(anchor.left - bounds.left, pane.clientWidth - panel.offsetWidth - 8);
    panel.style.top = `${top}px`;
    panel.style.left = `${Math.max(8, left)}px`;
    panel.style.maxHeight = `${Math.max(0, pane.clientHeight - top - 8)}px`;
  };
  const observer = new pane.ownerDocument.defaultView.ResizeObserver(position);
  observer.observe(pane);
  register(() => {
    observer.disconnect();
    close();
  });
  return {
    close,
    show(panel, button) {
      close();
      const doc = pane.ownerDocument;
      opened = { panel, button, doc };
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      doc.addEventListener("pointerdown", dismiss, true);
      doc.addEventListener("focusin", dismiss, true);
      position();
    },
  };
}

function mountSourceTools(editor, pane, tools, field) {
  const { t, view } = editor;
  const popovers = createSourcePopovers(pane, cleanup => view.register(cleanup));
  const photo = tools.createEl("button", { attr: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" } });
  setIcon(photo.createSpan({ attr: { "aria-hidden": "true" } }), "image");
  photo.createSpan({ text: t("photo") });
  photo.addEventListener("click", openPhoto);

  const entry = tools.createEl("button", {
    text: t("editEntry"), attr: { type: "button", "aria-expanded": "false", "aria-haspopup": "dialog" },
  });
  entry.hidden = true;
  mountLegacyEntryEditor(pane, entry, field, popovers, editor);
  const photoPanel = pane.createDiv({ cls: "resume-layout-source-popover resume-layout-photo-popover", attr: { role: "dialog", "aria-label": t("photo") } });
  photoPanel.hidden = true;
  const photoControls = mountPhotoControls(photoPanel, view);
  function openPhoto() {
    if (!editor.edit || field.readOnly || editor.edit.conflicted) return;
    if (!photoPanel.hidden) {
      popovers.close();
      field.focus();
      return;
    }
    if (!headerPhoto(field.value).photo && !(view.preview.renderedBody === field.value && view.preview.sectionLayout?.portrait)) {
      popovers.close();
      editor.changePhoto(true);
      return;
    }
    photoControls.update();
    popovers.show(photoPanel, photo);
    photoControls.focus();
  }
  photoPanel.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    popovers.close();
    field.focus({ preventScroll: true });
  });
  function updateTools() {
    photo.disabled = !editor.edit || field.readOnly || !!editor.edit.conflicted;
    entry.hidden = photo.disabled || !legacyEntryAt(field)?.fields;
  }
  return { update: updateTools, close: popovers.close, openPhoto, updatePhoto: photoControls.update };
}

function mountLegacyEntryEditor(pane, button, field, popovers, editor) {
  const { t, view } = editor;
  const form = pane.createEl("form", {
    cls: "resume-layout-source-popover resume-layout-source-entry resume-layout-modal-form",
    attr: { role: "dialog", "aria-label": t("editEntry") },
  });
  form.hidden = true;
  const fields = form.createDiv({ cls: "resume-layout-source-entry-fields" });
  const input = (label, name, required = false) => fields.createEl("label", {
    text: label, cls: `resume-layout-entry-${name}`,
  }).createEl("input", { type: "text", attr: required ? { required: "" } : {} });
  const title = input(t("entryTitle"), "title", true);
  const subtitle = input(t("entrySubtitle"), "subtitle");
  title.placeholder = t("entryTitleHint");
  subtitle.placeholder = t("entrySubtitleHint");
  const right = input(t("entryDate"), "date");
  const preview = form.createDiv({ cls: "resume-layout-entry-preview", attr: { "aria-label": t("entryPreview") } });
  const previewHeading = preview.createDiv({ cls: "resume-layout-entry-preview-heading" });
  const previewTitle = previewHeading.createEl("strong");
  const previewSubtitle = previewHeading.createSpan({ cls: "resume-layout-entry-preview-subtitle" });
  const previewRight = preview.createSpan({ cls: "resume-layout-entry-preview-date" });
  const actions = form.createDiv({ cls: "resume-layout-source-entry-actions" });
  const cancel = actions.createEl("button", { text: t("cancel"), attr: { type: "button" } });
  const submit = actions.createEl("button", { cls: "mod-cta", text: t("update"), attr: { type: "submit" } });
  let target;
  const close = () => {
    popovers.close();
    field.focus({ preventScroll: true });
  };
  const updatePreview = () => {
    const detail = subtitle.value.trim();
    previewTitle.setText(title.value.trim());
    previewSubtitle.setText(detail ? `${target?.separator ?? "·"} ${detail}` : "");
    previewRight.setText(right.value.trim());
    submit.disabled = !title.value.trim();
  };
  button.addEventListener("click", () => {
    if (!form.hidden) return close();
    const range = legacyEntryAt(field);
    if (!editor.edit || field.readOnly || editor.edit.conflicted || !range?.fields) return;
    const decoder = field.ownerDocument.createElement("textarea");
    const decode = text => {
      decoder.innerHTML = text;
      return decoder.value.trim();
    };
    target = {
      ...range, edit: editor.edit, snapshot: field.value, separator: range.fields.separator,
      title: decode(range.fields.title), subtitle: decode(range.fields.subtitle), right: decode(range.fields.right),
    };
    title.value = target.title;
    subtitle.value = target.subtitle;
    right.value = target.right;
    right.placeholder = view.selected?.classes.includes("lapis-cv-zh") ? "2023.06 – 至今" : "Jun 2023 – Present";
    updatePreview();
    popovers.show(form, button);
    const next = title.value ? right : title;
    next.focus({ preventScroll: true });
    next.select();
  });
  form.addEventListener("input", updatePreview);
  cancel.addEventListener("click", close);
  form.addEventListener("keydown", event => {
    if (event.key !== "Escape" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = title.value.trim();
    if (form.hidden || !target || !name || field.readOnly) return;
    if (target.edit !== editor.edit || target.snapshot !== field.value) {
      close();
      new Notice(t("entryMoved"));
      return;
    }
    const block = updateLegacyEntry(target, name, subtitle.value.trim(), right.value.trim());
    close();
    if (block === target.markup) return;
    const cursor = target.start + block.length;
    replaceSourceSelection(field, target.start, target.end, block, cursor, cursor);
    editor.toolbar.update();
  });
}


module.exports = { mountSourceTools };
