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

function defaultSidebarSection(sections, rules) {
  if (Object.values(rules).some(rule => rule?.region === "sidebar" || rule?.region === "main")) return;
  const duplicates = new Set(sectionRuleIssues(sections, {}).duplicate);
  const primary = /^(?:核心技能|专业技能|技能|技能特长|技术栈|skills|core skills|technical skills)$/i;
  const secondary = /^(?:专业证书|证书|荣誉证书|语言能力|教育背景|教育经历|certifications|languages|education|awards)$/i;
  const eligible = [];
  let group = [];
  for (const section of sections) {
    if (!ruleFor(rules, section.title).hidden) group.push(section.title);
    if (section.breaks?.length || section === sections.at(-1)) {
      if (group.length >= 2) eligible.push(...group.filter(title => !duplicates.has(title)));
      group = [];
    }
  }
  return eligible.find(title => primary.test(title)) ?? eligible.find(title => secondary.test(title));
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

function addSection(section, nodes, timeline) {
  let body = section;
  for (const node of nodes) {
    if (beginsEntry(node)) {
      const entry = container(section, "div", "resume-entry");
      section.append(entry);
      entry.append(node);
      body = entry;
      if (timeline) {
        body = container(section, "div", "resume-entry-body");
        entry.append(body);
      }
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
      // A trailing rule before the next heading separates document pages. Keep
      // it outside the region that can be hidden or moved into the sidebar.
      if (index < this.sections.length - 1) {
        while (section.nodes.at(-1)?.matches("hr,.el-hr")) section.breaks.unshift(section.nodes.pop());
      }
      section.lists = tagLists(section.nodes);
    }
    this.duplicates = new Set(sectionRuleIssues(this.sections, {}).duplicate);
  }

  apply(layout) {
    const declared = this.root.ownerDocument.defaultView.getComputedStyle(this.root).getPropertyValue("--resume-structure").trim();
    const mode = declared === "sidebar" || declared === "timeline" ? declared : "single";
    const rules = this.sections.map(({ title }) => this.duplicates.has(title) ? {} : ruleFor(layout.sections, title));
    const sidePhoto = !!this.portrait && mode === "sidebar" && layout.appearance?.avatarPosition === "sidebar";
    const key = JSON.stringify([mode, sidePhoto, rules.map(rule => [rule.hidden === true, rule.region === "sidebar", rule.display === "tags"])]);
    if (this.key === key) return;
    this.key = key;
    this.mode = mode;
    if (this.wrapper) {
      this.wrapper.before(...this.blocks);
      this.wrapper.remove();
      this.wrapper = null;
    }
    for (const [index, { nodes, lists }] of this.sections.entries()) {
      for (const node of nodes) node.classList.toggle("resume-layout-section-hidden", rules[index].hidden === true);
      for (const list of lists) list.classList.toggle("resume-section-tags", rules[index].display === "tags");
    }
    const structured = mode !== "single" && this.sections.length > 0;
    if (!structured && !this.portrait) return;
    const header = container(this.root, "header", "resume-header");
    if (this.portrait && !(structured && sidePhoto)) header.classList.add("has-portrait");
    const wrapper = structured ? container(this.root, "div", "resume-layout-document") : header;
    this.blocks[0].before(wrapper);
    this.wrapper = wrapper;
    header.append(...this.intro);
    if (!structured) return;
    wrapper.append(header);
    const timeline = mode === "timeline";
    wrapper.classList.toggle("resume-timeline", timeline);
    let group = [];
    let photo = sidePhoto ? this.portrait : null;
    for (const [index, section] of this.sections.entries()) {
      group.push({ section, rule: rules[index] });
      if (section.breaks.length || index === this.sections.length - 1) {
        wrapper.append(this.columnsFor(group, mode, photo), ...section.breaks);
        group = [];
        photo = null;
      }
    }
  }

  columnsFor(group, mode, photo) {
    const columns = container(this.root, "div", "resume-layout-columns");
    const main = container(this.root, "div", "resume-main");
    const sidebar = container(this.root, "aside", "resume-sidebar");
    if (photo) sidebar.append(photo);
    for (const { section: { title, nodes }, rule } of group) {
      const section = container(this.root, "section", "resume-section");
      section.dataset.resumeSection = title;
      section.classList.toggle("resume-layout-section-hidden", rule.hidden === true);
      addSection(section, nodes, mode === "timeline");
      (mode === "sidebar" && rule.region === "sidebar" ? sidebar : main).append(section);
    }
    columns.append(main);
    if (mode === "sidebar") {
      if (main.querySelector("section:not(.resume-layout-section-hidden)") && (photo || sidebar.querySelector("section:not(.resume-layout-section-hidden)"))) {
        columns.classList.add("has-sidebar");
      }
      columns.append(sidebar);
    }
    return columns;
  }
}

module.exports = { SectionLayout, changeSectionRule, ruleFor, defaultSidebarSection };
