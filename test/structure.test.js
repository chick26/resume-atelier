const assert = require("node:assert/strict");
const test = require("node:test");
const { pageBreakCounts } = require("../src/layout/pagination");

test("page warnings distinguish single, explicit, automatic and mixed boundaries", () => {
  for (const [flags, manual, automatic] of [
    [[false], 0, 0], [[false, true], 1, 0], [[false, false], 0, 1], [[false, true, false], 1, 1],
  ]) assert.deepEqual(pageBreakCounts(flags.map(manual => ({ manual }))), { manual, automatic });
});
const { splitSectionBody, sectionRuleIssues } = require("../src/resume/structure");
const { changeSectionRule, ruleFor } = require("../src/resume/section-layout");

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

test("section controls change one property at a time and previous layouts stay usable for undo", () => {
  const original = { Skills: { display: "tags", extra: ["retained"] } };
  const sidebar = changeSectionRule(original, "Skills", "region", "sidebar");
  const hidden = changeSectionRule(sidebar, "Skills", "hidden", true);
  assert.deepEqual(ruleFor(hidden, "Skills"), { display: "tags", extra: ["retained"], hidden: true, region: "sidebar" });
  assert.deepEqual(ruleFor(sidebar, "Skills"), { display: "tags", extra: ["retained"], region: "sidebar" });
  assert.deepEqual(changeSectionRule(sidebar, "Skills", "region", undefined), original);
  assert.deepEqual(changeSectionRule({ Other: { hidden: true } }, "Other", "hidden", undefined), {});
  assert.deepEqual(ruleFor({}, "constructor"), {});
});
