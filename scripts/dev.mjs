import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;

const children = [
  spawn(
    nodeCommand,
    [
      "--watch-preserve-output",
      "--watch-path=server.mjs",
      "--watch-path=historyStore.mjs",
      "--watch-path=promptStore.mjs",
      "--watch-path=providers.mjs",
      "--watch-path=src/contentPreferences.js",
      "--watch-path=src/sectionGeneration.js",
      "--watch-path=src/xiaohongshuPublish.js",
      "--watch-path=src/xiaohongshuText.js",
      "server.mjs",
    ],
    { stdio: "inherit" },
  ),
  spawn(npmCommand, ["exec", "vite"], { stdio: "inherit" }),
];

let shuttingDown = false;

function stop(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0 && signal !== "SIGTERM") {
      stop(code || 1);
    }
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
