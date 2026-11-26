const { MARKDOWN_FENCE } = require("../resume/markdown");
const { entryFields } = require("../resume/entry");

const SOURCE_LIST_PREFIX = /^([ \t]*)([-+*]|\d{1,9}[.)])[ \t]+(?:(\[[ xX]\])(?:[ \t]+|$))?/;
const SOURCE_HEADING_PREFIX = /^ {0,3}(#{1,6})(?:[ \t]+|$)/;
const SOURCE_ENTRY_BLOCK = /^ {0,3}<div (alt|class)="entry-title">[ \t]*\n((?:[^\n]*\n)*?)[ \t]*<\/div>[ \t]*$/gm;
const SOURCE_ENTRY_SEPARATOR = "·";

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

function toggleSourceBold(field, { bold }) {
  const { start, end, content, span } = bold;
  const { value, selectionDirection } = field;
  if (span) {
    const { from, to, width } = span;
    const text = value.slice(from + width, to - width);
    const emphasis = width === 3 ? "*" : "";
    const move = offset => from + emphasis.length + Math.min(text.length, Math.max(0, offset - from - width));
    replaceSourceSelection(field, from, to, emphasis + text + emphasis, move(start), move(end), selectionDirection);
    return;
  }
  replaceSourceSelection(field, start, end, `**${content}**`, start + 2, end + 2, selectionDirection);
}

function replaceSourceLinePrefix(field, line, previous, prefix) {
  const { selectionStart: start, selectionEnd: end, selectionDirection } = field;
  const contentStart = line.start + previous.length;
  const offset = line.start + prefix.length;
  replaceSourceSelection(field, line.start, contentStart, prefix,
    offset + Math.max(0, start - contentStart), offset + Math.max(0, end - contentStart), selectionDirection);
}

function toggleSourceList(field, { line, list, heading }) {
  const indent = line.text.match(/^[ \t]*/)[0];
  replaceSourceLinePrefix(field, line, list?.[0] ?? heading?.[0] ?? indent, list ? indent : `${indent}- `);
}

function toggleSourceHeading(field, { line, list, heading }) {
  replaceSourceLinePrefix(field, line, heading?.[0] ?? list?.[0] ?? "", heading?.[1] === "##" ? "" : "## ");
}

function sourceEntryAt(value, selectionStart, selectionEnd) {
  for (const match of value.matchAll(SOURCE_ENTRY_BLOCK)) {
    const start = match.index;
    const end = start + match[0].length;
    if (selectionStart < start || selectionEnd > end) continue;
    const block = match[2].match(/^[ \t]*<h3>([^\n]*?)<\/h3>[ \t]*\n(?:[ \t]*<p>([^<>\n]*)<\/p>[ \t]*\n)?$/);
    const title = block?.[1].match(/^([^<>]+?)(?:[ \t]*<span class="entry-sep">([|·])<\/span>[ \t]*<span class="entry-sub">([^<>]*)<\/span>)?$/);
    const entry = { start, end, attribute: match[1] };
    // Custom entry markup remains editable as source without risking a lossy conversion.
    if (title) entry.fields = { title: title[1], subtitle: title[3] ?? "", right: block[2] ?? "", separator: title[2] };
    return entry;
  }
  return null;
}

function sourceEditorContext(field) {
  const { value, selectionStart, selectionEnd } = field;
  const line = sourceLineAt(value, selectionStart);
  const fenced = MARKDOWN_FENCE.test(line.text) || inSourceFence(value, line.start);
  const entry = fenced ? null : sourceEntryAt(value, selectionStart, selectionEnd);
  const singleLine = selectionEnd <= line.end;
  const canFormat = !field.readOnly && !fenced && !entry && singleLine;
  const heading = canFormat ? line.text.match(SOURCE_HEADING_PREFIX) : null;
  const subtitleLine = heading?.[1] === "###" ? line.text.slice(heading[0].length).replace(/[ \t]+#+[ \t]*$/, "").trim() : "";
  const subheading = subtitleLine;
  return {
    line, entry, subheading, headingFields: subheading ? entryFields(subheading) : null, canFormat,
    canUseEntry: !field.readOnly && !fenced && (entry ? !!entry.fields : singleLine),
    list: canFormat ? line.text.match(SOURCE_LIST_PREFIX) : null,
    heading, bold: canFormat ? sourceBoldSelection(field, line) : null,
  };
}

function sourceEntryTarget(field, context) {
  const { value, selectionStart, selectionEnd, ownerDocument } = field;
  const { line, entry, subheading, canUseEntry } = context;
  if (!canUseEntry) return null;
  if (entry) {
    const decoder = ownerDocument.createElement("textarea");
    const readText = text => {
      decoder.innerHTML = text;
      return decoder.value.trim();
    };
    const { title, subtitle, right, separator } = entry.fields;
    return {
      start: entry.start, end: entry.end, updating: true, attribute: entry.attribute, separator,
      title: readText(title), subtitle: readText(subtitle), right: readText(right),
    };
  }

  if (selectionEnd <= line.end) {
    if (subheading) {
      const fields = context.headingFields ?? { title: subheading, subtitle: "", right: "" };
      return { ...fields, start: line.start, end: line.end, updating: true };
    }
    const selected = value.slice(selectionStart, selectionEnd).trim();
    const title = subheading || (selected === line.text.trim() && !/^[#>*+\-]/.test(selected) ? selected : "");
    if (title && !/[*_`[\]<>]/.test(title)) return { start: line.start, end: line.end, title };
  }
  const lastLine = sourceLineAt(value, selectionEnd);
  if (!lastLine.text.trim()) return { start: lastLine.start, end: lastLine.end };
  const boundary = value.slice(lastLine.end).search(/\n[ \t]*\n/);
  const position = boundary === -1 ? value.length : lastLine.end + boundary;
  return { start: position, end: position };
}

function sourceEntryMarkup(title, subtitle, right, attribute, separator = SOURCE_ENTRY_SEPARATOR) {
  if (!attribute) return `### ${title}${subtitle ? " · " + subtitle : ""}${right ? " | " + right : ""}`;
  const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const detail = subtitle ? ` <span class="entry-sep">${separator}</span><span class="entry-sub">${escape(subtitle)}</span>` : "";
  const date = right ? `\n    <p>${escape(right)}</p>` : "";
  return `<div ${attribute}="entry-title">\n    <h3>${escape(title)}${detail}</h3>${date}\n</div>`;
}


module.exports = { SOURCE_ENTRY_SEPARATOR, changeSourceIndent, continueSourceList, replaceSourceSelection, sourceEditorContext, toggleSourceBold, toggleSourceList, toggleSourceHeading, sourceEntryTarget, sourceEntryMarkup };
