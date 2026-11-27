const { sectionTitle, sectionRuleIssues } = require("./structure");

function ruleFor(rules, title) {
  const rule = Object.hasOwn(rules, title) && rules[title];
  return rule && typeof rule === "object" && !Array.isArray(rule) ? rule : {};
}

function changeSectionRule(rules, title, key, value) {
  const next = { ...rules };
  const rule = { ...ruleFor(rules, title) };
  if (value === undefined) delete rule[key];
  else rule[key] = value;
  if (Object.keys(rule).length) return { ...next, [title]: rule };
  delete next[title];
  return next;
}

function blockHeading(block) {
  if (block.matches("h2[data-heading]")) return block;
  return block.matches("div") && block.firstElementChild?.matches("h2[data-heading]") ? block.firstElementChild : null;
}

function paragraphWithPortrait(block) {
  const paragraph = block.matches("p") ? block : block.firstElementChild;
  if (!paragraph?.matches("p")) return false;
  const photo = paragraph.querySelector('img[alt="avatar"], .internal-embed[alt="avatar"], img.avatar');
  return !!photo && [...paragraph.childNodes].every(node => node.contains(photo) || !node.textContent.trim());
}

function tagLists(nodes) {
  return nodes.map(node => node.matches("ul") ? node : node.matches("div") ? node.firstElementChild : null)
    .filter(list => list?.matches("ul") && !list.querySelector("ul,ol,.task-list-item"));
}

// Reuse native nodes so embeds, links and editor bindings keep their identity.
class SectionLayout {
  constructor(root, blocks, titles) {
    const intro = [];
    this.sections = [];
    let nodes = intro;
    for (const block of blocks) {
      const heading = blockHeading(block);
      const title = titles ? titles.get(heading) : heading && sectionTitle(heading.dataset.heading);
      if (typeof title === "string") {
        nodes = [];
        this.sections.push({ title, nodes });
      }
      nodes.push(block);
    }
    this.portrait = intro.find(paragraphWithPortrait);
    if (this.portrait) {
      this.portrait.classList.add("resume-portrait-block");
      const header = root.ownerDocument.createElement("header");
      header.className = "resume-header has-portrait";
      intro[0].before(header);
      header.append(...intro);
    }
    for (const [index, section] of this.sections.entries()) {
      // A page break before the next heading still applies when this section is hidden.
      if (index < this.sections.length - 1) {
        while (section.nodes.at(-1)?.matches("hr,.el-hr")) section.nodes.pop();
      }
      section.lists = tagLists(section.nodes);
    }
    this.duplicates = new Set(sectionRuleIssues(this.sections, {}).duplicate);
  }

  apply({ sections }) {
    for (const { title, nodes, lists } of this.sections) {
      const { hidden, display } = this.duplicates.has(title) ? {} : ruleFor(sections, title);
      for (const node of nodes) node.classList.toggle("resume-layout-section-hidden", hidden === true);
      for (const list of lists) list.classList.toggle("resume-section-tags", display === "tags");
    }
  }
}

module.exports = { SectionLayout, changeSectionRule, ruleFor };
