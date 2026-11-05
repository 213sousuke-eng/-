const test = require("node:test");
const assert = require("node:assert/strict");
const { G, M } = require("./_util.js");
const Q = require("../src/quiz.js");

function fakeStore() {
  const calls = [];
  return {
    calls,
    record(id, ok) { calls.push([id, ok]); },
    weights(ids) { return ids.map(() => 0.5); },
  };
}
function correctInput(p) {
  return p.answerType === "choice" ? p.answer : p.answer;
}

test("unit モードで10問解ける", () => {
  const store = fakeStore();
  const s = Q.createSession({ mode: "unit", unitId: "factorize", level: 1, rng: M.mulberry32(1), store });
  let n = 0;
  do {
    const p = s.current();
    assert.equal(p.unitId, "factorize");
    const r = s.answer(correctInput(p));
    assert.equal(r.status, "graded");
    assert.equal(r.correct, true);
    n++;
  } while (s.next());
  assert.equal(n, 10);
  assert.equal(s.results().length, 10);
  assert.equal(s.score(), 10);
  assert.equal(store.calls.length, 10);
  assert.equal(s.current(), null);
});

test("数値入力で読めない値は invalid で記録しない", () => {
  const store = fakeStore();
  const s = Q.createSession({ mode: "unit", unitId: "lineq", level: 1, rng: M.mulberry32(2), store });
  assert.deepEqual(s.answer("abc"), { status: "invalid" });
  assert.equal(store.calls.length, 0);
  const r = s.answer(s.current().answer);
  assert.equal(r.correct, true);
});

test("値が等しい別表記は正解", () => {
  const store = fakeStore();
  const s = Q.createSession({ mode: "unit", unitId: "signed", level: 1, rng: M.mulberry32(3), store });
  const ans = M.parseAnswer(s.current().answer);
  const alt = ans.n * 2 + "/" + ans.d * 2;
  assert.equal(s.answer(alt).correct, true);
});

test("連立方程式は両方合って正解", () => {
  const store = fakeStore();
  const s = Q.createSession({ mode: "unit", unitId: "simul", level: 1, rng: M.mulberry32(4), store });
  const [x, y] = s.current().answer;
  assert.equal(s.answer([x, String(+y + 1)]).correct, false);
  const s2 = Q.createSession({ mode: "unit", unitId: "simul", level: 1, rng: M.mulberry32(4), store: fakeStore() });
  assert.equal(s2.answer([x, y]).correct, true);
  const s3 = Q.createSession({ mode: "unit", unitId: "simul", level: 1, rng: M.mulberry32(4), store: fakeStore() });
  assert.deepEqual(s3.answer([x, ""]), { status: "invalid" });
});

test("同じ問題への2回目の answer は記録しない", () => {
  const store = fakeStore();
  const s = Q.createSession({ mode: "unit", unitId: "expand", level: 1, rng: M.mulberry32(5), store });
  const p = s.current();
  const wrong = p.choices.find((c) => c !== p.answer);
  const r1 = s.answer(wrong);
  const r2 = s.answer(p.answer);
  assert.equal(store.calls.length, 1);
  assert.equal(r2.correct, false);
  assert.deepEqual(r1, r2);
});

test("答える前の next は進まない", () => {
  const s = Q.createSession({ mode: "unit", unitId: "expand", level: 1, rng: M.mulberry32(6), store: fakeStore() });
  assert.equal(s.next(), false);
  assert.equal(s.index, 0);
});

test("pickWeighted", () => {
  const r = M.mulberry32(7);
  for (let i = 0; i < 100; i++) assert.equal(Q.pickWeighted(r, [0, 1, 0]), 1);
  let c0 = 0;
  for (let i = 0; i < 10000; i++) if (Q.pickWeighted(r, [1.1, 0.1]) === 0) c0++;
  assert.ok(c0 / 10000 >= 0.85, String(c0));
});

test("mix モードは重みに従って単元を選ぶ", () => {
  const store = fakeStore();
  store.weights = (ids) => ids.map((id) => (id === "sqrt" ? 1 : 0));
  const s = Q.createSession({ mode: "mix", level: 2, rng: M.mulberry32(8), store });
  do {
    assert.equal(s.current().unitId, "sqrt");
    s.answer(s.current().answer);
  } while (s.next());
});

test("1セット内で同じ問題文を出さない", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = Q.createSession({ mode: "unit", unitId: "quadeq", level: 1, rng: M.mulberry32(seed), store: fakeStore() });
    const seen = new Set();
    do {
      assert.ok(!seen.has(s.current().prompt), s.current().prompt);
      seen.add(s.current().prompt);
      s.answer(s.current().answer);
    } while (s.next());
  }
});
