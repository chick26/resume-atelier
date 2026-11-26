const { sectionTitle, sectionRuleIssues } = require("./structure");
const { SIDEBAR_TEMPLATE } = require("../themes/built-ins");

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
  const selector = 'h3[data-heading], .entry-title, [alt="entry-title"]';
  return block.matches(selector) || (block.matches("div") && block.firstElementChild?.matches(selector));
}

function container(root, tag, className) {
  const element = root.ownerDocument.createElement(tag);
  element.className = className;
  return element;
}

// Keep the original native block nodes, including embeds and their event handlers.
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
    this.duplicates = new Set(sectionRuleIssues(this.sections, {}).duplicate);
  }

  apply(layout) {
    const dual = layout.template === SIDEBAR_TEMPLATE;
    const rules = this.sections.map(({ title }) => this.duplicates.has(title) ? {} : ruleFor(layout.sections, title));
    const key = JSON.stringify([dual, rules.map(rule => [rule.hidden === true, rule.region === "sidebar"])]);
    if (this.key === key) return;
    this.key = key;
    if (this.wrapper) {
      this.wrapper.before(...this.blocks);
      this.wrapper.remove();
      this.wrapper = null;
    }
    for (const [index, { nodes }] of this.sections.entries()) {
      for (const node of nodes) node.classList.toggle("resume-layout-section-hidden", rules[index].hidden === true);
    }
    if (!dual || !this.sections.length) return;
    const wrapper = container(this.root, "div", "resume-layout-document");
    this.blocks[0].before(wrapper);
    this.wrapper = wrapper;
    const header = container(this.root, "header", "resume-header");
    header.append(...this.intro);
    const columns = container(this.root, "div", "resume-layout-columns");
    const main = container(this.root, "div", "resume-main");
    const sidebar = container(this.root, "aside", "resume-sidebar");
    for (const [index, { title, nodes }] of this.sections.entries()) {
      const section = container(this.root, "section", "resume-section");
      section.dataset.resumeSection = title;
      section.classList.toggle("resume-layout-section-hidden", rules[index].hidden === true);
      let parent = section;
      for (const node of nodes) {
        if (beginsEntry(node)) {
          parent = container(this.root, "div", "resume-entry");
          section.append(parent);
        }
        parent.append(node);
      }
      (rules[index].region === "sidebar" ? sidebar : main).append(section);
    }
    if (main.querySelector("section:not(.resume-layout-section-hidden)") && sidebar.querySelector("section:not(.resume-layout-section-hidden)")) {
      columns.classList.add("has-sidebar");
    }
    columns.append(main, sidebar);
    wrapper.append(header, columns);
  }
}

module.exports = { SectionLayout, changeSectionRule, ruleFor };
