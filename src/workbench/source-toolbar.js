const { Notice, setIcon } = require("obsidian");
const { iconButton } = require("./dom");
const { PhotoPicker } = require("./modals");
const {
  SOURCE_ENTRY_SEPARATOR, replaceSourceSelection, sourceEditorContext, sourceEntryTarget, sourceEntryMarkup,
  toggleSourceBold, toggleSourceList, toggleSourceHeading,
} = require("../editor/formatting");

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

function mountSourceTools(editor, pane, tools, info, field) {
  const { t, view } = editor;
  const popovers = createSourcePopovers(pane, cleanup => view.register(cleanup));
  const group = () => tools.createDiv({ cls: "resume-layout-source-group" });
  const addFormat = (parent, symbol, label, run, withText = false) => {
    const button = parent.createEl("button", {
      type: "button", cls: "resume-layout-source-format",
      attr: { "aria-label": label, "aria-pressed": "false" },
    });
    setIcon(button.createSpan({ attr: { "aria-hidden": "true" } }), symbol);
    if (withText) button.createSpan({ cls: "resume-layout-source-caption", text: label });
    button.addEventListener("click", () => {
      const context = sourceEditorContext(field);
      if (button.disabled || !context.canFormat || (run === toggleSourceBold && !context.bold)) return;
      popovers.close();
      field.focus({ preventScroll: true });
      run(field, context);
      updateTools();
    });
    return button;
  };
  const text = group();
  const bold = addFormat(text, "bold", t("bold"), toggleSourceBold);
  bold.setAttribute("aria-keyshortcuts", "Meta+B Control+B");
  const list = addFormat(text, "list", t("list"), toggleSourceList);
  const heading = addFormat(group(), "heading-2", t("section"), toggleSourceHeading, true);
  const entry = group().createEl("button", {
    type: "button", cls: "resume-layout-source-entry-button", attr: { "aria-expanded": "false", "aria-haspopup": "dialog" },
  });
  const entryIcon = entry.createSpan({ cls: "resume-layout-source-entry-icon", attr: { "aria-hidden": "true" } });
  const entryLabel = entry.createSpan();
  setIcon(entry.createSpan({ cls: "resume-layout-source-chevron", attr: { "aria-hidden": "true" } }), "chevron-down");
  createSourceEntryPopover(pane, entry, field, popovers, { t, view, updateTools });

  const photo = iconButton(tools, "image", t("choosePhoto"), () => {
    if (!editor.edit || field.readOnly) return;
    popovers.close();
    new PhotoPicker(editor, field).open();
  });
  const help = iconButton(info, "circle-help", t("editorShortcuts"), () => {
    if (!helpPanel.hidden) return popovers.close();
    popovers.show(helpPanel, help);
    helpPanel.focus({ preventScroll: true });
  });
  help.addClass("resume-layout-source-help");
  help.setAttribute("aria-expanded", "false");
  help.setAttribute("aria-haspopup", "dialog");
  const helpPanel = pane.createDiv({
    cls: "resume-layout-source-popover resume-layout-source-help-panel", attr: { role: "dialog", "aria-label": t("editorShortcuts"), tabindex: "-1" },
  });
  helpPanel.hidden = true;
  const shortcuts = helpPanel.createEl("dl");
  for (const [key, action] of [
    ["⌘B / Ctrl+B", "bold"], ["Enter", "continueList"], ["Tab", "indent"], [t("clickPreview"), "jumpToSource"],
  ]) {
    shortcuts.createEl("dt").createEl("kbd", { text: key });
    shortcuts.createEl("dd", { text: t(action) });
  }
  helpPanel.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    popovers.close();
    help.focus({ preventScroll: true });
  });

  const update = (button, active, title, disabled) => {
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(active));
    button.title = title;
  };
  function updateTools() {
    if (!editor.edit) return;
    photo.disabled = field.readOnly;
    const context = sourceEditorContext(field);
    const isBold = !!context.bold?.span;
    const isList = !!context.list;
    const isHeading = context.heading?.[1] === "##";
    update(bold, isBold, t("boldShortcut", { action: t(isBold ? "unbold" : "bold") }), !context.bold);
    update(list, isList, isList ? t("removeList") : t("makeBulletList"), !context.canFormat);
    update(heading, isHeading, isHeading ? t("removeSectionFormat") : t("makeSection"), !context.canFormat);
    const editing = !!(context.entry?.fields || context.headingFields?.right || context.headingFields?.subtitle);
    const label = editing ? t("editEntry") : t("entry");
    if (entryLabel.textContent !== label) {
      entryLabel.setText(label);
      setIcon(entryIcon, editing ? "pencil" : "calendar-range");
    }
    entry.disabled = !context.canUseEntry;
    entry.toggleClass("is-current-entry", editing);
    entry.title = editing ? t("editEntryHelp") : context.subheading ? t("addDateHelp") : t("insertEntry");
  }
  return { update: updateTools, close: popovers.close };
}

