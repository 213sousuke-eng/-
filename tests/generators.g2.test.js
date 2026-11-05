const test = require("node:test");
const assert = require("node:assert/strict");
const { forAll, M, G } = require("./_util.js");
const { Frac, Poly, formatPoly, parseAnswer } = M;

test("polycalc: 答えが再計算と一致", () => {
  forAll("polycalc", (p) => {
    assert.equal(p.answerType, "choice");
    const fmt = p.meta.answerFmt === "overden" ? G.formatOverDen : formatPoly;
    assert.equal(fmt(p.meta.result), p.answer);
    if (p.meta.parts) {
      let s = Poly.const(0);
      for (const part of p.meta.parts) s = s.add(part.p.scale(part.k));
      assert.ok(s.eq(p.meta.result), p.prompt);
    } else {
      // result × Π den = Π num
      let lhs = p.meta.result, rhs = Poly.const(1);
      for (const d of p.meta.den) lhs = lhs.mul(d);
      for (const n of p.meta.num) rhs = rhs.mul(n);
      assert.ok(lhs.eq(rhs), p.prompt);
    }
  });
});

test("simul: 解を2式に代入すると成り立ち、解は一意", () => {
  forAll("simul", (p) => {
    assert.equal(p.answerType, "number");
    assert.deepEqual(p.fields, ["x", "y"]);
    assert.equal(p.answer.length, 2);
    const x = parseAnswer(p.answer[0]), y = parseAnswer(p.answer[1]);
    for (const e of p.meta.eqs) {
      assert.ok(e.lhs.evaluate({ x, y }).eq(e.rhs.evaluate({ x, y })), p.prompt);
    }
    const d = p.meta.eqs.map((e) => e.lhs.sub(e.rhs));
    const det = d[0].coefOf({ x: 1 }).mul(d[1].coefOf({ y: 1 })).sub(d[0].coefOf({ y: 1 }).mul(d[1].coefOf({ x: 1 })));
    assert.ok(!det.isZero());
  });
});

test("linfunc: 2点が直線上にあり、答えの形が正しい", () => {
  forAll("linfunc", (p) => {
    assert.equal(p.answerType, "choice");
    const { a, b, points } = p.meta;
    assert.ok(!a.isZero());
    for (const [px, py] of points) assert.ok(a.mul(px).add(b).eq(py), p.prompt);
    assert.equal(p.answer, "y = " + formatPoly(Poly.var("x", a).add(Poly.const(b))));
    assert.match(p.answer, /^y = -?(\d+\/\d+)?\d*x( [+-] \d+(\/\d+)?)?$/);
  });
});

test("simul: 手順の倍率は正の数", () => {
  forAll("simul", (p) => {
    const s = p.steps.find((t) => t.startsWith("x を消去"));
    assert.ok(!/-\d+ 倍/.test(s), s);
    assert.match(s, /(たす|ひく)と/);
    const m = /と (-?[\d/]*)y = (-?[\d/]+)$/.exec(s);
    assert.ok(m, s);
    const K = m[1] === "" ? new Frac(1) : m[1] === "-" ? new Frac(-1) : parseAnswer(m[1]);
    assert.ok(parseAnswer(m[2]).div(K).eq(parseAnswer(p.answer[1])), p.prompt + " / " + s);
  }, 200);
});
