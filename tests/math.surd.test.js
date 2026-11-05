const test = require("node:test");
const assert = require("node:assert/strict");
const { Surd, Frac, simplifySqrt, mulberry32, randInt } = require("../src/math.js");

test("simplifySqrt", () => {
  assert.deepEqual(simplifySqrt(12), { k: 2, r: 3 });
  assert.deepEqual(simplifySqrt(49), { k: 7, r: 1 });
  assert.deepEqual(simplifySqrt(1), { k: 1, r: 1 });
});
test("Surd の加減乗と表示", () => {
  assert.equal(Surd.sqrt(8).add(Surd.sqrt(18)).toString(), "5√2");
  assert.equal(Surd.sqrt(2).mul(Surd.sqrt(6)).toString(), "2√3");
  assert.equal(Surd.sqrt(3).sub(Surd.sqrt(3)).toString(), "0");
  assert.equal(Surd.rat(3).add(Surd.sqrt(5)).toString(), "3 + √5");
  assert.equal(Surd.sqrt(2).mul(new Frac(-1, 2)).toString(), "-√2/2");
  assert.equal(Surd.sqrt(5).mul(new Frac(-3, 2)).toString(), "-3√5/2");
  assert.equal(Surd.rat(1).sub(Surd.sqrt(2)).toString(), "1 - √2");
  assert.equal(Surd.sqrt(16).toString(), "4");
});
test("Surd.eq", () => {
  assert.ok(Surd.sqrt(12).eq(Surd.sqrt(3).mul(2)));
  assert.ok(!Surd.sqrt(2).eq(Surd.sqrt(3)));
});
test("toNumber が Math.sqrt と一致", () => {
  const r = mulberry32(9);
  for (let i = 0; i < 200; i++) {
    const a = randInt(r, 1, 80), b = randInt(r, 1, 80), k = randInt(r, -5, 5);
    const s = Surd.sqrt(a).add(Surd.sqrt(b).mul(k)).mul(Surd.sqrt(a));
    const exp = (Math.sqrt(a) + k * Math.sqrt(b)) * Math.sqrt(a);
    assert.ok(Math.abs(s.toNumber() - exp) < 1e-9, `${a},${b},${k}`);
  }
});
