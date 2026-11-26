const { getFrontMatterInfo } = require("obsidian");

const MARKDOWN_FENCE = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/;

function splitSectionBody(body) {
  const headings = [];
  let fence = "";
  let inComment = false;
  let offset = 0;
  for (const line of body.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = line.match(MARKDOWN_FENCE);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = "";
    } else if (inComment || /^\s*<!--/.test(line)) {
      inComment = !line.includes("-->");
    } else if (marker) {
      fence = marker[1];
    } else {
      const heading = line.match(/^ {0,3}##[ \t]+(.+?)[ \t]*(?:\r?\n)?$/);
      if (heading) {
        const title = heading[1].replace(/[ \t]+#+$/, "").replace(/<[^>]+>|&#(?:x[\da-f]+|\d+);/gi, "").trim();
        headings.push({ offset, title });
      }
    }
    offset += line.length;
  }
  return {
    intro: body.slice(0, headings[0]?.offset ?? body.length),
    sections: headings.map((heading, index) => ({
      title: heading.title,
      markdown: body.slice(heading.offset, headings[index + 1]?.offset ?? body.length),
    })),
  };
}


function sourceText(markdown) {
  return markdown.replace(/\r\n?/g, "\n");
}

function sourceParts(markdown) {
  const bom = Number(markdown.charCodeAt(0) === 0xfeff);
  const info = getFrontMatterInfo(markdown.slice(bom).replace(/\r(?!\n)/g, "\n"));
  const start = bom + info.contentStart;
  return { prefix: markdown.slice(0, start), body: markdown.slice(start), hasYaml: info.exists };
}

function editableBody(markdown) {
  return sourceText(sourceParts(markdown).body);
}

function withEditedBody(markdown, text) {
  const { prefix, hasYaml } = sourceParts(markdown);
  const newline = markdown.match(/\r\n|\r|\n/)?.[0] ?? "\n";
  const separator = hasYaml && text && !/[\r\n]$/.test(prefix) ? newline : "";
  return prefix + separator + text.replace(/\n/g, newline);
}

function guessChinese(text) {
  let characters = 0;
  let han = 0;
  for (const character of text) {
    if (/\s/u.test(character)) continue;
    characters++;
    if (/\p{Script=Han}/u.test(character)) han++;
    if (characters === 500) break;
  }
  return characters > 0 && han / characters >= 0.2;
}


module.exports = { MARKDOWN_FENCE, splitSectionBody, sourceText, sourceParts, editableBody, withEditedBody, guessChinese };
