let scopeId = 0;

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

function applyTemplate(root, css) {
  let style = root.querySelector(":scope > style[data-careeros-template]");
  if (!css) {
    if (style) {
      root.classList.remove(style.dataset.careerosTemplate);
      style.remove();
    }
    return;
  }
  if (style?.careerosCss === css) return;
  if (!style) {
    const scope = `careeros-template-${++scopeId}`;
    root.classList.add(scope);
    style = root.ownerDocument.createElement("style");
    style.dataset.careerosTemplate = scope;
    root.append(style);
  }
  const scope = `.lapis-cv.careeros-resume.resume-layout-styled.${style.dataset.careerosTemplate}`;
  style.textContent = scopedCss(css, scope, root.ownerDocument);
  style.careerosCss = css;
}


module.exports = { scopeSelectors, scopedCss, applyTemplate };
