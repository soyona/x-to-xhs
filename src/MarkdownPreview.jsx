import React, { useRef, useState } from "react";

const EMPTY_SCENES = [
  {
    id: "mario",
    className: "empty-mario-visual",
    label: "让 Mario 跳起来挥手",
    prompt: "移动鼠标或点击 Mario；从左侧加入内容后开始生成。",
  },
  {
    id: "transformers",
    className: "empty-transformers-visual",
    label: "触发擎天柱和大黄蜂的协同动作",
    prompt: "移动鼠标或点击两位机器人；从左侧加入内容后开始生成。",
  },
  {
    id: "minion",
    className: "empty-minion-visual",
    label: "让小黄人做鬼脸",
    prompt: "移动鼠标或点击小黄人；从左侧加入内容后开始生成。",
  },
];

function MarioScene() {
  return (
    <svg
      className="empty-mario-svg"
      viewBox="0 0 320 280"
      role="img"
      aria-labelledby="empty-mario-title"
    >
      <title id="empty-mario-title">会跟随鼠标并可点击跳跃的 Mario</title>
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
    </svg>
  );
}

function MinionScene() {
  return (
    <svg
      className="empty-minion-svg"
      viewBox="0 0 320 280"
      role="img"
      aria-labelledby="empty-minion-title"
    >
      <title id="empty-minion-title">会跟随鼠标并可点击做鬼脸的小黄人</title>
      <g className="empty-minion-character">
        <path className="empty-minion-hair" d="M129 61c-6-20-1-27 5-35m8 34c-1-23 7-30 14-37m0 38c5-21 15-26 23-29m-5 34c11-16 20-18 29-18" />
        <rect className="empty-minion-body" x="93" y="57" width="134" height="175" rx="65" />
        <path className="empty-minion-goggle-band" d="M94 100h132" />
        <g className="empty-minion-goggle" transform="translate(132 105)">
          <circle r="29" />
          <g className="empty-minion-eye-unit">
            <circle className="empty-minion-eye" r="20" />
            <circle className="empty-minion-pupil empty-minion-pupil-left" r="8" />
          </g>
        </g>
        <g className="empty-minion-goggle" transform="translate(188 105)">
          <circle r="29" />
          <g className="empty-minion-eye-unit">
            <circle className="empty-minion-eye" r="20" />
            <circle className="empty-minion-pupil empty-minion-pupil-right" r="8" />
          </g>
        </g>
        <ellipse className="empty-minion-mouth" cx="160" cy="155" rx="34" ry="21" />
        <path className="empty-minion-teeth" d="M132 149h56c-7 11-17 15-28 15s-21-4-28-15Z" />
        <path className="empty-minion-overalls" d="M104 173h112v58H104Z" />
        <path className="empty-minion-bib" d="M127 164h66v54h-66Z" />
        <path className="empty-minion-strap" d="m108 166 28 17m76-17-28 17" />
        <circle className="empty-minion-button" cx="132" cy="184" r="4" />
        <circle className="empty-minion-button" cx="188" cy="184" r="4" />
        <path className="empty-minion-tongue" d="M145 165c8-6 22-6 30 0-2 19-8 29-15 29s-13-10-15-29Z" />
        <g className="empty-minion-arm empty-minion-arm-left">
          <path d="M104 174c-27 2-34-15-23-35" />
          <circle cx="81" cy="134" r="11" />
        </g>
        <g className="empty-minion-arm empty-minion-arm-right">
          <path d="M216 174c27 2 34-15 23-35" />
          <circle cx="239" cy="134" r="11" />
        </g>
        <path className="empty-minion-leg" d="M125 225h27v25h-34Z" />
        <path className="empty-minion-leg" d="M168 225h27l7 25h-34Z" />
        <path className="empty-minion-boot" d="M116 245h38v13h-45Z" />
        <path className="empty-minion-boot" d="M168 245h37l7 13h-44Z" />
      </g>
    </svg>
  );
}

