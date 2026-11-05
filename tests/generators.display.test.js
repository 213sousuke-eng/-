// 生徒に見える文字列の表記チェック（最終レビューの指摘）
const test = require("node:test");
const assert = require("node:assert/strict");
const { forAll, G } = require("./_util.js");

const ALL = G.UNITS.map((u) => u.id);
function texts(p) {
  return [p.prompt].concat(p.steps, [].concat(p.answer), p.choices || []);
}

test("^ による指数表記が出ない", () => {
  for (const id of ALL) forAll(id, (p) => {
    for (const t of texts(p)) assert.ok(!t.includes("^"), id + ": " + t);
  }, 500);
});

test("手順の 1/単項式 はかっこで包む（縦の分数で誤読されない）", () => {
  forAll("polycalc", (p) => {
    for (const s of p.steps) assert.ok(!/1\/(?!\()/.test(s), s);
  }, 1000);
});

test("手順に 1√、0√、1a、+ 0 などの不自然な表記がない", () => {
  for (const id of ALL) forAll(id, (p) => {
    for (const s of p.steps) {
      assert.ok(!/(^|[^\d/])[01]√/.test(s), id + ": " + s);
      assert.ok(!/(^|[^\d/])1a\b/.test(s), id + ": " + s);
      // 傾きの代入式 (y2 - y1) の「- 0」は正しい書き方なので除く
      if (!s.startsWith("傾き =")) assert.ok(!/[+-] 0($|[^\d./])/.test(s), id + ": " + s);
      assert.ok(!/\) -\(/.test(s), id + ": " + s);
    }
  }, 500);
});
