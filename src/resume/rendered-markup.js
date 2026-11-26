const { entryFields } = require("./entry");

function headingSuffix(parent, separator, expected, className) {
  const doc = parent.ownerDocument;
  for (const node of [...parent.childNodes].reverse()) {
    if (node.nodeType !== 3) continue;
    for (let i = node.length - 1; i >= 0; i--) {
      if (!separator.includes(node.data[i])) continue;
      const range = doc.createRange();
      range.selectNodeContents(parent);
      range.setStart(node, i + 1);
      if (previewMatchText(range.toString()) !== previewMatchText(expected)) continue;
      const suffix = doc.createElement("span");
      suffix.className = className;
      suffix.append(range.extractContents());
      node.deleteData(i, 1);
      return suffix;
    }
  }
  return null;
}

function decorateEntryHeadings(root) {
  const selector = "h3[data-heading]:not(.resume-entry-heading)";
  const headings = root.matches(selector) ? [root] : root.querySelectorAll(selector);
  for (const heading of headings) {
    const fields = entryFields(heading.dataset.heading);
    if (!fields || (!fields.right && !fields.subtitle)) continue;
    const date = fields.right && headingSuffix(heading, "|｜", fields.right, "entry-date");
    if (fields.right && !date) continue;
    const subtitle = fields.subtitle && headingSuffix(heading, "·", fields.subtitle, "entry-sub");
    const main = heading.ownerDocument.createElement("span");
    main.className = "entry-main";
    for (const child of [...heading.childNodes]) main.append(child);
    if (subtitle) main.append(" · ", subtitle);
    heading.append(main);
    if (date) heading.append(date);
    heading.classList.add("resume-entry-heading");
  }
}

function decorateResumeMarkup(root) {
  decorateEntryHeadings(root);
  const doc = root.ownerDocument;
  const blocks = [...root.querySelectorAll("h2, blockquote")];
  if (root.matches("h2, blockquote")) blocks.unshift(root);
  for (const block of blocks) {
    const walker = doc.createTreeWalker(block, 4);
    const icons = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/[\uE000-\uF8FF]/u.test(node.data) && !node.parentElement.closest(".resume-layout-icon")) icons.push(node);
    }
    for (const node of icons) {
      const parent = node.parentElement;
      if (parent.tagName === "SPAN" && /^[\s\uE000-\uF8FF]+$/u.test(parent.textContent)) {
        parent.classList.add("resume-layout-icon");
        parent.setAttribute("aria-hidden", "true");
        continue;
      }
      const fragment = doc.createDocumentFragment();
      for (const part of node.data.split(/([\uE000-\uF8FF]+)/u)) {
        if (!part) continue;
        if (/^[\uE000-\uF8FF]+$/u.test(part)) {
          const icon = doc.createElement("span");
          icon.className = "resume-layout-icon";
          icon.setAttribute("aria-hidden", "true");
          icon.textContent = part;
          fragment.append(icon);
        } else {
          fragment.append(part);
        }
      }
      node.replaceWith(fragment);
    }
  }
}

function previewMatchText(text) {
  return text.normalize("NFKC")
    .replace(/<[^>]*>|&(?:#x[\da-f]+|#\d+|[a-z]+);/gi, "")
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, label) => label ?? link)
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

function locatePreviewBlocks(root, body) {
  const lines = body.split("\n").map(line =>
    previewMatchText(line.replace(/^\s*(?:>\s*)*(?:[-+*]\s+|\d+[.)]\s+)?/, "")),
  );
  const locations = [];
  let nextLine = 0;
  // The standalone renderer does not expose section positions. Match visible
  // block text in source order so repeated headings and bullets stay distinct.
  for (const element of root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table")) {
    if (element.closest(".internal-embed")) continue;
    const group = element.closest("li,blockquote,pre,table");
    if (group && group !== element) continue;
    const text = element.matches("li")
      ? Array.from(element.childNodes).filter(node => !node.matches?.("ul,ol")).map(node => node.textContent).join(" ")
      : element.textContent;
    const key = previewMatchText(text);
    if (!key) continue;
    for (let line = nextLine; line < lines.length; line++) {
      const value = lines[line];
      const prefixMatch = Math.min(value.length, key.length) >= 4 && (key.startsWith(value) || value.startsWith(key));
      if (value !== key && !prefixMatch) continue;
      locations.push({ line, element });
      nextLine = line + 1;
      break;
    }
  }
  return locations;
}

function previewSourceLine({ line, element }, body, event) {
  if (!element.matches("p,li,blockquote")) return line;
  const doc = element.ownerDocument;
  const caret = doc.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (!caret || !element.contains(caret.startContainer)) return line;
  const range = doc.createRange();
  range.selectNodeContents(element);
  range.setEnd(caret.startContainer, caret.startOffset);
  const prefix = previewMatchText(range.toString());
  const lines = body.split("\n");
  let consumed = previewMatchText(lines[line]);
  while (consumed.length < prefix.length && prefix.startsWith(consumed) && lines[line + 1]?.trim()) {
    const next = consumed + previewMatchText(lines[line + 1]);
    if (next === consumed || !(prefix.startsWith(next) || next.startsWith(prefix))) break;
    consumed = next;
    line++;
  }
  return line;
}

module.exports = { decorateResumeMarkup, locatePreviewBlocks, previewSourceLine };
