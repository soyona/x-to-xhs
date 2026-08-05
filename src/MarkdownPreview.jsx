import React, { useRef } from "react";

function EmptyWorkflowGuide() {
  const mascotRef = useRef(null);

  function updateMascotLook(event) {
    const mascot = mascotRef.current;
    if (!mascot) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      -1,
      Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)),
    );
    const y = Math.max(
      -1,
      Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)),
    );

    mascot.style.setProperty("--look-x", `${x * 3}px`);
    mascot.style.setProperty("--look-y", `${y * 2}px`);
    mascot.style.setProperty("--body-lean", `${x * 4}deg`);
  }

  function resetMascotLook() {
    const mascot = mascotRef.current;
    if (!mascot) return;
    mascot.style.setProperty("--look-x", "0px");
    mascot.style.setProperty("--look-y", "0px");
    mascot.style.setProperty("--body-lean", "0deg");
  }

  function playMarioAction() {
    const mascot = mascotRef.current;
    if (!mascot) return;
    mascot.classList.remove("is-jumping");
    void mascot.offsetWidth;
    mascot.classList.add("is-jumping");
  }

  function handleMarioKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    playMarioAction();
  }

  return (
    <div
      className="empty-state empty-workflow-guide"
      onPointerMove={updateMascotLook}
      onPointerLeave={resetMascotLook}
    >
      <div
        className="empty-mario-visual"
        ref={mascotRef}
        role="button"
        tabIndex="0"
        aria-label="让 Mario 跳起来顶问号砖块"
        onClick={playMarioAction}
        onKeyDown={handleMarioKeyDown}
        onAnimationEnd={(event) => {
          if (event.animationName === "mario-jump") {
            mascotRef.current?.classList.remove("is-jumping");
          }
        }}
      >
        <svg
          className="empty-mario-svg"
          viewBox="0 0 320 280"
          role="img"
          aria-labelledby="empty-mario-title"
        >
          <title id="empty-mario-title">会跟随鼠标并可点击跳跃的 Mario</title>

          <g className="empty-mario-layer empty-mario-layer-back">
            <rect x="53" y="194" width="232" height="42" rx="10" />
            <path d="M75 207h71m12 0h47m11 0h45" />
          </g>
          <g className="empty-mario-layer empty-mario-layer-mid">
            <rect x="35" y="211" width="250" height="38" rx="10" />
            <path d="M57 224h91m12 0h49m12 0h41" />
          </g>

          <g className="empty-mario-question">
            <rect x="226" y="63" width="50" height="50" rx="7" />
            <path d="M233 72h36M233 104h36M235 68v38m32-38v38" />
            <text x="251" y="99" textAnchor="middle">?</text>
          </g>
          <g className="empty-mario-coin">
            <ellipse cx="251" cy="51" rx="9" ry="13" />
            <path d="M251 42v18" />
          </g>

          <g className="empty-mario-character">
            <ellipse className="empty-mario-ear" cx="119" cy="111" rx="10" ry="13" />
            <ellipse className="empty-mario-face" cx="154" cy="108" rx="38" ry="39" />
            <path className="empty-mario-hair" d="M119 96c4-22 18-35 41-35 21 0 34 13 37 32-15-9-30-12-45-8-12 4-20 9-33 11Z" />
            <path className="empty-mario-cap" d="M115 80c8-23 26-34 48-31 18 2 29 12 35 28l-13 9c-21-10-45-8-70-6Z" />
            <path className="empty-mario-cap-brim" d="M111 81c30-7 62-6 88 3-2 8-9 11-18 9l-45-3c-13 0-22-2-25-9Z" />
            <circle className="empty-mario-cap-mark" cx="158" cy="65" r="10" />
            <text className="empty-mario-cap-letter" x="158" y="70" textAnchor="middle">M</text>

            <g className="empty-mario-eye" transform="translate(145 105)">
              <ellipse rx="7" ry="10" />
              <circle className="empty-mario-pupil" r="3.5" />
            </g>
            <g className="empty-mario-eye" transform="translate(170 105)">
              <ellipse rx="7" ry="10" />
              <circle className="empty-mario-pupil" r="3.5" />
            </g>
            <ellipse className="empty-mario-nose" cx="184" cy="116" rx="13" ry="10" />
            <path className="empty-mario-mustache" d="M143 125c9 7 19 7 29 0 5 6 11 8 18 6-3 13-14 19-29 16-13 1-23-5-27-16 4 1 7-1 9-6Z" />

            <path className="empty-mario-shirt" d="M126 149c10-10 22-14 35-14s26 4 35 14l-8 39h-54Z" />
            <path className="empty-mario-overalls" d="M137 151h47l7 49h-61Z" />
            <path className="empty-mario-bib" d="M143 151h35v31h-35Z" />
            <path className="empty-mario-strap" d="m138 146 11 4v25h-10Zm45 0-11 4v25h10Z" />
            <circle className="empty-mario-button" cx="148" cy="174" r="3" />
            <circle className="empty-mario-button" cx="174" cy="174" r="3" />

            <g className="empty-mario-arm empty-mario-arm-left">
              <path d="M130 153c-14 3-22 13-25 29" />
              <circle cx="103" cy="188" r="12" />
            </g>
            <g className="empty-mario-arm empty-mario-arm-right">
              <path d="M191 153c13-6 22-17 25-31" />
              <circle cx="218" cy="116" r="12" />
            </g>

            <path className="empty-mario-leg" d="M135 194h25v24h-35c-2-10 2-18 10-24Z" />
            <path className="empty-mario-leg" d="M166 194h23c10 7 13 15 9 24h-36Z" />
            <path className="empty-mario-boot" d="M123 211h39v14h-46c-2-7 1-12 7-14Z" />
            <path className="empty-mario-boot" d="M164 211h38c8 3 10 8 7 14h-47Z" />
          </g>

          <g className="empty-mario-layer empty-mario-layer-front">
            <rect x="28" y="226" width="264" height="28" rx="9" />
            <path d="M51 239h62m12 0h88m12 0h43" />
          </g>
        </svg>
      </div>

      <div className="empty-workflow-heading">
        <span className="empty-workflow-kicker">PUBLISHING KIT</span>
        <h2>一份素材，四个可复制区块</h2>
        <p>移动鼠标或点击 Mario；从左侧加入内容后开始生成。</p>
      </div>
    </div>
  );
}

function inlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
}

export function MarkdownPreview({ markdown }) {
  if (!markdown) {
    return <EmptyWorkflowGuide />;
  }

  const blocks = markdown.split("\n");
  return (
    <article className="markdown-document">
      {blocks.map((line, index) => {
        if (!line.trim()) return <div className="paragraph-gap" key={index} />;
        if (/^###\s+/.test(line))
          return <h3 key={index}>{inlineMarkdown(line.replace(/^###\s+/, ""))}</h3>;
        if (/^##\s+/.test(line))
          return <h2 key={index}>{inlineMarkdown(line.replace(/^##\s+/, ""))}</h2>;
        if (/^#\s+/.test(line))
          return <h1 key={index}>{inlineMarkdown(line.replace(/^#\s+/, ""))}</h1>;
        if (/^\s*[-*+]\s+/.test(line))
          return (
            <div className="list-line" key={index}>
              <span aria-hidden="true">•</span>
              <p>{inlineMarkdown(line.replace(/^\s*[-*+]\s+/, ""))}</p>
            </div>
          );
        if (/^\s*\d+[.、）)]\s+/.test(line))
          return <p key={index}>{inlineMarkdown(line)}</p>;
        if (/^【建议配图[：:]/.test(line.trim()))
          return (
            <aside className="image-note" key={index}>
              {line.trim()}
            </aside>
          );
        return <p key={index}>{inlineMarkdown(line)}</p>;
      })}
    </article>
  );
}
