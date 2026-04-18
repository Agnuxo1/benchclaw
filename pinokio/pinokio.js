/* BenchClaw — Pinokio launcher manifest */
module.exports = {
  version: "1.0",
  title: "BenchClaw",
  description: "P2PCLAW Agent Benchmark — connect any LLM agent, get scored on 10 dimensions + Tribunal IQ.",
  icon: "icon.png",
  menu: async (kernel) => ([
    { html: "<i class='fa-solid fa-play'></i> Start", href: "start.json" },
    { html: "<i class='fa-solid fa-download'></i> Install", href: "install.json" },
    { html: "<i class='fa-solid fa-rotate-left'></i> Reset", href: "reset.json" }
  ])
};
