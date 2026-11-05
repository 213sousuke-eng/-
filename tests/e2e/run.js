// ブラウザでの動作確認: node build.js && node tests/e2e/run.js
const path = require("path");
const fs = require("fs");
const pw = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const URL = "file://" + path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "test-results");
fs.mkdirSync(OUT, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error("確認失敗: " + msg);
}

async function noHScroll(page, where) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert(ok, "横スクロールが発生: " + where);
}

// 問題に答える。choice は choice-0、数値は "0"
async function answerCurrent(page) {
  if (await page.locator('[data-testid="choice-0"]').count()) {
    await page.click('[data-testid="choice-0"]');
  } else {
    const n = await page.locator('[data-testid^="input-"]').count();
    for (let i = 0; i < n; i++) await page.fill(`[data-testid="input-${i}"]`, "0");
    await page.click('[data-testid="submit"]');
  }
  await page.waitForSelector('[data-testid="feedback"]:not([hidden])');
}

async function solveAll(page, name, shoot) {
  for (let i = 0; i < 10; i++) {
    const prog = await page.textContent('[data-testid="progress"]');
    assert(prog.trim() === `${i + 1} / 10`, `${name}: 進捗表示 ${prog}`);
    await answerCurrent(page);
    await noHScroll(page, `${name} ${i + 1}問目`);
    if (shoot && i === 0) await page.screenshot({ path: path.join(OUT, shoot + "-quiz.png"), fullPage: true });
    await page.click('[data-testid="next"]');
  }
  await page.waitForSelector('[data-testid="score"]');
}

async function scenario(browser, deviceName, tag) {
  const ctx = await browser.newContext({ ...pw.devices[deviceName] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
  page.on("dialog", (d) => d.accept());

  await page.goto(URL);
  await page.waitForSelector('[data-testid="unit-factorize"]');
  await noHScroll(page, "ホーム");
  // iOS 端末ではホーム画面追加の案内が出て、閉じられる
  assert(await page.locator('[data-testid="a2hs"]').count() === 1, "ホーム画面追加の案内が出ない");
  await page.screenshot({ path: path.join(OUT, tag + "-home.png"), fullPage: true });
  await page.click('[data-testid="a2hs-close"]');
  assert(await page.locator('[data-testid="a2hs"]').count() === 0, "案内が閉じない");

  // 1. 因数分解を10問
  await page.click('[data-testid="unit-factorize"]');
  await solveAll(page, tag + " 因数分解", tag);
  await noHScroll(page, "結果");
  await page.screenshot({ path: path.join(OUT, tag + "-result.png"), fullPage: true });

  // 2. 一次方程式: 不正な入力
  await page.click('[data-testid="home"]');
  await page.click('[data-testid="unit-lineq"]');
  await page.fill('[data-testid="input-0"]', "abc");
  await page.click('[data-testid="submit"]');
  await page.waitForSelector("text=数字で入力してね");
  assert((await page.textContent('[data-testid="progress"]')).trim() === "1 / 10", "不正入力で進んだ");
  assert(await page.isHidden('[data-testid="feedback"]'), "不正入力で採点された");

  // 3. 正しい形の入力 → 採点される。Enter キーで送信
  await page.fill('[data-testid="input-0"]', "1");
  await page.press('[data-testid="input-0"]', "Enter");
  await page.waitForSelector('[data-testid="feedback"]:not([hidden])');
  // 二重送信しても記録は1回
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="submit"]');
    b.hidden = false;
    b.click();
    b.click();
  });
  await page.click('[data-testid="quit"]');
  await page.click('[data-testid="nav-stats"]');
  const cnt = (await page.textContent('[data-testid="count-lineq"]')).trim();
  assert(cnt === "1", "一次方程式の解答数が " + cnt);
  const cntF = (await page.textContent('[data-testid="count-factorize"]')).trim();
  assert(cntF === "10", "因数分解の解答数が " + cntF);

  // 4. 苦手ミックス（受験レベル）
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="level-2"]');
  await page.click('[data-testid="mix"]');
  await solveAll(page, tag + " 苦手ミックス");

  // 5. 記録のリセット
  await page.click('[data-testid="home"]');
  await page.click('[data-testid="nav-stats"]');
  await noHScroll(page, "記録");
  await page.click('[data-testid="reset"]');
  const rates = await page.$$eval("tbody .unit-rate", (els) => els.map((e) => e.textContent));
  assert(rates.length === 11 && rates.every((t) => t === "未挑戦"), "リセット後: " + rates.join(","));

  // 6. 再読み込みで難易度の選択が保たれる
  await page.reload();
  await page.waitForSelector('[data-testid="level-2"]');
  assert((await page.getAttribute('[data-testid="level-2"]', "aria-pressed")) === "true", "難易度が保存されていない");

  assert(errors.length === 0, "エラー: " + errors.join(" | "));
  await ctx.close();
}

// 全単元・両レベルを開いて表示崩れとエラーがないか
async function allUnits(browser) {
  const ctx = await browser.newContext({ ...pw.devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL);
  const ids = await page.$$eval('[data-testid^="unit-"]', (els) => els.map((e) => e.dataset.testid.slice(5)));
  assert(ids.length === 11, "単元数 " + ids.length);
  for (const lv of [1, 2]) {
    for (const id of ids) {
      await page.click(`[data-testid="level-${lv}"]`);
      await page.click(`[data-testid="unit-${id}"]`);
      for (let i = 0; i < 3; i++) {
        await noHScroll(page, `${id} L${lv}`);
        const pt = (await page.textContent('[data-testid="prompt"]')).trim();
        assert(pt.length > 0, `${id} L${lv}: 問題の欄が空`);
        await answerCurrent(page);
        await noHScroll(page, `${id} L${lv} 解説`);
        await page.click('[data-testid="next"]');
      }
      await page.click('[data-testid="quit"]');
    }
  }
  assert(errors.length === 0, "エラー: " + errors.join(" | "));
  await ctx.close();
}

// localStorage が使えない環境
async function noStorage(browser) {
  const ctx = await browser.newContext({ ...pw.devices["iPhone 13"] });
  await ctx.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error("QuotaExceededError");
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector('[data-testid="no-storage"]');
  await page.click('[data-testid="unit-signed"]');
  await solveAll(page, "保存不可");
  assert(errors.length === 0, "エラー: " + errors.join(" | "));
  await ctx.close();
}

(async () => {
  const browser = await pw.chromium.launch();
  try {
    await scenario(browser, "iPad (gen 7)", "ipad");
    console.log("iPad: OK");
    await scenario(browser, "iPhone 13", "iphone");
    console.log("iPhone: OK");
    await allUnits(browser);
    console.log("全単元: OK");
    await noStorage(browser);
    console.log("保存不可: OK");
    try {
      await pw.webkit.launch().then((b) => b.close());
    } catch (e) {
      console.log("(webkit はこの環境にないため chromium のみで確認)");
    }
    console.log("E2E OK");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
