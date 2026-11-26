const { paperSize } = require("./geometry");

// A detached copy uses Chromium's column fragmenter with one printable page per
// column. The visible Markdown and its source bindings stay in a continuous flow.
function measurePageStarts(root, layout, zoom) {
  const doc = root.ownerDocument;
  const sheet = paperSize(layout);
  const probe = doc.createElement("div");
  probe.className = "resume-layout-pagination-probe";
  probe.inert = true;
  probe.setAttribute("aria-hidden", "true");
  probe.style.width = `${sheet.width - layout.left - layout.right}mm`;
  probe.style.height = `${sheet.height - layout.top - layout.bottom}mm`;
  const copy = root.cloneNode(true);
  // Replaced media are already sized in the live document. Do not open a
  // second frame or multimedia player just to measure its box.
  const media = "iframe,video,audio,object,canvas";
  const originals = [...root.querySelectorAll(media)];
  [...copy.querySelectorAll(media)].forEach((node, i) => {
    const size = originals[i].getBoundingClientRect();
    const box = doc.createElement("span");
    box.className = "resume-layout-media-box";
    box.style.width = `${size.width / zoom}px`;
    box.style.height = `${size.height / zoom}px`;
    node.replaceWith(box);
  });
  probe.append(copy);
  root.closest(".resume-layout-stage").append(probe);
  try {
    const bounds = probe.getBoundingClientRect();
    const count = Math.max(1, copy.getClientRects().length);
    const pages = Array.from({ length: count }, () => ({ offset: 0, manual: false }));
    if (count < 2 || bounds.width <= 0) return pages;
    const top = root.getBoundingClientRect().top;
    const firstY = Array(count).fill(Infinity);
    const columnOf = rect => Math.max(0, Math.min(count - 1, Math.floor((rect.left - bounds.left + 0.5) / bounds.width)));
    const range = doc.createRange();
    const liveRange = doc.createRange();
    const live = readableNodes(root);
    for (const node of readableNodes(copy)) {
      const original = live.next().value;
      if (!original) break;
      if (node.nodeName === "HR") {
        const rect = node.getClientRects()[0];
        const next = rect && pages[columnOf(rect) + 1];
        if (next) {
          next.manual = true;
          next.offset = Math.max(0, (original.getBoundingClientRect().bottom - top) / zoom);
        }
        continue;
      }
      const isText = node.nodeType === 3;
      if (isText) range.selectNodeContents(node);
      const rects = (isText ? range : node).getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const page = columnOf(rect);
        if (!page || !rect.height || rect.top >= firstY[page]) continue;
        if (isText) liveRange.selectNodeContents(original);
        const originalRects = (isText ? liveRange : original).getClientRects();
        const match = originalRects[Math.min(i, originalRects.length - 1)];
        if (!match) continue;
        firstY[page] = rect.top;
        pages[page].offset = Math.max(0, (match.top - top) / zoom);
      }
    }
    return pages;
  } finally {
    probe.remove();
  }
}

function* readableNodes(root) {
  const { NodeFilter } = root.ownerDocument.defaultView;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest("iframe,video,audio,object,canvas")) return NodeFilter.FILTER_REJECT;
      if (node.nodeType === 3) return node.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      if (node.matches("style,script,.resume-layout-section-hidden")) return NodeFilter.FILTER_REJECT;
      return node.matches("hr,img,iframe,video,audio,object,canvas,.resume-layout-media-box")
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) yield walker.currentNode;
}

function pageBreakCounts(starts) {
  const breaks = starts.slice(1);
  const manual = breaks.filter(start => start.manual).length;
  return { manual, automatic: breaks.length - manual };
}

module.exports = { measurePageStarts, pageBreakCounts };