function EmptyWorkflowGuide() {
  const [scene] = useState(
    () => EMPTY_SCENES[Math.floor(Math.random() * EMPTY_SCENES.length)],
  );
  const sceneRef = useRef(null);

  function updateSceneMotion(event) {
    const scene = sceneRef.current;
    if (!scene) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      -1,
      Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)),
    );
    const y = Math.max(
      -1,
      Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)),
    );

    scene.style.setProperty("--look-x", `${x * 4}px`);
    scene.style.setProperty("--look-y", `${y * 3}px`);
    scene.style.setProperty("--body-lean", `${x * 2.5}deg`);
  }

  function resetSceneMotion() {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.style.setProperty("--look-x", "0px");
    scene.style.setProperty("--look-y", "0px");
    scene.style.setProperty("--body-lean", "0deg");
  }

  function playSceneAction() {
    const illustration = sceneRef.current;
    if (!illustration) return;
    illustration.classList.remove("is-active");
    void illustration.offsetWidth;
    illustration.classList.add("is-active");
  }

  function handleSceneKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    playSceneAction();
  }

  return (
    <div
      className="empty-state empty-workflow-guide"
      onPointerMove={updateSceneMotion}
      onPointerLeave={resetSceneMotion}
    >
      <div
        className={scene.className}
        ref={sceneRef}
        role="button"
        tabIndex="0"
        aria-label={scene.label}
        onClick={playSceneAction}
        onKeyDown={handleSceneKeyDown}
        onAnimationEnd={(event) => {
          if (["mario-jump", "optimus-salute", "minion-giggle"].includes(event.animationName)) {
            sceneRef.current?.classList.remove("is-active");
          }
        }}
      >
        {scene.id === "mario" ? (
          <MarioScene />
        ) : scene.id === "minion" ? (
          <MinionScene />
        ) : (
          <svg
          className="empty-transformers-svg"
          viewBox="0 0 360 280"
          role="img"
          aria-labelledby="empty-transformers-title"
        >
          <title id="empty-transformers-title">会跟随鼠标并可点击互动的擎天柱和大黄蜂</title>

          <g className="empty-bot empty-optimus">
            <g className="empty-bot-head empty-optimus-head">
              <path className="empty-optimus-helmet" d="M84 62h12l5-12h24l5 12h12v39l-12 14H96l-12-14Z" />
              <path className="empty-optimus-crest" d="m106 46 7-14 7 14v42h-14Z" />
              <path className="empty-optimus-face" d="M98 83h30v23l-8 8h-14l-8-8Z" />
              <path className="empty-bot-eyes" d="m96 75 13 3-4 7-10-3Zm34 0-13 3 4 7 10-3Z" />
            </g>

            <g className="empty-optimus-torso">
              <path className="empty-optimus-chest" d="M73 112h80l12 57-18 22H80l-18-22Z" />
              <path className="empty-optimus-window" d="m80 119 28 4-5 31H78Zm66 0-28 4 5 31h25Z" />
              <path className="empty-optimus-core" d="M104 158h18v20h-18Z" />
            </g>

            <g className="empty-optimus-arm empty-optimus-arm-left">
              <path className="empty-optimus-shoulder" d="M61 116 38 126l7 36 25-8Z" />
              <path className="empty-bot-metal" d="m46 157 21-7 8 44-18 8Z" />
              <path className="empty-bot-hand" d="m57 198 19-7 6 18-19 7Z" />
            </g>
            <g className="empty-optimus-arm empty-optimus-arm-right">
              <path className="empty-optimus-shoulder" d="m165 116 23 10-7 36-25-8Z" />
              <path className="empty-bot-metal" d="m180 157-21-7-8 44 18 8Z" />
              <path className="empty-bot-hand" d="m169 198-19-7-6 18 19 7Z" />
              <path className="empty-optimus-blade" d="m159 205-9 53 18-45Z" />
            </g>

            <path className="empty-optimus-leg" d="M81 183h31l-6 50H72Z" />
            <path className="empty-optimus-leg" d="M116 183h30l12 50h-36Z" />
            <path className="empty-bot-foot" d="M70 224h38v17H62Z" />
            <path className="empty-bot-foot" d="M122 224h37l9 17h-46Z" />
          </g>

          <g className="empty-bot empty-bumblebee">
            <circle className="empty-bumblebee-wheel empty-bumblebee-wheel-left" cx="222" cy="150" r="18" />
            <circle className="empty-bumblebee-wheel empty-bumblebee-wheel-right" cx="299" cy="150" r="18" />

            <g className="empty-bot-head empty-bumblebee-head">
              <path className="empty-bumblebee-helmet" d="M242 76h38l10 17-7 28-22 10-23-10-7-28Z" />
              <path className="empty-bumblebee-antenna" d="m240 82-9-24m49 24 10-24" />
              <path className="empty-bumblebee-face" d="m244 98 17-9 17 9-4 22-13 8-13-8Z" />
              <path className="empty-bot-eyes" d="m241 95 16 3-6 8-12-4Zm40 0-16 3 6 8 12-4Z" />
            </g>

            <path className="empty-bumblebee-chest" d="m226 128 35-10 36 10 7 57-20 21h-47l-19-21Z" />
            <path className="empty-bumblebee-window" d="m233 133 25-7v30l-28-5Zm56 0-24-7v30l27-5Z" />
            <path className="empty-bumblebee-stripe" d="M255 122h12v80h-12Z" />

            <g className="empty-bumblebee-arm empty-bumblebee-arm-left">
              <path d="m226 137-24 19 10 41 20-8Z" />
              <path className="empty-bot-hand" d="m210 191 21-7 5 18-20 7Z" />
            </g>
            <g className="empty-bumblebee-arm empty-bumblebee-arm-right">
              <path d="m296 137 24 19-10 41-20-8Z" />
              <path className="empty-bot-hand" d="m312 191-21-7-5 18 20 7Z" />
            </g>

            <path className="empty-bumblebee-leg" d="M235 194h24l-3 40h-31Z" />
            <path className="empty-bumblebee-leg" d="M266 194h23l9 40h-31Z" />
            <path className="empty-bot-foot" d="M224 226h33v15h-41Z" />
            <path className="empty-bot-foot" d="M268 226h31l9 15h-40Z" />
          </g>

          </svg>
        )}
      </div>

      <div className="empty-workflow-heading">
        <span className="empty-workflow-kicker">PUBLISHING KIT</span>
        <h2>一份素材，四个可复制区块</h2>
        <p>{scene.prompt}</p>
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
