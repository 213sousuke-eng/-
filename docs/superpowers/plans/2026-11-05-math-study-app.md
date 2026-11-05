# 中学数学 計算トレーニングアプリ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中1〜中3の計算11単元を自動生成で出題し、端末内に成績を記録して苦手単元を重点出題する、単一HTMLのWebアプリを作る。

**Architecture:** ロジックは `src/*.js` に純粋関数として書き、Node の `node:test` でテストする。各ファイルは `globalThis.MathApp` 名前空間に自分を登録し、Node では `module.exports` も設定する。`build.js` が CSS と JS をインライン化して `index.html` を生成する。

**Tech Stack:**
- 素の HTML / CSS / JavaScript（ES2020、ビルド時の変換なし）
- Node.js 18 以上（`node --test`）
- Playwright（環境にプリインストール済みのものを使い、ブラウザ確認に限る）

**Spec:** `docs/superpowers/specs/2026-11-05-math-study-app-design.md`

## Global Constraints

- 外部リソースを一切読み込まない（CDN、Webフォント、`fetch`、外部画像なし）。生成された `index.html` 1ファイルで動くこと
- npm 依存パッケージを追加しない（`package.json` は scripts のみ）
- 対象ブラウザは iPad Safari（iPadOS 15 以上）、iOS / Android の Chrome、PC の Chrome / Edge
  - 使ってよい構文は ES2020 まで
  - BigInt・正規表現の後読みは使わない
- localStorage のキーは `chugaku-math-v1`。形式は `{ units: { [unitId]: { recent: number[] } } }`
  - `recent` は直近20件、1=正解、0=不正解
- 1セットは10問
- 難易度は `level` 1（基本）と 2（受験レベル）
- 苦手ミックスの重み: `(1 - 正答率) + 0.1`。未挑戦の単元は `0.5`
- 画面に表示する文言・UI はすべて日本語
- 乱数はすべて引数 `rng: () => number`（0以上1未満）経由で得る。テストではシード付きの `mulberry32(seed)` を使う

## Review Focus

1. **iPad の入力**: 全角数字、全角マイナス `－`、数学記号のマイナス `−`（U+2212）、前後の空白が入る → 半角に直して正しく採点する（Task 1 でテスト）
2. **値が等しい別表記**: 正解 3 に対して `6/2`、`3.0`、`+3` と答える → 正解にする。`-0` は 0 として扱う（Task 1 でテスト）
3. **解答の二重送信**: 答えた後に選択肢を連打する、「答え合わせ」を2回押す → 2回目以降は無視し、記録も1回だけにする（Task 8 でテスト）
4. **localStorage が使えない**: Safari のプライベートブラウズで `setItem` が例外を出す、保存データが壊れている → 出題は続けられ、データは初期化する（Task 9 でテスト）
5. **長い式と狭い画面**: 幅 375px で長い式を表示する → 横スクロールを出さずに折り返す（Task 10 の e2e でテスト）

---

## ファイル構成

| ファイル | 責務 |
|---|---|
| `package.json` | `"test": "node --test tests/"`、`"build": "node build.js"`、`"e2e": "node tests/e2e/run.js"` |
| `src/math.js` | `mulberry32`、乱数ヘルパー、`Frac`（分数）、`Poly`（多変数多項式）、`Surd`（根号の和）、数値入力の解析 |
| `src/generators.js` | 単元の定義 `UNITS`、単元ごとの生成関数、`makeChoices`、`generate`（作り直しと予備問題の仕組み） |
| `src/quiz.js` | セッション（10問）、採点、苦手ミックスで使う単元の選び方 |
| `src/storage.js` | 記録の保存・読み込み、正答率、重みの計算 |
| `src/ui.js` | 画面の描画とイベント処理（DOM を扱うのはここだけ） |
| `src/style.css` | スタイル |
| `src/index.template.html` | `<!--CSS-->` と `<!--JS-->` を差し込むための雛形 |
| `build.js` | 雛形にファイルをインライン化して `index.html` を出力する |
| `tests/*.test.js` | ユニットテスト |
| `tests/e2e/run.js` | Playwright によるブラウザ確認 |

