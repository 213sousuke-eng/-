const test = require("node:test");
const assert = require("node:assert/strict");
const { G, M } = require("./_util.js");

test("UNITS は11単元", () => {
  assert.deepEqual(G.UNITS.map((u) => u.id), [
    "signed", "linexpr", "lineq", "proportion", "polycalc", "simul", "linfunc",
    "expand", "factorize", "sqrt", "quadeq",
  ]);
  for (const u of G.UNITS) assert.ok(u.name && [1, 2, 3].includes(u.grade));
});

test("makeChoices は正解1つ・4件・重複なし", () => {
  const r = M.mulberry32(1);
  const c = G.makeChoices(r, "A", ["B", "A", "B", "C", "D", "E"], () => "Z");
  assert.equal(c.length, 4);
  assert.equal(c.filter((x) => x === "A").length, 1);
  assert.equal(new Set(c).size, 4);
});

test("makeChoices は誤答が足りないと fallback で埋める", () => {
  const r = M.mulberry32(2);
  let i = 0;
  const c = G.makeChoices(r, "A", ["A", "A"], () => "F" + (i++ % 5));
  assert.equal(c.length, 4);
  assert.equal(new Set(c).size, 4);
  assert.ok(c.includes("A"));
});

test("makeChoices は埋められなければ例外", () => {
  assert.throws(() => G.makeChoices(M.mulberry32(3), "A", [], () => "A"));
});

test("generate は生成関数が失敗し続けると FALLBACK を返す", () => {
  const orig = G.GENERATORS.signed;
  G.GENERATORS.signed = () => { throw new Error("boom"); };
  try {
    const p = G.generate("signed", 1, M.mulberry32(1));
    assert.equal(p, G.FALLBACK.signed[1]);
  } finally {
    G.GENERATORS.signed = orig;
  }
});

test("validateProblem は NaN を拒否", () => {
  const p = Object.assign({}, G.FALLBACK.signed[1], { answer: "NaN" });
  assert.equal(G.validateProblem(p), false);
});

test("FALLBACK は全単元・全レベルで妥当", () => {
  for (const u of G.UNITS) for (const lv of [1, 2]) {
    const p = G.FALLBACK[u.id][lv];
    assert.ok(G.validateProblem(p), `${u.id} L${lv}`);
    assert.equal(p.unitId, u.id);
    assert.equal(p.level, lv);
  }
});
