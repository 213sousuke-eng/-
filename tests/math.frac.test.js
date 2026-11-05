const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/math.js");
const { Frac, parseAnswer, mulberry32, randInt } = M;

test("mulberry32 は同じシードで同じ数列", () => {
  const a = mulberry32(1), b = mulberry32(1);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test("randInt は範囲内で両端も出る", () => {
  const r = mulberry32(5);
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const v = randInt(r, -3, 3);
    assert.ok(v >= -3 && v <= 3 && Number.isInteger(v));
    seen.add(v);
  }
  assert.ok(seen.has(-3) && seen.has(3));
});

test("Frac は既約・分母正", () => {
  assert.equal(new Frac(6, -4).toString(), "-3/2");
  assert.equal(new Frac(1, 2).add(new Frac(1, 3)).toString(), "5/6");
  assert.equal(new Frac(0, -5).toString(), "0");
  assert.throws(() => new Frac(1, 0));
});

test("Frac の四則", () => {
  const a = new Frac(2, 3), b = new Frac(-1, 4);
  assert.equal(a.sub(b).toString(), "11/12");
  assert.equal(a.mul(b).toString(), "-1/6");
  assert.equal(a.div(b).toString(), "-8/3");
  assert.ok(new Frac(4, 2).isInt());
  assert.ok(Frac.of(3).eq(new Frac(6, 2)));
});

const cases = [
  ["3", "3"], [" -3 ", "-3"], ["－３", "-3"], ["−3", "-3"], ["+3", "3"],
  ["6/2", "3"], ["3.0", "3"], ["0.25", "1/4"], ["-3/4", "-3/4"], ["３／４", "3/4"],
  ["-0", "0"], ["3/0", null], ["", null], ["abc", null], ["x=3", null], ["1/2/3", null],
];
for (const [inp, exp] of cases) {
  test(`parseAnswer(${JSON.stringify(inp)})`, () => {
    const r = parseAnswer(inp);
    assert.equal(r === null ? null : r.toString(), exp);
  });
}
