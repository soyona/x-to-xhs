export const IMAGE_FORMATS = new Set(["png", "jpg", "jpeg", "webp"]);

export function imageFileName(title, page, format = "png") {
  const safe = String(title || "图文笔记").replace(/[\\/:*?"<>|\r\n]+/gu, "-").trim().slice(0, 80) || "图文笔记";
  const suffix = page.kind === "cover" ? "-封面" : "";
  return `${safe}-${String(page.index).padStart(2, "0")}${suffix}.${format === "jpeg" ? "jpg" : format}`;
}

export function validateImageExport({ pages, width, height, format, byteSize = 0 }) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 18) throw new Error("一次最多导出18张图片。");
  if (!IMAGE_FORMATS.has(format)) throw new Error("只支持 PNG、JPG、JPEG 或 WebP。");
  const ratio = width / height;
  if (!Number.isFinite(ratio) || width < 720 || height < 960 || ratio < 0.75 || ratio > 2) throw new Error("图片尺寸或宽高比不符合要求。");
  if (byteSize > 32 * 1024 * 1024) throw new Error("单张图片不能超过32MB。");
  return true;
}

export async function renderCardToBlob(element, { width, height, format = "png", quality = 0.92 }) {
  validateImageExport({ pages: [{}], width, height, format });
  if (!element) throw new Error("找不到要导出的图片页。");
  if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) throw new Error("页面内容溢出，请先精简或调整问题页。");
  const clone = element.cloneNode(true);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  const styles = [...document.styleSheets].flatMap((sheet) => {
    try { return [...sheet.cssRules].map((rule) => rule.cssText); } catch { return []; }
  }).join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${styles}</style>${clone.outerHTML}</div></foreignObject></svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("图片渲染失败。")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    const mime = format === "jpg" || format === "jpeg" ? "image/jpeg" : `image/${format}`;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) throw new Error("图片导出失败。");
    validateImageExport({ pages: [{}], width, height, format, byteSize: blob.size });
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