各 `src/*.js` は次の形で書く。

```js
(function (root) {
  const App = (root.MathApp = root.MathApp || {});
  // ... 実装 ...
  App.math = { /* 公開するもの */ };
  if (typeof module !== "undefined") module.exports = App.math;
})(typeof globalThis !== "undefined" ? globalThis : this);
```

依存関係は `math ← generators ← quiz`、`storage` は単独、`ui` はすべてに依存する。Node のテストでは依存元を先に `require` する。

---

### Task 1: 土台・乱数・分数・入力の解析

**Files:**
- Create: `package.json`, `.gitignore`（`node_modules/`, `test-results/`）, `src/math.js`
- Test: `tests/math.frac.test.js`

**Interfaces:**
- Produces（`MathApp.math`）:
  - `mulberry32(seed: number) => () => number`
  - `randInt(rng, min, max) => number`（min と max を含む）
  - `pick(rng, arr) => T`
  - `shuffle(rng, arr) => T[]`（新しい配列を返す）
  - `randNonZero(rng, min, max) => number`
  - `class Frac`
    - 生成: `new Frac(n, d = 1)`。常に既約で、分母は正
    - 演算: `add`, `sub`, `mul`, `div`（どれも Frac を返す）
    - その他: `neg()`, `eq(o)`, `isZero()`, `isInt()`, `toString()`（`"3"`, `"-3/4"`）
    - 静的メソッド: `Frac.of(x: number|Frac)`
  - `parseAnswer(text: string) => Frac | null`

- [ ] **Step 1: テストを書く**（`tests/math.frac.test.js`）
  - `mulberry32(1)` を2回作ると同じ数列になる
  - `randInt(rng,-3,3)` を1000回呼ぶと、範囲内に収まり、両端の値も出る
  - `new Frac(6,-4).toString() === "-3/2"`
  - `new Frac(1,2).add(new Frac(1,3)).toString() === "5/6"`
  - `new Frac(0,-5).toString() === "0"`
  - `new Frac(1,0)` で例外が出る
  - `parseAnswer` の入出力（期待値は `toString()` で比べる）:

    | 入力 | 結果 |
    |---|---|
    | `"3"` | `3` |
    | `" -3 "` | `-3` |
    | `"－３"` | `-3` |
    | `"−3"`（U+2212） | `-3` |
    | `"+3"` | `3` |
    | `"6/2"` | `3` |
    | `"3.0"` | `3` |
    | `"0.25"` | `1/4` |
    | `"-3/4"` | `-3/4` |
    | `"３／４"` | `3/4` |
    | `"-0"` | `0` |
    | `"3/0"` | `null` |
    | `""` | `null` |
    | `"abc"` | `null` |
    | `"x=3"` | `null` |
    | `"1/2/3"` | `null` |

- [ ] **Step 2: 実行して失敗を確認する**
  - Run: `node --test tests/`
  - Expected: `Cannot find module '../src/math.js'` で FAIL

- [ ] **Step 3: `src/math.js` に上記を実装する**
  - `parseAnswer` の処理順:
    1. NFKC 正規化
    2. `−` と `ー` を `-` に置き換える
    3. 空白を除去する
    4. `^[+-]?\d+(\.\d+)?(\/[+-]?\d+)?$` に一致しなければ `null`
  - 小数は 10 の累乗を分母にして Frac に変換する

- [ ] **Step 4: 実行して成功を確認する**
  - Run: `node --test tests/`
  - Expected: すべて PASS

- [ ] **Step 5: コミットする**
  - `git add -A && git commit -m "feat: 分数と入力解析"`

### Task 2: 多項式 Poly

**Files:**
- Modify: `src/math.js`
- Test: `tests/math.poly.test.js`

