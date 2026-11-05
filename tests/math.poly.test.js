const test = require("node:test");
const assert = require("node:assert/strict");
const { Poly, Frac, formatPoly, mulberry32, randInt } = require("../src/math.js");

const x = Poly.var("x"), y = Poly.var("y"), a = Poly.var("a"), b = Poly.var("b");
const c = (n) => Poly.const(n);

test("formatPoly: 展開結果", () => {
  assert.equal(formatPoly(x.add(c(2)).mul(x.add(c(3)))), "x² + 5x + 6");
  assert.equal(formatPoly(x.sub(c(3)).pow(2)), "x² - 6x + 9");
});
test("formatPoly: 係数1と-1", () => {
  assert.equal(formatPoly(x.scale(-1).add(c(1))), "-x + 1");
  assert.equal(formatPoly(a.scale(2).sub(b.scale(3))), "2a - 3b");
});
test("formatPoly: 多変数と指数", () => {
  assert.equal(formatPoly(Poly.term(3, { x: 2, y: 1 })), "3x²y");
  assert.equal(formatPoly(x.add(y).pow(2)), "x² + 2xy + y²");
  assert.equal(formatPoly(x.pow(3)), "x³");
  assert.equal(formatPoly(a.add(b)), "a + b");
});
test("formatPoly: 分数係数と0", () => {
  assert.equal(formatPoly(x.scale(new Frac(1, 2))), "1/2x");
  assert.equal(formatPoly(x.scale(new Frac(-1, 2))), "-1/2x");
  assert.equal(formatPoly(x.sub(x)), "0");
});
test("Poly の eq と isZero", () => {
  assert.ok(x.add(y).eq(y.add(x)));
  assert.ok(x.sub(x).isZero());
  assert.ok(!x.eq(y));
});
test("積の評価は評価の積", () => {
  const r = mulberry32(3);
  const rp = () => {
    let p = c(randInt(r, -5, 5));
    for (let i = 1; i <= 2; i++) p = p.add(x.pow(i).scale(randInt(r, -5, 5)));
    return p;
  };
  for (let i = 0; i < 200; i++) {
    const p = rp(), q = rp(), v = randInt(r, -4, 4);
    assert.ok(p.mul(q).evaluate({ x: v }).eq(p.evaluate({ x: v }).mul(q.evaluate({ x: v }))));
  }
});
