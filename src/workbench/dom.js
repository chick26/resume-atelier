const { Notice, setIcon } = require("obsidian");

async function copySourceText(field, t, text = field.value) {
  try {
    await field.ownerDocument.defaultView.navigator.clipboard.writeText(text);
    new Notice(t("copySuccess"));
  } catch {
    field.focus();
    field.select();
    new Notice(t("copyShortcutHint"));
  }
}


function iconButton(parent, icon, label, callback) {
  const button = parent.createEl("button", { cls: "resume-layout-icon-button", attr: { "aria-label": label, title: label } });
  setIcon(button, icon);
  button.addEventListener("click", callback);
  return button;
}

async function runWithNotice(run) {
  try {
    await run();
  } catch (error) {
    new Notice(error.message);
  }
}

module.exports = { copySourceText, iconButton, runWithNotice };
