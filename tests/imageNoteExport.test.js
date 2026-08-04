import test from "node:test";
import assert from "node:assert/strict";
import { imageFileName, validateImageExport } from "../src/imageNoteExport.js";

test("图文导出限制格式、尺寸、比例、数量和32MB", () => {
  assert.equal(imageFileName("标题/测试", { index: 1, kind: "cover" }), "标题-测试-01-封面.png");
  assert.equal(validateImageExport({ pages: Array.from({ length: 18 }), width: 1080, height: 1440, format: "png" }), true);
  assert.throws(() => validateImageExport({ pages: Array.from({ length: 19 }), width: 1080, height: 1440, format: "png" }), /18/u);
  assert.throws(() => validateImageExport({ pages: [{}], width: 1080, height: 1440, format: "gif" }), /PNG/u);
  assert.throws(() => validateImageExport({ pages: [{}], width: 500, height: 2000, format: "webp" }), /尺寸/u);
  assert.throws(() => validateImageExport({ pages: [{}], width: 1080, height: 1440, format: "jpg", byteSize: 33 * 1024 * 1024 }), /32MB/u);
});
