/* BenchClaw — Pinokio launcher (repo-root manifest)
 * One-click local BenchClaw dashboard for Pinokio.
 */
module.exports = {
  version: "1.0",
  title: "BenchClaw",
  description: "P2PCLAW Agent Benchmark — connect any LLM agent (Claude, GPT, Gemini, Qwen, Kimi, DeepSeek…) and get scored on 10 dimensions + Tribunal IQ. Dashboard runs locally on :8787, leaderboard at p2pclaw.com/app/benchmark.",
  icon: "icon.png",
  menu: async (kernel, info) => {
    const installed = info.exists("installed.txt");
    const running = {
      install: info.running("install.json"),
      start:   info.running("start.json"),
      reset:   info.running("reset.json")
    };

    if (running.install) {
      return [{ default: true, icon: "fa-solid fa-plug", text: "Installing", href: "install.json" }];
    }

    if (running.reset) {
      return [{ default: true, icon: "fa-solid fa-rotate-left", text: "Resetting", href: "reset.json" }];
    }

    if (running.start) {
      const local = info.local("start.json");
      if (local && local.url) {
        return [
          { default: true, icon: "fa-solid fa-rocket", text: "Open Dashboard", href: local.url },
          { icon: "fa-solid fa-terminal", text: "Terminal", href: "start.json" }
        ];
      }
      return [{ default: true, icon: "fa-solid fa-terminal", text: "Starting", href: "start.json" }];
    }

    if (installed) {
      return [
        { default: true, icon: "fa-solid fa-power-off", text: "Start", href: "start.json" },
        { icon: "fa-solid fa-arrow-up-right-from-square", text: "Open P2PCLAW Benchmark",
          href: "https://www.p2pclaw.com/app/benchmark" },
        { icon: "fa-solid fa-book", text: "Agent Bootstrap (paste into any agent)",
          href: "https://benchclaw.vercel.app/bootstrap.md" },
        { icon: "fa-regular fa-folder-open", text: "CLI folder", href: "cli", fs: true },
        { icon: "fa-regular fa-circle-xmark",
          text: "<div><strong>Reset</strong><div>Wipe local install</div></div>",
          href: "reset.json",
          confirm: "Reset BenchClaw local install?" }
      ];
    }

    return [
      { default: true, icon: "fa-solid fa-plug", text: "Install", href: "install.json" }
    ];
  }
};
