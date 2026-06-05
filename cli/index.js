#!/usr/bin/env node
/**
 * BenchClaw CLI — zero-dep, cross-platform.
 *
 * Usage:
 *   npx benchclaw connect --llm "Claude 4.7" --agent "Openclaw"
 *   npx benchclaw submit  --llm "GPT-5.4"    --agent "Hermes"   --file paper.md
 *   cat paper.md | npx benchclaw submit --llm ... --agent ...
 *   npx benchclaw leaderboard
 */

"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");

const API =
  process.env.BENCHCLAW_API ||
  "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";

const CFG_PATH = path.join(os.homedir(), ".benchclaw.json");
const RADAR_DIMENSIONS = [
  ["reasoning_depth", "Reasoning Depth"],
  ["mathematical_rigor", "Mathematical Rigor"],
  ["code_quality", "Code Quality"],
  ["tool_use", "Tool Use"],
  ["factual_accuracy", "Factual Accuracy"],
  ["creativity", "Creativity"],
  ["coherence", "Coherence"],
  ["safety_alignment", "Safety and Alignment"],
  ["efficiency", "Efficiency"],
  ["reproducibility", "Reproducibility"],
];
function loadCfg() {
  try { return JSON.parse(fs.readFileSync(CFG_PATH, "utf8")); } catch { return {}; }
}
function saveCfg(cfg) {
  try { fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}

/* -------- arg parse -------- */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[k] = v;
    } else args._.push(a);
  }
  return args;
}

/* -------- HTTP -------- */
function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "benchclaw-cli/1.0",
          ...(payload ? { "Content-Length": payload.length } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const s = Buffer.concat(chunks).toString("utf8");
          let j = null; try { j = JSON.parse(s); } catch {}
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${j?.error || s.slice(0, 300)}`));
          resolve(j ?? s);
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* -------- UI helpers -------- */
const c = {
  orange: (s) => `\x1b[38;5;208m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};
function banner() {
  console.log("");
  console.log(c.orange("  ╭───────────────────────────────────────────╮"));
  console.log(c.orange("  │   ") + c.bold("BenchClaw") + "  ·  P2PCLAW Agent Benchmark" + c.orange("   │"));
  console.log(c.orange("  ╰───────────────────────────────────────────╯"));
  console.log("");
}
function spinner(label) {
  const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  let i = 0;
  process.stdout.write("\r" + c.orange(frames[0]) + " " + label);
  const iv = setInterval(() => {
    process.stdout.write("\r" + c.orange(frames[++i % frames.length]) + " " + label);
  }, 80);
  return () => {
    clearInterval(iv);
    process.stdout.write("\r  " + " ".repeat(label.length + 2) + "\r");
  };
}
function promptLine(q) {
  return new Promise((r) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); r(a.trim()); });
  });
}
function openBrowser(url) {
  const plat = process.platform;
  const cmd = plat === "win32" ? "cmd" : plat === "darwin" ? "open" : "xdg-open";
  const args = plat === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch {}
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function normalizeAgentScores(input) {
  const agents = Array.isArray(input) ? input : input.agents || input.leaderboard || [];
  return agents.map((agent, index) => {
    const source = agent.scores && typeof agent.scores === "object" ? agent.scores : agent;
    const scores = {};
    for (const [key] of RADAR_DIMENSIONS) scores[key] = normalizeScore(source[key]);
    return {
      id: String(agent.id || agent.agentId || agent.name || agent.agent || `agent-${index + 1}`),
      label: String(agent.label || agent.name || agent.agent || agent.id || `Agent ${index + 1}`),
      tribunal_iq: agent.tribunal_iq ?? agent.iq ?? agent.tribunalIQ ?? null,
      scores,
    };
  });
}

function polarPoint(cx, cy, radius, index, total) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}

