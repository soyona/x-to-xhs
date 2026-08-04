import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react";
import { ImageCardRenderer } from "./ImageCardRenderer";
import { imageFileName, renderCardToBlob } from "./imageNoteExport";
import { updateCoverTitle } from "./imageNoteSchema";

function trigger(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MaterialAction({ children, icon, variant = "", ...props }) {
  return (
    <button className={`material-action ${variant ? `is-${variant}` : ""}`} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function CandidateList({ candidates, onApply, onCopy }) {
  if (!candidates.length) return null;
  return (
    <div className="material-candidates" aria-label="重新生成的候选内容">
      {candidates.map((candidate, index) => {
        const value = Array.isArray(candidate) ? candidate.join(" ") : candidate;
        return (
          <div className="material-candidate" key={`${index}-${value}`}>
            <span>{value}</span>
            <button type="button" onClick={() => onCopy(value)}>复制</button>
            <button type="button" onClick={() => onApply(candidate)}>采用</button>
          </div>
        );
      })}
    </div>
  );
}

export function ImageNoteWorkflow({
  note,
  onChange,
  onGenerateSection,
  promptName,
  generateInitialTitleCandidates = false,
}) {
  const [current, setCurrent] = useState(0);
  const [titleCandidates, setTitleCandidates] = useState([]);
  const [sectionCandidates, setSectionCandidates] = useState({
    description: [],
    tags: [],
  });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [stale, setStale] = useState({ description: false, tags: false });
  const cancelBatchRef = useRef(false);
  const copyTokenRef = useRef(0);
  const cardRef = useRef(null);
  const initialCandidatesRequested = useRef(false);
  const page = note.pages[current] || note.pages[0];

  useEffect(() => {
    setCurrent((value) => Math.min(value, note.pages.length - 1));
  }, [note.pages.length]);

  useEffect(() => {
    if (!generateInitialTitleCandidates || initialCandidatesRequested.current) return;
    initialCandidatesRequested.current = true;
    void generate("title");
  }, [generateInitialTitleCandidates]);

  useEffect(() => {
    function key(event) {
      if (/INPUT|TEXTAREA/.test(event.target?.tagName)) return;
      if (event.key === "ArrowLeft") setCurrent((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") {
        setCurrent((value) => Math.min(note.pages.length - 1, value + 1));
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [note.pages.length]);

  function updatePage(next) {
    onChange({
      ...note,
      pages: note.pages.map((item) => item.id === next.id ? next : item),
    });
    setStale({ description: true, tags: true });
  }

  async function copyValue(key, value) {
    if (!value) return;
    const token = ++copyTokenRef.current;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => {
        if (copyTokenRef.current === token) setCopied("");
      }, 1800);
    } catch {
      setNotice("复制失败，请重试。");
    }
  }

  async function generate(section) {
    setBusy(section);
    setNotice("");
    try {
      const result = await onGenerateSection({
        section,
        imageNote: note,
        currentValue: section === "title" ? note.title : note[section],
      });
      if (section === "title") {
        setTitleCandidates(result.candidates);
      } else if (section === "images") {
        onChange({ ...note, pages: result.candidates[0] });
        setStale({ description: true, tags: true });
      } else {
        setSectionCandidates((value) => ({
          ...value,
          [section]: result.candidates,
        }));
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  async function downloadPages(pages) {
    if (!pages.length || busy) return;
    setBusy("download");
    setNotice("");
    cancelBatchRef.current = false;
    try {
      for (let index = 0; index < pages.length; index += 1) {
        if (cancelBatchRef.current) {
          setNotice(`已取消，已发起 ${index} / ${pages.length} 张。`);
          break;
        }
        const target = pages[index];
        if (target.id !== page.id) {
          setCurrent(note.pages.findIndex((item) => item.id === target.id));
        }
        await new Promise((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
        });
        const blob = await renderCardToBlob(cardRef.current, {
          ...note.themeTokens.canvas,
          format: "png",
        });
        trigger(blob, imageFileName(note.title, target));
      }
    } catch (error) {
      setNotice(`下载被阻止或导出失败：${error.message}。可重试或单张下载。`);
    } finally {
      setBusy("");
    }
  }

  const titleCount = note.title.replace(/\s/gu, "").length;
  const descriptionCount = note.description.length;
  const tagsValue = note.tags.join(" ");

  return (
    <div className="image-note-workflow publishing-kit">
      <section className="material-section is-title" aria-labelledby="image-title-label">
        <div className="material-section-heading">
          <h3 id="image-title-label">标题</h3>
          <span className="material-meta">{titleCount} 字</span>
          <div className="material-actions">
            {copied === "title" && <span className="material-copy-feedback" role="status">已复制</span>}
            <MaterialAction variant="copy" icon={<Copy />} onClick={() => copyValue("title", note.title)} disabled={!note.title}>复制</MaterialAction>
            <MaterialAction icon={<RefreshCw />} onClick={() => generate("title")} disabled={Boolean(busy)}>{busy === "title" ? "生成中" : "重新生成"}</MaterialAction>
          </div>
        </div>
        <input
          className="material-input"
          value={note.title}
          onChange={(event) => onChange(updateCoverTitle(note, event.target.value))}
          aria-label="图文标题"
        />
        <CandidateList
          candidates={titleCandidates}
          onCopy={(value) => copyValue("title-candidate", value)}
          onApply={(value) => onChange(updateCoverTitle(note, value))}
        />
      </section>

      <section className="material-section is-images" aria-labelledby="image-pages-label">
        <div className="material-section-heading">
          <h3 id="image-pages-label">图片</h3>
          <span className="material-meta">{current + 1} / {note.pages.length}</span>
          <div className="material-actions">
            <MaterialAction icon={<Download />} onClick={() => downloadPages([page])} disabled={Boolean(busy)}>下载当前图</MaterialAction>
            <MaterialAction icon={<Download />} onClick={() => downloadPages(note.pages)} disabled={Boolean(busy)}>下载全部</MaterialAction>
            <MaterialAction icon={<RefreshCw />} onClick={() => generate("images")} disabled={Boolean(busy)}>{busy === "images" ? "生成中" : "重新生成图片"}</MaterialAction>
          </div>
        </div>
        <div className="image-note-stage">
          <div className="image-canvas is-fit">
            <ImageCardRenderer
              ref={cardRef}
              page={page}
              pages={note.pages}
              themeTokens={note.themeTokens}
              editable
              onChange={updatePage}
            />
          </div>
          <div className="image-note-filmstrip">
            <button className="filmstrip-arrow" type="button" aria-label="上一张" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}><ChevronLeft /></button>
            <div className="image-note-thumbnails" aria-label="图片缩略图">
              {note.pages.map((item, index) => (
                <button
                  className="image-note-thumbnail"
                  type="button"
                  key={item.id}
                  aria-current={index === current ? "page" : undefined}
                  aria-label={`查看第 ${item.index} 张图片`}
                  onClick={() => setCurrent(index)}
                >
                  <ImageCardRenderer page={item} pages={note.pages} themeTokens={note.themeTokens} />
                  <span>{item.index}</span>
                </button>
              ))}
            </div>
            <button className="filmstrip-arrow" type="button" aria-label="下一张" disabled={current === note.pages.length - 1} onClick={() => setCurrent((value) => value + 1)}><ChevronRight /></button>
          </div>
        </div>
        {busy === "download" && (
          <button className="material-cancel-action" type="button" onClick={() => { cancelBatchRef.current = true; }}>取消尚未发起的下载</button>
        )}
      </section>

      <section className="material-section is-description" aria-labelledby="image-description-label">
        <div className="material-section-heading">
          <h3 id="image-description-label">正文描述</h3>
          <span className={`material-meta ${descriptionCount > 1000 ? "is-warning" : ""}`}>{descriptionCount} / 1000 字</span>
          <div className="material-actions">
            {copied === "description" && <span className="material-copy-feedback" role="status">已复制</span>}
            <MaterialAction variant="copy" icon={<Copy />} onClick={() => copyValue("description", note.description)} disabled={!note.description}>复制</MaterialAction>
            <MaterialAction icon={<RefreshCw />} onClick={() => generate("description")} disabled={Boolean(busy)}>{busy === "description" ? "生成中" : "重新生成"}</MaterialAction>
          </div>
        </div>
        {stale.description && <p className="material-stale-notice">图片已更新，当前描述可能仍基于上一版内容。</p>}
        <textarea className="material-textarea" value={note.description} onChange={(event) => {
          onChange({ ...note, description: event.target.value });
          setStale((before) => ({ ...before, description: false }));
        }} aria-label="图文正文描述" />
        <CandidateList
          candidates={sectionCandidates.description}
          onCopy={(value) => copyValue("description-candidate", value)}
          onApply={(value) => {
            onChange({ ...note, description: value });
            setStale((before) => ({ ...before, description: false }));
          }}
        />
      </section>

      <section className="material-section is-tags" aria-labelledby="image-tags-label">
        <div className="material-section-heading">
          <h3 id="image-tags-label">标签</h3>
          <span className="material-meta">{note.tags.length} 个</span>
          <div className="material-actions">
            {copied === "tags" && <span className="material-copy-feedback" role="status">已复制</span>}
            <MaterialAction variant="copy" icon={<Copy />} onClick={() => copyValue("tags", tagsValue)} disabled={!tagsValue}>复制</MaterialAction>
            <MaterialAction icon={<RefreshCw />} onClick={() => generate("tags")} disabled={Boolean(busy)}>{busy === "tags" ? "生成中" : "重新生成"}</MaterialAction>
          </div>
        </div>
        {stale.tags && <p className="material-stale-notice">图片已更新，当前标签可能仍基于上一版内容。</p>}
        <input className="material-input" value={tagsValue} onChange={(event) => {
          onChange({ ...note, tags: event.target.value.split(/\s+/u).filter(Boolean) });
          setStale((before) => ({ ...before, tags: false }));
        }} aria-label="图文标签" />
        <CandidateList
          candidates={sectionCandidates.tags}
          onCopy={(value) => copyValue("tags-candidate", value)}
          onApply={(value) => {
            onChange({ ...note, tags: value });
            setStale((before) => ({ ...before, tags: false }));
          }}
        />
      </section>

      {notice && <p className="image-note-notice" role="status">{notice}</p>}
      <span className="publishing-kit-profile" aria-hidden="true">{promptName || "当前图文方案"}</span>
    </div>
  );
}
