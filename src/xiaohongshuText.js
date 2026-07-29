export function toXiaohongshuText(
  markdown = "",
  { preserveHighlights = false } = {},
) {
  const needsCompatibilityCleanup =
    /(?:^|\n)\s*(?:#{1,6}\s|>|[-*+]\s|```|\|.+\|)|\*\*|__|~~|`[^`\n]+`/u.test(
      markdown,
    ) ||
    /(?<![=])==[^=\n]+==(?![=])|未完待续|(?:^|\n)\s*[-*_](?:\s*[-*_]){2,}\s*(?:\n|$)/u.test(
      markdown,
    );
  const cleaned = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*```[^\n]*$/gm, "")
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(
      /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/gm,
      "",
    )
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, cells) =>
      cells
        .split("|")
        .map((cell) => cell.trim())
        .join("｜"),
    )
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/^[ \t]*（未完待续，下滑查看下一章 ➡️）[ \t]*$/gm, "")
    .replace(/^[ \t]*[-*_](?:[ \t]*[-*_]){2,}[ \t]*$/gm, "")
    .replace(/^[ \t]*[*+][ \t]+/gm, "- ")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(
      /(?<![=])==([^=\n]+)==(?![=])/gu,
      (_, content) => preserveHighlights ? `==${content}==` : content,
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+$/gm, "")
    .trim();

  return needsCompatibilityCleanup
    ? cleaned.replace(/\n{3,}/g, "\n\n")
    : cleaned;
}

export function toXiaohongshuPlainText(markdown = "") {
  return toXiaohongshuText(markdown)
    .replace(/^[ \t]{0,3}#{1,2}[ \t]+/gm, "")
    .replace(/^[ \t]*-[ \t]+/gm, "• ");
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function richInlineMarkdown(value = "") {
  const parts = value.split(/(?<![=])==([^=\n]+)==(?![=])/gu);
  return parts
    .map((part, index) =>
      index % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part),
    )
    .join("");
}

export function toXiaohongshuRichHtml(markdown = "") {
  const lines = toXiaohongshuText(markdown, {
    preserveHighlights: true,
  }).split("\n");
  const html = [];
  let listType = "";

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  }

  function appendListItem(type, content) {
    if (listType !== type) {
      closeList();
      listType = type;
      html.push(`<${type}>`);
    }
    html.push(`<li>${richInlineMarkdown(content)}</li>`);
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const h2Match = /^##\s+(.+)/u.exec(trimmed);
    const h1Match = /^#\s+(.+)/u.exec(trimmed);
    const bulletMatch = /^-\s+(.+)/u.exec(trimmed);
    const orderedMatch = /^\d+[.、）)]\s+(.+)/u.exec(trimmed);

    if (!trimmed) {
      closeList();
      html.push("<p><br></p>");
    } else if (h2Match) {
      closeList();
      html.push(`<h2>${richInlineMarkdown(h2Match[1])}</h2>`);
    } else if (h1Match) {
      closeList();
      html.push(`<h1>${richInlineMarkdown(h1Match[1])}</h1>`);
    } else if (bulletMatch) {
      appendListItem("ul", bulletMatch[1]);
    } else if (orderedMatch) {
      appendListItem("ol", orderedMatch[1]);
    } else {
      closeList();
      html.push(`<p>${richInlineMarkdown(trimmed)}</p>`);
    }
  }

  closeList();
  return `<div>${html.join("")}</div>`;
}