**Interfaces:**
- Produces:
  - `class Poly`（項は「変数の次数マップ → 係数 Frac」）
    - 生成:
      - `Poly.const(c)`
      - `Poly.var(name, coef = 1)`
      - `Poly.term(coef, {x:2, y:1})`
    - 演算: `add`, `sub`, `mul`, `scale(Frac|number)`, `pow(n)`
    - その他: `eq(o)`, `isZero()`, `evaluate({x: Frac|number}) => Frac`
  - `formatPoly(p: Poly) => string`

- [ ] **Step 1: テストを書く**
  - `formatPoly` の出力:
    - `(x+2)(x+3)` を展開 → `"x² + 5x + 6"`
    - `(x-3)²` を展開 → `"x² - 6x + 9"`
    - `-x + 1` → `"-x + 1"`
    - `2a - 3b` → `"2a - 3b"`
    - `3x²y` → `"3x²y"`
    - `1/2 x` → `"1/2x"`
    - 0 → `"0"`
  - 項の並び順は、次数の高い順。同じ次数なら変数名のアルファベット順（`x² + xy + y²`、`a + b`）
  - 係数が 1 なら省き、-1 なら `-` だけ書く
  - 指数 2 と 3 は `²` `³` で表す
  - `p.mul(q).evaluate({x:2})` は `p.evaluate(...)` と `q.evaluate(...)` の積に等しい（ランダムな p と q で 200 回確かめる）

- [ ] **Step 2: 失敗を確認する**（`node --test tests/`）

- [ ] **Step 3: 実装する**
  - 項のキーは、変数名をソートして `"x2y1"` の形でつなげた文字列にする
  - 係数が 0 の項はすぐに消す

- [ ] **Step 4: 成功を確認する**

- [ ] **Step 5: コミットする**（`feat: 多項式`）

### Task 3: 根号 Surd

**Files:**
- Modify: `src/math.js`
- Test: `tests/math.surd.test.js`

**Interfaces:**
- Produces:
  - `class Surd`（`k√r` の和。r は平方因数を含まない正の整数、k は Frac）
    - 生成: `Surd.sqrt(n: number)`（簡約済み）、`Surd.rat(Frac|number)`
    - 演算: `add`, `sub`, `mul`
    - その他: `eq`, `toNumber()`, `toString()`
  - `simplifySqrt(n) => { k: number, r: number }`

- [ ] **Step 1: テストを書く**
  - `simplifySqrt(12)` → `{k:2,r:3}`
  - `simplifySqrt(49)` → `{k:7,r:1}`
  - `Surd.sqrt(8).add(Surd.sqrt(18)).toString() === "5√2"`
  - `Surd.sqrt(2).mul(Surd.sqrt(6)).toString() === "2√3"`
  - `Surd.sqrt(3).sub(Surd.sqrt(3)).toString() === "0"`
  - `Surd.rat(3).add(Surd.sqrt(5)).toString() === "3 + √5"`
  - `Surd.sqrt(2).mul(new Frac(-1,2)).toString() === "-√2/2"`
  - ランダムな式で `toNumber()` が `Math.sqrt` による計算と 1e-9 以内で一致する（200 回）

- [ ] **Step 2: 失敗を確認する**

- [ ] **Step 3: 実装する**
  - 内部は `r → Frac` の Map で持つ
  - `toString` は有理数の部分を先に、r の小さい順に並べる
  - 係数が分数なら `k√r/d` の形にする（例: `√2/2`、`-3√5/2`）

- [ ] **Step 4: 成功を確認する**

- [ ] **Step 5: コミットする**（`feat: 根号`）

### Task 4: 生成の土台と中1の4単元

**Files:**
- Create: `src/generators.js`
- Test: `tests/generators.helpers.test.js`, `tests/generators.g1.test.js`

