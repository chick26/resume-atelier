const MARKDOWN_FENCE = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/;
const LEGACY_ENTRY = /^ {0,3}<div\b[^>]*\b(?:alt|class)=["']entry-title["'][^>]*>/i;

function sectionTitle(text) {
  return text.replace(/[ \t]+#+$/, "").replace(/<[^>]+>|&#(?:x[\da-f]+|\d+);/gi, "").trim();
}

// Zero-based body lines. The end of a section or entry is exclusive.
function splitSectionBody(body) {
  const headings = [];
  let fence = "";
  let inComment = false;
  let offset = 0;
  let lineNumber = 0;
  for (const line of body.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = line.match(MARKDOWN_FENCE);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = "";
    } else if (inComment || /^\s*<!--/.test(line)) {
      inComment = !line.includes("-->");
    } else if (marker) {
      fence = marker[1];
    } else {
      const heading = line.match(/^ {0,3}(#{2,3})[ \t]+(.+?)[ \t]*(?:\r?\n)?$/);
      if (heading?.[1] === "##") {
        const title = sectionTitle(heading[2]);
        headings.push({ title, offset, startLine: lineNumber, entries: [] });
      } else if (headings.length && (heading || LEGACY_ENTRY.test(line))) {
        headings.at(-1).entries.push(lineNumber);
      }
    }
    offset += line.length;
    lineNumber++;
  }
  return {
    intro: body.slice(0, headings[0]?.offset ?? body.length),
    sections: headings.map((heading, index) => {
      const next = headings[index + 1];
      const endLine = next?.startLine ?? lineNumber;
      return {
        title: heading.title, markdown: body.slice(heading.offset, next?.offset ?? body.length),
        startLine: heading.startLine, endLine,
        entries: heading.entries.map((startLine, at) => ({ startLine, endLine: heading.entries[at + 1] ?? endLine })),
      };
    }),
  };
}

function sectionRuleIssues(sections, rules) {
  const counts = new Map();
  for (const { title } of sections) counts.set(title, (counts.get(title) ?? 0) + 1);
  return {
    duplicate: [...counts.keys()].filter(title => counts.get(title) > 1),
    missing: Object.keys(rules).filter(title => !counts.has(title)),
  };
}

module.exports = { MARKDOWN_FENCE, splitSectionBody, sectionTitle, sectionRuleIssues };
