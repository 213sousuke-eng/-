(function (root) {
  "use strict";
  const App = (root.MathApp = root.MathApp || {});

  // ---------- 乱数 ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }
  function randNonZero(rng, min, max) {
    for (;;) {
      const v = randInt(rng, min, max);
      if (v !== 0) return v;
    }
  }
  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ---------- 分数 ----------
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  class Frac {
    constructor(n, d) {
      if (d === undefined) d = 1;
      if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error("Frac: 整数でない値 " + n + "/" + d);
      if (d === 0) throw new Error("Frac: 分母が0");
      if (d < 0) {
        n = -n;
        d = -d;
      }
      const g = gcd(n, d) || 1;
      this.n = n / g + 0; // -0 を 0 に
      this.d = d / g;
      if (!Number.isSafeInteger(this.n) || !Number.isSafeInteger(this.d)) throw new Error("Frac: 桁あふれ");
    }
    static of(x) {
      return x instanceof Frac ? x : new Frac(x, 1);
    }
    add(o) {
      o = Frac.of(o);
      return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
    }
    sub(o) {
      o = Frac.of(o);
      return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
    }
    mul(o) {
      o = Frac.of(o);
      return new Frac(this.n * o.n, this.d * o.d);
    }
    div(o) {
      o = Frac.of(o);
      if (o.n === 0) throw new Error("Frac: 0で割った");
      return new Frac(this.n * o.d, this.d * o.n);
    }
    neg() {
      return new Frac(-this.n, this.d);
    }
    abs() {
      return new Frac(Math.abs(this.n), this.d);
    }
    eq(o) {
      o = Frac.of(o);
      return this.n === o.n && this.d === o.d;
    }
    isZero() {
      return this.n === 0;
    }
    isInt() {
      return this.d === 1;
    }
    isNeg() {
      return this.n < 0;
    }
    toNumber() {
      return this.n / this.d;
    }
    toString() {
      return this.d === 1 ? String(this.n) : this.n + "/" + this.d;
    }
  }

  // ---------- 入力の解析 ----------
  function normalizeInput(text) {
    let s = String(text == null ? "" : text);
    if (s.normalize) s = s.normalize("NFKC");
    return s.replace(/[−ー‐-―ｰ]/g, "-").replace(/\s+/g, "");
  }

  function decToFrac(str) {
    const neg = str[0] === "-";
    if (str[0] === "-" || str[0] === "+") str = str.slice(1);
    const parts = str.split(".");
    const dec = parts[1] || "";
    if (dec.length > 9) return null;
    const den = Math.pow(10, dec.length);
    const num = parseInt(parts[0], 10) * den + (dec ? parseInt(dec, 10) : 0);
    if (!Number.isSafeInteger(num)) return null;
    return new Frac(neg ? -num : num, den);
  }

  function parseAnswer(text) {
    const s = normalizeInput(text);
    const m = /^([+-]?\d+(?:\.\d+)?)(?:\/([+-]?\d+))?$/.exec(s);
    if (!m) return null;
    const a = decToFrac(m[1]);
    if (!a) return null;
    if (m[2] === undefined) return a;
    const b = parseInt(m[2], 10);
    if (!Number.isSafeInteger(b) || b === 0) return null;
    return a.div(b);
  }

  App.math = {
    mulberry32,
    randInt,
    randNonZero,
    pick,
    shuffle,
    gcd,
    Frac,
    normalizeInput,
    parseAnswer,
  };
  if (typeof module !== "undefined") module.exports = App.math;
})(typeof globalThis !== "undefined" ? globalThis : this);
