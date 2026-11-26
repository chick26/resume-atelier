const assert = require("node:assert/strict");
const test = require("node:test");
const { splitSectionBody, sectionRuleIssues } = require("../src/resume/structure");

test("section and entry line ranges include their details and ignore fenced, quoted and commented headings", () => {
  const body = ["# Name", "> ## Contact", "## Work", "### First | Now", "- details", "",
    "<div alt=\"entry-title\">", "    <h3>Previous</h3>", "</div>", "Second paragraph",
    "```md", "## Fenced", "```", "<!--", "## Commented", "-->", "## Skills", "- details", "## Skills"].join("\r\n");
  const { intro, sections } = splitSectionBody(body);
  assert.equal(intro + sections.map(section => section.markdown).join(""), body);
  assert.deepEqual(sections.map(({ title, startLine, endLine }) => [title, startLine, endLine]),
    [["Work", 2, 16], ["Skills", 16, 18], ["Skills", 18, 19]]);
  assert.deepEqual(sections[0].entries, [{ startLine: 3, endLine: 6 }, { startLine: 6, endLine: 16 }]);
  assert.deepEqual(sectionRuleIssues(sections, { Skills: { hidden: true }, Honors: {} }),
    { duplicate: ["Skills"], missing: ["Honors"] });
});
