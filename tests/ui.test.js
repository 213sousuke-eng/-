const test = require("node:test");
const assert = require("node:assert/strict");
require("./_util.js");
require("../src/storage.js");
require("../src/quiz.js");
const { renderMath } = require("../src/ui.js");
const F = (n, d) => `<span class="frac"><span class="num">${n}</span><span class="den">${d}</span></span>`;

test("renderMath: 分数係数と分数式", () => {
  assert.equal(renderMath("y = 1/5x"), "y = " + F("1", "5") + "x");
  assert.equal(renderMath("y = -12/x"), "y = -" + F("12", "x"));
  assert.equal(renderMath("x/3 + y/2 = 1"), F("x", "3") + " + " + F("y", "2") + " = 1");
});
test("renderMath: かっこ付きの分子", () => {
  assert.equal(renderMath("(x + 1)/2 = (x - 3)/3"), F("x + 1", "2") + " = " + F("x - 3", "3"));
  assert.equal(renderMath("x = (3 ± √5)/2"), "x = " + F("3 ± √5", "2"));
});
test("renderMath: 根号の分数", () => {
  assert.equal(renderMath("-3√5/2"), "-" + F("3√5", "2"));
  assert.equal(renderMath("6/√3"), F("6", "√3"));
});
test("renderMath: 割り算記号や普通の式はそのまま", () => {
  assert.equal(renderMath("(-35) ÷ 7"), "(-35) ÷ 7");
  assert.equal(renderMath("x² + 5x + 6"), "x² + 5x + 6");
});
test("renderMath: HTML をエスケープし改行を br に", () => {
  assert.equal(renderMath("<b>&\n1"), "&lt;b&gt;&amp;<br>1");
});

test("renderMath: 1/(単項式) は単項式全体を分母にする", () => {
  assert.equal(renderMath("8a²b² × 1/(4ab)"), "8a²b² × " + F("1", "4ab"));
  assert.equal(renderMath("1/(-2b)"), F("1", "-2b"));
});