**Interfaces:**
- Consumes: Task 1〜3 のすべて
- Produces（`MathApp.gen`）:
  - `UNITS: Array<{ id, grade: 1|2|3, name }>`
    - 設計書の表の順に11件
    - `name` の例: `"正負の数"`
  - 問題 `Problem`:
    ```
    {
      unitId, level, prompt,
      answerType: "number" | "choice",
      answer: string | string[],
      fields?: string[],
      choices?: string[],
      steps: string[],
      meta: object
    }
    ```
    - number 形式の `answer` は `Frac.toString()`。2つの値を答える場合は配列にし、`fields` を `["x","y"]` にする
    - `meta` はテストで検算するためのデータ。画面には出さない
  - `makeChoices(rng, correct: string, distractors: string[], fallback: () => string) => string[]`
    - 正解を1つだけ含む4件をシャッフルして返す
    - 重複と正解に一致するものは除く
    - 足りなければ `fallback` で補う。`fallback` は最大50回まで試し、それでも足りなければ例外を出す
  - `GENERATORS: { [unitId]: (rng, level) => Problem }`
  - `generate(unitId, level, rng) => Problem`
    - 生成関数を最大20回試す。例外を出したもの、`validateProblem` に通らないものは作り直す
    - 20回で作れなければ `FALLBACK[unitId][level]`（手書きの固定問題）を返す
  - `validateProblem(p) => boolean`
    - 文字列に `NaN`、`Infinity`、`undefined` を含まない
    - choice 形式なら選択肢が4件・重複なしで、正解をちょうど1つ含む
    - `steps` が1件以上ある

- [ ] **Step 1: 土台のテストを書く**（`tests/generators.helpers.test.js`）
  - `makeChoices` が4件を返し、正解を1つ含み、重複がない
  - 誤答候補がすべて正解と同じでも、`fallback` で埋まる
  - `generate` に、毎回例外を出す生成関数を差し込むと `FALLBACK` が返る
    - テスト用に `GENERATORS` を一時的に差し替えられるようにしておく
  - `validateProblem` は `answer: "NaN"` のとき false を返す

- [ ] **Step 2: 中1のテストを書く**（`tests/generators.g1.test.js`）
  - 4単元 × level 1・2 の各組み合わせで、`mulberry32(seed)` を seed 1〜1000 で回す
  - 全件で `validateProblem` が true
  - 単元ごとの検算:
    - `signed`: `meta.value`（Frac）と `answer` が一致する。`meta.expr` を独立に再計算した値とも一致する
    - `linexpr`: `meta.result` を `formatPoly` した文字列が `answer` と一致する。`meta.result` は `meta.a.add(meta.b)` などの再計算結果と等しい
    - `lineq`: `meta.lhs.evaluate({x: ans})` と `meta.rhs.evaluate({x: ans})` が等しい（`ans` は `parseAnswer(answer)`）
    - `proportion`: `meta.k` と `meta.point` について、比例なら `y = kx`、反比例なら `y = k/x` を満たす。`answer` は `"y = 3x"` や `"y = 12/x"` の形

- [ ] **Step 3: 失敗を確認する**

- [ ] **Step 4: `generators.js` を実装する**

  共通の部分（`UNITS`、`makeChoices`、`generate`、`validateProblem`、`FALLBACK` の11単元×2問）と、中1の4単元を作る。

  | 単元 | level 1 | level 2 | 解答形式 | 誤答の作り方 |
  |---|---|---|---|---|
  | `signed` | 2〜3項の加減乗除（整数、絶対値は12以下） | 累乗（`(-2)³`、`-3²`）と分数を含む四則 | number | ― |
  | `linexpr` | `(3x+2)+(x-5)`、`2(3x-1)` | 分数の係数、`2(x-3)-3(2x-1)` | choice | 後ろのかっこの符号を変え忘れる、分配のし忘れ |
  | `lineq` | `ax+b=cx+d`（整数解） | かっこ・分数係数を含み、分数解もあり得る | number | ― |
  | `proportion` | 1点を通る比例・反比例の式 | x の変域や表から求める | choice | 比例と反比例の取り違え、k の逆数 |

  - `steps` は問題ごとに具体的な式で、2〜4行にする
    - 例: `"移項すると 3x - x = 5 - 1"`、`"2x = 4"`、`"x = 2"`

