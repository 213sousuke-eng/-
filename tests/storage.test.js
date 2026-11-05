const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore } = require("../src/storage.js");

function memBackend(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  };
}

test("recent は直近20件まで", () => {
  const s = createStore(memBackend());
  for (let i = 0; i < 25; i++) s.record("signed", true);
  assert.equal(s.stats("signed").count, 20);
});

test("正答率", () => {
  const s = createStore(memBackend());
  s.record("lineq", true); s.record("lineq", true); s.record("lineq", true); s.record("lineq", false);
  assert.equal(s.stats("lineq").rate, 0.75);
  assert.deepEqual(s.stats("sqrt"), { count: 0, rate: null });
});

test("重み", () => {
  const s = createStore(memBackend());
  s.record("a", true);
  s.record("b", false);
  const w = s.weights(["a", "b", "c"]);
  assert.ok(Math.abs(w[0] - 0.1) < 1e-12);
  assert.ok(Math.abs(w[1] - 1.1) < 1e-12);
  assert.equal(w[2], 0.5);
});

test("壊れたデータは初期化", () => {
  const s = createStore(memBackend({ "chugaku-math-v1": "{壊れた" }));
  assert.deepEqual(s.stats("signed"), { count: 0, rate: null });
  s.record("signed", true);
  assert.equal(s.stats("signed").count, 1);
});

test("形の違うデータも初期化", () => {
  const s = createStore(memBackend({ "chugaku-math-v1": JSON.stringify({ units: { signed: { recent: "x" } } }) }));
  assert.deepEqual(s.stats("signed"), { count: 0, rate: null });
});

test("setItem が例外でも動き、persistent=false", () => {
  const b = memBackend();
  b.setItem = () => { throw new Error("QuotaExceeded"); };
  const s = createStore(b);
  s.record("signed", false);
  assert.equal(s.persistent, false);
  assert.equal(s.stats("signed").count, 1);
});

test("localStorage へのアクセス自体が例外でも動く", () => {
  const s = createStore({ getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); }, removeItem() {} });
  s.record("x", true);
  assert.equal(s.stats("x").rate, 1);
  assert.equal(s.persistent, false);
});

test("作り直すと読み込まれる", () => {
  const b = memBackend();
  createStore(b).record("expand", true);
  assert.equal(createStore(b).stats("expand").count, 1);
});

test("reset とフラグ", () => {
  const b = memBackend();
  const s = createStore(b);
  s.record("expand", true);
  s.setFlag("a2hsClosed");
  assert.equal(s.getFlag("a2hsClosed"), true);
  s.reset();
  assert.equal(s.stats("expand").count, 0);
  assert.equal(createStore(b).stats("expand").count, 0);
  assert.equal(createStore(b).getFlag("a2hsClosed"), true);
});
