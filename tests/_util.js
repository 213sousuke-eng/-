// テスト用ヘルパー（*.test.js ではないので単独では実行されない）
require("../src/math.js");
const G = require("../src/generators.js");
const M = globalThis.MathApp.math;

// 単元の生成関数を seed 1..N × level 1,2 で回す（generate ではなく生関数を直接呼び、作り直しに頼らない）
function forAll(unitId, fn, n = 1000) {
  for (const level of [1, 2]) {
    for (let seed = 1; seed <= n; seed++) {
      const rng = M.mulberry32(seed * 7919 + level);
      let p;
      try {
        p = G.GENERATORS[unitId](rng, level);
      } catch (e) {
        // 条件を満たせず例外を出すのは許す（generate が最大20回作り直す）。失敗率50%以下なら20回全滅の確率は 1e-6 未満
        fn.failures = (fn.failures || 0) + 1;
        if (fn.failures > n * 2 * 0.5) throw new Error(`${unitId} の生成失敗が多すぎる: ${e.message}`);
        continue;
      }
      if (!G.validateProblem(p)) throw new Error(`validateProblem 失敗 ${unitId} L${level} seed${seed}: ${JSON.stringify(p)}`);
      fn(p, { level, seed });
    }
  }
}
module.exports = { forAll, G, M };
