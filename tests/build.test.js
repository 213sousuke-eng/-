const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

test("build で外部参照のない index.html ができる", () => {
  const root = path.join(__dirname, "..");
  execFileSync(process.execPath, [path.join(root, "build.js")], { cwd: root });
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(!html.includes("<script src="));
  assert.ok(!/<link[^>]+rel="stylesheet"/.test(html));
  assert.ok(!html.includes("http://"));
  assert.ok(!html.includes("https://"));
  assert.ok(html.includes('<meta name="viewport"'));
  assert.ok(html.includes("apple-mobile-web-app-capable"));
  assert.ok(!html.includes("<!--JS-->") && !html.includes("<!--CSS-->"));
  assert.ok(html.includes("MathApp"));
});
