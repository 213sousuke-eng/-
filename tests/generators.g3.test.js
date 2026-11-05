const test = require("node:test");
const assert = require("node:assert/strict");
const { forAll, M } = require("./_util.js");
const { Frac, Poly, Surd, formatPoly, formatFactors } = M;
const x = Poly.var("x"), c = (n) => Poly.const(n);

test("formatFactors の表示", () => {
  assert.equal(formatFactors([x.add(c(2)), x.add(c(3))]), "(x + 2)(x + 3)");
  assert.equal(formatFactors([x.add(c(3)), x.add(c(3))]), "(x + 3)²");
  assert.equal(formatFactors([x.add(c(1)), x.sub(c(3))], 2), "2(x + 1)(x - 3)");
  assert.equal(formatFactors([x, x.add(c(2))]), "x(x + 2)");
  assert.equal(formatFactors([x, x.add(c(2))], 3), "3x(x + 2)");
  assert.equal(formatFactors([x.add(c(2)), x.sub(c(2))], -1), "-(x + 2)(x - 2)");
});

const prod = (fs, k) => fs.reduce((a, f) => a.mul(f), Poly.const(k === undefined ? 1 : k));

test("expand: 各部分を掛けて足すと答え", () => {
  forAll("expand", (p) => {
    let s = Poly.const(0);
    for (const part of p.meta.parts) s = s.add(prod(part.factors).scale(part.k));
    assert.equal(formatPoly(s), p.answer, p.prompt);
  });
});

test("factorize: 正解だけが元の式に戻る", () => {
  forAll("factorize", (p) => {
    assert.ok(prod(p.meta.factors, p.meta.coef).eq(p.meta.original), p.prompt);
    assert.equal(p.answer, formatFactors(p.meta.factors, p.meta.coef));
    assert.ok(p.prompt.endsWith(formatPoly(p.meta.original)));
    for (const ch of p.choices) {
      const cf = p.meta.choiceFactors[ch];
      assert.ok(cf, "choiceFactors がない: " + ch);
      assert.equal(formatFactors(cf.factors, cf.coef), ch);
      const same = prod(cf.factors, cf.coef).eq(p.meta.original);
      assert.equal(same, ch === p.answer, p.prompt + " 選択肢 " + ch);
    }
  });
});

test("sqrt: 答えが数値と一致", () => {
  forAll("sqrt", (p) => {
    assert.equal(p.meta.value.toString(), p.answer);
    assert.ok(Math.abs(p.meta.value.toNumber() - p.meta.exprNumber) < 1e-9, p.prompt);
    // 誤答は値が異なる
    for (const ch of p.choices) if (ch !== p.answer) assert.ok(Math.abs(evalSurdStr(ch) - p.meta.exprNumber) > 1e-9, p.prompt + " " + ch);
  });
});

// "x = (3 ± 2√5)/2" などを数値の配列にする（テスト側の独立した解釈）
function evalSurdStr(s) {
  const js = s.replace(/(\d*)√(\d+)/g, (_, k, r) => "(" + (k || "1") + "*Math.sqrt(" + r + "))");
  return Function("return (" + js + ")")();
}
function rootsOf(answer) {
  assert.match(answer, /^x = /);
  const out = [];
  for (const part of answer.slice(4).split(", ")) {
    if (part.includes("±")) {
      for (const sg of ["+", "-"]) {
        const e = part.startsWith("±") ? part.replace("±", sg === "+" ? "" : "-") : part.replace("±", sg);
        out.push(evalSurdStr(e));
      }
    } else out.push(evalSurdStr(part));
  }
  return out.sort((a, b) => a - b);
}

test("quadeq: 答えの解を代入すると0、誤答は解が違う", () => {
  forAll("quadeq", (p) => {
    const A = p.meta.poly.coefOf({ x: 2 }).toNumber(), B = p.meta.poly.coefOf({ x: 1 }).toNumber(), C = p.meta.poly.coefOf({}).toNumber();
    const f = (r) => A * r * r + B * r + C;
    const rs = rootsOf(p.answer);
    for (const r of rs) assert.ok(Math.abs(f(r)) < 1e-6, p.prompt + " → " + p.answer);
    // 解の個数（重解は1つ）
    const disc = B * B - 4 * A * C;
    assert.equal(rs.length, Math.abs(disc) < 1e-9 ? 1 : 2, p.prompt + " → " + p.answer);
    for (const ch of p.choices) {
      if (ch === p.answer) continue;
      const w = rootsOf(ch);
      assert.ok(w.length !== rs.length || w.some((r, i) => Math.abs(r - rs[i]) > 1e-9), p.prompt + " 誤答 " + ch);
    }
  });
});

test("sqrt: 選択肢・問題文に未簡約の √(平方数) や同じ根号の重複がない", () => {
  forAll("sqrt", (p) => {
    for (const ch of p.choices) assert.ok(!/√(4|9|16|25|36|49)(?!\d)/.test(ch), ch);
    const roots = (p.prompt.split("\n")[1] || "").match(/√\d+/g) || [];
    const line = p.prompt.split("\n")[1] || "";
    if (/[+-]/.test(line) && !/[(/×÷]/.test(line)) assert.equal(new Set(roots).size, roots.length, p.prompt);
    for (const s of p.steps) {
      assert.ok(!/(√\d+) = \1$/.test(s), s);
      assert.ok(!/\(\d+\)√/.test(s), s);
    }
  }, 300);
});
