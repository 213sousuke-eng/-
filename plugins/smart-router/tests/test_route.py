import json, os, subprocess, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "route.py"
sys.path.insert(0, str(ROOT / "scripts"))
import route  # noqa: E402


def run_hook(payload, env_extra=None, raw=None):
    env = {k: v for k, v in os.environ.items() if not k.startswith("SMART_ROUTER_")}
    env.update(env_extra or {})
    p = subprocess.run([sys.executable, str(SCRIPT)], input=raw if raw is not None else json.dumps(payload),
                       capture_output=True, text=True, env=env, timeout=10)
    return p


class ClassifyTest(unittest.TestCase):
    def tier(self, text):
        return route.classify(text).tier

    def test_chitchat_direct(self):
        for t in ["ありがとう", "了解！", "thanks", "ok", "/help"]:
            self.assertEqual(self.tier(t), "direct", t)

    def test_light(self):
        self.assertEqual(self.tier("この文を英語に翻訳して: こんにちは"), "quick")
        self.assertEqual(self.tier("Pythonとは？"), "quick")

    def test_standard(self):
        self.assertEqual(self.tier("ログイン画面のバグを直して"), "standard")

    def test_deep(self):
        self.assertIn(self.tier("決済APIを実装して、テストを書いて、全部のエラー処理を丁寧に直して"), ("deep", "max"))

    def test_max(self):
        t = "マイクロサービスへ移行するアーキテクチャを設計して実装して。競合状態とデッドロックも全部調査して直して"
        self.assertEqual(self.tier(t), "max")

    def test_force(self):
        self.assertEqual(self.tier("翻訳して #max"), "max")
        self.assertEqual(self.tier("#quick 大規模アーキテクチャ設計"), "quick")

    def test_empty(self):
        self.assertEqual(self.tier(""), "direct")


class HookTest(unittest.TestCase):
    def test_output_json(self):
        p = run_hook({"prompt": "バグを直して", "hook_event_name": "UserPromptSubmit"})
        self.assertEqual(p.returncode, 0, p.stderr)
        out = json.loads(p.stdout)
        ctx = out["hookSpecificOutput"]["additionalContext"]
        self.assertEqual(out["hookSpecificOutput"]["hookEventName"], "UserPromptSubmit")
        self.assertIn("smart-router:standard", ctx)

    def test_suggest_mode(self):
        p = run_hook({"prompt": "バグを直して"}, {"SMART_ROUTER_MODE": "suggest"})
        self.assertIn("/model sonnet", json.loads(p.stdout)["hookSpecificOutput"]["additionalContext"])

    def test_off_and_optout_and_subagent(self):
        self.assertEqual(run_hook({"prompt": "バグを直して"}, {"SMART_ROUTER_MODE": "off"}).stdout, "")
        self.assertEqual(run_hook({"prompt": "バグを直して #noroute"}).stdout, "")
        self.assertEqual(run_hook({"prompt": "バグを直して", "agent_id": "x"}).stdout, "")

    def test_bad_input_does_not_block(self):
        p = run_hook(None, raw="not json")
        self.assertEqual((p.returncode, p.stdout), (0, ""))

    def test_min_tier(self):
        p = run_hook({"prompt": "Pythonとは？"}, {"SMART_ROUTER_MIN_TIER": "deep"})
        self.assertIn("smart-router:deep", p.stdout)

    def test_plugin_data_saved(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            run_hook({"prompt": "バグを直して"}, {"CLAUDE_PLUGIN_DATA": d})
            with open(Path(d) / "last_route.json", encoding="utf-8") as f:
                self.assertEqual(json.load(f)["tier"], "standard")

    def test_explain(self):
        p = subprocess.run([sys.executable, str(SCRIPT), "--explain"], input="バグを直して",
                           capture_output=True, text=True)
        self.assertIn("sonnet", p.stdout)


if __name__ == "__main__":
    unittest.main()