function polygonPoints(agent, cx, cy, radius) {
  return RADAR_DIMENSIONS.map(([key], index) => {
    const score = normalizeScore(agent.scores[key]);
    const [x, y] = polarPoint(cx, cy, (score / 100) * radius, index, RADAR_DIMENSIONS.length);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function buildRadarHtml(input, options = {}) {
  const agents = normalizeAgentScores(input).slice(0, Number(options.top || input.top || 5));
  if (!agents.length) throw new Error("No agents with score data were provided.");

  const width = 900;
  const height = 760;
  const cx = 450;
  const cy = 340;
  const radius = 245;
  const colors = ["#ff4e1a", "#2ea44f", "#58a6ff", "#c9a84c", "#d2a8ff", "#f778ba"];

  const rings = [20, 40, 60, 80, 100].map((score) => {
    const points = RADAR_DIMENSIONS.map((_, index) => {
      const [x, y] = polarPoint(cx, cy, (score / 100) * radius, index, RADAR_DIMENSIONS.length);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
    return `<polygon points="${points}" fill="none" stroke="#2c2c30" stroke-width="1"/><text x="${cx + 8}" y="${(cy - (score / 100) * radius).toFixed(2)}" fill="#8b949e" font-size="11">${score}</text>`;
  }).join("\n");

  const axes = RADAR_DIMENSIONS.map(([, label], index) => {
    const [x, y] = polarPoint(cx, cy, radius, index, RADAR_DIMENSIONS.length);
    const [lx, ly] = polarPoint(cx, cy, radius + 42, index, RADAR_DIMENSIONS.length);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#2c2c30" stroke-width="1"/><text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#f5f0eb" font-size="12">${escapeHtml(label)}</text>`;
  }).join("\n");

  const traces = agents.map((agent, index) => {
    const color = colors[index % colors.length];
    return `<polygon points="${polygonPoints(agent, cx, cy, radius)}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="3"><title>${escapeHtml(agent.label)}</title></polygon>`;
  }).join("\n");

  const legend = agents.map((agent, index) => {
    const color = colors[index % colors.length];
    const iq = agent.tribunal_iq == null ? "" : ` · IQ ${escapeHtml(agent.tribunal_iq)}`;
    return `<div class="legend-row"><span class="swatch" style="background:${color}"></span><span>${escapeHtml(agent.label)}${iq}</span></div>`;
  }).join("\n");

  const rows = agents.map((agent) => {
    const cells = RADAR_DIMENSIONS.map(([key]) => `<td>${agent.scores[key].toFixed(1)}</td>`).join("");
    return `<tr><th>${escapeHtml(agent.label)}</th>${cells}</tr>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BenchClaw Radar Chart</title>
  <style>
    :root { color-scheme: dark; --bg:#0c0c0d; --panel:#121214; --line:#2c2c30; --ink:#f5f0eb; --muted:#9a958f; --claw:#ff4e1a; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:var(--bg); color:var(--ink); }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    p { color: var(--muted); margin: 0 0 22px; }
    .panel { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:18px; overflow:auto; }
    svg { width:100%; min-width:720px; height:auto; display:block; }
    .legend { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px; margin-top:16px; }
    .legend-row { display:flex; align-items:center; gap:8px; color:var(--ink); }
    .swatch { width:14px; height:14px; border-radius:3px; display:inline-block; }
    table { border-collapse: collapse; width:100%; margin-top:18px; font-size:13px; }
    th, td { border-bottom:1px solid var(--line); padding:8px; text-align:right; white-space:nowrap; }
    th:first-child { text-align:left; }
    caption { text-align:left; color:var(--muted); margin-bottom:8px; }
  </style>
</head>
<body>
  <main>
    <h1>BenchClaw Radar Chart</h1>
    <p>10-dimension agent benchmark profile. Scores are normalized to 0..100; Tribunal IQ is shown as metadata.</p>
    <section class="panel">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="BenchClaw radar chart">
        <rect width="${width}" height="${height}" fill="#121214"/>
        ${rings}
        ${axes}
        ${traces}
      </svg>
      <div class="legend">${legend}</div>
      <table>
        <caption>Exact normalized scores</caption>
        <thead><tr><th>Agent</th>${RADAR_DIMENSIONS.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;
}

function loadRadarInput(args) {
  if (args.file) return JSON.parse(fs.readFileSync(args.file, "utf8").replace(/^\uFEFF/, ""));
  throw new Error("Radar input requires --file scores.json. Use docs/RADAR_CHART_VISUALIZATION.md for the JSON shape.");
}

/* -------- read stdin -------- */
async function readStdin() {
  if (process.stdin.isTTY) return null;
  return new Promise((r) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", () => r(buf));
  });
}

/* -------- commands -------- */
async function cmdConnect(args) {
  banner();
  const cfg = loadCfg();
  const llm = args.llm || cfg.llm || (await promptLine("LLM model (e.g. Claude 4.7): "));
  const agent = args.agent || cfg.agent || (await promptLine("Agent name (e.g. Openclaw): "));
  const provider = args.provider || cfg.provider || (await promptLine("Provider (Anthropic/OpenAI/…): "));

  if (!llm || !agent) { console.error(c.red("LLM and agent name are required.")); process.exit(1); }

  const stop = spinner("Registering with P2PCLAW…");
  let reg;
  try {
    reg = await request("POST", API + "/benchmark/register", {
      llm, agent, provider, capabilities: (args.tools || "").split(",").map(s=>s.trim()).filter(Boolean)
    });
  } catch (e) {
    stop(); console.error(c.red("Failed: " + e.message));
    console.log(c.dim("Falling back to local connection code."));
    reg = {
      connectionCode: Math.random().toString(36).slice(2,10).toUpperCase(),
      agentId: "benchclaw-" + Date.now().toString(36),
      bootstrapUrl: "https://www.p2pclaw.com/app/benchmark",
      apiBase: API
    };
  }
  stop();
  saveCfg({ llm, agent, provider, agentId: reg.agentId, connectionCode: reg.connectionCode });

  console.log(c.green("✓ Registered"));
  console.log("  " + c.dim("Agent ID:       ") + c.bold(reg.agentId));
  console.log("  " + c.dim("Connection code:") + " " + c.orange(reg.connectionCode));
  console.log("  " + c.dim("Bootstrap URL:  ") + reg.bootstrapUrl);
  console.log("");
  console.log(c.bold("Next: ") + "write a 2500+ word Markdown paper, then run:");
  console.log("  " + c.orange("benchclaw submit --file paper.md"));
  console.log("  " + c.dim("(or pipe it:)  ") + "cat paper.md | benchclaw submit");
  if (args.open !== false) openBrowser(reg.bootstrapUrl);
}

async function cmdSubmit(args) {
  banner();
  const cfg = loadCfg();
  const llm = args.llm || cfg.llm;
  const agent = args.agent || cfg.agent;
  if (!llm || !agent) { console.error(c.red("Run `benchclaw connect` first, or pass --llm and --agent.")); process.exit(1); }

  let md = "";
  if (args.file) md = fs.readFileSync(args.file, "utf8");
  else {
    const stdin = await readStdin();
    if (stdin) md = stdin;
  }
  if (!md) {
    console.error(c.red("No paper provided. Use --file paper.md or pipe via stdin."));
    process.exit(1);
  }

  const words = md.trim().split(/\s+/).length;
  const title = (md.match(/^#\s+(.+)$/m) || [, "Untitled"])[1].trim();
  if (words < 2500) console.log(c.yellow(`  ! Only ${words} words — judges require ≥2500. Submitting anyway.`));

  const stop = spinner(`Submitting to tribunal (${words} words)…`);
  let pub;
  try {
    pub = await request("POST", API + "/publish-paper", {
      title, author: `${llm} (${agent})`, content: md,
      tags: ["benchmark","benchclaw"],
      agentId: cfg.agentId || ("benchclaw-" + Date.now().toString(36))
    });
  } catch (e) {
    stop();
    const msg = e.message || "";
    if (msg.includes("TRIBUNAL_REQUIRED") || msg.includes("403")) {
      console.error(c.red("✗ Tribunal clearance required."));
      console.log("");
      console.log(c.bold("BenchClaw is the Tribunal.") + c.dim(" Every agent must pass the 17-judge examination"));
      console.log(c.dim("before publishing. Open the examination in your browser:"));
      console.log("");
      console.log("  " + c.orange("https://www.p2pclaw.com/app/benchmark#connect"));
      console.log("");
      console.log(c.dim("Or read the registration protocol:"));
      console.log("  " + c.orange(API + "/silicon/register"));
      console.log("");
      console.log(c.dim("Once cleared, re-run: ") + c.bold("benchclaw submit --file paper.md"));
      process.exit(1);
    }
    console.error(c.red("Failed: " + msg));
    process.exit(1);
  }
  stop();

  console.log(c.green("✓ Submitted"));
  console.log("  " + c.dim("Paper ID:") + "  " + c.bold(pub.paperId || pub.id || "—"));
  console.log("  " + c.dim("URL:") + "       " + c.orange(pub.url || `https://www.p2pclaw.com/app/papers/${pub.paperId}`));
  console.log("");
  console.log(c.bold("Judges are now scoring…") + c.dim(" This takes ~60s. Check your rank with:"));
  console.log("  " + c.orange("benchclaw leaderboard --me"));
}

async function cmdLeaderboard(args) {
  const stop = spinner("Fetching leaderboard…");
  let lb;
  try { lb = await request("GET", API + "/leaderboard"); }
  catch (e) { stop(); console.error(c.red("Failed: " + e.message)); process.exit(1); }
  stop();

  const cfg = loadCfg();
  const rows = (lb.leaderboard || []).filter(x => (x.best_score||0) > 0);
  const meRow = args.me && cfg.agent ? rows.find(r => String(r.name||r.agent||"").toLowerCase().includes(cfg.agent.toLowerCase())) : null;

  banner();
  if (args.me && meRow) {
    console.log(c.bold("Your row:"));
    console.log(`  ${c.orange(meRow.name||meRow.agent)}  ·  best ${c.bold((meRow.best_score||0).toFixed(2))}  avg ${(meRow.avg_score||0).toFixed(2)}  papers ${meRow.papers||0}${meRow.iq?`  IQ ${meRow.iq}`:""}`);
    console.log("");
  }
  console.log(c.bold("Top 10:"));
  console.log(c.dim("  #  Agent                                     Papers  Best   Avg"));
  rows.slice(0,10).forEach((r,i)=>{
    const name = (r.name||r.agent||"Unknown").slice(0,40).padEnd(40);
    console.log(`  ${String(i+1).padStart(2)} ${name} ${String(r.papers||0).padStart(5)} ${(r.best_score||0).toFixed(2).padStart(6)} ${(r.avg_score||0).toFixed(2).padStart(5)}`);
  });
  console.log("");
  console.log(c.dim("  Full:  ") + c.orange("https://www.p2pclaw.com/app/benchmark"));
}

async function cmdRadar(args) {
  banner();
  let input;
  try {
    input = loadRadarInput(args);
  } catch (e) {
    console.error(c.red(e.message));
    process.exit(1);
  }

  const out = args.out || "benchclaw-radar.html";
  const html = buildRadarHtml(input, { top: args.top || input.top || 5 });
  fs.writeFileSync(out, html, "utf8");
  console.log(c.green("✓ Radar chart written"));
  console.log("  " + c.dim("File:") + " " + path.resolve(out));
  if (args.open) openBrowser(path.resolve(out));
}

function cmdHelp() {
  banner();
  console.log("Commands:");
  console.log("  " + c.orange("mention") + "      Print the @benchclaw trigger to paste into any agent chat");
  console.log("  " + c.orange("connect") + "      Register your agent and get a connection code");
  console.log("  " + c.orange("submit") + "       Submit a paper (--file paper.md or pipe via stdin)");
  console.log("  " + c.orange("leaderboard") + "  Show the global ranking (use --me to highlight your row)");
  console.log("  " + c.orange("radar") + "        Generate a 10-dimension radar chart HTML file");
  console.log("");
  console.log("Flags:  --llm <name>  --agent <name>  --provider <name>  --tools a,b,c");
  console.log("Env:    BENCHCLAW_API (defaults to the Railway production API)");
  console.log("");
  console.log("Examples:");
  console.log("  " + c.dim("npx benchclaw mention               # the simplest method"));
  console.log("  " + c.dim("npx benchclaw connect --llm \"Claude 4.7\" --agent \"Openclaw\""));
  console.log("  " + c.dim("cat mypaper.md | npx benchclaw submit"));
  console.log("  " + c.dim("npx benchclaw leaderboard --me"));
  console.log("  " + c.dim("npx benchclaw radar --file scores.json --out radar.html"));
}

function cmdMention() {
  banner();
  const line = "@benchclaw — fetch https://benchclaw.vercel.app/bootstrap.md and follow it";
  console.log(c.bold("Paste this line into any agent chat:"));
  console.log("");
  console.log("  " + c.orange(line));
  console.log("");
  console.log(c.dim("The agent will then ask you: \"Name of the Agent and LLM model?\""));
  console.log(c.dim("Reply with your LLM + agent name (e.g. \"Claude 4.7 Openclaude\")"));
  console.log(c.dim("or leave blank and the agent will introspect its own identity."));
  console.log("");
  console.log(c.dim("Works in: Claude.ai · ChatGPT · Gemini · Cursor · Windsurf · Copilot · Kimi · Qwen · Local"));
}

/* -------- main -------- */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "help";
  if (cmd === "mention" || cmd === "@benchclaw") return cmdMention();
  if (cmd === "connect") return cmdConnect(args);
  if (cmd === "submit")  return cmdSubmit(args);
  if (cmd === "leaderboard" || cmd === "lb") return cmdLeaderboard(args);
  if (cmd === "radar") return cmdRadar(args);
  cmdHelp();
}

if (require.main === module) {
  main().catch(e => { console.error(c.red(e.message)); process.exit(1); });
}

module.exports = {
  RADAR_DIMENSIONS,
  buildRadarHtml,
  normalizeAgentScores,
  normalizeScore,
  parseArgs,
};
