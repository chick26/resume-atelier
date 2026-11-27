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

function beginsEntry(block) {
  return block.matches("h3[data-heading]") || (block.matches("div") && block.firstElementChild?.matches("h3[data-heading]"));
}

function container(root, tag, className) {
  const element = root.ownerDocument.createElement(tag);
  element.className = className;
  return element;
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

function appendTimelineEntries(section, nodes) {
  let body = section;
  for (const node of nodes) {
    if (beginsEntry(node)) {
      const entry = container(section, "div", "resume-entry");
      section.append(entry);
      entry.append(node);
      body = container(section, "div", "resume-entry-body");
      entry.append(body);
    } else {
      body.append(node);
    }
  }
}

// Reuse native nodes so embeds, links and editor bindings keep their identity.
class SectionLayout {
  constructor(root, blocks, titles) {
    this.root = root;
    this.intro = [];
    this.sections = [];
    this.blocks = blocks;
    let nodes = this.intro;
    for (const block of blocks) {
      const heading = blockHeading(block);
      const title = titles ? titles.get(heading) : heading && sectionTitle(heading.dataset.heading);
      if (typeof title === "string") {
        nodes = [];
        this.sections.push({ title, nodes });
      }
      nodes.push(block);
    }
    this.portrait = this.intro.find(paragraphWithPortrait);
    this.portrait?.classList.add("resume-portrait-block");
    for (const [index, section] of this.sections.entries()) {
      section.breaks = [];
      // A page break before the next heading still applies when this section is hidden.
      if (index < this.sections.length - 1) {
        while (section.nodes.at(-1)?.matches("hr,.el-hr")) section.breaks.unshift(section.nodes.pop());
      }
      section.lists = tagLists(section.nodes);
    }
    this.duplicates = new Set(sectionRuleIssues(this.sections, {}).duplicate);
  }

  apply(layout) {
    const declared = this.root.ownerDocument.defaultView.getComputedStyle(this.root).getPropertyValue("--resume-structure").trim();
    const timeline = declared === "timeline" && this.sections.length > 0;
    const rules = this.sections.map(({ title }) => this.duplicates.has(title) ? {} : ruleFor(layout.sections, title));
    const key = JSON.stringify([timeline, rules.map(rule => [rule.hidden === true, rule.display === "tags"])]);
    if (this.key === key) return;
    this.key = key;
    if (this.wrapper) {
      this.wrapper.before(...this.blocks);
      this.wrapper.remove();
      this.wrapper = null;
    }
    for (const [index, { nodes, lists }] of this.sections.entries()) {
      for (const node of nodes) node.classList.toggle("resume-layout-section-hidden", rules[index].hidden === true);
      for (const list of lists) list.classList.toggle("resume-section-tags", rules[index].display === "tags");
    }
    if (!timeline && !this.portrait) return;
    const header = container(this.root, "header", "resume-header");
    if (this.portrait) header.classList.add("has-portrait");
    const wrapper = timeline ? container(this.root, "div", "resume-layout-document resume-timeline") : header;
    this.blocks[0].before(wrapper);
    this.wrapper = wrapper;
    header.append(...this.intro);
    if (!timeline) return;
    wrapper.append(header);
    for (const [index, { title, nodes, breaks }] of this.sections.entries()) {
      const section = container(wrapper, "section", "resume-section");
      section.dataset.resumeSection = title;
      section.classList.toggle("resume-layout-section-hidden", rules[index].hidden === true);
      appendTimelineEntries(section, nodes);
      wrapper.append(section, ...breaks);
    }
  }
}

module.exports = { SectionLayout, changeSectionRule, ruleFor };
