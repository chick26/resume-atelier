const { MARKDOWN_FENCE, splitSectionBody } = require("./structure");

function relativeImage(notePath, imagePath) {
  const parent = notePath.split("/").slice(0, -1);
  const asset = imagePath.split("/");
  let shared = 0;
  while (shared < parent.length && parent[shared] === asset[shared]) shared++;
  const folders = parent.slice(shared).map(() => "..");
  const parts = asset.slice(shared).map(part => encodeURIComponent(part).replace(/[()]/g, c => c === "(" ? "%28" : "%29"));
  return [...folders, ...parts].join("/");
}

function headerPhoto(body) {
  const { intro } = splitSectionBody(body);
  let titleEnd = 0;
  let offset = 0;
  let fence = "";
  let comment = false;
  for (const line of intro.split("\n")) {
    const marker = line.match(MARKDOWN_FENCE);
    if (fence) {
      if (marker?.[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = "";
    } else if (comment || /^\s*<!--/.test(line)) comment = !line.includes("-->");
    else if (marker) fence = marker[1];
    else if (/^ {0,3}(?:!\[avatar\]\(.+\)|!\[\[[^\]]+\|avatar\]\]|<img\b(?=[^>]*\b(?:alt=["']avatar["']|class=["'][^"']*\bavatar\b[^"']*["']))[^>]*>)\s*$/i.test(line)) {
      return { titleEnd, photo: { start: offset, line } };
    }
    else if (!titleEnd && /^ {0,3}#\s+/.test(line)) titleEnd = offset + line.length;
    offset += line.length + 1;
  }
  return { titleEnd };
}

function avatarEdit(body, notePath, imagePath) {
  const { titleEnd, photo } = headerPhoto(body);
  if (!imagePath) {
    if (!photo) return null;
    const end = photo.start + photo.line.length;
    const spacing = body.slice(end).match(/^\n(?:\n)?/)?.[0] ?? "";
    return { start: photo.start, end: end + spacing.length, text: "" };
  }
  const markdown = `![avatar](${relativeImage(notePath, imagePath)})`;
  if (photo) return { start: photo.start, end: photo.start + photo.line.length, text: markdown };
  const tail = body.slice(titleEnd);
  const after = !tail || tail.startsWith("\n\n") ? "" : tail.startsWith("\n") ? "\n" : "\n\n";
  return { start: titleEnd, end: titleEnd, text: (titleEnd ? "\n\n" : "") + markdown + after };
}

function rebaseAvatar(body, sourcePath, targetPath, resolve) {
  if (sourcePath.split("/").slice(0, -1).join("/") === targetPath.split("/").slice(0, -1).join("/")) return body;
  const { photo } = headerPhoto(body);
  const link = photo?.line.match(/^( {0,3}!\[avatar\]\()([^\s()<>]+)(\)\s*)$/);
  if (!link || /^(?:[a-z][a-z\d+.-]*:|[/#])/i.test(link[2])) return body;
  let asset;
  try { asset = resolve(decodeURIComponent(link[2]), sourcePath); }
  catch { return body; }
  if (!asset) return body;
  const start = photo.start + link[1].length;
  return body.slice(0, start) + relativeImage(targetPath, asset.path) + body.slice(start + link[2].length);
}

module.exports = { avatarEdit, rebaseAvatar, headerPhoto };