- [ ] **Step 5: 成功を確認する**（`node --test tests/`）

- [ ] **Step 6: コミットする**（`feat: 問題生成の土台と中1単元`）

### Task 5: 中2の3単元

**Files:**
- Modify: `src/generators.js`
- Test: `tests/generators.g2.test.js`

**Interfaces:**
- Consumes: Task 4 の `makeChoices`、`GENERATORS`、`Poly`、`Frac`
- Produces: `GENERATORS.polycalc`、`GENERATORS.simul`、`GENERATORS.linfunc`

- [ ] **Step 1: テストを書く**（Task 4 と同じく seed 1〜1000 × level 1・2）
  - 全件で `validateProblem` が true
  - `polycalc`: `formatPoly(meta.result) === answer`。`meta.result` は `meta.ops` を再計算した結果と等しい
  - `simul`:
    - `answer` は長さ2の配列、`fields` は `["x","y"]`
    - 2式に代入するとどちらも成り立つ
    - 係数で作る行列式が 0 でない
  - `linfunc`: `meta.points` の2点が `y = ax + b` の上にある。`answer` の形は `"y = 2x - 3"`、`"y = -1/2x + 4"`、`"y = 3x"`

- [ ] **Step 2: 失敗を確認する**

- [ ] **Step 3: 実装する**

  | 単元 | level 1 | level 2 | 誤答の作り方 |
  |---|---|---|---|
  | `polycalc` | 多項式の加減、単項式の乗除（`6x²y ÷ 2x`） | 分数を含む式（`(x+y)/2 - (x-y)/3`）、3つの項の乗除 | 符号のミス、指数の足し忘れ・引き忘れ |
  | `simul` | 整数解。加減法がそのまま使える係数 | 係数に倍数関係がない、かっこ・分数を含む式 | ―（number） |
  | `linfunc` | 傾きと1点から式を求める | 2点から求める。傾きが分数になる場合あり | 切片の符号ミス、傾きの分子と分母の逆転 |

- [ ] **Step 4: 成功を確認する**

- [ ] **Step 5: コミットする**（`feat: 中2単元`）

### Task 6: 中3の4単元

**Files:**
- Modify: `src/generators.js`
- Test: `tests/generators.g3.test.js`

**Interfaces:**
- Produces: `GENERATORS.expand`、`GENERATORS.factorize`、`GENERATORS.sqrt`、`GENERATORS.quadeq`

- [ ] **Step 1: テストを書く**（seed 1〜1000 × level 1・2）
  - 全件で `validateProblem` が true
  - `expand`: `meta.factors` をかけ合わせた結果を `formatPoly` すると `answer` になる
  - `factorize`:
    - `meta.factors` の積が `meta.original` と等しい
    - `answer === formatFactors(meta.factors, meta.coef)`
    - 選択肢のうち、展開して `meta.original` と等しくなるのは正解だけ
    - 展開しても等しくならない誤答を選ぶため、`meta.choiceFactors` で各選択肢の因数を保持する
  - `sqrt`: `meta.value.toString() === answer`。数値として `meta.exprNumber` と 1e-9 以内で一致する
  - `quadeq`:
    - `meta.roots` をそれぞれ `meta.poly.evaluate` に代入すると 0 になる
      - 無理数解は Surd で数値に直し、誤差 1e-9 以内
    - `answer` の形は `"x = 2, 3"`、`"x = -1 ± √3"`、`"x = (3 ± √5)/2"`

- [ ] **Step 2: 失敗を確認する**

