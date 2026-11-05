// src/ の CSS と JS を1つの index.html にまとめる
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const JS_FILES = ["math.js", "generators.js", "storage.js", "quiz.js", "ui.js"];

const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");
const js = JS_FILES.map((f) => "// ---- " + f + " ----\n" + read(f)).join("\n");
if (/<\/script/i.test(js)) throw new Error("JS に </script が含まれています");
const css = read("style.css");

const html = read("index.template.html")
  .replace("<!--CSS-->", () => css)
  .replace("<!--JS-->", () => js);

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("index.html を書き出しました (" + Math.round(html.length / 1024) + " KB)");
