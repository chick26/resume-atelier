const assert = require("node:assert/strict");
const test = require("node:test");
const { ResumeStyleSheets } = require("../src/themes/scoped-css");

function windowStyles() {
  let onMutation;
  let disconnected = false;
  class CSSStyleSheet {
    replaceSync(text) {
      this.text = text;
      this.cssRules = [{ type: 1, selectorText: "h1", style: { cssText: text } }];
    }
  }
  class ClassList extends Set {
    remove(value) { this.delete(value); }
  }
  class MutationObserver {
    constructor(callback) { onMutation = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const other = {};
  const doc = {
    defaultView: { CSSStyleSheet, MutationObserver },
    documentElement: {},
    adoptedStyleSheets: [other],
  };
  return {
    doc,
    other,
    root: () => ({ classList: new ClassList(), ownerDocument: doc, isConnected: true }),
    removed: () => onMutation([{ removedNodes: [{}] }]),
    disconnected: () => disconnected,
  };
}

test("disconnected print roots remove their page rules and preserve other stylesheets", () => {
  const styles = new ResumeStyleSheets();
  const window = windowStyles();
  const preview = window.root();
  const print = window.root();
  styles.apply(preview, "color: red;");
  styles.apply(print, undefined, { paper: "Letter", top: 8, right: 14, bottom: 9, left: 17 });
  const [other, sheet] = window.doc.adoptedStyleSheets;
  assert.equal(other, window.other);
  assert.match(sheet.text, /@page resume-atelier-sheet-2 \{ size: Letter portrait; margin: 8mm 14mm 9mm 17mm; \}/);
  assert.match(sheet.text, /\.resume-atelier-sheet-1 h1 \{ color: red;/);

  print.isConnected = false;
  window.removed();
  assert.equal(print.classList.size, 0);
  assert.doesNotMatch(sheet.text, /@page/);
  assert.match(sheet.text, /color: red/);
  styles.apply(preview);
  assert.deepEqual(window.doc.adoptedStyleSheets, [window.other]);
  assert.equal(window.disconnected(), true);
});

test("theme replacements and unload keep document-local stylesheet ownership", () => {
  const styles = new ResumeStyleSheets();
  const first = windowStyles();
  const second = windowStyles();
  const preview = first.root();
  const popout = second.root();
  styles.apply(preview, "color: red;");
  styles.apply(popout, "color: blue;");
  const sheet = first.doc.adoptedStyleSheets[1];
  assert.doesNotMatch(sheet.text, /color: blue/);
  assert.match(second.doc.adoptedStyleSheets[1].text, /color: blue/);

  styles.apply(preview, "color: green;");
  assert.equal(first.doc.adoptedStyleSheets[1], sheet);
  assert.match(sheet.text, /color: green/);
  styles.dispose();
  styles.apply(preview, "color: red;");
  assert.deepEqual(first.doc.adoptedStyleSheets, [first.other]);
  assert.deepEqual(second.doc.adoptedStyleSheets, [second.other]);
  assert.equal(preview.classList.size + popout.classList.size, 0);
});
