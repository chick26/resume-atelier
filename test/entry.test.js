const assert = require("node:assert/strict");
const test = require("node:test");
const { entryFields } = require("../src/resume/entry");
const { legacyEntryAt, updateLegacyEntry, toggleSourceBold, changeSourceIndent, continueSourceList } = require("../src/editor/formatting");

test("entry fields keep inline Markdown and distinguish literal separators", () => {
  const rich = "**工程师** · [[公司|业务部]] | 2022 – 至今";
  assert.deepEqual(entryFields(rich), { title: "**工程师**", subtitle: "[[公司|业务部]]", right: "2022 – 至今" });
  assert.deepEqual(entryFields("Role｜Present"), { title: "Role", subtitle: "", right: "Present" });
  for (const literal of ["a \\| b", "\x60a | b\x60", "[web | site](https://example.org/a|b)", "[[file|alias]]", "**a | b**", "普通经历"]) {
    assert.deepEqual(entryFields(literal), { title: literal, subtitle: "", right: "" });
  }
  assert.equal(entryFields("A | "), null);
});

test("the contextual form recognizes only editable legacy headers at the selection", () => {
  const header = '<div alt="entry-title">\n  <h3>Designer</h3>\n  <p>2020–2024</p>\n</div>';
  const full = "### Designer · Example | 2024\n\n" + header + "\n\n- Wrote the brief.";
  const at = (value, text, end = text) => legacyEntryAt({
    value, selectionStart: value.indexOf(text), selectionEnd: value.indexOf(end) + end.length,
  });
  assert.equal(at(full, "### Designer"), null);
  assert.equal(at(full, "- Wrote"), null);
  assert.equal(at(full, "<h3>", "- Wrote"), null);
  assert.equal(at(full, "<h3>", "</p>").fields.right, "2020–2024");
  assert.ok(at(header.replace('alt="entry-title"', "class='entry-title'"), "Designer").fields);
  for (const [open, close] of [["~~~html", "~~~"], ["<!--", "-->"], ["%%", "%%"]]) {
    assert.equal(at(open + "\n" + header + "\n" + close, "<h3>"), null);
  }
  assert.equal(at(header.replace("Designer", "<em>Designer</em>"), "Designer").fields, undefined);
});

test("editing a legacy date keeps the original title, wrapper, entities and indentation", () => {
  const body = "<div class='entry-title' data-team='A'>\n  <h3>Research &amp; design</h3>\n  <p>2021</p>\n</div>";
  const target = { ...legacyEntryAt({ value: body, selectionStart: 4, selectionEnd: 4 }),
    title: "Research & design", subtitle: "", right: "2021", separator: "·" };
  assert.equal(updateLegacyEntry(target, target.title, "", "2021"), body);
  assert.equal(updateLegacyEntry(target, target.title, "", "2022"), body.replace("<p>2021", "<p>2022"));
  const removed = updateLegacyEntry(target, target.title, "", "");
  assert.equal(removed, body.replace("  <p>2021</p>\n", ""));
  assert.equal(updateLegacyEntry({ ...target, markup: removed, right: "" }, target.title, "", "A < B"),
    removed.replace("</div>", "  <p>A &lt; B</p>\n</div>"));
});

test("the formatting shortcuts work directly on the Markdown selection", () => {
  const field = {
    value: "draft", selectionStart: 0, selectionEnd: 5,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    ownerDocument: { execCommand(command, unused, text) {
      field.value = field.value.slice(0, field.selectionStart) + text + field.value.slice(field.selectionEnd);
      return true;
    } },
  };
  assert.equal(toggleSourceBold(field), true);
  assert.equal(field.value, "**draft**");
  assert.equal(toggleSourceBold(field), true);
  assert.equal(field.value, "draft");
  field.value = "- first";
  field.setSelectionRange(7, 7);
  assert.equal(continueSourceList(field), true);
  assert.equal(field.value, "- first\n- ");
  field.setSelectionRange(0, field.value.length);
  changeSourceIndent(field, false);
  assert.equal(field.value, "  - first\n  - ");
  changeSourceIndent(field, true);
  assert.equal(field.value, "- first\n- ");
});
