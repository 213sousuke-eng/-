# smart-router — 指示ごとに最適なモデルとエフォートへ自動で切り替える Claude Code プラグイン

指示を送るたびに `UserPromptSubmit` フックが内容を解析して難易度を判定します。そのうえで、判定に合ったモデルとエフォートを固定したサブエージェントへ、Claude が自動で作業を委譲します。軽い作業は Haiku で安く速く、難しい設計は Opus の max で深く考えて処理します。

| ティア | 使う場面 | モデル | エフォート |
|---|---|---|---|
| direct | あいさつ・お礼・スラッシュコマンド | 現在のモデル (委譲しない) | 現在 |
| quick | 翻訳・要約・簡単な質問・小さな修正 | Haiku | (既定) |
| standard | 通常の実装・バグ修正・テスト追加 | Sonnet | medium |
| deep | 難しいデバッグ・複数ファイルの実装・深い調査 | Opus | high |
| max | アーキテクチャ設計・大規模移行・並行処理/セキュリティ | Opus | max |

## インストール

```
/plugin marketplace add 213sousuke-eng/-
/plugin install smart-router@smart-router-marketplace
```

インストール後に Claude Code を再起動してください。動作には `python3` が必要です。

ローカルで試すだけなら、次のように起動します。

```
claude --plugin-dir ./plugins/smart-router
```

## 使い方

普段どおりに指示を送るだけです。応答の1行目に `smart-router: standard（sonnet / medium）で実行` のように、選ばれた設定が表示されます。

- **ティアの強制指定**: 指示に `#quick` / `#standard` / `#deep` / `#max` / `#direct` を含めます。例: `このバグを直して #max`
- **その回だけ無効化**: 指示に `#noroute` を含めます。
- **判定だけ確認**: `/smart-router:route <指示文>` を実行します。タスクは実行されません。

## 設定 (環境変数)

| 変数 | 値 | 説明 |
|---|---|---|
| `SMART_ROUTER_MODE` | `delegate` (既定) | 判定したティアのサブエージェントへ自動で委譲します |
| | `suggest` | 委譲はせず、`/model` と `/effort` の推奨値を表示するだけにします |
| | `off` | プラグインを無効にします |
| `SMART_ROUTER_MIN_TIER` | `quick`〜`max` | これより下のティアには落としません (例: `standard`) |

`~/.claude/settings.json` の `env` に書くと常に有効になります。

```json
{ "env": { "SMART_ROUTER_MIN_TIER": "standard" } }
```

## 仕組みと制限

Claude Code のフックは、実行中のメインセッションのモデルを直接変更できません (`UserPromptSubmit` で返せるのは追加コンテキストやブロックだけです)。そこでこのプラグインは、`model` と `effort` をフロントマターで固定した 4 つのサブエージェント (`agents/*.md`) を用意し、フックが判定結果に応じた委譲先を Claude に伝えます。

- 判定はキーワード (日本語/英語)、指示の長さ、コードやスタックトレースの有無、手順やファイルの数から計算するヒューリスティックです。ずれる場合は `#max` などで強制指定してください。
- 委譲の判断を最終的に行うのはメインの Claude なので、まれに委譲せず直接答えることがあります。
- 直近の判定結果は `${CLAUDE_PLUGIN_DATA}/last_route.json` に保存されます。
- 使えるエフォートはモデルによって異なり、非対応の値は Claude Code 側で自動的に調整されます。

## 開発

```
cd plugins/smart-router
python3 -m unittest discover -s tests -v
claude plugin validate .
```
