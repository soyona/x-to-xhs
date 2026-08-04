export const PROMPT_SCHEMA_VERSION = 1;
export const PROMPT_FILE_LIMIT = 200 * 1024;

export const PROMPT_DEFINITIONS = {
  longform: {
    type: "longform",
    defaultPath: "prompts/longform/default.md",
    localPath: "prompts/longform.json",
    exportPrefix: "xhs-longform-prompt",
    modules: ["global", "title", "body", "summary", "tags", "output", "source"],
    editable: ["global", "title", "body", "summary", "tags"],
    protected: ["output", "source"],
  },
  "image-note": {
    type: "image-note",
    defaultPath: "prompts/image-note/default.md",
    localPath: "prompts/image-note.json",
    exportPrefix: "xhs-image-note-prompt",
    modules: ["global", "title", "images", "summary", "tags", "output", "source"],
    editable: ["global", "title", "images", "summary", "tags"],
    protected: ["output", "source"],
    visual: ["images"],
  },
};

export function getPromptDefinition(type) {
  const definition = PROMPT_DEFINITIONS[type];
  if (!definition) throw new Error("未知的提示词类型。");
  return definition;
}
