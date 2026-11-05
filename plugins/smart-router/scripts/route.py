#!/usr/bin/env python3
"""smart-router: ユーザーの指示を解析し、最適なモデルとエフォートを選ぶ。

UserPromptSubmit フックとして呼ばれた場合は stdin の JSON を読み、
選んだティアのサブエージェントへ委譲するよう additionalContext を返す。

  python3 route.py              # フックモード (stdin に JSON)
  python3 route.py --explain "指示文"   # 判定結果を表示 (デバッグ用)

環境変数:
  SMART_ROUTER_MODE   delegate (既定) | suggest | off
  SMART_ROUTER_MIN_TIER  quick|standard|deep|max  (これより下のティアには落とさない)
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field

TIERS = ["direct", "quick", "standard", "deep", "max"]

TIER_INFO = {
    "direct": {"agent": None, "model": "(現在のモデル)", "effort": "(現在)",
               "label": "会話・相づち"},
    "quick": {"agent": "smart-router:quick", "model": "haiku", "effort": "low",
              "label": "軽い作業"},
    "standard": {"agent": "smart-router:standard", "model": "sonnet", "effort": "medium",
                 "label": "通常の開発作業"},
    "deep": {"agent": "smart-router:deep", "model": "opus", "effort": "high",
             "label": "難しい実装・調査"},
    "max": {"agent": "smart-router:max", "model": "opus", "effort": "max",
            "label": "最難関・大規模設計"},
}

# (正規表現, 加点) — 日本語と英語の両方に対応
SIGNALS: list[tuple[str, int, str]] = [
    # 最難関
    (r"アーキテクチャ|設計(し|を|して)|全体設計|大規模|リアーキ|移行計画|マイグレーション戦略", 4, "設計/大規模"),
    (r"\barchitect(ure)?\b|\bredesign\b|\bmigrat(e|ion)\b|\bfrom scratch\b|\bscalab", 4, "architecture"),
    (r"セキュリティ監査|脆弱性|並行処理|競合状態|デッドロック|メモリリーク|パフォーマンス(改善|最適化|チューニング)", 4, "高難度技術"),
    (r"\b(security audit|vulnerabilit|race condition|deadlock|memory leak|concurren|optimi[sz]e performance)", 4, "hard-tech"),
    (r"証明|アルゴリズム|計算量|数理|最適化問題", 3, "アルゴリズム"),
    (r"\b(prove|proof|algorithm|complexity)\b", 3, "algorithm"),
    # 実装・デバッグ
    (r"実装|作って|作成して|開発|機能を追加|アプリ|プラグイン|ゲーム|システム|API", 3, "実装"),
    (r"\b(implement|build|create|develop|add (a )?feature|app|plugin|system)\b", 3, "implement"),
    (r"バグ|エラー|直して|修正|デバッグ|動かない|落ちる|原因", 3, "デバッグ"),
    (r"\b(bug|error|fix|debug|broken|crash|stack ?trace|exception|fails?)\b", 3, "debug"),
    (r"リファクタ|書き直|整理して|テストを(書|追加)", 3, "リファクタ/テスト"),
    (r"\b(refactor|rewrite|write tests?|unit tests?)\b", 3, "refactor"),
    (r"調査|分析|比較|レビュー|検証", 2, "調査"),
    (r"\b(investigate|analy[sz]e|compare|review|research)\b", 2, "research"),
    (r"複数|すべての|全部|全ファイル|一括|徹底的|しっかり|丁寧に|詳しく", 2, "広範囲/丁寧"),
    (r"\b(all files|entire|whole (repo|codebase)|thorough|comprehensive|in depth)\b", 2, "broad"),
    # 軽い作業
    (r"翻訳|要約|言い換え|誤字|typo|タイポ|フォーマット|整形|リネーム|名前を変え", -2, "軽作業"),
    (r"\b(translate|summari[sz]e|rephrase|typo|format|rename|lint)\b", -2, "light"),
    (r"とは[？?]?$|って何|意味は|教えて|簡単に|ちょっと|さっと|手短に", -2, "簡単な質問"),
    (r"^(what|who|when|where) (is|are|was)\b|\bquick(ly)?\b|\bbriefly\b|\bsimple\b", -2, "simple-q"),
]

CHITCHAT = re.compile(
    r"^(ありがと(う|ー)?(ございます)?|サンキュー|了解|りょ|おk|ok|okay|はい|いいえ|うん|おはよう|こんにちは|こんばんは|"
    r"thanks?( you)?|thx|ty|yes|no|yep|nope|hi|hello|hey|got it|cool|nice)[!！。.\s]*$",
    re.IGNORECASE,
)

FORCE = re.compile(r"(?:^|\s)[#!](quick|standard|deep|max|direct)\b", re.IGNORECASE)
OPT_OUT = re.compile(r"(?:^|\s)[#!]noroute\b", re.IGNORECASE)


@dataclass
class Decision:
    tier: str
    score: int
    reasons: list[str] = field(default_factory=list)
    forced: bool = False

    @property
    def info(self) -> dict:
        return TIER_INFO[self.tier]


def classify(prompt: str) -> Decision:
    text = (prompt or "").strip()
    if not text:
        return Decision("direct", 0, ["空の入力"])

    m = FORCE.search(text)
    if m:
        return Decision(m.group(1).lower(), 0, [f"明示指定 #{m.group(1).lower()}"], forced=True)

    if CHITCHAT.match(text) or text.startswith("/"):
        return Decision("direct", 0, ["会話/スラッシュコマンド"])

    score = 0
    reasons: list[str] = []
    for pattern, weight, name in SIGNALS:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            score += weight
            reasons.append(f"{name}({weight:+d})")

    # 長さ・コード量・パス/箇条書きの数
    length = len(text)
    if length > 1500:
        score += 4; reasons.append("非常に長い指示(+4)")
    elif length > 500:
        score += 2; reasons.append("長い指示(+2)")
    elif length < 25:
        score -= 1; reasons.append("短い指示(-1)")

    if "```" in text or re.search(r"Traceback|at .+\(.+:\d+\)|^\s*File \".+\", line \d+", text, re.M):
        score += 2; reasons.append("コード/スタックトレース(+2)")

    steps = len(re.findall(r"^\s*(?:\d+[.)]|[-*・])\s+", text, re.M))
    if steps >= 3:
        score += 2; reasons.append(f"手順{steps}件(+2)")

    paths = len(set(re.findall(r"[\w./-]+\.(?:py|js|ts|tsx|jsx|go|rs|java|kt|swift|rb|php|c|cpp|h|cs|md|json|ya?ml)\b", text)))
    if paths >= 3:
        score += 2; reasons.append(f"ファイル{paths}個(+2)")

    if score >= 9:
        tier = "max"
    elif score >= 5:
        tier = "deep"
    elif score >= 2:
        tier = "standard"
    else:
        tier = "quick"
    return Decision(tier, score, reasons or ["特徴なし"])


def apply_min_tier(d: Decision) -> Decision:
    floor = os.environ.get("SMART_ROUTER_MIN_TIER", "").strip().lower()
    if d.forced or d.tier == "direct" or floor not in TIERS:
        return d
    if TIERS.index(d.tier) < TIERS.index(floor):
        d.reasons.append(f"最低ティア {floor} に引き上げ")
        d.tier = floor
    return d


def build_context(d: Decision, mode: str) -> str:
    info = d.info
    head = (f"[smart-router] 判定: {d.tier} ({info['label']}) / モデル={info['model']} "
            f"エフォート={info['effort']} / スコア={d.score} / 根拠: {', '.join(d.reasons)}")
    if d.tier == "direct":
        return head + "\nこの入力は会話またはコマンドのため、委譲せず現在のモデルでそのまま応答する。"
    if mode == "suggest":
        return (head + f"\nこのタスクの推奨設定は /model {info['model']} と /effort {info['effort']}。"
                "応答の冒頭で、推奨設定を1行でユーザーに伝える。")
    return (
        head + "\n"
        f"このタスクは Agent ツールで subagent_type=\"{info['agent']}\" に委譲する"
        f"（このエージェントは model={info['model']}, effort={info['effort']} で動く）。"
        "ユーザーの指示文と、ここまでの会話で必要な文脈（ファイルパス、決定事項、制約）をすべて"
        "プロンプトに含めて渡し、完了まで待ってから結果をユーザーに日本語で報告する。"
        "簡単な質問でも自分で答えずに必ず委譲する（モデルとエフォートを合わせることがこのプラグインの目的のため）。"
        "例外は、作業前にユーザーへ確認すべき不明点がある場合だけで、そのときは確認を先に行う。"
        f"最終応答の1行目は必ず「smart-router: {d.tier}（{info['model']} / {info['effort']}）で実行」とする。"
    )


def save_last(d: Decision) -> None:
    data_dir = os.environ.get("CLAUDE_PLUGIN_DATA")
    if not data_dir:
        return
    try:
        os.makedirs(data_dir, exist_ok=True)
        with open(os.path.join(data_dir, "last_route.json"), "w", encoding="utf-8") as f:
            json.dump({"tier": d.tier, "score": d.score, "reasons": d.reasons, **d.info},
                      f, ensure_ascii=False, indent=2)
    except OSError:
        pass


def explain(prompt: str) -> int:
    d = apply_min_tier(classify(prompt))
    info = d.info
    print(f"ティア      : {d.tier} ({info['label']})")
    print(f"モデル      : {info['model']}")
    print(f"エフォート  : {info['effort']}")
    print(f"エージェント: {info['agent'] or '委譲しない'}")
    print(f"スコア      : {d.score}")
    print(f"根拠        : {', '.join(d.reasons)}")
    return 0


def hook() -> int:
    mode = os.environ.get("SMART_ROUTER_MODE", "delegate").strip().lower()
    if mode == "off":
        return 0
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # 壊れた入力ではプロンプトを妨げない
    # サブエージェント内から呼ばれた場合は再委譲しない
    if payload.get("agent_id") or payload.get("agent_type"):
        return 0
    prompt = payload.get("prompt") or ""
    if OPT_OUT.search(prompt):
        return 0
    d = apply_min_tier(classify(prompt))
    save_last(d)
    out = {"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
                                  "additionalContext": build_context(d, mode)}}
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[1] == "--explain":
        return explain(" ".join(argv[2:]) if len(argv) > 2 else sys.stdin.read())
    try:
        return hook()
    except Exception as e:  # フックの失敗でユーザーの入力を止めない
        sys.stderr.write(f"smart-router: {e}\n")
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
