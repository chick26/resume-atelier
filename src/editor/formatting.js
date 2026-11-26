const { MARKDOWN_FENCE } = require("../resume/structure");

const SOURCE_LIST_PREFIX = /^([ \t]*)([-+*]|\d{1,9}[.)])[ \t]+(?:(\[[ xX]\])(?:[ \t]+|$))?/;

function changeSourceIndent(field, outdent) {
  const { value, selectionStart: start, selectionEnd: end, selectionDirection } = field;
  if (!outdent && start === end) {
    replaceSourceSelection(field, start, end, "  ", start + 2, start + 2, selectionDirection);
    return;
  }

  const firstLine = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const lastSelected = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const newline = value.indexOf("\n", lastSelected);
  const lastLine = newline === -1 ? value.length : newline;
  const lines = value.slice(firstLine, lastLine).split("\n");
  const changed = lines.map(line => outdent ? line.replace(/^(?:\t| {1,2})/, "") : `  ${line}`);
  const replacement = changed.join("\n");
  if (replacement === value.slice(firstLine, lastLine)) return;

  const firstDelta = changed[0].length - lines[0].length;
  const newStart = Math.max(firstLine, start + firstDelta);
  const newEnd = Math.max(newStart, end + replacement.length - (lastLine - firstLine));
  replaceSourceSelection(field, firstLine, lastLine, replacement, newStart, newEnd, selectionDirection);
}

function replaceSourceSelection(field, start, end, text, selectionStart, selectionEnd, direction) {
  field.setSelectionRange(start, end);
  // Chromium's editing command puts the replacement on the textarea's undo stack.
  if (!field.ownerDocument.execCommand(text ? "insertText" : "delete", false, text)) {
    field.setRangeText(text, start, end, "end");
    field.dispatchEvent(new field.ownerDocument.defaultView.Event("input", { bubbles: true }));
  }
  field.setSelectionRange(selectionStart, selectionEnd, direction);
}

function sourceLineAt(value, offset) {
  const start = offset === 0 ? 0 : value.lastIndexOf("\n", offset - 1) + 1;
  const newline = value.indexOf("\n", offset);
  const end = newline === -1 ? value.length : newline;
  return { start, end, text: value.slice(start, end) };
}

function inSourceFence(value, lineStart) {
  let fence = "";
  for (const line of value.slice(0, lineStart).split("\n")) {
    const marker = line.match(MARKDOWN_FENCE);
    if (!marker) continue;
    if (!fence) fence = marker[1];
    else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = "";
  }
  return !!fence;
}

function continueSourceList(field) {
  const { value, selectionStart: cursor, selectionEnd } = field;
  if (cursor !== selectionEnd) return false;
  const line = sourceLineAt(value, cursor);
  const prefix = line.text.match(SOURCE_LIST_PREFIX);
  if (!prefix || cursor < line.start + prefix[0].length || inSourceFence(value, line.start)) return false;
  if (!line.text.slice(prefix[0].length).trim()) {
    replaceSourceSelection(field, line.start, line.end, "", line.start, line.start);
    return true;
  }
  const [, indent, marker, checklist] = prefix;
  const next = marker.length === 1 ? marker : `${Math.min(999999999, Number(marker.slice(0, -1)) + 1)}${marker.at(-1)}`;
  const insertion = `\n${indent}${next} ${checklist ? "[ ] " : ""}`;
  replaceSourceSelection(field, cursor, cursor, insertion, cursor + insertion.length, cursor + insertion.length);
  return true;
}

function sourceBoldSelection(field, line) {
  const { value, selectionStart, selectionEnd } = field;
  const selected = value.slice(selectionStart, selectionEnd);
  const content = selected.trim();
  const start = content ? selectionStart + selected.indexOf(content) : selectionEnd;
  const end = start + content.length;
  const spans = /(`+)(?!`)[^\n]*?\1(?!`)|(?<![\\*])(\*{2,3})(?!\*)(\S(?:.*?\S)?)(?<![\\*])\2(?!\*)/g;
  for (const match of line.text.matchAll(spans)) {
    const from = line.start + match.index;
    const to = from + match[0].length;
    if (start < from || end > to) continue;
    if (!match[2]) return null;
    const width = match[2].length;
    if (start !== end || (from + width <= start && start <= to - width)) {
      return { start, end, content, span: { from, to, width } };
    }
  }
  if (start === end && value.slice(start - 2, start + 2) === "****") {
    return { start, end, content, span: { from: start - 2, to: start + 2, width: 2 } };
  }
  return { start, end, content };
}

function toggleSourceBold(field) {
  const line = sourceLineAt(field.value, field.selectionStart);
  if (field.readOnly || field.selectionEnd > line.end || MARKDOWN_FENCE.test(line.text)
    || inSourceFence(field.value, line.start)) return false;
  const bold = sourceBoldSelection(field, line);
  if (!bold) return false;
  const { start, end, content, span } = bold;
  const { value, selectionDirection } = field;
  if (span) {
    const { from, to, width } = span;
    const text = value.slice(from + width, to - width);
    const emphasis = width === 3 ? "*" : "";
    const move = offset => from + emphasis.length + Math.min(text.length, Math.max(0, offset - from - width));
    replaceSourceSelection(field, from, to, emphasis + text + emphasis, move(start), move(end), selectionDirection);
    return true;
  }
  replaceSourceSelection(field, start, end, `**${content}**`, start + 2, end + 2, selectionDirection);
  return true;
}

module.exports = { changeSourceIndent, continueSourceList, replaceSourceSelection, toggleSourceBold };