- [ ] **Step 3: 実装する**

  `math.js` に `formatFactors(factors: Poly[], coef?: number) => string` を追加する。

  - 同じ因数はまとめて `(x + 3)²` と書く
  - 共通因数は先頭に置く（`2(x + 1)(x - 3)`）
  - 単項式の因数はかっこで包まない（`x(x + 2)`）

  | 単元 | level 1 | level 2 | 誤答の作り方 |
  |---|---|---|---|
  | `expand` | 乗法公式4種 | `(2x+3y)²`、`(x+2)(x-2) - (x-1)²` | `2ab` の項の忘れ、符号ミス、`(a+b)² = a² + b²` |
  | `factorize` | `x²+px+q`、`a²-b²`、平方の形 | 共通因数をくくってから公式を使う。`ax²+bx+c` の形（係数は 2〜3） | 定数項の組の取り違え、符号の逆転、共通因数の忘れ |
  | `sqrt` | 簡約と、同じ根号どうしの加減（`√12 + √27`） | 有理化、`(√3+1)²`、乗除の組み合わせ | 根号の中を足してしまう、簡約ミス |
  | `quadeq` | 因数分解で解ける形（整数解） | 解の公式（無理数解）、`(x+a)² = b` の形 | 符号の逆転、公式の分母の 2a の忘れ |

- [ ] **Step 4: 成功を確認する**

- [ ] **Step 5: コミットする**（`feat: 中3単元`）

### Task 7: 記録 storage

**Files:**
- Create: `src/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces（`MathApp.storage`）:
  - `createStore(backend?: {getItem,setItem,removeItem})`
    - 既定の backend は `globalThis.localStorage`。取得自体が例外を出す場合は、メモリ上の代替を使う
  - 返り値:
    - `record(unitId, correct: boolean) => void`（`recent` は直近20件まで）
    - `stats(unitId) => { count: number, rate: number|null }`（未挑戦なら `rate` は null）
    - `weights(unitIds: string[]) => number[]`
    - `reset() => void`
    - `persistent: boolean`（保存に失敗したら false）
    - `getFlag(name) => boolean`、`setFlag(name)`（ホーム画面追加の案内を閉じたかどうかの記録に使う）

- [ ] **Step 1: テストを書く**
  - 25回記録すると `recent.length === 20`
  - 正解3回・不正解1回なら `rate === 0.75`
  - 重みの計算:
    - 未挑戦なら `0.5`
    - 正答率 1.0 なら `0.1`
    - 正答率 0 なら `1.1`
  - 保存先に `"{壊れた"` が入っている状態で `createStore` しても例外が出ず、`stats` は未挑戦になる
  - `setItem` が例外を出す backend でも、`record` が例外を出さない。`persistent === false` になり、メモリ上では記録が反映される
  - 同じ backend で store を作り直すと、記録が読み込まれる

- [ ] **Step 2: 失敗を確認する**

- [ ] **Step 3: 実装する**

- [ ] **Step 4: 成功を確認する**

- [ ] **Step 5: コミットする**（`feat: 記録と苦手度`）

### Task 8: セッションと採点 quiz

**Files:**
- Create: `src/quiz.js`
- Test: `tests/quiz.test.js`

**Interfaces:**
- Consumes:
  - `gen.generate`、`gen.UNITS`、`math.parseAnswer`
  - store インターフェース（`record`、`weights`）
- Produces（`MathApp.quiz`）:
  - `pickWeighted(rng, weights: number[]) => index`
  - `createSession({ mode: "unit" | "mix", unitId?, level, rng, store, size = 10 })`。返り値:
    - `current() => Problem | null`
    - `index`、`size`
    - `answer(input: string | string[]) => { status: "invalid" } | { status: "graded", correct: boolean, problem }`
      - `invalid` は、number 形式で `parseAnswer` が null を返したとき。このとき記録しない
      - choice 形式の入力は選んだ選択肢の文字列
    - `next() => boolean`（次の問題があれば true）
    - `results() => Array<{ problem, given, correct }>`
    - `score() => number`
  - 同じ問題に対する2回目以降の `answer` は、1回目の結果をそのまま返し、記録も増やさない
  - mix モードでは、問題ごとに `store.weights` を基に `pickWeighted` で単元を選ぶ
  - 1セットの中で、prompt が完全に同じ問題は作り直す（最大5回まで）

- [ ] **Step 1: テストを書く**
  - unit モードで10問を解くと `results().length === 10` になり、`next()` は10問目で false を返す
  - number 形式で `"abc"` と答えると `invalid` になり、`store.record` は呼ばれない
  - `"6/2"` と答えて正解が `"3"` なら correct
  - 連立方程式では、配列の各要素を比べ、両方合っているときだけ正解
  - 同じ問題に `answer` を2回呼ぶと、`record` の呼び出しは1回だけで、2回目も1回目と同じ結果を返す
  - `pickWeighted(rng, [0, 1, 0])` は常に 1 を返す
  - 重みが `[1.1, 0.1]` のとき、1万回選ぶと 0 番目が 85% 以上（期待値は 91.7%）

- [ ] **Step 2: 失敗を確認する**

- [ ] **Step 3: 実装する**

- [ ] **Step 4: 成功を確認する**

- [ ] **Step 5: コミットする**（`feat: セッションと採点`）

### Task 9: UI・ビルド・index.html

**Files:**
- Create: `src/ui.js`, `src/style.css`, `src/index.template.html`, `build.js`, `index.html`（生成物もコミットする。GitHub Pages で配信するため）
- Test: `tests/build.test.js`

**Interfaces:**
- Consumes: `MathApp.math`、`gen`、`quiz`、`storage`
- Produces:
  - `index.html`
  - `build.js` は `src/math.js`、`generators.js`、`storage.js`、`quiz.js`、`ui.js` をこの順に結合して `<!--JS-->` に、`style.css` を `<!--CSS-->` に差し込む
  - e2e テストのための `data-testid` 属性:
    - ホーム: `unit-<unitId>`、`level-1`、`level-2`、`mix`、`nav-stats`、`a2hs-close`
    - 出題: `progress`、`prompt`、`input-<i>`、`submit`、`choice-<i>`、`feedback`、`next`
    - 結果: `score`、`retry`、`home`
    - 記録: `reset`

- [ ] **Step 1: テストを書く**（`tests/build.test.js`）
  - `node build.js` を実行した後の `index.html` について:
    - `<script src=`、`<link rel="stylesheet" href=`、`http://`、`https://` を含まない
    - `<meta name="viewport"` を含む
    - `apple-mobile-web-app-capable` を含む
    - `<!--JS-->` と `<!--CSS-->` が残っていない