function createSourceEntryPopover(pane, button, field, popovers, { t, view, updateTools }) {
  const form = pane.createEl("form", {
    cls: "resume-layout-source-popover resume-layout-source-entry resume-layout-modal-form",
    attr: { role: "dialog", "aria-label": t("entry") },
  });
  form.hidden = true;
  const fields = form.createDiv({ cls: "resume-layout-source-entry-fields" });
  const input = (label, name, required = false) => fields.createEl("label", {
    text: label, cls: `resume-layout-entry-${name}`,
  }).createEl("input", { type: "text", attr: required ? { required: "" } : {} });
  const title = input(t("entryTitle"), "title", true);
  const subtitle = input(t("entrySubtitle"), "subtitle");
  const right = input(t("entryDate"), "date");
  const preview = form.createDiv({ cls: "resume-layout-entry-preview", attr: { "aria-label": t("entryPreview") } });
  const previewHeading = preview.createDiv({ cls: "resume-layout-entry-preview-heading" });
  const previewTitle = previewHeading.createEl("strong");
  const previewSubtitle = previewHeading.createSpan({ cls: "resume-layout-entry-preview-subtitle" });
  const previewRight = preview.createSpan({ cls: "resume-layout-entry-preview-date" });
  const actions = form.createDiv({ cls: "resume-layout-source-entry-actions" });
  const cancel = actions.createEl("button", { text: t("cancel"), attr: { type: "button" } });
  const submit = actions.createEl("button", { cls: "mod-cta", text: t("insert"), attr: { type: "submit" } });
  let target;
  const close = () => {
    popovers.close();
    field.focus({ preventScroll: true });
  };
  const updatePreview = () => {
    const detail = subtitle.value.trim();
    previewTitle.setText(title.value.trim());
    previewSubtitle.setText(detail ? `${target?.separator ?? SOURCE_ENTRY_SEPARATOR} ${detail}` : "");
    previewRight.setText(right.value.trim());
    submit.disabled = !title.value.trim();
  };
  button.addEventListener("click", () => {
    if (!form.hidden) return close();
    const range = sourceEntryTarget(field, sourceEditorContext(field));
    if (!range) return;
    target = { ...range, snapshot: field.value };
    title.value = range.title ?? "";
    subtitle.value = range.subtitle ?? "";
    right.value = range.right ?? "";
    right.placeholder = view.selected?.classes.includes("lapis-cv-zh") ? "2023.06 – 至今" : "Jun 2023 – Present";
    submit.setText(range.updating ? t("update") : t("insert"));
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
    const { start, end, updating, attribute, separator, snapshot } = target;
    if (snapshot !== field.value) {
      close();
      new Notice(t("entryMoved"));
      return;
    }
    const detail = subtitle.value.trim();
    const date = right.value.trim();
    close();
    if (updating && name === target.title && detail === target.subtitle && date === target.right) return;
    const block = sourceEntryMarkup(name, detail, date, attribute, separator);
    const before = snapshot.slice(0, start);
    const after = snapshot.slice(end);
    const leading = updating || !before || /\n[ \t]*\n$/.test(before) ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const trailing = updating || /^\n[ \t]*\n/.test(after) ? "" : after.startsWith("\n") ? "\n" : "\n\n";
    const cursor = start + leading.length + block.length + (updating ? 0 : 1);
    replaceSourceSelection(field, start, end, leading + block + trailing, cursor, cursor);
    updateTools();
  });
}


module.exports = { mountSourceTools };
