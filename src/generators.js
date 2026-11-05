(function (root) {
  "use strict";
  const App = (root.MathApp = root.MathApp || {});
  const M = App.math;
  const { Frac, Poly, Surd, formatPoly, randInt, randNonZero, pick, shuffle } = M;

  const UNITS = [
    { id: "signed", grade: 1, name: "正負の数" },
    { id: "linexpr", grade: 1, name: "文字式の計算" },
    { id: "lineq", grade: 1, name: "一次方程式" },
    { id: "proportion", grade: 1, name: "比例・反比例" },
    { id: "polycalc", grade: 2, name: "式の計算" },
    { id: "simul", grade: 2, name: "連立方程式" },
    { id: "linfunc", grade: 2, name: "一次関数の式" },
    { id: "expand", grade: 3, name: "式の展開" },
    { id: "factorize", grade: 3, name: "因数分解" },
    { id: "sqrt", grade: 3, name: "平方根" },
    { id: "quadeq", grade: 3, name: "二次方程式" },
  ];

  // ---------- 共通ヘルパー ----------
  function makeChoices(rng, correct, distractors, fallback) {
    const out = [correct];
    const seen = new Set(out);
    for (const d of shuffle(rng, distractors)) {
      if (out.length >= 4) break;
      if (typeof d !== "string" || seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    let tries = 0;
    while (out.length < 4) {
      if (tries++ >= 50) throw new Error("makeChoices: 選択肢が足りない");
      let d;
      try {
        d = fallback();
      } catch (e) {
        continue;
      }
      if (typeof d !== "string" || seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return shuffle(rng, out);
  }

  function choiceProblem(rng, base, correct, distractors, fallback) {
    return Object.assign({}, base, {
      answerType: "choice",
      answer: correct,
      choices: makeChoices(rng, correct, distractors, fallback),
    });
  }

  function validateProblem(p) {
    if (!p || typeof p !== "object") return false;
    if (typeof p.prompt !== "string" || !p.prompt) return false;
    if (!Array.isArray(p.steps) || p.steps.length === 0) return false;
    const strs = [p.prompt].concat(p.steps, [].concat(p.answer), p.choices || [], p.fields || []);
    for (const s of strs) {
      if (typeof s !== "string" || s === "") return false;
      if (/NaN|Infinity|undefined|null|\[object/.test(s)) return false;
    }
    if (p.answerType === "choice") {
      if (!Array.isArray(p.choices) || p.choices.length !== 4) return false;
      if (new Set(p.choices).size !== 4) return false;
      if (p.choices.filter((c) => c === p.answer).length !== 1) return false;
    } else if (p.answerType === "number") {
      const ans = [].concat(p.answer);
      for (const a of ans) if (!M.parseAnswer(a)) return false;
      if (Array.isArray(p.answer)) {
        if (!Array.isArray(p.fields) || p.fields.length !== p.answer.length) return false;
      }
    } else return false;
    return true;
  }

  // 表示用ヘルパー
  // 負の数はかっこで包む
  function paren(f) {
    const s = Frac.of(f).toString();
    return Frac.of(f).isNeg() ? "(" + s + ")" : s;
  }
  // 一次式 ax + b
  function lin(a, b, v) {
    return Poly.var(v || "x", a).add(Poly.const(b));
  }
  // 係数 k をかっこの前に付けた表示: 2(3x - 1), -(x + 2)
  function kParen(k, p) {
    k = Frac.of(k);
    const ks = k.eq(1) ? "" : k.eq(-1) ? "-" : k.toString();
    return ks + "(" + formatPoly(p) + ")";
  }
  // 方程式の片側を表示（0 も含む）
  function side(p) {
    return formatPoly(p);
  }
  // 値が大きすぎる・分母が大きすぎるものを弾く
  function niceFrac(f, maxAbs, maxDen) {
    return Math.abs(f.n) <= maxAbs * f.d && f.d <= maxDen;
  }
  function need(cond, msg) {
    if (!cond) throw new Error("retry: " + (msg || ""));
  }

  // ========== 中1 ==========

  // ---- 正負の数 ----
  // 項: { str, js, val }
  function numTerm(rng, max) {
    const v = randNonZero(rng, -max, max);
    return { str: paren(v), js: "(" + v + ")", val: new Frac(v) };
  }
  function signedTermL1(rng) {
    const kind = pick(rng, ["num", "num", "mul", "div"]);
    if (kind === "num") return numTerm(rng, 12);
    const a = randNonZero(rng, -9, 9);
    const b = randNonZero(rng, -9, 9);
    if (kind === "mul") {
      return { str: paren(a) + " × " + paren(b), js: "(" + a + ")*(" + b + ")", val: new Frac(a * b), calc: true };
    }
    const prod = a * b;
    return { str: paren(prod) + " ÷ " + paren(b), js: "(" + prod + ")/(" + b + ")", val: new Frac(a), calc: true };
  }
  function powFactor(rng, allowLeadingMinus) {
    const kind = allowLeadingMinus ? pick(rng, ["negpow", "minuspow", "pow"]) : pick(rng, ["negpow", "pow"]);
    const n = pick(rng, [2, 2, 3]);
    const a = n === 3 ? randInt(rng, 2, 3) : randInt(rng, 2, 5);
    const sup = n === 2 ? "²" : "³";
    if (kind === "negpow") {
      return { str: "(-" + a + ")" + sup, js: "((-" + a + ")**" + n + ")", val: new Frac(Math.pow(-a, n)) };
    }
    if (kind === "minuspow") {
      return { str: "-" + a + sup, js: "(-(" + a + "**" + n + "))", val: new Frac(-Math.pow(a, n)) };
    }
    return { str: a + sup, js: "(" + a + "**" + n + ")", val: new Frac(Math.pow(a, n)) };
  }
  function fracFactor(rng) {
    const d = randInt(rng, 2, 6);
    let n = randNonZero(rng, -7, 7);
    if (M.gcd(n, d) !== 1) n = n > 0 ? 1 : -1;
    const f = new Frac(n, d);
    return { str: paren(f), js: "(" + n + "/" + d + ")", val: f };
  }
  function signedTermL2(rng, first) {
    const kind = pick(rng, ["powmul", "powdiv", "fracmul", "fracdiv", "num"]);
    if (kind === "num") return numTerm(rng, 12);
    if (kind === "powmul" || kind === "powdiv") {
      const p = powFactor(rng, first);
      const b = randNonZero(rng, -6, 6);
      if (kind === "powmul") {
        return { str: p.str + " × " + paren(b), js: p.js + "*(" + b + ")", val: p.val.mul(b), calc: true };
      }
      return { str: p.str + " ÷ " + paren(b), js: p.js + "/(" + b + ")", val: p.val.div(b), calc: true };
    }
    const f = fracFactor(rng);
    if (kind === "fracmul") {
      const b = randNonZero(rng, -12, 12);
      return { str: f.str + " × " + paren(b), js: f.js + "*(" + b + ")", val: f.val.mul(b), calc: true };
    }
    const g = fracFactor(rng);
    return { str: f.str + " ÷ " + g.str, js: f.js + "/" + g.js, val: f.val.div(g.val), calc: true };
  }

  function genSigned(rng, level) {
    const nTerms = level === 1 ? randInt(rng, 2, 3) : 2 + (rng() < 0.4 ? 1 : 0);
    const terms = [];
    for (let i = 0; i < nTerms; i++) terms.push(level === 1 ? signedTermL1(rng) : signedTermL2(rng, i === 0));
    need(terms.some((t) => t.calc) || level === 1, "L2 は計算項を含む");
    let str = terms[0].str,
      js = terms[0].js,
      val = terms[0].val;
    const ops = [];
    for (let i = 1; i < nTerms; i++) {
      const op = pick(rng, ["+", "-"]);
      ops.push(op);
      str += " " + op + " " + terms[i].str;
      js += op + terms[i].js;
      val = op === "+" ? val.add(terms[i].val) : val.sub(terms[i].val);
    }
    need(niceFrac(val, 300, 12), "値が大きすぎる");
    const steps = [];
    const calcTerms = terms.filter((t) => t.calc);
    if (calcTerms.length) {
      steps.push("かけ算・わり算（累乗）を先に計算: " + calcTerms.map((t) => t.str + " = " + t.val.toString()).join("、"));
    }
    let line = paren(terms[0].val);
    for (let i = 1; i < nTerms; i++) line += " " + ops[i - 1] + " " + paren(terms[i].val);
    steps.push("たし算・ひき算をする: " + line + " = " + val.toString());
    return {
      unitId: "signed",
      level,
      prompt: "次の計算をしなさい。\n" + str,
      answerType: "number",
      answer: val.toString(),
      steps,
      meta: { value: val, js },
    };
  }

  // ---- 文字式の計算 ----
  function genLinexpr(rng, level) {
    const r1 = () => randNonZero(rng, -9, 9);
    const p1 = lin(r1(), r1());
    const p2 = lin(r1(), r1());
    let parts, prompt, wrong = [];
    const tmpl = level === 1 ? pick(rng, ["add", "sub", "k"]) : pick(rng, ["ksub", "fracmul", "div"]);
    if (tmpl === "add") {
      parts = [{ k: new Frac(1), p: p1 }, { k: new Frac(1), p: p2 }];
      prompt = "(" + formatPoly(p1) + ") + (" + formatPoly(p2) + ")";
      wrong.push(p1.add(p2.scale(-1)));
    } else if (tmpl === "sub") {
      parts = [{ k: new Frac(1), p: p1 }, { k: new Frac(-1), p: p2 }];
      prompt = "(" + formatPoly(p1) + ") - (" + formatPoly(p2) + ")";
      // 後ろのかっこの定数項の符号を変え忘れる
      const c2 = p2.coefOf({});
      wrong.push(p1.sub(p2).add(Poly.const(c2.mul(2))));
      wrong.push(p1.add(p2));
    } else if (tmpl === "k") {
      const k = randNonZero(rng, -6, 6);
      need(k !== 1 && k !== -1, "k");
      parts = [{ k: new Frac(k), p: p1 }];
      prompt = kParen(k, p1);
      // 定数項にかけ忘れ
      wrong.push(Poly.var("x", p1.coefOf({ x: 1 }).mul(k)).add(Poly.const(p1.coefOf({}))));
    } else if (tmpl === "ksub") {
      const k = randInt(rng, 2, 5) * pick(rng, [1, -1]);
      const m = randInt(rng, 2, 5);
      parts = [{ k: new Frac(k), p: p1 }, { k: new Frac(-m), p: p2 }];
      prompt = kParen(k, p1) + " - " + kParen(m, p2);
      // 後ろの定数項の符号ミス
      const c2 = p2.coefOf({});
      wrong.push(p1.scale(k).sub(p2.scale(m)).add(Poly.const(c2.mul(2 * m))));
      // 後ろの定数項にかけ忘れ
      wrong.push(p1.scale(k).sub(Poly.var("x", p2.coefOf({ x: 1 }).mul(m))).sub(Poly.const(c2)));
    } else if (tmpl === "fracmul") {
      const q = randInt(rng, 2, 5);
      let pn = randNonZero(rng, -4, 4);
      need(M.gcd(pn, q) === 1, "既約");
      const f = new Frac(pn, q);
      const pp = lin(r1() * q, r1() * q);
      const m = randNonZero(rng, -5, 5);
      parts = [{ k: f, p: pp }, { k: new Frac(m), p: p2 }];
      prompt = kParen(f, pp) + (m > 0 ? " + " : " - ") + kParen(Math.abs(m), p2);
      wrong.push(pp.scale(f).add(Poly.var("x", p2.coefOf({ x: 1 }).mul(m))).add(Poly.const(p2.coefOf({}))));
      wrong.push(pp.scale(f.neg()).add(p2.scale(m)));
    } else {
      // (ax + b) ÷ k  （a, b は k の倍数）
      const k = randNonZero(rng, -5, 5);
      need(Math.abs(k) >= 2, "k");
      const pp = lin(r1() * k, r1() * k);
      const m = randNonZero(rng, -5, 5);
      parts = [{ k: new Frac(1, k), p: pp }, { k: new Frac(m), p: p2 }];
      prompt = "(" + formatPoly(pp) + ") ÷ " + paren(k) + (m > 0 ? " + " : " - ") + kParen(Math.abs(m), p2);
      wrong.push(pp.scale(new Frac(-1, k)).add(p2.scale(m)));
      wrong.push(Poly.var("x", pp.coefOf({ x: 1 }).div(k)).add(Poly.const(pp.coefOf({}))).add(p2.scale(m)));
    }
    let result = Poly.const(0);
    for (const pt of parts) result = result.add(pt.p.scale(pt.k));
    need(!result.isZero(), "結果が0");
    const correct = formatPoly(result);
    // 一般的な誤り: 定数項の符号、x の係数のずれ
    wrong.push(Poly.var("x", result.coefOf({ x: 1 })).sub(Poly.const(result.coefOf({}))));
    wrong.push(result.add(Poly.var("x", pick(rng, [1, -1]))));
    const expanded = parts.map((pt) => formatPoly(pt.p.scale(pt.k)));
    const steps = [
      "かっこをはずす: " + expanded.map((s, i) => (i === 0 ? s : "+ (" + s + ")")).join(" "),
      "同類項（x の項どうし、数の項どうし）をまとめる: " + correct,
    ];
    return choiceProblem(
      rng,
      { unitId: "linexpr", level, prompt: "次の計算をしなさい。\n" + prompt, steps, meta: { parts, result } },
      correct,
      wrong.filter((w) => !w.isZero()).map(formatPoly),
      () => formatPoly(result.add(Poly.const(randNonZero(rng, -3, 3))))
    );
  }

  // ---- 一次方程式 ----
  function eqSteps(lhs, rhs, extraFirst, mult) {
    // mult: 分母をはらうためにかけた数（手順を整数係数で示す）
    const diff = lhs.sub(rhs).scale(mult || 1);
    const A = diff.coefOf({ x: 1 });
    const C = diff.coefOf({});
    const x = C.neg().div(A);
    const steps = extraFirst ? [extraFirst] : [];
    steps.push("x の項を左辺に、数の項を右辺に移項して整理: " + formatPoly(Poly.var("x", A)) + " = " + C.neg().toString());
    steps.push("両辺を " + paren(A) + " でわる: x = " + x.toString());
    return { x, steps };
  }
  function genLineq(rng, level) {
    let lhs, rhs, prompt, extra, mult;
    if (level === 1) {
      const x0 = randInt(rng, -9, 9);
      const a = randNonZero(rng, -9, 9);
      const c = randInt(rng, -9, 9);
      need(a !== c, "a≠c");
      const b = randInt(rng, -12, 12);
      const d = a * x0 + b - c * x0;
      need(Math.abs(d) <= 40, "d");
      lhs = lin(a, b);
      rhs = lin(c, d);
      prompt = side(lhs) + " = " + side(rhs);
    } else if (rng() < 0.5) {
      // k(x + p) = m(x + q) + r
      const k = randNonZero(rng, -5, 5);
      const m = randNonZero(rng, -5, 5);
      need(k !== m, "k≠m");
      const p = randNonZero(rng, -6, 6);
      const q = randNonZero(rng, -6, 6);
      const r = randInt(rng, -9, 9);
      lhs = lin(1, p).scale(k);
      rhs = lin(1, q).scale(m).add(Poly.const(r));
      prompt = kParen(k, lin(1, p)) + " = " + kParen(m, lin(1, q)) + (r === 0 ? "" : (r > 0 ? " + " : " - ") + Math.abs(r));
      extra = "かっこをはずす: " + side(lhs) + " = " + side(rhs);
    } else {
      // (ax + b)/p = (cx + d)/q
      const pp = randInt(rng, 2, 6);
      const qq = randInt(rng, 2, 6);
      need(pp !== qq, "p≠q");
      const a = randNonZero(rng, -5, 5),
        b = randNonZero(rng, -9, 9),
        c = randNonZero(rng, -5, 5),
        d = randNonZero(rng, -9, 9);
      lhs = lin(a, b).scale(new Frac(1, pp));
      rhs = lin(c, d).scale(new Frac(1, qq));
      prompt = "(" + formatPoly(lin(a, b)) + ")/" + pp + " = (" + formatPoly(lin(c, d)) + ")/" + qq;
      const L = (pp * qq) / M.gcd(pp, qq);
      mult = L;
      extra =
        "両辺に " + L + " をかけて分母をはらう: " + kParen(L / pp, lin(a, b)) + " = " + kParen(L / qq, lin(c, d));
    }
    const diffA = lhs.sub(rhs).coefOf({ x: 1 });
    need(!diffA.isZero(), "x の係数が0");
    const { x, steps } = eqSteps(lhs, rhs, extra, mult);
    need(niceFrac(x, 50, 9), "解");
    return {
      unitId: "lineq",
      level,
      prompt: "次の方程式を解きなさい。\n" + prompt,
      answerType: "number",
      answer: x.toString(),
      fields: undefined,
      steps,
      meta: { lhs, rhs },
    };
  }

  // ---- 比例・反比例 ----
  function propAnswer(kind, k) {
    return kind === "direct" ? "y = " + formatPoly(Poly.var("x", k)) : "y = " + k.toString() + "/x";
  }
  function genProportion(rng, level) {
    const kind = pick(rng, ["direct", "inverse"]);
    let k, px, py;
    if (kind === "direct") {
      if (level === 1) {
        k = new Frac(randNonZero(rng, -8, 8));
        px = new Frac(randNonZero(rng, -6, 6));
      } else {
        const d = randInt(rng, 2, 5);
        let n = randNonZero(rng, -7, 7);
        need(M.gcd(n, d) === 1, "既約");
        k = new Frac(n, d);
        px = new Frac(d * randNonZero(rng, -3, 3));
      }
      py = k.mul(px);
    } else {
      px = new Frac(randNonZero(rng, -6, 6));
      py = new Frac(randNonZero(rng, -8, 8));
      if (level === 2) {
        // 分数の値を与える: x = p, y = q/r → k = p*q/r が整数になるもの
        const r = randInt(rng, 2, 4);
        px = new Frac(r * randNonZero(rng, -3, 3));
        py = new Frac(randNonZero(rng, -7, 7), r);
      }
      k = px.mul(py);
      need(k.isInt() && !k.isZero(), "k は整数");
    }
    need(!(kind === "direct" && k.abs().eq(1) && level === 2), "L2 で k=±1 は避ける");
    const kindName = kind === "direct" ? "比例" : "反比例";
    const prompt =
      "y は x に" + kindName + "し、x = " + px.toString() + " のとき y = " + py.toString() + " です。\ny を x の式で表しなさい。";
    const correct = propAnswer(kind, k);
    const other = kind === "direct" ? "inverse" : "direct";
    const wrongs = [];
    if (k.isInt()) wrongs.push(propAnswer(other, k));
    wrongs.push(propAnswer(kind, k.neg()));
    if (kind === "direct") {
      wrongs.push(propAnswer("direct", new Frac(1).div(k)));
      wrongs.push(propAnswer("direct", px.div(py)));
    } else {
      // y = x/k 型の誤り → 比例で 1/k
      wrongs.push(propAnswer("direct", new Frac(1).div(k)));
      wrongs.push(propAnswer("inverse", py.div(px).isInt() ? py.div(px) : k.add(1)));
    }
    const steps =
      kind === "direct"
        ? [
            "比例の式は y = ax とおける",
            "x = " + px.toString() + "、y = " + py.toString() + " を代入: " + py.toString() + " = a × " + paren(px),
            "a = " + k.toString() + " なので " + correct,
          ]
        : [
            "反比例の式は y = a/x とおける（a = xy）",
            "a = " + paren(px) + " × " + paren(py) + " = " + k.toString(),
            "よって " + correct,
          ];
    return choiceProblem(
      rng,
      { unitId: "proportion", level, prompt, steps, meta: { kind, k, point: [px, py] } },
      correct,
      wrongs,
      () => propAnswer(kind, k.add(randNonZero(rng, -3, 3)))
    );
  }

  // ========== 中2 ==========

  // 先頭以外に続ける多項式: " + 3y" / " - 3y"
  function plusPoly(p) {
    const s = formatPoly(p);
    return s[0] === "-" ? " - " + s.slice(1) : " + " + s;
  }
  function monoParen(p) {
    const s = formatPoly(p);
    return s[0] === "-" ? "(" + s + ")" : s;
  }
  function randMono(rng, vars, maxCoef, maxDeg) {
    const v = {};
    for (const name of vars) if (rng() < 0.7) v[name] = randInt(rng, 1, maxDeg);
    if (Object.keys(v).length === 0) v[vars[0]] = 1;
    return Poly.term(randNonZero(rng, -maxCoef, maxCoef), v);
  }
  function monoParts(p) {
    const t = Array.from(p.terms.values())[0];
    return { coef: t.coef, vars: t.vars };
  }
  // 単項式の典型的な誤り
  function monoMistakes(rng, result, coefWrong) {
    const { coef, vars } = monoParts(result);
    const out = [result.scale(-1)];
    const names = Object.keys(vars);
    const n = pick(rng, names);
    const v2 = Object.assign({}, vars);
    v2[n] = vars[n] + 1;
    out.push(Poly.term(coef, v2));
    if (vars[n] > 1) {
      const v3 = Object.assign({}, vars);
      v3[n] = vars[n] - 1;
      out.push(Poly.term(coef, v3));
    }
    if (coefWrong && !coefWrong.eq(coef) && !coefWrong.isZero()) out.push(Poly.term(coefWrong, vars));
    return out;
  }
  function lcm(a, b) {
    return Math.abs(a * b) / M.gcd(a, b);
  }
  // 分母をそろえて (ax + by)/L の形にする（整数係数ならそのまま）
  function formatOverDen(p) {
    let L = 1;
    for (const t of p.terms.values()) L = lcm(L, t.coef.d);
    if (L === 1) return formatPoly(p);
    return "(" + formatPoly(p.scale(L)) + ")/" + L;
  }

  // ---- 式の計算 ----
  function genPolycalc(rng, level) {
    const vs = pick(rng, [["x", "y"], ["a", "b"]]);
    const [u, v] = vs;
    const r = () => randNonZero(rng, -9, 9);
    const two = () => Poly.var(u, r()).add(Poly.var(v, r()));
    const tmpl = level === 1 ? pick(rng, ["addsub", "monomul", "monodiv"]) : pick(rng, ["ksub", "frac", "three"]);
    let prompt, result, meta, wrong = [], fmt = formatPoly, steps;
    if (tmpl === "addsub" || tmpl === "ksub") {
      const p1 = two(),
        p2 = two();
      const k = tmpl === "addsub" ? 1 : randInt(rng, 2, 5) * pick(rng, [1, -1]);
      const m = tmpl === "addsub" ? pick(rng, [1, -1]) : -randInt(rng, 2, 5);
      result = p1.scale(k).add(p2.scale(m));
      if (tmpl === "addsub") prompt = "(" + formatPoly(p1) + ") " + (m > 0 ? "+" : "-") + " (" + formatPoly(p2) + ")";
      else prompt = kParen(k, p1) + " - " + kParen(-m, p2);
      // 後ろのかっこの2つ目の項の符号を変え忘れる
      const t2 = Poly.var(v, p2.coefOf(((o) => ((o[v] = 1), o))({})));
      if (m < 0) wrong.push(result.add(t2.scale(-2 * m)));
      wrong.push(p1.scale(k).sub(p2.scale(m)));
      wrong.push(result.add(Poly.var(u, pick(rng, [1, -1]))));
      meta = { parts: [{ k: new Frac(k), p: p1 }, { k: new Frac(m), p: p2 }], result };
      steps = [
        "かっこをはずす: " + formatPoly(p1.scale(k)) + plusPoly(p2.scale(m)),
        "同類項をまとめる: " + formatPoly(result),
      ];
    } else if (tmpl === "monomul") {
      const a = randMono(rng, vs, 6, 2),
        b = randMono(rng, vs, 6, 2);
      result = a.mul(b);
      prompt = formatPoly(a) + " × " + monoParen(b);
      wrong = monoMistakes(rng, result, monoParts(a).coef.add(monoParts(b).coef));
      meta = { num: [a, b], den: [], result };
      steps = ["係数どうし、文字どうしをかける（同じ文字は指数をたす）", formatPoly(result)];
    } else if (tmpl === "monodiv") {
      const q = randMono(rng, vs, 6, 2),
        d = randMono(rng, vs, 5, 1);
      need(!monoParts(d).coef.abs().eq(1) || rng() < 0.3, "除数の係数");
      const n = q.mul(d);
      result = q;
      prompt = formatPoly(n) + " ÷ " + monoParen(d);
      wrong = monoMistakes(rng, result, monoParts(n).coef.sub(monoParts(d).coef));
      meta = { num: [n], den: [d], result };
      steps = [
        "分数の形にする: " + formatPoly(n) + " / " + monoParen(d),
        "係数どうし、文字どうしで約分する: " + formatPoly(result),
      ];
    } else if (tmpl === "frac") {
      const P = randInt(rng, 2, 4),
        Q = randInt(rng, 2, 5);
      need(P !== Q, "P≠Q");
      const p1 = Poly.var(u, randNonZero(rng, -4, 4)).add(Poly.var(v, randNonZero(rng, -4, 4)));
      const p2 = Poly.var(u, randNonZero(rng, -4, 4)).add(Poly.var(v, randNonZero(rng, -4, 4)));
      const sg = pick(rng, [1, -1]);
      result = p1.scale(new Frac(1, P)).add(p2.scale(new Frac(sg, Q)));
      need(!result.isZero() && result.terms.size === 2, "2項残す");
      prompt = "(" + formatPoly(p1) + ")/" + P + (sg > 0 ? " + " : " - ") + "(" + formatPoly(p2) + ")/" + Q;
      fmt = formatOverDen;
      const L = lcm(P, Q);
      // 後ろの分子の2つ目の項の符号ミス
      const wrongNum = p1.scale(L / P).add(p2.scale((sg * L) / Q));
      const t2 = Poly.var(v, p2.coefOf(((o) => ((o[v] = 1), o))({})));
      if (sg < 0) wrong.push(wrongNum.add(t2.scale((2 * L) / Q)).scale(new Frac(1, L)));
      // 分母をはらってしまう誤り（分子だけ）
      wrong.push(result.scale(L));
      wrong.push(p1.scale(new Frac(1, P)).sub(p2.scale(new Frac(sg, Q))));
      meta = { parts: [{ k: new Frac(1, P), p: p1 }, { k: new Frac(sg, Q), p: p2 }], result, answerFmt: "overden" };
      steps = [
        "分母を " + L + " にそろえる: (" + formatPoly(p1.scale(L / P)) + ")/" + L + (sg > 0 ? " + " : " - ") +
          "(" + formatPoly(p2.scale(L / Q)) + ")/" + L,
        "分子を計算する: " + formatOverDen(result),
      ];
    } else {
      // a ÷ b × c
      const q = randMono(rng, vs, 4, 1),
        d = randMono(rng, vs, 4, 1),
        c = randMono(rng, vs, 3, 2);
      const n = q.mul(d);
      result = q.mul(c);
      need(result.degree() <= 5, "次数");
      prompt = formatPoly(n) + " ÷ " + monoParen(d) + " × " + monoParen(c);
      wrong = monoMistakes(rng, result);
      // 先に d × c を計算してからわってしまう誤り（係数を c² でわったもの）
      const cc = monoParts(c).coef;
      if (!cc.abs().eq(1)) wrong.push(result.scale(new Frac(1).div(cc.mul(cc))));
      meta = { num: [n, c], den: [d], result };
      steps = [
        "わり算は逆数のかけ算にする: " + formatPoly(n) + " × 1/" + monoParen(d) + " × " + monoParen(c),
        "係数どうし、文字どうしで計算する: " + formatPoly(result),
      ];
    }
    need(!result.isZero(), "0");
    const correct = fmt(result);
    return choiceProblem(
      rng,
      { unitId: "polycalc", level, prompt: "次の計算をしなさい。\n" + prompt, steps, meta },
      correct,
      wrong.filter((w) => !w.isZero()).map(fmt),
      () => fmt(result.add(Poly.term(randNonZero(rng, -3, 3), monoParts(result).vars)))
    );
  }

  // ---- 連立方程式 ----
  function genSimul(rng, level) {
    const tmpl = level === 1 ? "basic" : pick(rng, ["general", "paren", "frac"]);
    const P = randInt(rng, 2, 4),
      Q = randInt(rng, 2, 4);
    const x0 = tmpl === "frac" ? P * randInt(rng, -2, 2) : randInt(rng, -6, 6),
      y0 = tmpl === "frac" ? Q * randInt(rng, -2, 2) : randInt(rng, -6, 6);
    const X = Poly.var("x"),
      Y = Poly.var("y");
    const env = { x: x0, y: y0 };
    let eqs, lines;
    const r = (m) => randNonZero(rng, -m, m);
    if (level === 1) {
      const a1 = r(5),
        b1 = r(5);
      let a2, b2;
      if (rng() < 0.5) {
        a2 = r(5);
        b2 = pick(rng, [b1, -b1]);
      } else {
        a2 = pick(rng, [a1, -a1]);
        b2 = r(5);
      }
      const l1 = X.scale(a1).add(Y.scale(b1)),
        l2 = X.scale(a2).add(Y.scale(b2));
      eqs = [
        { lhs: l1, rhs: Poly.const(l1.evaluate(env)) },
        { lhs: l2, rhs: Poly.const(l2.evaluate(env)) },
      ];
      lines = eqs.map((e) => formatPoly(e.lhs) + " = " + formatPoly(e.rhs));
    } else {
      const a2 = r(6),
        b2 = r(6);
      const l2 = X.scale(a2).add(Y.scale(b2));
      const e2 = { lhs: l2, rhs: Poly.const(l2.evaluate(env)) };
      let e1, line1;
      if (tmpl === "general") {
        const a1 = r(6),
          b1 = r(6);
        need(Math.abs(a1) !== Math.abs(a2) && Math.abs(b1) !== Math.abs(b2), "倍数関係なし");
        need(a2 % a1 !== 0 && a1 % a2 !== 0, "倍数関係なし");
        const l1 = X.scale(a1).add(Y.scale(b1));
        e1 = { lhs: l1, rhs: Poly.const(l1.evaluate(env)) };
        line1 = formatPoly(e1.lhs) + " = " + formatPoly(e1.rhs);
      } else if (tmpl === "paren") {
        const k = randInt(rng, 2, 4),
          pc = r(4),
          q = r(5);
        const inner = X.add(Y.scale(pc));
        const l1 = inner.scale(k).add(Y.scale(q));
        need(!l1.coefOf({ y: 1 }).isZero(), "y が消える");
        e1 = { lhs: l1, rhs: Poly.const(l1.evaluate(env)) };
        line1 = kParen(k, inner) + plusPoly(Y.scale(q)) + " = " + formatPoly(e1.rhs);
      } else {
        const sg = pick(rng, [1, -1]);
        const l1 = X.scale(new Frac(1, P)).add(Y.scale(new Frac(sg, Q)));
        e1 = { lhs: l1, rhs: Poly.const(l1.evaluate(env)) };
        line1 = "x/" + P + (sg > 0 ? " + " : " - ") + "y/" + Q + " = " + formatPoly(e1.rhs);
      }
      eqs = rng() < 0.5 ? [e1, e2] : [e2, e1];
      lines = eqs.map((e) => (e === e1 ? line1 : formatPoly(e.lhs) + " = " + formatPoly(e.rhs)));
    }
    // 整理した係数（整数化）
    const norm = eqs.map((e) => {
      let d = e.lhs.sub(e.rhs);
      let L = 1;
      for (const t of d.terms.values()) L = lcm(L, t.coef.d);
      d = d.scale(L);
      return { a: d.coefOf({ x: 1 }), b: d.coefOf({ y: 1 }), c: d.coefOf({}).neg() };
    });
    const det = norm[0].a.mul(norm[1].b).sub(norm[0].b.mul(norm[1].a));
    need(!det.isZero(), "解が一意でない");
    const steps = [];
    const show = (n) => formatPoly(X.scale(n.a).add(Y.scale(n.b))) + " = " + n.c.toString();
    if (level === 2) steps.push("式を整理する: " + show(norm[0]) + "、" + show(norm[1]));
    const A1 = norm[0].a.n,
      A2 = norm[1].a.n;
    const L = lcm(A1, A2);
    const m1 = L / Math.abs(A1),
      m2 = L / Math.abs(A2);
    const same = A1 * A2 > 0;
    const sg = same ? -1 : 1;
    const K = norm[0].b.mul(m1).add(norm[1].b.mul(m2 * sg));
    const R = norm[0].c.mul(m1).add(norm[1].c.mul(m2 * sg));
    const mulTxt = (m) => (m === 1 ? "そのまま" : m + " 倍");
    steps.push(
      "x を消去する: 上の式を" + mulTxt(m1) + "、下の式を" + mulTxt(m2) + "して" + (same ? "ひく" : "たす") + "と " +
        formatPoly(Y.scale(K)) + " = " + R.toString()
    );
    steps.push("y = " + y0 + " を代入して x = " + x0);
    return {
      unitId: "simul",
      level,
      prompt: "次の連立方程式を解きなさい。\n" + lines.join("\n"),
      answerType: "number",
      answer: [String(x0), String(y0)],
      fields: ["x", "y"],
      steps,
      meta: { eqs },
    };
  }

  // ---- 一次関数の式 ----
  function lineStr(a, b) {
    return "y = " + formatPoly(Poly.var("x", a).add(Poly.const(b)));
  }
  function pt(x, y) {
    return "(" + x.toString() + ", " + y.toString() + ")";
  }
  function genLinfunc(rng, level) {
    let a, b, points, prompt, steps;
    if (level === 1) {
      a = new Frac(randNonZero(rng, -5, 5));
      b = new Frac(randInt(rng, -9, 9));
      const px = new Frac(randNonZero(rng, -4, 4));
      const py = a.mul(px).add(b);
      points = [[px, py], [px.add(1), py.add(a)]];
      if (rng() < 0.6) {
        prompt = "傾きが " + a.toString() + " で、点 " + pt(px, py) + " を通る直線の式を求めなさい。";
        steps = [
          "y = " + formatPoly(Poly.var("x", a)) + " + b に " + pt(px, py) + " を代入: " + py.toString() + " = " + a.toString() + " × " + paren(px) + " + b",
          "b = " + b.toString() + " より " + lineStr(a, b),
        ];
      } else {
        prompt = "切片が " + b.toString() + " で、点 " + pt(px, py) + " を通る直線の式を求めなさい。";
        steps = [
          "y = ax " + (b.isNeg() ? "- " + b.abs().toString() : "+ " + b.toString()) + " に " + pt(px, py) + " を代入",
          py.toString() + " = " + paren(px) + "a + " + paren(b) + " より a = " + a.toString(),
          lineStr(a, b),
        ];
      }
    } else {
      const d = pick(rng, [1, 2, 3]);
      let n = randNonZero(rng, -6, 6);
      need(M.gcd(n, d) === 1, "既約");
      a = new Frac(n, d);
      b = new Frac(randInt(rng, -9, 9));
      const x1 = new Frac(d * randInt(rng, -3, 3));
      const x2 = new Frac(d * randInt(rng, -3, 3));
      need(!x1.eq(x2), "x1≠x2");
      const y1 = a.mul(x1).add(b),
        y2 = a.mul(x2).add(b);
      points = [[x1, y1], [x2, y2]];
      prompt = "2点 " + pt(x1, y1) + "、" + pt(x2, y2) + " を通る直線の式を求めなさい。";
      steps = [
        "傾き = (" + y2.toString() + " - " + paren(y1) + ") ÷ (" + x2.toString() + " - " + paren(x1) + ") = " + a.toString(),
        y1.toString() + " = " + a.toString() + " × " + paren(x1) + " + b より b = " + b.toString(),
        lineStr(a, b),
      ];
    }
    const [[x1, y1]] = points;
    const wrongs = [lineStr(a, b.neg()), lineStr(a.neg(), b), lineStr(a, y1.add(a.mul(x1)))];
    if (!b.isZero()) wrongs.push(lineStr(b, a));
    wrongs.push(lineStr(new Frac(1).div(a), b));
    return choiceProblem(
      rng,
      { unitId: "linfunc", level, prompt, steps, meta: { a, b, points } },
      lineStr(a, b),
      wrongs,
      () => lineStr(a, b.add(randNonZero(rng, -3, 3)))
    );
  }

  // ========== 中3 ==========
  const { formatFactors } = M;

  // ---- 式の展開 ----
  function genExpand(rng, level) {
    const X = Poly.var("x"),
      Yv = Poly.var("y");
    const r = (m) => randNonZero(rng, -m, m);
    let parts, prompt, wrong = [];
    const show = (fs) => fs.map((f) => "(" + formatPoly(f) + ")").join("");
    const showSq = (f) => "(" + formatPoly(f) + ")²";
    if (level === 1) {
      const t = pick(rng, ["ab", "sq", "sqm", "pm"]);
      const a = Math.abs(r(9)),
        b = r(9);
      let fs;
      if (t === "ab") {
        const b2 = r(9);
        need(b !== b2, "同じ");
        fs = [X.add(Poly.const(b)), X.add(Poly.const(b2))];
        prompt = show(fs);
        wrong.push(X.pow(2).add(Poly.const(b * b2)));
        wrong.push(X.pow(2).add(X.scale(b * b2)).add(Poly.const(b + b2)));
      } else if (t === "sq" || t === "sqm") {
        const v = t === "sq" ? a : -a;
        fs = [X.add(Poly.const(v)), X.add(Poly.const(v))];
        prompt = showSq(fs[0]);
        wrong.push(X.pow(2).add(Poly.const(v * v)));
        wrong.push(X.pow(2).add(X.scale(v)).add(Poly.const(v * v)));
        wrong.push(X.pow(2).add(X.scale(2 * v)).add(Poly.const(2 * v)));
      } else {
        fs = [X.add(Poly.const(a)), X.sub(Poly.const(a))];
        prompt = show(fs);
        wrong.push(X.pow(2).add(Poly.const(a * a)));
        wrong.push(X.pow(2).sub(X.scale(2 * a)).sub(Poly.const(a * a)));
      }
      parts = [{ k: 1, factors: fs }];
    } else {
      const t = pick(rng, ["sq2", "pm2", "combo"]);
      if (t === "sq2") {
        const p = Math.abs(r(4)),
          q = r(5);
        need(p !== 1 || Math.abs(q) !== 1, "簡単すぎ");
        const f = X.scale(p).add(Yv.scale(q));
        parts = [{ k: 1, factors: [f, f] }];
        prompt = showSq(f);
        wrong.push(X.scale(p).pow(2).add(Yv.scale(q).pow(2)));
        wrong.push(X.scale(p).pow(2).add(X.mul(Yv).scale(p * q)).add(Yv.scale(q).pow(2)));
        wrong.push(X.scale(p * p).mul(X).add(X.mul(Yv).scale(2 * p * q)).add(Yv.mul(Yv).scale(q)));
      } else if (t === "pm2") {
        const p = Math.abs(r(5)),
          q = Math.abs(r(9));
        need(p !== 1, "簡単すぎ");
        const fs = [X.scale(p).add(Poly.const(q)), X.scale(p).sub(Poly.const(q))];
        parts = [{ k: 1, factors: fs }];
        prompt = show(fs);
        wrong.push(X.pow(2).scale(p).sub(Poly.const(q * q)));
        wrong.push(X.pow(2).scale(p * p).add(Poly.const(q * q)));
        wrong.push(X.pow(2).scale(p * p).sub(Poly.const(q)));
      } else {
        // (x + a)(x + b) - (x + c)²  または  (x + a)(x - a) + (x + c)(x + d) など
        const a = r(6),
          b = r(6),
          cc = r(6);
        const f1 = [X.add(Poly.const(a)), X.add(Poly.const(b))];
        const f2 = [X.add(Poly.const(cc)), X.add(Poly.const(cc))];
        const sg = pick(rng, [1, -1]);
        parts = [{ k: 1, factors: f1 }, { k: sg, factors: f2 }];
        prompt = show(f1) + (sg > 0 ? " + " : " - ") + showSq(f2[0]);
        const p1 = f1[0].mul(f1[1]),
          p2 = f2[0].mul(f2[1]);
        // 後ろのかっこの符号を一部しか変えない誤り
        if (sg < 0) wrong.push(p1.sub(X.pow(2)).add(X.scale(2 * cc)).add(Poly.const(cc * cc)));
        wrong.push(p1.add(p2.scale(-sg)));
        wrong.push(p1.add(X.pow(2).add(Poly.const(cc * cc)).scale(sg)));
      }
    }
    let result = Poly.const(0);
    for (const pt of parts) {
      let pr = Poly.const(pt.k);
      for (const f of pt.factors) pr = pr.mul(f);
      result = result.add(pr);
    }
    need(!result.isZero(), "0");
    const steps =
      parts.length === 1
        ? ["乗法公式を使って展開する", "= " + formatPoly(result)]
        : [
            "それぞれ展開する: " +
              parts
                .map((pt) => {
                  let pr = Poly.const(1);
                  for (const f of pt.factors) pr = pr.mul(f);
                  return (pt.k < 0 ? "-(" : "(") + formatPoly(pr) + ")";
                })
                .join(" "),
            "かっこをはずして同類項をまとめる: " + formatPoly(result),
          ];
    return choiceProblem(
      rng,
      { unitId: "expand", level, prompt: "次の式を展開しなさい。\n" + prompt, steps, meta: { parts } },
      formatPoly(result),
      wrong.filter((w) => !w.isZero() && !w.eq(result)).map(formatPoly),
      () => formatPoly(result.add(X.scale(randNonZero(rng, -2, 2))))
    );
  }

  // ---- 因数分解 ----
  function genFactorize(rng, level) {
    const X = Poly.var("x"),
      Yv = Poly.var("y");
    const C = (n) => Poly.const(n);
    const r = (m) => randNonZero(rng, -m, m);
    let factors, coef = 1, cands = [], hint;
    const t = level === 1 ? pick(rng, ["tri", "tri", "diffsq", "square", "common"]) : pick(rng, ["ktri", "ax2", "two", "kdiff"]);
    if (t === "tri") {
      const p = r(9),
        q = r(9);
      need(p + q !== 0, "差の平方は別");
      factors = [X.add(C(p)), X.add(C(q))];
      hint = "たして " + (p + q) + "、かけて " + p * q + " になる2数は " + p + " と " + q;
      cands.push({ factors: [X.sub(C(p)), X.sub(C(q))] });
      cands.push({ factors: [X.add(C(-p)), X.add(C(q))] });
      cands.push({ factors: [X.add(C(p)), X.add(C(-q))] });
      cands.push({ factors: [X.add(C(1)), X.add(C(p * q))] });
      cands.push({ factors: [X.add(C(-1)), X.add(C(-p * q))] });
    } else if (t === "diffsq") {
      const a = randInt(rng, 1, 3),
        b = randInt(rng, 1, 9);
      need(M.gcd(a, b) === 1, "共通因数なし");
      const P = X.scale(a);
      factors = [P.add(C(b)), P.sub(C(b))];
      hint = "a² - b² = (a + b)(a - b) を使う";
      cands.push({ factors: [P.sub(C(b)), P.sub(C(b))] });
      cands.push({ factors: [P.add(C(b)), P.add(C(b))] });
      cands.push({ factors: [X.add(C(b)), X.sub(C(b))] });
      cands.push({ factors: [P.add(C(b * b)), P.sub(C(1))] });
    } else if (t === "square") {
      const a = r(9);
      factors = [X.add(C(a)), X.add(C(a))];
      hint = "a² ± 2ab + b² = (a ± b)² を使う";
      cands.push({ factors: [X.sub(C(a)), X.sub(C(a))] });
      cands.push({ factors: [X.add(C(a)), X.sub(C(a))] });
      cands.push({ factors: [X.add(C(2 * a)), X.add(C(2 * a))] });
      cands.push({ factors: [X.add(C(1)), X.add(C(a * a))] });
    } else if (t === "common") {
      const k = randInt(rng, 2, 6),
        a = r(9);
      factors = [X, X.add(C(a))];
      coef = k;
      hint = "共通因数 " + formatPoly(X.scale(k)) + " をくくり出す";
      cands.push({ factors: [X.sub(C(a))], coef: k, mono: true });
      cands.push({ factors: [X, X.add(C(a * k))], coef: 1 });
      cands.push({ factors: [X, X.add(C(a))], coef: 1 });
      cands.push({ factors: [X, X.sub(C(a))], coef: k });
    } else if (t === "ktri") {
      const k = randInt(rng, 2, 4) * pick(rng, [1, 1, -1]);
      const p = r(6),
        q = r(6);
      need(p + q !== 0 && p !== q, "形");
      factors = [X.add(C(p)), X.add(C(q))];
      coef = k;
      hint = "共通因数 " + k + " をくくり出してから、たして " + (p + q) + "、かけて " + p * q + " になる2数を探す";
      cands.push({ factors: [X.add(C(p)), X.add(C(q))], coef: 1 });
      cands.push({ factors: [X.sub(C(p)), X.sub(C(q))], coef: k });
      cands.push({ factors: [X.add(C(-p)), X.add(C(q))], coef: k });
      cands.push({ factors: [X.add(C(p)), X.add(C(q))], coef: -k });
    } else if (t === "ax2") {
      const a = randInt(rng, 2, 3);
      const p = r(7),
        q = r(5);
      need(M.gcd(a, Math.abs(p)) === 1, "共通因数なし");
      factors = [X.scale(a).add(C(p)), X.add(C(q))];
      hint = "(" + a + "x + □)(x + △) の形で、□ と △ の組を探す";
      cands.push({ factors: [X.scale(a).add(C(q)), X.add(C(p))] });
      cands.push({ factors: [X.scale(a).sub(C(p)), X.sub(C(q))] });
      cands.push({ factors: [X.scale(a).add(C(p)), X.sub(C(q))] });
      cands.push({ factors: [X.scale(a).sub(C(p)), X.add(C(q))] });
    } else if (t === "two") {
      // 2変数: (ax + by)(ax - by) または (ax + by)²
      const a = randInt(rng, 1, 3),
        b = randInt(rng, 1, 5);
      need(M.gcd(a, b) === 1 && !(a === 1 && b === 1), "形");
      const P = X.scale(a),
        Q = Yv.scale(b * pick(rng, [1, -1]));
      if (rng() < 0.5) {
        factors = [P.add(Q), P.sub(Q)];
        hint = "a² - b² = (a + b)(a - b) を使う";
        cands.push({ factors: [P.add(Q), P.add(Q)] });
        cands.push({ factors: [P.sub(Q), P.sub(Q)] });
        cands.push({ factors: [X.add(Yv.scale(b)), X.sub(Yv.scale(b))], coef: 1 });
      } else {
        factors = [P.add(Q), P.add(Q)];
        hint = "a² ± 2ab + b² = (a ± b)² を使う";
        cands.push({ factors: [P.sub(Q), P.sub(Q)] });
        cands.push({ factors: [P.add(Q), P.sub(Q)] });
        cands.push({ factors: [P.add(Q.scale(2)), P.add(Q.scale(2))] });
      }
    } else {
      // k(x + a)(x - a)
      const k = randInt(rng, 2, 5),
        a = randInt(rng, 1, 6);
      factors = [X.add(C(a)), X.sub(C(a))];
      coef = k;
      hint = "共通因数 " + k + " をくくり出してから a² - b² = (a + b)(a - b) を使う";
      cands.push({ factors: [X.sub(C(a)), X.sub(C(a))], coef: k });
      cands.push({ factors: [X.add(C(a * k)), X.sub(C(a))], coef: 1 });
      cands.push({ factors: [X.add(C(a)), X.sub(C(a))], coef: 1 });
      cands.push({ factors: [X.add(C(2 * a)), X.sub(C(2 * a))], coef: k });
    }
    const product = (fs, k) => fs.reduce((acc, f) => acc.mul(f), Poly.const(k === undefined ? 1 : k));
    const original = product(factors, coef);
    const correct = formatFactors(factors, coef);
    const choiceFactors = {};
    choiceFactors[correct] = { factors, coef };
    const wrongStrs = [];
    for (const c of cands) {
      const cc = c.coef === undefined ? coef : c.coef;
      const fs = c.mono ? [X].concat(c.factors) : c.factors;
      if (product(fs, cc).eq(original)) continue;
      const s = formatFactors(fs, cc);
      if (choiceFactors[s]) continue;
      choiceFactors[s] = { factors: fs, coef: cc };
      wrongStrs.push(s);
    }
    const fallback = () => {
      const i = randInt(rng, 0, factors.length - 1);
      const fs = factors.slice();
      fs[i] = fs[i].add(C(randNonZero(rng, -3, 3)));
      if (product(fs, coef).eq(original)) throw new Error("同じ");
      const s = formatFactors(fs, coef);
      choiceFactors[s] = { factors: fs, coef };
      return s;
    };
    const steps = [hint, formatPoly(original) + " = " + correct];
    const p = choiceProblem(
      rng,
      {
        unitId: "factorize",
        level,
        prompt: "次の式を因数分解しなさい。\n" + formatPoly(original),
        steps,
        meta: { factors, coef, original, choiceFactors },
      },
      correct,
      wrongStrs,
      fallback
    );
    // 使わなかった候補は消しておく
    for (const k of Object.keys(choiceFactors)) if (!p.choices.includes(k)) delete choiceFactors[k];
    return p;
  }

  // ---- 平方根 ----
  // k√n の表示（簡約前）
  function rootStr(k, n) {
    return (k === 1 ? "" : k === -1 ? "-" : String(k)) + "√" + n;
  }
  function genSqrt(rng, level) {
    let value, prompt, num, wrongs = [], steps;
    const sqf = [2, 3, 5, 6, 7];
    const t = level === 1 ? pick(rng, ["simplify", "addsub", "mul"]) : pick(rng, ["rational", "square", "product", "muldiv"]);
    if (t === "simplify") {
      const r = pick(rng, sqf),
        k = randInt(rng, 2, 7);
      const n = k * k * r;
      value = Surd.sqrt(n);
      num = Math.sqrt(n);
      prompt = "√" + n + " を a√b の形に変形しなさい。";
      wrongs = [rootStr(k + 1, r), rootStr(k - 1, r).replace(/^1√/, "√"), rootStr(k * k, r), rootStr(r, k), rootStr(k, r * 2)];
      steps = [n + " = " + k + "² × " + r, "√" + n + " = " + value.toString()];
    } else if (t === "addsub") {
      const r = pick(rng, [2, 3, 5]);
      const n = randInt(rng, 2, 3);
      let sum = new Surd(),
        js = 0,
        str = "",
        naive = 0;
      let shown = "";
      const used = new Set();
      for (let i = 0; i < n; i++) {
        const k = randInt(rng, 1, 5);
        need(!used.has(k), "同じ根号");
        used.add(k);
        const sg = i === 0 ? 1 : pick(rng, [1, -1]);
        const m = k * k * r;
        sum = sum.add(Surd.sqrt(m).mul(sg));
        js += sg * Math.sqrt(m);
        naive += sg * m;
        str += (i === 0 ? "" : sg > 0 ? " + " : " - ") + "√" + m;
        shown += (i === 0 ? "" : sg > 0 ? " + " : " - ") + rootStr(k, r);
      }
      need(!sum.isZero(), "0");
      value = sum;
      num = js;
      prompt = "次の計算をしなさい。\n" + str;
      if (naive > 0) wrongs.push(Surd.sqrt(naive).toString() === value.toString() ? "√" + (naive + 1) : "√" + naive);
      const coef = value.terms.get(r);
      if (coef) {
        wrongs.push(Surd.sqrt(r).mul(coef.add(1)).toString());
        wrongs.push(Surd.sqrt(r).mul(coef.sub(1)).toString());
        wrongs.push(Surd.sqrt(r * 2).mul(coef).toString());
      }
      steps = ["それぞれ a√b の形にする: " + shown, "√" + r + " の係数をまとめる: " + value.toString()];
    } else if (t === "mul") {
      const a = pick(rng, [2, 3, 5, 6, 7, 10]),
        b = pick(rng, [2, 3, 6, 8, 12, 15, 18]);
      need(a !== b, "同じ");
      value = Surd.sqrt(a).mul(Surd.sqrt(b));
      num = Math.sqrt(a) * Math.sqrt(b);
      prompt = "次の計算をしなさい。\n√" + a + " × √" + b;
      wrongs = ["√" + (a + b), (a * b) + "", Surd.sqrt(a * b).mul(2).toString(), "√" + a * b === value.toString() ? "2√" + a * b : "√" + a * b];
      steps = ["√a × √b = √(ab) より √" + a * b, "簡単にする: " + value.toString()];
    } else if (t === "rational") {
      // k/√r + √m など
      const r = pick(rng, [2, 3, 5, 6]);
      const k = r * randInt(rng, 1, 4);
      const m2 = randInt(rng, 1, 4);
      const sg = pick(rng, [1, -1]);
      const m = m2 * m2 * r;
      value = Surd.sqrt(r).mul(new Frac(k, r)).add(Surd.sqrt(m).mul(sg));
      num = k / Math.sqrt(r) + sg * Math.sqrt(m);
      need(!value.isZero(), "0");
      prompt = "次の計算をしなさい。\n" + k + "/√" + r + (sg > 0 ? " + " : " - ") + "√" + m;
      const co = value.terms.get(r) || new Frac(0);
      wrongs.push(Surd.sqrt(r).mul(new Frac(k)).add(Surd.sqrt(m).mul(sg)).toString());
      wrongs.push(Surd.sqrt(r).mul(co.add(1)).toString());
      wrongs.push(Surd.sqrt(r).mul(co.neg()).toString());
      wrongs.push(Surd.rat(new Frac(k, r)).add(Surd.sqrt(m).mul(sg)).toString());
      steps = ["分母を有理化する: " + k + "/√" + r + " = " + k + "√" + r + "/" + r + " = " + Surd.sqrt(r).mul(new Frac(k, r)).toString()];
      if (m2 > 1) steps.push("√" + m + " = " + Surd.sqrt(m).toString());
      steps.push("まとめる: " + value.toString());
    } else if (t === "square") {
      const a = pick(rng, [2, 3, 5, 6, 7]),
        b = randNonZero(rng, -4, 4);
      const base = Surd.sqrt(a).add(b);
      value = base.mul(base);
      num = Math.pow(Math.sqrt(a) + b, 2);
      prompt = "次の計算をしなさい。\n(√" + a + (b > 0 ? " + " : " - ") + Math.abs(b) + ")²";
      wrongs.push(Surd.rat(a + b * b).toString());
      wrongs.push(Surd.rat(a + b * b).add(Surd.sqrt(a).mul(b)).toString());
      wrongs.push(Surd.rat(a + b * b).sub(Surd.sqrt(a).mul(2 * b)).toString());
      wrongs.push(Surd.rat(a + 2 * b).add(Surd.sqrt(a).mul(2 * b)).toString());
      steps = [
        "(a + b)² = a² + 2ab + b² を使う",
        "(√" + a + ")² + 2 × √" + a + " × " + paren(b) + " + " + paren(b) + "² = " + value.toString(),
      ];
    } else if (t === "product") {
      // (√a + p)(√a + q)
      const a = pick(rng, [2, 3, 5, 6, 7]),
        p = randNonZero(rng, -5, 5),
        q = randNonZero(rng, -5, 5);
      need(p !== q, "同じ");
      value = Surd.sqrt(a).add(p).mul(Surd.sqrt(a).add(q));
      num = (Math.sqrt(a) + p) * (Math.sqrt(a) + q);
      const term = (v) => (v > 0 ? " + " + v : " - " + -v);
      prompt = "次の計算をしなさい。\n(√" + a + term(p) + ")(√" + a + term(q) + ")";
      wrongs.push(Surd.rat(a + p * q).toString());
      wrongs.push(Surd.rat(a + p * q).sub(Surd.sqrt(a).mul(p + q)).toString());
      wrongs.push(Surd.rat(a - p * q).add(Surd.sqrt(a).mul(p + q)).toString());
      wrongs.push(Surd.rat(a + p * q).add(Surd.sqrt(a).mul(p * q)).toString());
      steps = [
        "(x + a)(x + b) = x² + (a + b)x + ab を使う",
        a + (p + q >= 0 ? " + " + (p + q) : " - " + -(p + q)) + "√" + a + (p * q > 0 ? " + " + p * q : " - " + -(p * q)) + " = " + value.toString(),
      ];
    } else {
      // √a × √b ÷ √c
      const a = pick(rng, [2, 3, 6, 10, 15]),
        b = pick(rng, [2, 3, 5, 6, 8, 12]),
        c = pick(rng, [2, 3, 5, 6]);
      need((a * b) % c === 0, "割り切れる");
      value = Surd.sqrt((a * b) / c);
      num = (Math.sqrt(a) * Math.sqrt(b)) / Math.sqrt(c);
      prompt = "次の計算をしなさい。\n√" + a + " × √" + b + " ÷ √" + c;
      wrongs.push(Surd.sqrt(a * b * c).toString());
      wrongs.push(value.mul(2).toString());
      wrongs.push(Surd.sqrt(a + b - c > 0 ? a + b - c : a + b).toString());
      wrongs.push("√" + (a * b) / c === value.toString() ? value.add(1).toString() : "√" + (a * b) / c);
      steps = ["√(" + a + " × " + b + " ÷ " + c + ") = √" + (a * b) / c, "簡単にする: " + value.toString()];
    }
    const correct = value.toString();
    // 値が正解と同じになる誤答（表記違い）は除く
    const evalStr = (s) => {
      const js = s.replace(/(\d*)√(\d+)/g, (_, k, r) => "(" + (k || "1") + "*Math.sqrt(" + r + "))");
      try {
        return Function('"use strict";return (' + js + ")")();
      } catch (e) {
        return NaN;
      }
    };
    // √(平方数) のような表記の誤答は出さない
    const perfectRoot = (s) => (s.match(/√(\d+)/g) || []).some((t) => M.simplifySqrt(+t.slice(1)).r === 1);
    const ok = (s) => typeof s === "string" && !perfectRoot(s) && Math.abs(evalStr(s) - num) > 1e-9 && isFinite(evalStr(s));
    return choiceProblem(
      rng,
      { unitId: "sqrt", level, prompt, steps, meta: { value, exprNumber: num } },
      correct,
      wrongs.filter(ok),
      () => {
        const s = value.add(Surd.sqrt(pick(rng, [2, 3, 5])).mul(randNonZero(rng, -2, 2))).toString();
        if (!ok(s)) throw new Error("同値");
        return s;
      }
    );
  }

  // ---- 二次方程式 ----
  // 解の表示
  function rootsRational(rs) {
    const u = [];
    for (const r of rs) if (!u.some((v) => v.eq(r))) u.push(r);
    u.sort((a, b) => a.toNumber() - b.toNumber());
    if (u.length === 2 && u[0].eq(u[1].neg())) return "x = ±" + u[1].toString();
    return "x = " + u.map((r) => r.toString()).join(", ");
  }
  // (p ± q√r)/d  （p, q, d は整数、q>0, d>0, r は平方因数なし >1）
  function rootsIrrational(p, q, r, d) {
    const g = M.gcd(M.gcd(Math.abs(p), q), d);
    p /= g;
    q /= g;
    d /= g;
    const qs = (q === 1 ? "" : String(q)) + "√" + r;
    if (d === 1) return p === 0 ? "x = ±" + qs : "x = " + p + " ± " + qs;
    return p === 0 ? "x = ±" + qs + "/" + d : "x = (" + p + " ± " + qs + ")/" + d;
  }
  function genQuadeq(rng, level) {
    const X = Poly.var("x");
    let poly, prompt, answer, wrongs = [], steps;
    const t = level === 1 ? pick(rng, ["fact", "fact", "zero", "sq"]) : pick(rng, ["formula", "formula", "shift", "ax2"]);
    if (t === "fact" || t === "zero" || t === "sq" || t === "ax2") {
      let p, q, a = 1;
      if (t === "fact") {
        p = randInt(rng, -9, 9);
        q = randInt(rng, -9, 9);
        need(p !== 0 && q !== 0 && p !== -q, "形");
      } else if (t === "zero") {
        p = 0;
        q = randNonZero(rng, -9, 9);
      } else if (t === "sq") {
        p = randInt(rng, 1, 9);
        q = -p;
      } else {
        a = randInt(rng, 2, 3);
        p = randNonZero(rng, -7, 7);
        q = randNonZero(rng, -5, 5);
        need(M.gcd(a, Math.abs(p)) === 1, "既約");
      }
      // a(x)... : (a x - p)(x - q) = 0  → 解 p/a, q
      poly = X.scale(a).sub(Poly.const(p)).mul(X.sub(Poly.const(q)));
      const r1 = new Frac(p, a),
        r2 = new Frac(q);
      answer = rootsRational([r1, r2]);
      prompt = formatPoly(poly) + " = 0";
      wrongs.push(rootsRational([r1.neg(), r2.neg()]));
      wrongs.push(rootsRational([r1, r2.neg()]));
      wrongs.push(rootsRational([r1.neg(), r2]));
      if (a !== 1) wrongs.push(rootsRational([new Frac(p), r2]));
      if (t === "zero") wrongs.push(rootsRational([r2]));
      if (t === "sq") wrongs.push(rootsRational([new Frac(p)]));
      steps = ["左辺を因数分解する: " + formatFactors([X.scale(a).sub(Poly.const(p)), X.sub(Poly.const(q))]) + " = 0", answer];
    } else if (t === "shift") {
      // (x + a)² = b
      const a = randNonZero(rng, -6, 6),
        b = pick(rng, [2, 3, 5, 6, 7, 8, 12, 18, 20]);
      poly = X.add(Poly.const(a)).pow(2).sub(Poly.const(b));
      const { k, r } = M.simplifySqrt(b);
      answer = rootsIrrational(-a, k, r, 1);
      prompt = "(" + formatPoly(X.add(Poly.const(a))) + ")² = " + b;
      wrongs.push(rootsIrrational(a, k, r, 1));
      wrongs.push(rootsIrrational(-a, b, 1, 1) === answer ? rootsIrrational(-a, k + 1, r, 1) : "x = " + -a + " ± " + b);
      if (b > 1) wrongs.push("x = " + -a + " ± √" + b === answer ? rootsIrrational(-a, k, r, 2) : "x = " + (-a) + " ± √" + b);
      wrongs.push(rootsIrrational(-a, k, r, 2));
      steps = ["x " + (a > 0 ? "+ " + a : "- " + -a) + " = ±√" + b, answer];
    } else {
      // 解の公式
      const A = randInt(rng, 1, 3),
        B = randInt(rng, -7, 7),
        Cc = randNonZero(rng, -7, 7);
      const D = B * B - 4 * A * Cc;
      need(D > 0, "実数解");
      const { k, r } = M.simplifySqrt(D);
      need(r !== 1, "無理数解");
      poly = X.pow(2).scale(A).add(X.scale(B)).add(Poly.const(Cc));
      answer = rootsIrrational(-B, k, r, 2 * A);
      prompt = formatPoly(poly) + " = 0";
      wrongs.push(rootsIrrational(B, k, r, 2 * A));
      wrongs.push(rootsIrrational(-B, k, r, A));
      wrongs.push(rootsIrrational(-B, k, r, 1));
      const D2 = B * B + 4 * A * Cc;
      if (D2 > 0) {
        const s2 = M.simplifySqrt(D2);
        if (s2.r !== 1) wrongs.push(rootsIrrational(-B, s2.k, s2.r, 2 * A));
      }
      steps = [
        "解の公式 x = (-b ± √(b² - 4ac))/2a に a = " + A + "、b = " + B + "、c = " + Cc + " を代入",
        "x = (" + -B + " ± √" + D + ")/" + 2 * A,
        "簡単にする: " + answer,
      ];
    }
    // 答えと解の集合が同じ誤答を除く
    const toNums = (s) => {
      const out = [];
      for (const part of s.slice(4).split(", ")) {
        const ev = (e) => Function('"use strict";return (' + e.replace(/(\d*)√(\d+)/g, (_, kk, rr) => "(" + (kk || "1") + "*Math.sqrt(" + rr + "))") + ")")();
        if (part.includes("±")) {
          out.push(ev(part.startsWith("±") ? part.slice(1) : part.replace("±", "+")));
          out.push(ev(part.startsWith("±") ? "-" + part.slice(1) : part.replace("±", "-")));
        } else out.push(ev(part));
      }
      return out.sort((a, b) => a - b);
    };
    const ans = toNums(answer);
    const differs = (s) => {
      let w;
      try {
        w = toNums(s);
      } catch (e) {
        return false;
      }
      return w.length !== ans.length || w.some((v, i) => !isFinite(v) || Math.abs(v - ans[i]) > 1e-9);
    };
    return choiceProblem(
      rng,
      { unitId: "quadeq", level, prompt: "次の方程式を解きなさい。\n" + prompt, steps, meta: { poly } },
      answer,
      wrongs.filter(differs),
      () => {
        const s = rootsRational([new Frac(randNonZero(rng, -9, 9)), new Frac(randNonZero(rng, -9, 9))]);
        if (!differs(s)) throw new Error("同じ");
        return s;
      }
    );
  }

  const GENERATORS = {
    signed: genSigned,
    linexpr: genLinexpr,
    lineq: genLineq,
    proportion: genProportion,
    polycalc: genPolycalc,
    simul: genSimul,
    linfunc: genLinfunc,
    expand: genExpand,
    factorize: genFactorize,
    sqrt: genSqrt,
    quadeq: genQuadeq,
  };

  // ---------- 予備問題（生成に失敗し続けた場合のみ使用） ----------
  function fb(unitId, level, prompt, answerType, answer, steps, extra) {
    return Object.assign({ unitId, level, prompt, answerType, answer, steps, meta: {} }, extra || {});
  }
  const FALLBACK = {
    signed: {
      1: fb("signed", 1, "次の計算をしなさい。\n(-3) + 8 - (-5)", "number", "10", ["-3 + 8 + 5 = 10"]),
      2: fb("signed", 2, "次の計算をしなさい。\n(-2)³ × 3 - 4²", "number", "-40", [
        "(-2)³ = -8、4² = 16",
        "-8 × 3 - 16 = -24 - 16 = -40",
      ]),
    },
    linexpr: {
      1: fb("linexpr", 1, "次の計算をしなさい。\n(3x + 2) - (x - 5)", "choice", "2x + 7", ["3x + 2 - x + 5 = 2x + 7"], {
        choices: ["2x + 7", "2x - 3", "4x - 3", "2x - 7"],
      }),
      2: fb("linexpr", 2, "次の計算をしなさい。\n2(3x - 1) - 3(x + 2)", "choice", "3x - 8", [
        "6x - 2 - 3x - 6",
        "= 3x - 8",
      ], { choices: ["3x - 8", "3x + 4", "9x - 8", "3x - 4"] }),
    },
    lineq: {
      1: fb("lineq", 1, "次の方程式を解きなさい。\n3x + 1 = x + 7", "number", "3", ["3x - x = 7 - 1", "2x = 6", "x = 3"]),
      2: fb("lineq", 2, "次の方程式を解きなさい。\n2(x + 3) = 5(x - 3)", "number", "7", [
        "2x + 6 = 5x - 15",
        "-3x = -21",
        "x = 7",
      ]),
    },
    proportion: {
      1: fb("proportion", 1, "y は x に比例し、x = 2 のとき y = 6 です。\ny を x の式で表しなさい。", "choice", "y = 3x", [
        "y = ax に代入して 6 = 2a",
        "a = 3",
      ], { choices: ["y = 3x", "y = 12/x", "y = 1/3x", "y = -3x"] }),
      2: fb("proportion", 2, "y は x に反比例し、x = -4 のとき y = 3 です。\ny を x の式で表しなさい。", "choice", "y = -12/x", [
        "a = xy = (-4) × 3 = -12",
      ], { choices: ["y = -12/x", "y = 12/x", "y = -12x", "y = -3/4x"] }),
    },
    polycalc: {
      1: fb("polycalc", 1, "次の計算をしなさい。\n6x²y ÷ 2x", "choice", "3xy", ["6 ÷ 2 = 3、x² ÷ x = x", "= 3xy"], {
        choices: ["3xy", "3x²y", "4xy", "3x³y"],
      }),
      2: fb("polycalc", 2, "次の計算をしなさい。\n3(2a - b) - 2(a - 3b)", "choice", "4a + 3b", ["6a - 3b - 2a + 6b", "= 4a + 3b"], {
        choices: ["4a + 3b", "4a - 9b", "4a - 3b", "8a + 3b"],
      }),
    },
    simul: {
      1: fb("simul", 1, "次の連立方程式を解きなさい。\nx + y = 5\nx - y = 1", "number", ["3", "2"], [
        "2式をたすと 2x = 6、x = 3",
        "x + y = 5 に代入して y = 2",
      ], { fields: ["x", "y"] }),
      2: fb("simul", 2, "次の連立方程式を解きなさい。\n2x + 3y = 12\n3x - 2y = 5", "number", ["3", "2"], [
        "1式を2倍、2式を3倍してたすと 13x = 39、x = 3",
        "2x + 3y = 12 に代入して y = 2",
      ], { fields: ["x", "y"] }),
    },
    linfunc: {
      1: fb("linfunc", 1, "傾きが 2 で、点 (1, 5) を通る直線の式を求めなさい。", "choice", "y = 2x + 3", [
        "y = 2x + b に (1, 5) を代入: 5 = 2 + b",
        "b = 3",
      ], { choices: ["y = 2x + 3", "y = 2x - 3", "y = 3x + 2", "y = 2x + 5"] }),
      2: fb("linfunc", 2, "2点 (1, 3)、(3, 7) を通る直線の式を求めなさい。", "choice", "y = 2x + 1", [
        "傾き = (7 - 3) ÷ (3 - 1) = 2",
        "3 = 2 × 1 + b より b = 1",
      ], { choices: ["y = 2x + 1", "y = 1/2x + 5/2", "y = 2x - 1", "y = -2x + 5"] }),
    },
    expand: {
      1: fb("expand", 1, "次の式を展開しなさい。\n(x + 3)²", "choice", "x² + 6x + 9", ["(a + b)² = a² + 2ab + b²", "= x² + 6x + 9"], {
        choices: ["x² + 6x + 9", "x² + 9", "x² + 3x + 9", "x² + 6x + 6"],
      }),
      2: fb("expand", 2, "次の式を展開しなさい。\n(2x - 3y)²", "choice", "4x² - 12xy + 9y²", [
        "(2x)² - 2 × 2x × 3y + (3y)²",
        "= 4x² - 12xy + 9y²",
      ], { choices: ["4x² - 12xy + 9y²", "4x² + 9y²", "4x² - 6xy + 9y²", "2x² - 12xy + 3y²"] }),
    },
    factorize: {
      1: fb("factorize", 1, "次の式を因数分解しなさい。\nx² + 5x + 6", "choice", "(x + 2)(x + 3)", [
        "たして 5、かけて 6 になる2数は 2 と 3",
      ], { choices: ["(x + 2)(x + 3)", "(x - 2)(x - 3)", "(x + 1)(x + 6)", "(x - 1)(x + 6)"] }),
      2: fb("factorize", 2, "次の式を因数分解しなさい。\n2x² - 8", "choice", "2(x + 2)(x - 2)", [
        "共通因数 2 をくくる: 2(x² - 4)",
        "x² - 4 = (x + 2)(x - 2)",
      ], { choices: ["2(x + 2)(x - 2)", "(2x + 2)(x - 4)", "2(x - 2)²", "2(x + 4)(x - 4)"] }),
    },
    sqrt: {
      1: fb("sqrt", 1, "次の計算をしなさい。\n√12 + √27", "choice", "5√3", ["√12 = 2√3、√27 = 3√3", "2√3 + 3√3 = 5√3"], {
        choices: ["5√3", "√39", "6√3", "5√6"],
      }),
      2: fb("sqrt", 2, "次の計算をしなさい。\n(√3 + 1)²", "choice", "4 + 2√3", ["(√3)² + 2 × √3 × 1 + 1²", "= 3 + 2√3 + 1 = 4 + 2√3"], {
        choices: ["4 + 2√3", "4", "4 + √3", "3 + 2√3"],
      }),
    },
    quadeq: {
      1: fb("quadeq", 1, "次の方程式を解きなさい。\nx² - 5x + 6 = 0", "choice", "x = 2, 3", ["(x - 2)(x - 3) = 0", "x = 2, 3"], {
        choices: ["x = 2, 3", "x = -2, -3", "x = 1, 6", "x = -1, 6"],
      }),
      2: fb("quadeq", 2, "次の方程式を解きなさい。\nx² + 2x - 2 = 0", "choice", "x = -1 ± √3", [
        "解の公式: x = (-2 ± √(4 + 8)) / 2",
        "= (-2 ± 2√3) / 2 = -1 ± √3",
      ], { choices: ["x = -1 ± √3", "x = 1 ± √3", "x = -2 ± 2√3", "x = -1 ± √12"] }),
    },
  };

  function generate(unitId, level, rng) {
    for (let i = 0; i < 20; i++) {
      const fn = api.GENERATORS[unitId];
      if (!fn) break;
      try {
        const p = fn(rng, level);
        if (validateProblem(p)) return p;
      } catch (e) {
        /* 作り直す */
      }
    }
    return FALLBACK[unitId][level];
  }

  const api = {
    UNITS,
    GENERATORS,
    FALLBACK,
    makeChoices,
    formatOverDen,
    validateProblem,
    generate,
    // 単元追加用の内部ヘルパー
    _h: { choiceProblem, paren, lin, kParen, side, niceFrac, need, plusPoly, monoParen, lcm, formatOverDen },
  };
  App.gen = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
