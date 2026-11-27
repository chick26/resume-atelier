const { RESUME_CLASS } = require("../identity");

function scopeSelectors(selectorText, scope) {
  const selectors = [];
  let quote = "";
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectorText.length; index++) {
    const character = selectorText[index];
    if (character === "\\") {
      index++;
    } else if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(" || character === "[") {
      depth++;
    } else if (character === ")" || character === "]") {
      depth--;
    } else if (character === "," && depth === 0) {
      selectors.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(selectorText.slice(start).trim());
  return selectors.flatMap(selector => {
    if (!/^:scope(?![\w-])/.test(selector)) return [`${scope} ${selector}`];
    const anchored = selector.replace(/^:scope/, scope);
    const child = selector.match(/^:scope((?:[.#][\p{L}\p{N}_-]+)*)\s*>\s*(.+)$/u);
    if (!child) return [anchored];
    const [, modifier, target] = child;
    const host = scope + modifier;
    // Reading and print views wrap each rendered Markdown block.
    return [
      anchored,
      `${host} > :where(.resume-header) > ${target}`,
      `.print > ${host} > :where(.resume-header) > :where(div:not([class])) > ${target}`,
      `.print > ${host} > :where(div:not([class])) > ${target}`,
      `${host} > :where([class^="el-"]) > ${target}`,
      `${host} > :where(.markdown-preview-sizer) > ${target}`,
      `${host} > :where(.markdown-preview-sizer) > :where([class^="el-"]) > ${target}`,
    ];
  }).join(", ");
}

function scopedCss(text, scope, doc) {
  const Sheet = doc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new Sheet();
  sheet.replaceSync(text);
  const render = rules => Array.from(rules, rule => {
    if (rule.type === 1) {
      return `${scopeSelectors(rule.selectorText, scope)} { ${rule.style.cssText} }`;
    }
    if (rule.type === 4 || rule.type === 12) {
      const header = rule.type === 4 ? "@media" : "@supports";
      return `${header} ${rule.conditionText} { ${render(rule.cssRules)} }`;
    }
    return "";
  }).join("\n");
  return render(sheet.cssRules).trim();
}

function printRules(scope, { paper, top, right, bottom, left }) {
  return `@media print {
    .${scope} { page: ${scope}; }
    @page ${scope} { size: ${paper} portrait; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; }
  }`;
}

class ResumeStyleSheets {
  constructor() {
    this.documents = new Map();
    this.scopeId = 0;
    this.disposed = false;
  }

  apply(root, theme, layout) {
    if (this.disposed) return;
    const doc = root.ownerDocument;
    let group = this.documents.get(doc);
    const previous = group?.rules.get(root);
    if (!theme && !layout) {
      if (previous) {
        root.classList.remove(previous.scope);
        group.rules.delete(root);
        this.refresh(doc, group);
      }
      return;
    }
    const scope = previous?.scope ?? `resume-atelier-sheet-${++this.scopeId}`;
    const page = layout ? printRules(scope, layout) : "";
    if (previous && previous.theme === theme && previous.page === page) return;
    const selector = `.lapis-cv.${RESUME_CLASS}.resume-layout-styled.${scope}`;
    const css = theme ? scopedCss(theme, selector, doc) : "";
    group ??= this.adopt(doc);
    group.rules.set(root, { scope, theme, page, css });
    root.classList.add(scope);
    this.refresh(doc, group);
  }

  adopt(doc) {
    const sheet = new doc.defaultView.CSSStyleSheet();
    const rules = new Map();
    const observer = new doc.defaultView.MutationObserver(records => {
      if (!records.some(record => record.removedNodes.length)) return;
      const count = rules.size;
      for (const [root, { scope }] of rules) {
        if (root.isConnected && root.ownerDocument === doc) continue;
        root.classList.remove(scope);
        rules.delete(root);
      }
      if (rules.size !== count) this.refresh(doc, group);
    });
    const group = { sheet, rules, observer };
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    this.documents.set(doc, group);
    return group;
  }

  refresh(doc, group) {
    if (group.rules.size) {
      group.sheet.replaceSync([...group.rules.values()].map(({ css, page }) => css + "\n" + page).join("\n"));
      return;
    }
    group.observer.disconnect();
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(sheet => sheet !== group.sheet);
    this.documents.delete(doc);
  }

  dispose() {
    this.disposed = true;
    for (const [doc, group] of this.documents) {
      for (const [root, { scope }] of group.rules) root.classList.remove(scope);
      group.rules.clear();
      this.refresh(doc, group);
    }
  }
}

module.exports = { scopeSelectors, scopedCss, ResumeStyleSheets };
