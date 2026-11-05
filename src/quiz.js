(function (root) {
  "use strict";
  const App = (root.MathApp = root.MathApp || {});
  const M = App.math;
  const G = App.gen;

  function pickWeighted(rng, weights) {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (!(total > 0)) return Math.floor(rng() * weights.length);
    let t = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i]);
      if (t < w) return i;
      t -= w;
    }
    // 浮動小数の誤差対策: 最後の正の重み
    for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
    return weights.length - 1;
  }

  // 答えの採点。読めない入力は null
  function grade(problem, input) {
    if (problem.answerType === "choice") {
      if (typeof input !== "string" || !problem.choices.includes(input)) return null;
      return input === problem.answer;
    }
    const answers = [].concat(problem.answer);
    const inputs = [].concat(input);
    if (inputs.length !== answers.length) return null;
    const parsed = inputs.map((s) => M.parseAnswer(s));
    if (parsed.some((v) => v === null)) return null;
    return parsed.every((v, i) => v.eq(M.parseAnswer(answers[i])));
  }

  function createSession(opts) {
    const size = opts.size || 10;
    const { rng, store, level, mode } = opts;
    const unitIds = G.UNITS.map((u) => u.id);
    const seen = new Set();
    const results = [];
    let index = 0;
    let current = null;
    let graded = null;

    function makeProblem() {
      let p = null;
      for (let i = 0; i < 6; i++) {
        const unitId = mode === "mix" ? unitIds[pickWeighted(rng, store.weights(unitIds))] : opts.unitId;
        p = G.generate(unitId, level, rng);
        if (!seen.has(p.prompt)) break;
      }
      seen.add(p.prompt);
      return p;
    }

    current = makeProblem();

    const session = {
      get index() {
        return index;
      },
      size,
      current() {
        return current;
      },
      answer(input) {
        if (!current) return { status: "invalid" };
        if (graded) return graded;
        const ok = grade(current, input);
        if (ok === null) return { status: "invalid" };
        try {
          store.record(current.unitId, ok);
        } catch (e) {
          /* 記録できなくても採点は続ける */
        }
        results.push({ problem: current, given: input, correct: ok });
        graded = { status: "graded", correct: ok, problem: current };
        return graded;
      },
      // 次の問題へ。答えていなければ進まない。最後の問題の後は false
      next() {
        if (!current || !graded) return false;
        graded = null;
        index++;
        if (index >= size) {
          current = null;
          return false;
        }
        current = makeProblem();
        return true;
      },
      isAnswered() {
        return !!graded;
      },
      results() {
        return results.slice();
      },
      score() {
        return results.filter((r) => r.correct).length;
      },
    };
    return session;
  }

  App.quiz = { createSession, pickWeighted, grade };
  if (typeof module !== "undefined") module.exports = App.quiz;
})(typeof globalThis !== "undefined" ? globalThis : this);
