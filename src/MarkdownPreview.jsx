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

    mascot.style.setProperty("--look-x", `${x * 5}px`);
    mascot.style.setProperty("--look-y", `${y * 4}px`);
    mascot.style.setProperty("--head-tilt", `${x * 2.5}deg`);
  }

  function resetMascotLook() {
    const mascot = mascotRef.current;
    if (!mascot) return;
    mascot.style.setProperty("--look-x", "0px");
    mascot.style.setProperty("--look-y", "0px");
    mascot.style.setProperty("--head-tilt", "0deg");
  }

  return (
    <div
      className="empty-state empty-workflow-guide"
      onPointerMove={updateMascotLook}
      onPointerLeave={resetMascotLook}
    >
      <div className="empty-mascot-visual" ref={mascotRef}>
        <svg
          className="empty-mascot-svg"
          viewBox="0 0 320 280"
          role="img"
          aria-labelledby="empty-mascot-title"
        >
          <title id="empty-mascot-title">守着笔记卡片、眼睛跟随鼠标的小黑猫</title>

          <g className="empty-mascot-card empty-mascot-card-back">
            <rect x="72" y="42" width="184" height="166" rx="12" />
            <path d="M92 67h76M92 80h118M92 93h94" />
          </g>
          <g className="empty-mascot-card empty-mascot-card-mid">
            <rect x="57" y="58" width="192" height="158" rx="12" />
            <path d="M78 84h82M78 97h126M78 110h103" />
          </g>

          <path
            className="empty-mascot-tail"
            d="M209 181c47-2 59 35 30 51-15 8-32 0-29-14"
          />

          <g className="empty-mascot-head">
            <path className="empty-mascot-ear" d="M103 101 111 50l34 34Z" />
            <path
              className="empty-mascot-ear empty-mascot-ear-right"
              d="m166 82 36-31 5 54Z"
            />
            <ellipse className="empty-mascot-face" cx="155" cy="120" rx="59" ry="52" />

            <g className="empty-mascot-eye" transform="translate(128 111)">
              <ellipse rx="13" ry="15" />
              <circle className="empty-mascot-pupil" r="5" />
            </g>
            <g className="empty-mascot-eye empty-mascot-eye-right" transform="translate(167 111)">
              <ellipse rx="13" ry="15" />
              <circle className="empty-mascot-pupil" r="5" />
            </g>

            <path className="empty-mascot-nose" d="m147 132 8 6 8-6Z" />
            <path className="empty-mascot-mouth" d="M155 138v5m0 0-8 5m8-5 8 5" />
            <path className="empty-mascot-whiskers" d="m136 138-39-6m39 13-42 7m80-14 39-6m-39 13 42 7" />
          </g>

          <g className="empty-mascot-card empty-mascot-card-front">
            <rect x="55" y="160" width="202" height="82" rx="12" />
            <path d="M78 187h119M78 201h153M78 215h98" />
          </g>
          <ellipse className="empty-mascot-paw" cx="116" cy="165" rx="18" ry="10" />
          <ellipse className="empty-mascot-paw" cx="193" cy="165" rx="18" ry="10" />
        </svg>
      </div>

      <div className="empty-workflow-heading">
        <span className="empty-workflow-kicker">PUBLISHING KIT</span>
        <h2>一份素材，四个可复制区块</h2>
        <p>从左侧加入内容或链接，生成后分别复制到小红书。</p>
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
