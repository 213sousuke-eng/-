(function (root) {
  "use strict";
  const App = (root.MathApp = root.MathApp || {});

  // ---------- 数式の表示 ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function frac(n, d) {
    return '<span class="frac"><span class="num">' + n + '</span><span class="den">' + d + "</span></span>";
  }
  // a/b を縦の分数にする（テキストは先にエスケープ）
  function renderMath(text) {
    let s = escapeHtml(text);
    s = s.replace(/\(([^()]+)\)\/(\d+|√\d+)/g, (_, n, d) => frac(n, d));
    s = s.replace(/(\d+)\/\(([^()]+)\)/g, (_, n, d) => frac(n, d));
    s = s.replace(/(\d*√\d+|\d+|[a-z])\/(√\d+|\d+|[a-z])/g, (_, n, d) => frac(n, d));
    return s.replace(/\n/g, "<br>");
  }

  // 数式の行がない文章だけの問題（比例・一次関数など）か
  function isTextOnly(lines) {
    return lines.length < 2 || /[\u3040-\u30ff\u4e00-\u9fff]/.test(lines[lines.length - 1]);
  }

  // ---------- 画面 ----------
  const LEVEL_NAMES = { 1: "基本", 2: "受験レベル" };

  function start(doc) {
    const { createStore } = App.storage;
    const { createSession } = App.quiz;
    const { UNITS } = App.gen;
    const store = createStore();
    const appEl = doc.getElementById("app");
    const state = {
      level: store.getFlag("level2") ? 2 : 1,
      session: null,
      title: "",
    };
    const rng = Math.random;

    function h(tag, attrs, children) {
      const el = doc.createElement(tag);
      if (attrs) {
        for (const k of Object.keys(attrs)) {
          const v = attrs[k];
          if (v === undefined || v === null || v === false) continue;
          if (k === "class") el.className = v;
          else if (k === "html") el.innerHTML = v;
          else if (k === "text") el.textContent = v;
          else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
          else el.setAttribute(k, v === true ? "" : v);
        }
      }
      for (const c of [].concat(children || [])) {
        if (c === null || c === undefined || c === false) continue;
        el.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
      }
      return el;
    }
    function show(el) {
      appEl.innerHTML = "";
      appEl.appendChild(el);
      root.scrollTo && root.scrollTo(0, 0);
    }
    function unitName(id) {
      const u = UNITS.find((x) => x.id === id);
      return u ? u.name : id;
    }
    function rateText(st) {
      return st.rate === null ? "未挑戦" : Math.round(st.rate * 100) + "%";
    }
    function rateClass(st) {
      if (st.rate === null) return "rate-none";
      if (st.rate >= 0.8) return "rate-good";
      if (st.rate >= 0.5) return "rate-mid";
      return "rate-low";
    }

    function isIOS() {
      const ua = root.navigator ? root.navigator.userAgent : "";
      const touchMac = /Macintosh/.test(ua) && root.navigator.maxTouchPoints > 1;
      return /iPad|iPhone|iPod/.test(ua) || touchMac;
    }

    // ----- ホーム -----
    function renderHome() {
      const notices = [];
      if (!store.persistent) {
        notices.push(h("p", { class: "notice warn", "data-testid": "no-storage" }, "この環境では記録が保存されません"));
      }
      if (isIOS() && !(root.navigator && root.navigator.standalone) && !store.getFlag("a2hsClosed")) {
        notices.push(
          h("div", { class: "notice a2hs", "data-testid": "a2hs" }, [
            h("p", null, "共有ボタン →『ホーム画面に追加』で、記録が消えにくくなります"),
            h(
              "button",
              {
                class: "link",
                "data-testid": "a2hs-close",
                onclick: () => {
                  store.setFlag("a2hsClosed");
                  renderHome();
                },
              },
              "閉じる"
            ),
          ])
        );
      }
      const levelSeg = h("div", { class: "seg", role: "group", "aria-label": "難易度" }, [1, 2].map((lv) =>
        h(
          "button",
          {
            class: state.level === lv ? "on" : "",
            "aria-pressed": state.level === lv ? "true" : "false",
            "data-testid": "level-" + lv,
            onclick: () => {
              state.level = lv;
              if (lv === 2) store.setFlag("level2");
              else store.clearFlag("level2");
              renderHome();
            },
          },
          LEVEL_NAMES[lv]
        )
      ));
      const grades = [1, 2, 3].map((g) =>
        h("section", { class: "grade" }, [
          h("h2", null, "中" + g),
          h(
            "div",
            { class: "units" },
            UNITS.filter((u) => u.grade === g).map((u) => {
              const st = store.stats(u.id);
              return h(
                "button",
                {
                  class: "unit",
                  "data-testid": "unit-" + u.id,
                  onclick: () => startSession({ mode: "unit", unitId: u.id }),
                },
                [
                  h("span", { class: "unit-name" }, u.name),
                  h("span", { class: "unit-rate " + rateClass(st) }, st.count ? rateText(st) + "・" + st.count + "問" : rateText(st)),
                ]
              );
            })
          ),
        ])
      );
      show(
        h("main", { class: "screen home" }, [
          h("header", { class: "top" }, [
            h("h1", null, ["中学数学", h("br"), h("span", { class: "sub" }, "計算トレーニング")]),
            h("button", { class: "link", "data-testid": "nav-stats", onclick: renderStats }, "記録"),
          ]),
          ...notices,
          levelSeg,
          h(
            "button",
            { class: "primary mix", "data-testid": "mix", onclick: () => startSession({ mode: "mix" }) },
            [h("span", null, "苦手ミックス"), h("small", null, "正答率の低い単元から多めに10問")]
          ),
          ...grades,
        ])
      );
    }

    // ----- 出題 -----
    function startSession(opts) {
      state.session = createSession({ mode: opts.mode, unitId: opts.unitId, level: state.level, rng, store, size: 10 });
      state.title = (opts.mode === "mix" ? "苦手ミックス" : unitName(opts.unitId)) + "・" + LEVEL_NAMES[state.level];
      renderQuestion();
    }

    function renderQuestion() {
      const s = state.session;
      const p = s.current();
      if (!p) return renderResult();
      const lines = p.prompt.split("\n");
      const textOnly = isTextOnly(lines);
      const feedback = h("div", { class: "feedback", "data-testid": "feedback", hidden: true, "aria-live": "polite" });
      const msg = h("p", { class: "msg", "aria-live": "polite" });
      const nextBtn = h(
        "button",
        { class: "primary", "data-testid": "next", hidden: true, onclick: goNext },
        s.index + 1 >= s.size ? "結果を見る" : "次へ"
      );
      let answerArea;
      let inputs = [];
      let choiceBtns = [];
      let submitBtn = null;

      function finish(res, givenChoice) {
        if (res.status !== "graded") return;
        inputs.forEach((i) => (i.disabled = true));
        choiceBtns.forEach((b) => {
          b.disabled = true;
          if (b.dataset.value === p.answer) b.classList.add("correct");
          else if (b.dataset.value === givenChoice) b.classList.add("wrong");
        });
        if (submitBtn) submitBtn.hidden = true;
        msg.textContent = "";
        feedback.hidden = false;
        feedback.className = "feedback " + (res.correct ? "ok" : "ng");
        const ans = Array.isArray(p.answer) ? p.answer.map((a, i) => p.fields[i] + " = " + a).join("、") : p.answer;
        feedback.innerHTML = "";
        feedback.appendChild(h("p", { class: "verdict" }, res.correct ? "正解！" : "不正解…"));
        if (!res.correct) {
          feedback.appendChild(h("p", { class: "answer" }, [h("span", { class: "label" }, "正解 "), h("span", { html: renderMath(ans) })]));
        }
        feedback.appendChild(
          h("details", { open: !res.correct }, [
            h("summary", null, "解き方"),
            h("ol", { class: "steps" }, p.steps.map((st) => h("li", { html: renderMath(st) }))),
          ])
        );
        nextBtn.hidden = false;
        nextBtn.focus();
      }

      if (p.answerType === "choice") {
        choiceBtns = p.choices.map((c, i) =>
          h(
            "button",
            {
              class: "choice",
              "data-testid": "choice-" + i,
              "data-value": c,
              html: renderMath(c),
              onclick: () => {
                if (s.isAnswered()) return;
                finish(s.answer(c), c);
              },
            }
          )
        );
        answerArea = h("div", { class: "choices" }, choiceBtns);
      } else {
        const fields = p.fields || ["答え"];
        const submit = () => {
          if (s.isAnswered()) return;
          const vals = inputs.map((i) => i.value);
          const res = s.answer(p.fields ? vals : vals[0]);
          if (res.status === "invalid") {
            msg.textContent = "数字で入力してね";
            const empty = inputs.find((i) => i.value.trim() === "") || inputs[0];
            empty.focus();
            return;
          }
          finish(res);
        };
        inputs = fields.map((f, i) =>
          h("input", {
            type: "text",
            inputmode: "text",
            autocomplete: "off",
            autocapitalize: "off",
            autocorrect: "off",
            spellcheck: "false",
            enterkeyhint: "done",
            "aria-label": f,
            "data-testid": "input-" + i,
            onkeydown: (e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault();
                if (i < fields.length - 1 && inputs[i + 1].value.trim() === "") inputs[i + 1].focus();
                else submit();
              }
            },
          })
        );
        submitBtn = h("button", { class: "primary", "data-testid": "submit", onclick: submit }, "答え合わせ");
        answerArea = h("div", { class: "num-answer" }, [
          ...fields.map((f, i) => h("label", { class: "field" }, [h("span", { class: "fname" }, p.fields ? f + " =" : f), inputs[i]])),
          h("p", { class: "hint" }, "分数は 3/4 のように入力"),
          submitBtn,
        ]);
      }

      function goNext() {
        if (!s.isAnswered()) return;
        if (s.next()) renderQuestion();
        else renderResult();
      }

      show(
        h("main", { class: "screen quiz" }, [
          h("header", { class: "top" }, [
            h("button", { class: "link", "data-testid": "quit", onclick: renderHome }, "← やめる"),
            h("span", { class: "title" }, state.title),
            h("span", { class: "progress", "data-testid": "progress" }, s.index + 1 + " / " + s.size),
          ]),
          h("div", { class: "bar" }, h("div", { class: "bar-in", style: "width:" + (s.index / s.size) * 100 + "%" })),
          h("section", { class: "card question" }, textOnly
            ? [h("div", { class: "prompt text", "data-testid": "prompt", html: renderMath(p.prompt) })]
            : [
                h("p", { class: "instr" }, lines[0]),
                h("div", { class: "prompt", "data-testid": "prompt", html: renderMath(lines.slice(1).join("\n")) }),
              ]),
          answerArea,
          msg,
          feedback,
          nextBtn,
        ])
      );
      if (inputs[0] && !isIOS()) inputs[0].focus();
    }

    // ----- 結果 -----
    function reviewText(prompt) {
      const ls = prompt.split("\n");
      return isTextOnly(ls) ? prompt : ls.slice(1).join("\n");
    }
    function renderResult() {
      const s = state.session;
      const res = s.results();
      const wrong = res.filter((r) => !r.correct);
      const fmtGiven = (r) =>
        Array.isArray(r.given) ? r.given.map((g, i) => r.problem.fields[i] + " = " + g).join("、") : String(r.given);
      const fmtAns = (p) => (Array.isArray(p.answer) ? p.answer.map((a, i) => p.fields[i] + " = " + a).join("、") : p.answer);
      show(
        h("main", { class: "screen result" }, [
          h("header", { class: "top" }, [h("span", { class: "title" }, state.title)]),
          h("section", { class: "card score-card" }, [
            h("p", { class: "score", "data-testid": "score" }, [
              s.size + "問中 ",
              h("strong", null, String(s.score())),
              "問正解",
            ]),
            h("p", { class: "comment" }, s.score() === s.size ? "全問正解！すばらしい！" : s.score() >= 7 ? "いい調子！" : "間違えた問題を見直そう"),
          ]),
          wrong.length
            ? h("section", { class: "review" }, [
                h("h2", null, "間違えた問題"),
                ...wrong.map((r) =>
                  h("div", { class: "card review-item" }, [
                    h("div", { class: "prompt small", html: renderMath(reviewText(r.problem.prompt)) }),
                    h("p", null, [h("span", { class: "label" }, "あなたの答え "), h("span", { class: "given", html: renderMath(fmtGiven(r)) })]),
                    h("p", null, [h("span", { class: "label" }, "正解 "), h("span", { html: renderMath(fmtAns(r.problem)) })]),
                    h("ol", { class: "steps" }, r.problem.steps.map((st) => h("li", { html: renderMath(st) }))),
                  ])
                ),
              ])
            : null,
          h("div", { class: "actions" }, [
            h(
              "button",
              {
                class: "primary",
                "data-testid": "retry",
                onclick: () => {
                  const first = res[0] && res[0].problem;
                  const mix = state.title.startsWith("苦手ミックス");
                  startSession(mix || !first ? { mode: "mix" } : { mode: "unit", unitId: first.unitId });
                },
              },
              "もう一度"
            ),
            h("button", { class: "secondary", "data-testid": "home", onclick: renderHome }, "ホームへ"),
          ]),
        ])
      );
    }

    // ----- 記録 -----
    function renderStats() {
      const rows = UNITS.map((u) => {
        const st = store.stats(u.id);
        return h("tr", { "data-testid": "stat-" + u.id }, [
          h("td", null, "中" + u.grade),
          h("td", null, u.name),
          h("td", { class: "num" }, [
            h("span", { class: "unit-rate " + rateClass(st) }, rateText(st)),
          ]),
          h("td", { class: "num", "data-testid": "count-" + u.id }, String(st.count)),
        ]);
      });
      show(
        h("main", { class: "screen stats" }, [
          h("header", { class: "top" }, [
            h("button", { class: "link", "data-testid": "back", onclick: renderHome }, "← もどる"),
            h("span", { class: "title" }, "記録"),
          ]),
          h("p", { class: "hint" }, "正答率は各単元の直近20問から計算しています。"),
          h("div", { class: "card table-wrap" }, h("table", null, [
            h("thead", null, h("tr", null, [h("th", null, "学年"), h("th", null, "単元"), h("th", { class: "num" }, "正答率"), h("th", { class: "num" }, "解答数")])),
            h("tbody", null, rows),
          ])),
          h(
            "button",
            {
              class: "danger",
              "data-testid": "reset",
              onclick: () => {
                if (root.confirm("すべての記録を消しますか？（元に戻せません）")) {
                  store.reset();
                  renderStats();
                }
              },
            },
            "記録をリセット"
          ),
        ])
      );
    }

    renderHome();
  }

  App.ui = { renderMath, escapeHtml, start };
  if (typeof module !== "undefined") module.exports = App.ui;
  if (typeof document !== "undefined" && typeof module === "undefined") {
    const boot = () => start(document);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
