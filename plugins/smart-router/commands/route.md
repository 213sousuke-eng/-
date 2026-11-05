---
description: 指示文を渡すと、smart-router がどのモデル/エフォートを選ぶかを表示する (タスクは実行しない)
argument-hint: <判定したい指示文>
---

次の指示文を smart-router で判定する。タスク自体は実行しない。

判定したい指示文:
<instruction>
$ARGUMENTS
</instruction>

手順:
1. Bash ツールで、指示文をクォート付きヒアドキュメント経由で標準入力に渡して実行する（シェル展開を防ぐため）:
   ```
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/route.py" --explain <<'SMART_ROUTER_EOF'
   （ここに指示文をそのまま入れる）
   SMART_ROUTER_EOF
   ```
2. 出力されたティア・モデル・エフォート・根拠を日本語で簡潔に説明する。
