const test = require("node:test");
const assert = require("node:assert/strict");
const { forAll, M } = require("./_util.js");
const { Frac, formatPoly, parseAnswer } = M;

test("signed: 答えが式の値と一致", () => {
  forAll("signed", (p) => {
    assert.equal(p.answerType, "number");
    assert.equal(p.answer, p.meta.value.toString());
    const v = Function('"use strict";return (' + p.meta.js + ")")();
    assert.ok(Math.abs(v - p.meta.value.toNumber()) < 1e-9, p.prompt + " js=" + p.meta.js);
    assert.ok(parseAnswer(p.answer).eq(p.meta.value));
  });
});

test("linexpr: 答えが各部分の和と一致", () => {
  forAll("linexpr", (p) => {
    assert.equal(p.answerType, "choice");
    let s = M.Poly.const(0);
    for (const part of p.meta.parts) s = s.add(part.p.scale(part.k));
    assert.ok(s.eq(p.meta.result));
    assert.equal(formatPoly(p.meta.result), p.answer);
  });
});

test("lineq: 解を代入すると両辺が等しい", () => {
  forAll("lineq", (p) => {
    assert.equal(p.answerType, "number");
    const ans = parseAnswer(p.answer);
    assert.ok(ans);
    assert.ok(p.meta.lhs.evaluate({ x: ans }).eq(p.meta.rhs.evaluate({ x: ans })), p.prompt);
  });
});

test("proportion: 与えた点が式を満たす", () => {
  forAll("proportion", (p) => {
    assert.equal(p.answerType, "choice");
    const k = p.meta.k, [px, py] = p.meta.point;
    if (p.meta.kind === "direct") {
      assert.ok(k.mul(px).eq(py));
      assert.equal(p.answer, "y = " + formatPoly(M.Poly.var("x", k)));
    } else {
      assert.ok(py.mul(px).eq(k));
      assert.equal(p.answer, "y = " + k.toString() + "/x");
    }
  });
});

test("lineq: 分母をはらう問題の手順は整数係数で書く", () => {
  forAll("lineq", (p) => {
    if (!p.steps[0].startsWith("両辺に")) return;
    assert.ok(!/\d\/\d+x/.test(p.steps[1]), p.steps[1]);
  }, 200);
});
