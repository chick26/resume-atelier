const assert = require("node:assert/strict");
const test = require("node:test");
const { entryFields } = require("../src/resume/entry");
const { toggleSourceBold, changeSourceIndent, continueSourceList } = require("../src/editor/formatting");

test("entry fields keep inline Markdown and distinguish literal separators", () => {
  const rich = "**工程师** · [[公司|业务部]] | 2022 – 至今";
  assert.deepEqual(entryFields(rich), { title: "**工程师**", subtitle: "[[公司|业务部]]", right: "2022 – 至今" });
  assert.deepEqual(entryFields("Role｜Present"), { title: "Role", subtitle: "", right: "Present" });
  for (const literal of ["a \\| b", "\x60a | b\x60", "[web | site](https://example.org/a|b)", "[[file|alias]]", "**a | b**", "普通经历"]) {
    assert.deepEqual(entryFields(literal), { title: literal, subtitle: "", right: "" });
  }
  assert.equal(entryFields("A | "), null);
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
