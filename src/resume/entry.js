// Recognize separators in top-level heading text, preserving Markdown inline constructs.
function entryFields(label) {
  let bracketDepth = 0;
  let destinationDepth = 0;
  let angle = false;
  let dot = -1;
  let pipe = -1;
  for (let i = 0; i < label.length; i++) {
    const char = label[i];
    if (char === "\\") { i++; continue; }
    if (char === "`" || char === "*" || char === "_" || char === "~") {
      const run = label.slice(i).match(/^(`+|\*+|_+|~+)/)[0];
      let closing = label.indexOf(run, i + run.length);
      while (closing >= 0 && (label[closing - 1] === char || label[closing + run.length] === char)) {
        closing = label.indexOf(run, closing + run.length);
      }
      i += run.length - 1;
      if (closing >= 0) i = closing + run.length - 1;
      continue;
    }
    if (angle) { if (char === ">") angle = false; continue; }
    if (char === "<" && /^<(?:[a-z/!]|https?:)/i.test(label.slice(i))) { angle = true; continue; }
    if (char === "[") { bracketDepth++; continue; }
    if (char === "]" && bracketDepth) { bracketDepth--; continue; }
    if (bracketDepth) continue;
    if (char === "(" && (destinationDepth || label[i - 1] === "]")) { destinationDepth++; continue; }
    if (destinationDepth) { if (char === ")") destinationDepth--; continue; }
    const spaced = /\s/.test(label[i - 1] ?? "") && /\s/.test(label[i + 1] ?? "");
    if (char === "｜" || (spaced && char === "|")) pipe = i;
    if (spaced && char === "·" && dot < 0) dot = i;
  }
  const end = pipe < 0 ? label.length : pipe;
  if (dot >= end) dot = -1;
  const title = label.slice(0, dot < 0 ? end : dot).trim();
  const subtitle = dot < 0 ? "" : label.slice(dot + 1, end).trim();
  const right = pipe < 0 ? "" : label.slice(pipe + 1).trim();
  if (!title || (pipe >= 0 && !right)) return null;
  return { title, subtitle, right };
}

module.exports = { entryFields };
