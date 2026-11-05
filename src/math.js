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

  // ---------- 多項式（多変数） ----------
  // 項: key（"x2y1" のような次数表記）→ { vars: {x:2,y:1}, coef: Frac }
  function varsKey(vars) {
    return Object.keys(vars)
      .filter((k) => vars[k] !== 0)
      .sort()
      .map((k) => k + vars[k])
      .join("");
  }

  class Poly {
    constructor(terms) {
      this.terms = terms || new Map();
    }
    static term(coef, vars) {
      const p = new Poly();
      const c = Frac.of(coef);
      const v = {};
      for (const k of Object.keys(vars || {})) if (vars[k]) v[k] = vars[k];
      if (!c.isZero()) p.terms.set(varsKey(v), { vars: v, coef: c });
      return p;
    }
    static const(c) {
      return Poly.term(c, {});
    }
    static var(name, coef) {
      const v = {};
      v[name] = 1;
      return Poly.term(coef === undefined ? 1 : coef, v);
    }
    clone() {
      return new Poly(new Map(this.terms));
    }
    _addTerm(t) {
      const key = varsKey(t.vars);
      const cur = this.terms.get(key);
      const coef = cur ? cur.coef.add(t.coef) : t.coef;
      if (coef.isZero()) this.terms.delete(key);
      else this.terms.set(key, { vars: t.vars, coef });
    }
    add(o) {
      o = toPoly(o);
      const p = this.clone();
      for (const t of o.terms.values()) p._addTerm(t);
      return p;
    }
    sub(o) {
      return this.add(toPoly(o).scale(-1));
    }
    scale(k) {
      k = Frac.of(k);
      const p = new Poly();
      if (k.isZero()) return p;
      for (const t of this.terms.values()) p._addTerm({ vars: t.vars, coef: t.coef.mul(k) });
      return p;
    }
    mul(o) {
      o = toPoly(o);
      const p = new Poly();
      for (const s of this.terms.values()) {
        for (const t of o.terms.values()) {
          const v = Object.assign({}, s.vars);
          for (const k of Object.keys(t.vars)) v[k] = (v[k] || 0) + t.vars[k];
          p._addTerm({ vars: v, coef: s.coef.mul(t.coef) });
        }
      }
      return p;
    }
    pow(n) {
      let p = Poly.const(1);
      for (let i = 0; i < n; i++) p = p.mul(this);
      return p;
    }
    eq(o) {
      return this.sub(o).isZero();
    }
    isZero() {
      return this.terms.size === 0;
    }
    degree() {
      let d = 0;
      for (const t of this.terms.values()) d = Math.max(d, totalDeg(t.vars));
      return d;
    }
    // 変数名 → 次数 1 の係数（定数項は ""）
    coefOf(vars) {
      const t = this.terms.get(varsKey(vars || {}));
      return t ? t.coef : new Frac(0);
    }
    evaluate(env) {
      let s = new Frac(0);
      for (const t of this.terms.values()) {
        let v = t.coef;
        for (const k of Object.keys(t.vars)) {
          if (!(k in env)) throw new Error("evaluate: 変数 " + k + " の値がない");
          const base = Frac.of(env[k]);
          for (let i = 0; i < t.vars[k]; i++) v = v.mul(base);
        }
        s = s.add(v);
      }
      return s;
    }
  }
  function toPoly(o) {
    return o instanceof Poly ? o : Poly.const(o);
  }
  function totalDeg(vars) {
    let d = 0;
    for (const k of Object.keys(vars)) d += vars[k];
    return d;
  }

  const SUP = { 2: "²", 3: "³", 4: "⁴" };
  function monoStr(vars) {
    return Object.keys(vars)
      .sort()
      .map((k) => k + (vars[k] === 1 ? "" : SUP[vars[k]] || "^" + vars[k]))
      .join("");
  }
  function sortedTerms(p) {
    return Array.from(p.terms.values()).sort((s, t) => {
      const d = totalDeg(t.vars) - totalDeg(s.vars);
      if (d) return d;
      // 同じ次数: 変数名のアルファベット順（x² + xy + y² になるよう、先頭変数の次数が高い方を先に）
      const ks = monoKeyForSort(s.vars),
        kt = monoKeyForSort(t.vars);
      return ks < kt ? -1 : ks > kt ? 1 : 0;
    });
  }
  function monoKeyForSort(vars) {
    // "x2" と "x1y1" と "y2" を x²、xy、y² の順にするため、変数ごとに文字を次数分くり返す
    return Object.keys(vars)
      .sort()
      .map((k) => k.repeat(vars[k]))
      .join("");
  }
  function coefMono(coef, vars, first) {
    const mono = monoStr(vars);
    const neg = coef.isNeg();
    const ac = coef.abs();
    let body;
    if (mono === "") body = ac.toString();
    else if (ac.n === 1 && ac.d === 1) body = mono;
    else body = ac.toString() + mono;
    if (first) return (neg ? "-" : "") + body;
    return (neg ? " - " : " + ") + body;
  }
  function formatPoly(p) {
    const ts = sortedTerms(p);
    if (ts.length === 0) return "0";
    return ts.map((t, i) => coefMono(t.coef, t.vars, i === 0)).join("");
  }

  // ---------- 根号 ----------
  function simplifySqrt(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error("simplifySqrt: 不正な値 " + n);
    if (n === 0) return { k: 0, r: 1 };
    let k = 1,
      r = n;
    for (let f = 2; f * f <= r; f++) {
      while (r % (f * f) === 0) {
        r /= f * f;
        k *= f;
      }
    }
    return { k, r };
  }

  // k√r の和。terms: Map<r, Frac>（r=1 は有理数部分）
  class Surd {
    constructor(terms) {
      this.terms = terms || new Map();
    }
    static rat(q) {
      const s = new Surd();
      const f = Frac.of(q);
      if (!f.isZero()) s.terms.set(1, f);
      return s;
    }
    static sqrt(n) {
      const { k, r } = simplifySqrt(n);
      const s = new Surd();
      if (k !== 0) s.terms.set(r, new Frac(k));
      return s;
    }
    _put(r, c) {
      const cur = this.terms.get(r);
      const v = cur ? cur.add(c) : c;
      if (v.isZero()) this.terms.delete(r);
      else this.terms.set(r, v);
    }
    add(o) {
      o = toSurd(o);
      const s = new Surd(new Map(this.terms));
      for (const [r, c] of o.terms) s._put(r, c);
      return s;
    }
    sub(o) {
      return this.add(toSurd(o).mul(-1));
    }
    mul(o) {
      o = toSurd(o);
      const s = new Surd();
      for (const [r1, c1] of this.terms) {
        for (const [r2, c2] of o.terms) {
          const { k, r } = simplifySqrt(r1 * r2);
          s._put(r, c1.mul(c2).mul(k));
        }
      }
      return s;
    }
    eq(o) {
      return this.sub(o).isZero();
    }
    isZero() {
      return this.terms.size === 0;
    }
    isRational() {
      for (const r of this.terms.keys()) if (r !== 1) return false;
      return true;
    }
    toNumber() {
      let v = 0;
      for (const [r, c] of this.terms) v += c.toNumber() * Math.sqrt(r);
      return v;
    }
    toString() {
      const rs = Array.from(this.terms.keys()).sort((a, b) => a - b);
      if (rs.length === 0) return "0";
      return rs
        .map((r, i) => {
          const c = this.terms.get(r);
          const neg = c.isNeg();
          const ac = c.abs();
          let body;
          if (r === 1) body = ac.toString();
          else {
            const num = (ac.n === 1 ? "" : String(ac.n)) + "√" + r;
            body = ac.d === 1 ? num : num + "/" + ac.d;
          }
          if (i === 0) return (neg ? "-" : "") + body;
          return (neg ? " - " : " + ") + body;
        })
        .join("");
    }
  }
  function toSurd(o) {
    return o instanceof Surd ? o : Surd.rat(o);
  }

  App.math = {
    Surd,
    simplifySqrt,
    Poly,
    formatPoly,
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
