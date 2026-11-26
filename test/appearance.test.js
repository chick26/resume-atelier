const assert = require("node:assert/strict");
const test = require("node:test");
const { layoutFor, geometryForSave, layoutMetadata, noteLayoutKey, sameLayout } = require("../src/layout/geometry");
const { avatarEdit, rebaseAvatar } = require("../src/resume/avatar");

test("overrides survive copies, affect layout conflicts and restore the theme without losing extensions", () => {
  const previous = { paper: "Letter", appearance: { accent: "#336655", avatarRatio: "3:4", listGap: 0, vendor: { keep: true } } };
  const layout = layoutFor([], previous);
  const reset = { ...layout, appearance: {} };
  assert.equal(sameLayout(layout, reset), false);
  assert.deepEqual(geometryForSave(layout, previous).appearance, previous.appearance);
  assert.deepEqual(geometryForSave(reset, previous).appearance, { vendor: { keep: true } });
  assert.equal(geometryForSave(reset, {}).appearance, undefined);
  assert.notEqual(noteLayoutKey(layoutMetadata({ resume_layout: previous })), noteLayoutKey(layoutMetadata({ resume_layout: geometryForSave(reset, previous) })));
  assert.deepEqual(layoutFor([], { appearance: { accent: "var(--text)", avatarRatio: "7:1", avatarPosition: {}, sectionGap: 999 } }).appearance, { sectionGap: 12 });
});

test("an editable draft in another folder keeps the same local photo while preserving body line endings", () => {
  const body = "# Name\r\n\r\n![avatar](../Media/ID%20photo.png)\r\n\r\n## Work\r\n";
  const resolve = (link, origin) => link === "../Media/ID photo.png" && origin === "Master/CV.md" ? { path: "Media/ID photo.png" } : null;
  assert.equal(rebaseAvatar(body, "Master/CV.md", "Master/Draft.md", resolve), body);
  assert.equal(rebaseAvatar(body, "Master/CV.md", "Jobs/Role/Draft.md", resolve), body.replace("../Media/", "../../Media/"));
});

test("the photo picker edits only the header and uses portable relative Markdown for vault images", () => {
  const note = "Applications/Role/Draft.md";
  const photo = "Images/Photo (2026).png";
  const img = "![avatar](../../Images/Photo%20%282026%29.png)";
  const edit = source => {
    const { start, end, text } = avatarEdit(source, note, photo);
    return source.slice(0, start) + text + source.slice(end);
  };
  assert.equal(edit("# Name\n\n> Contact\n\n## Work"), "# Name\n\n" + img + "\n\n> Contact\n\n## Work");
  assert.equal(edit("# Name\n\n![avatar](old.png)\n\n## Work\n![avatar](other.png)"), "# Name\n\n" + img + "\n\n## Work\n![avatar](other.png)");
  assert.equal(edit("```md\n![avatar](example.png)\n```\n\n## Work"), img + "\n\n```md\n![avatar](example.png)\n```\n\n## Work");
});