- [ ] **Step 2: 失敗を確認する**

- [ ] **Step 3: 実装する**

  画面は設計書の「画面」の章どおりに作る。

  - **ホーム**
    - 学年ごとに見出しをつけ、単元ボタンに正答率（%）と解答数を出す
    - 未挑戦の単元は「未挑戦」と出す
  - **出題**
    - number 形式:
      - 入力欄は `inputmode="decimal"` ではなく `inputmode="text"` にする（iPad で `/` と `-` を入力できるようにするため）
      - 欄の下に「分数は 3/4 のように入力」と表示する
      - Enter で送信できる
      - `invalid` のときは「数字で入力してね」と表示し、入力欄はそのまま残す
    - choice 形式: 4つのボタンを縦に並べる
    - 答えた後:
      - 入力欄と選択肢を無効にし、`feedback` に「正解！」または「不正解…」、正解、手順を表示する
      - choice 形式では、正解を緑、選んだ誤答を赤にする
  - **結果**
    - `10問中 7問正解`
    - 間違えた問題の一覧（問題・自分の答え・正解・手順）
  - **記録**
    - 単元ごとの表
    - `reset` を押すと `confirm()` で確認してからリセットする
  - **案内と注意の表示**
    - ホーム画面追加の案内: iOS（UA に `iPad`・`iPhone` を含むか、`Macintosh` でタッチに対応）で、`navigator.standalone` が true でなく、まだ閉じていないときに表示する
      - 文言は「共有ボタン →『ホーム画面に追加』で、記録が消えにくくなります」
    - `store.persistent === false` のときは「この環境では記録が保存されません」と小さく表示する
  - **CSS**
    - `body` に `overflow-wrap: anywhere`
    - 問題文の文字サイズは 1.3rem
    - ボタンの高さは 48px 以上
    - 最大幅は 640px で中央に寄せる
    - ダークモード（`prefers-color-scheme`）に対応する
    - フォントは `system-ui, -apple-system, "Hiragino Sans", sans-serif`

