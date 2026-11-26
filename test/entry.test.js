const assert = require("node:assert/strict");
const test = require("node:test");
const { entryFields } = require("../src/resume/entry");

test("entry fields keep inline Markdown and distinguish literal separators", () => {
  const rich = "**工程师** · [[公司|业务部]] | 2022 – 至今";
  assert.deepEqual(entryFields(rich), { title: "**工程师**", subtitle: "[[公司|业务部]]", right: "2022 – 至今" });
  assert.deepEqual(entryFields("Role｜Present"), { title: "Role", subtitle: "", right: "Present" });
  for (const literal of ["a \\| b", "\x60a | b\x60", "[web | site](https://example.org/a|b)", "[[file|alias]]", "**a | b**", "普通经历"]) {
    assert.deepEqual(entryFields(literal), { title: literal, subtitle: "", right: "" });
  }
  assert.equal(entryFields("A | "), null);
});
