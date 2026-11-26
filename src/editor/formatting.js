const { MARKDOWN_FENCE } = require("../resume/structure");

const SOURCE_LIST_PREFIX = /^([ \t]*)([-+*]|\d{1,9}[.)])[ \t]+(?:(\[[ xX]\])(?:[ \t]+|$))?/;
const LEGACY_ENTRY_BLOCK = /^ {0,3}<div\b[^>\n]*[ \t](?:alt|class)=(["'])entry-title\1[^>\n]*>[ \t]*\n((?:[^\n]*\n)*?)[ \t]*<\/div>[ \t]*$/gm;

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

function inSourceLiteralBlock(value, lineStart, includeComments = false) {
  let fence = "";
  let commentEnd = "";
  for (const line of value.slice(0, lineStart).split("\n")) {
    const marker = line.match(MARKDOWN_FENCE);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = "";
    } else if (commentEnd) {
      if (line.includes(commentEnd)) commentEnd = "";
    } else if (marker) {
      fence = marker[1];
    } else if (includeComments) {
      const comment = line.match(/^\s*(<!--|%%)/);
      if (comment) {
        const end = comment[1] === "<!--" ? "-->" : "%%";
        if (!line.slice(comment[0].length).includes(end)) commentEnd = end;
      }
    }
  }
  return !!(fence || commentEnd);
}

function continueSourceList(field) {
  const { value, selectionStart: cursor, selectionEnd } = field;
  if (cursor !== selectionEnd) return false;
  const line = sourceLineAt(value, cursor);
  const prefix = line.text.match(SOURCE_LIST_PREFIX);
  if (!prefix || cursor < line.start + prefix[0].length || inSourceLiteralBlock(value, line.start)) return false;
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
    || inSourceLiteralBlock(field.value, line.start) || legacyEntryAt(field)) return false;
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

function legacyEntryAt(field) {
  const { value, selectionStart, selectionEnd } = field;
  for (const match of value.matchAll(LEGACY_ENTRY_BLOCK)) {
    const start = match.index;
    const end = start + match[0].length;
    if (selectionStart < start || selectionEnd > end) continue;
    if (inSourceLiteralBlock(value, start, true)) return null;
    const block = match[2].match(/^[ \t]*<h3>([^\n]*?)<\/h3>[ \t]*\n(?:[ \t]*<p>([^<>\n]*)<\/p>[ \t]*\n)?$/);
    const title = block?.[1].match(/^([^<>]+?)(?:[ \t]*<span class=["']entry-sep["']>([|·])<\/span>[ \t]*<span class=["']entry-sub["']>([^<>]*)<\/span>)?$/);
    const entry = { start, end, markup: match[0] };
    // Rich HTML remains editable in source. A form can safely edit these plain fields.
    if (title) entry.fields = { title: title[1], subtitle: title[3] ?? "", right: block[2] ?? "", separator: title[2] ?? "·" };
    return entry;
  }
  return null;
}

function updateLegacyEntry(entry, title, subtitle, right) {
  const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  // The recognized block has a wrapper, one heading and an optional date paragraph.
  const lines = entry.markup.split("\n");
  if (title !== entry.title || subtitle !== entry.subtitle) {
    const detail = subtitle
      ? ` <span class="entry-sep">${entry.separator}</span><span class="entry-sub">${escape(subtitle)}</span>` : "";
    lines[1] = lines[1].replace(/<h3>.*<\/h3>/, () => "<h3>" + escape(title) + detail + "</h3>");
  }
  if (right !== entry.right) {
    const date = "<p>" + escape(right) + "</p>";
    if (lines.length === 4) {
      if (right) lines[2] = lines[2].replace(/<p>.*<\/p>/, () => date);
      else lines.splice(2, 1);
    } else if (right) {
      lines.splice(2, 0, lines[1].match(/^[ \t]*/)[0] + date);
    }
  }
  return lines.join("\n");
}

module.exports = { changeSourceIndent, continueSourceList, replaceSourceSelection, toggleSourceBold, legacyEntryAt, updateLegacyEntry };