- [ ] **Step 4: ビルドしてテストする**
  - Run: `node build.js && node --test tests/`
  - Expected: すべて PASS

- [ ] **Step 5: コミットする**（`feat: UIとビルド`）

### Task 10: ブラウザ確認（e2e）

**Files:**
- Create: `tests/e2e/run.js`

**Interfaces:**
- Consumes: Task 9 の `index.html` と `data-testid`

- [ ] **Step 1: e2e スクリプトを書く**
  - `require('playwright')` の `chromium` と `webkit` で `file://<abs>/index.html` を開く
    - webkit が環境に無ければ、その旨を出力して chromium だけで行う
  - デバイスは `devices['iPad (gen 7)']` と `devices['iPhone 13']`
  - 各デバイスで次のシナリオを行う:
    1. ホームで `unit-factorize` を押し、10問すべて `choice-0` で答えて `next` で進む
    2. `score` が表示されることを確認する
    3. `home` → `unit-lineq` に進み、`input-0` に `abc` と入れて `submit` を押す。「数字で入力してね」と表示され、`progress` が `1 / 10` のままであることを確認する
    4. 続けて `1` と入れて送信し、`feedback` が表示されることを確認する
    5. `submit` をもう一度押しても、`nav-stats` の画面で lineq の解答数が 1 のままであることを確認する
    6. `mix` で10問を解き切る（number 形式の問題には `0` と答える）
    7. `reset` を押し、confirm を受け入れると、全単元が「未挑戦」に戻ることを確認する
  - すべての画面で `document.documentElement.scrollWidth <= window.innerWidth` であること
  - `page.on('pageerror')` と、console の error が0件であること
  - iPhone 13 のホーム・出題・結果の画面を、`deviceScaleFactor` 既定のまま `test-results/*.png` に保存する
  - localStorage を禁止したコンテキストでも出題できることを確認する
    - `addInitScript` で `Storage.prototype.setItem` が例外を出すようにする
    - 「この環境では記録が保存されません」が表示されることも確認する

- [ ] **Step 2: 実行する**
  - Run: `node build.js && node tests/e2e/run.js`
  - Expected: `E2E OK` を出力し、終了コード 0
  - 失敗した場合は superpowers:systematic-debugging で原因を特定し、該当する Task のコードを直す

- [ ] **Step 3: スクリーンショットを確認する**
  - レイアウト崩れや文字のはみ出しがないことを目で確認する

- [ ] **Step 4: コミットする**（`test: ブラウザ確認`）

### Task 11: 公開の準備

**Files:**
- Modify: `README.md`
- Create: `check.html`

**Interfaces:**
- Consumes: `index.html`

- [ ] **Step 1: 公開の準備をする**
  - `check.html` を作る。学校の iPad で github.io が開けるかを確かめるためのページで、本文は「このページが見えれば OK」の1行だけ
  - `README.md` に次を書く:
    - アプリの概要
    - GitHub Pages の有効化手順
      1. リポジトリを Public にする
      2. Settings → Pages → Branch: `main` / root
    - 公開 URL の形（`https://<ユーザー名>.github.io/<リポジトリ名>/`）
    - 学校の iPad で最初に `check.html` を開いて確かめる手順
    - ホーム画面への追加の手順
    - 開発用コマンド（`npm test`、`npm run build`、`npm run e2e`）

- [ ] **Step 2: 最終確認をする**
  - Run: `node build.js && node --test tests/ && node tests/e2e/run.js`
  - Expected: すべて PASS、`E2E OK`
  - `git status` で、`index.html` が最新のビルド結果になっていることを確認する

- [ ] **Step 3: コミットして push する**
  - `git push -u origin claude/math-study-app`
  - main へのマージと Pages の有効化はユーザーが行う（PR はユーザーから依頼があったときだけ作る）
