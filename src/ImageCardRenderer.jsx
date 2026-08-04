import { forwardRef, useMemo } from "react";

export const ImageCardRenderer = forwardRef(function ImageCardRenderer({ page, pages, themeTokens, editable = false, onChange }, ref) {
  const words = useMemo(() => [page.heading, page.subheading, ...page.body, page.highlight].filter(Boolean).join("").replace(/\s/gu, "").length, [page]);
  const totalWords = useMemo(() => pages.flatMap((item) => [item.heading, item.subheading, ...item.body, item.highlight]).filter(Boolean).join("").replace(/\s/gu, "").length, [pages]);
  const tokens = themeTokens;
  const style = { "--card-bg": tokens.colors.background, "--card-text": tokens.colors.text, "--card-accent": tokens.colors.accent, aspectRatio: `${tokens.canvas.width} / ${tokens.canvas.height}` };
  const change = (field, value) => onChange?.({ ...page, [field]: value });
  return (
    <article ref={ref} className={`image-card image-card--${tokens.layout} image-card--${page.kind}`} style={style} aria-label={`第${page.index}页，共${pages.length}页`}>
      <div className="image-card-accent" />
      {editable ? <input className="image-card-heading" value={page.heading} onChange={(event) => change("heading", event.target.value)} aria-label="页面标题" /> : <h2 className="image-card-heading">{page.heading}</h2>}
      {editable ? <textarea className="image-card-subheading" value={page.subheading || ""} onChange={(event) => change("subheading", event.target.value)} aria-label="页面副标题" /> : page.subheading && <p className="image-card-subheading">{page.subheading}</p>}
      <div className="image-card-body">
        {editable ? <textarea value={page.body.join("\n")} onChange={(event) => change("body", event.target.value.split(/\n/u).map((item) => item.trim()).filter(Boolean))} aria-label="页面正文，每行一段" /> : page.body.map((item, index) => <p key={`${page.id}-${index}`}>{item}</p>)}
      </div>
      {page.highlight && <p className="image-card-highlight">{page.highlight}</p>}
      <footer>
        <span>{tokens.showWordCount ? `${page.kind === "cover" ? totalWords : words} 字` : ""}</span>
        <span>{tokens.showReadingTime ? `约 ${Math.max(1, Math.ceil(totalWords / 400))} 分钟` : ""}</span>
        <span>{tokens.showPageNumber ? `${String(page.index).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}` : ""}</span>
      </footer>
    </article>
  );
});
