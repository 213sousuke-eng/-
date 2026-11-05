(function (root) {
  "use strict";
  const App = (root.MathApp = root.MathApp || {});
  const KEY = "chugaku-math-v1";
  const MAX_RECENT = 20;

  function emptyData() {
    return { units: {}, flags: {} };
  }

  // 読み込んだデータの形を確かめ、使える部分だけ残す
  function sanitize(raw) {
    const d = emptyData();
    if (!raw || typeof raw !== "object") return d;
    if (raw.units && typeof raw.units === "object") {
      for (const id of Object.keys(raw.units)) {
        const u = raw.units[id];
        if (u && Array.isArray(u.recent)) {
          const rec = u.recent.filter((v) => v === 0 || v === 1).slice(-MAX_RECENT);
          d.units[id] = { recent: rec };
        }
      }
    }
    if (raw.flags && typeof raw.flags === "object") {
      for (const k of Object.keys(raw.flags)) if (raw.flags[k] === true) d.flags[k] = true;
    }
    return d;
  }

  function defaultBackend() {
    try {
      const ls = root.localStorage;
      if (ls) return ls;
    } catch (e) {
      /* アクセス自体が禁止されている */
    }
    return null;
  }

  function createStore(backend) {
    const be = backend === undefined ? defaultBackend() : backend;
    let persistent = !!be;
    let data = emptyData();
    if (be) {
      try {
        const txt = be.getItem(KEY);
        if (txt) data = sanitize(JSON.parse(txt));
      } catch (e) {
        // 壊れている、または読めない
        data = emptyData();
        try {
          be.getItem(KEY);
        } catch (e2) {
          persistent = false;
        }
      }
    }

    function save() {
      if (!be || !persistent) return;
      try {
        be.setItem(KEY, JSON.stringify(data));
      } catch (e) {
        persistent = false;
      }
    }

    const store = {
      record(unitId, correct) {
        const u = data.units[unitId] || (data.units[unitId] = { recent: [] });
        u.recent.push(correct ? 1 : 0);
        if (u.recent.length > MAX_RECENT) u.recent.splice(0, u.recent.length - MAX_RECENT);
        save();
      },
      stats(unitId) {
        const u = data.units[unitId];
        if (!u || u.recent.length === 0) return { count: 0, rate: null };
        const ok = u.recent.reduce((a, b) => a + b, 0);
        return { count: u.recent.length, rate: ok / u.recent.length };
      },
      weights(unitIds) {
        return unitIds.map((id) => {
          const s = store.stats(id);
          return s.rate === null ? 0.5 : 1 - s.rate + 0.1;
        });
      },
      reset() {
        data.units = {};
        save();
      },
      getFlag(name) {
        return data.flags[name] === true;
      },
      setFlag(name) {
        data.flags[name] = true;
        save();
      },
      get persistent() {
        return persistent;
      },
    };
    // 書き込みできるかを最初に確かめる（Safari のプライベートブラウズ対策）
    if (be && persistent) save();
    return store;
  }

  App.storage = { createStore, KEY };
  if (typeof module !== "undefined") module.exports = App.storage;
})(typeof globalThis !== "undefined" ? globalThis : this);
