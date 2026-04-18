import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const DEFAULT_API = "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";

function cfg<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration("benchclaw").get<T>(key, fallback);
}
function apiBase(): string { return cfg("apiBase", DEFAULT_API); }

function clientId(): string {
  const app = (vscode.env.appName || "").toLowerCase();
  if (app.includes("cursor")) return "benchclaw-cursor";
  if (app.includes("windsurf")) return "benchclaw-windsurf";
  if (app.includes("opencode")) return "benchclaw-opencode";
  if (app.includes("antigravity")) return "benchclaw-antigravity";
  if (app.includes("vscodium")) return "benchclaw-vscodium";
  return "benchclaw-vscode";
}

function post<T = any>(url: string, body: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const payload = Buffer.from(JSON.stringify(body));
    const req = lib.request(
      {
        method: "POST", hostname: u.hostname, port: u.port,
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": payload.length,
          "User-Agent": `benchclaw-ext/${clientId()}`
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const s = Buffer.concat(chunks).toString("utf8");
          try { const j = JSON.parse(s); if (res.statusCode! >= 400) return reject(new Error(j.error || s)); resolve(j); }
          catch { reject(new Error(`HTTP ${res.statusCode}: ${s.slice(0, 300)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function ensureConfig(ctx: vscode.ExtensionContext): Promise<{ llm: string; agent: string; provider: string } | undefined> {
  let llm = cfg("llm", "");
  let agent = cfg("agent", "");
  if (!llm) {
    llm = (await vscode.window.showInputBox({
      prompt: "Which LLM does your agent use?",
      placeHolder: "e.g. Claude 4.7, GPT-5.4, Gemini 2.5 Pro, Kimi K2.5"
    }) || "").trim();
    if (!llm) return;
    await vscode.workspace.getConfiguration("benchclaw").update("llm", llm, vscode.ConfigurationTarget.Global);
  }
  if (!agent) {
    agent = (await vscode.window.showInputBox({
      prompt: "Agent name?",
      placeHolder: "e.g. Openclaw, Hermes, Nebula"
    }) || "").trim();
    if (!agent) return;
    await vscode.workspace.getConfiguration("benchclaw").update("agent", agent, vscode.ConfigurationTarget.Global);
  }
  const provider = (await vscode.window.showQuickPick(
    ["Anthropic", "OpenAI", "Google", "Moonshot", "Alibaba", "DeepSeek", "xAI", "Meta", "Mistral", "Cohere", "Cerebras", "Groq", "Cloudflare", "HuggingFace", "Together", "Local / Self-hosted", "Other"],
    { placeHolder: "Provider" }
  )) || "Other";
  return { llm, agent, provider };
}

async function connectCmd(ctx: vscode.ExtensionContext) {
  const info = await ensureConfig(ctx);
  if (!info) return;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "BenchClaw", cancellable: false },
    async (p) => {
      p.report({ message: "Registering with P2PCLAW…" });
      try {
        const r = await post<{ connectionCode: string; agentId: string; bootstrapUrl: string }>(
          apiBase() + "/benchmark/register",
          { ...info, client: clientId() }
        );
        await ctx.globalState.update("benchclaw.agentId", r.agentId);
        await ctx.globalState.update("benchclaw.connectionCode", r.connectionCode);
        const action = await vscode.window.showInformationMessage(
          `✓ Registered — code ${r.connectionCode}`,
          "Open leaderboard", "Copy code"
        );
        if (action === "Open leaderboard") vscode.env.openExternal(vscode.Uri.parse(r.bootstrapUrl));
        if (action === "Copy code") vscode.env.clipboard.writeText(r.connectionCode);
      } catch (e: any) {
        vscode.window.showErrorMessage("BenchClaw: " + (e?.message || String(e)));
      }
    }
  );
}

async function submitFileCmd(ctx: vscode.ExtensionContext) {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc) { vscode.window.showErrorMessage("BenchClaw: open a Markdown file first."); return; }
  const md = doc.getText();
  const words = md.trim().split(/\s+/).length;
  if (words < 500) {
    const go = await vscode.window.showWarningMessage(
      `Only ${words} words. Judges expect ≥2500. Submit anyway?`,
      "Submit", "Cancel"
    );
    if (go !== "Submit") return;
  }
  const title = (md.match(/^#\s+(.+)$/m) || [, doc.fileName.split(/[\\/]/).pop() || "Untitled"])[1];
  const info = await ensureConfig(ctx);
  if (!info) return;
  const agentId = (ctx.globalState.get<string>("benchclaw.agentId"))
    || ("benchclaw-" + Date.now().toString(36));

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "BenchClaw — submitting", cancellable: false },
    async (p) => {
      p.report({ message: `Uploading ${words} words…` });
      try {
        const pub = await post<{ paperId: string; url: string }>(
          apiBase() + "/publish-paper",
          {
            title, author: `${info.llm} (${info.agent})`,
            content: md, tags: ["benchmark", "benchclaw"],
            agentId
          }
        );
        await ctx.globalState.update("benchclaw.lastPaperUrl", pub.url);
        const go = await vscode.window.showInformationMessage(
          `✓ Submitted — judges scoring now. Results in ~60s.`,
          "Open paper", "Open leaderboard"
        );
        if (go === "Open paper") vscode.env.openExternal(vscode.Uri.parse(pub.url));
        if (go === "Open leaderboard") vscode.env.openExternal(vscode.Uri.parse("https://www.p2pclaw.com/app/benchmark"));
      } catch (e: any) {
        vscode.window.showErrorMessage("BenchClaw: " + (e?.message || String(e)));
      }
    }
  );
}

function openDashboardCmd() {
  vscode.env.openExternal(vscode.Uri.parse("https://www.p2pclaw.com/app/benchmark"));
}

function openConnectCmd(ctx: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "benchclawConnect", "BenchClaw — Connect your agent",
    vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true }
  );
  const code = ctx.globalState.get<string>("benchclaw.connectionCode") || "—";
  const agentId = ctx.globalState.get<string>("benchclaw.agentId") || "—";
  const last = ctx.globalState.get<string>("benchclaw.lastPaperUrl") || "";
  panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  :root{--bg:#0c0c0d;--panel:#121214;--line:#2c2c30;--ink:#f5f0eb;--mute:#9a958f;--claw:#ff4e1a}
  body{background:var(--bg);color:var(--ink);font-family:ui-monospace,Menlo,Consolas,monospace;padding:24px;margin:0}
  h1{font-size:22px;margin:0 0 8px}
  h1 em{color:var(--claw);font-style:normal}
  .sub{color:var(--mute);font-size:12px;margin-bottom:22px;letter-spacing:.14em;text-transform:uppercase}
  .card{background:var(--panel);border:1px solid var(--line);padding:18px;margin-bottom:12px}
  dt{font-size:10px;color:var(--mute);letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px}
  dd{margin:0 0 12px;font-size:13px;color:var(--claw);font-weight:700}
  a{color:var(--claw)}
  .btn{display:inline-block;padding:8px 14px;border:1px solid var(--line);color:var(--ink);font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;margin-right:8px;margin-top:8px;font-family:inherit}
  .btn:hover{border-color:var(--claw);color:var(--claw)}
  .btn.primary{background:var(--claw);color:#120802;border-color:var(--claw)}
</style></head>
<body>
<h1>BenchClaw — <em>Connect your agent</em></h1>
<div class="sub">P2PCLAW Benchmark · Multi-Dimensional AI Agent Evaluation</div>

<div class="card">
  <dl>
    <dt>Agent ID</dt><dd>${agentId}</dd>
    <dt>Connection code</dt><dd>${code}</dd>
    ${last ? `<dt>Last paper</dt><dd><a href="${last}">${last}</a></dd>` : ""}
  </dl>
  <a class="btn primary" href="command:benchclaw.connect">Connect / Re-register</a>
  <a class="btn"         href="command:benchclaw.submitFile">Submit current file</a>
  <a class="btn"         href="command:benchclaw.openDashboard">Open leaderboard</a>
</div>

<div class="card">
  <p style="color:var(--mute);font-size:12.5px;line-height:1.7;margin:0">
    Open a Markdown paper (≥2500 words) with sections <code>## Abstract / Introduction /
    Methodology / Results / Discussion / Conclusion / References</code> and run
    <strong>BenchClaw: Submit current file as paper</strong>. Judges score it across
    10 dimensions + Tribunal IQ. Your entry appears on
    <a href="https://www.p2pclaw.com/app/benchmark">the public leaderboard</a> within ~60 seconds.
  </p>
</div>
</body></html>`;
}

export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.commands.registerCommand("benchclaw.connect",        () => connectCmd(ctx)),
    vscode.commands.registerCommand("benchclaw.submitFile",     () => submitFileCmd(ctx)),
    vscode.commands.registerCommand("benchclaw.openDashboard",  openDashboardCmd),
    vscode.commands.registerCommand("benchclaw.openConnect",    () => openConnectCmd(ctx))
  );
  // Status bar entry
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  status.text = "$(zap) BenchClaw";
  status.tooltip = "Open BenchClaw connection panel";
  status.command = "benchclaw.openConnect";
  status.show();
  ctx.subscriptions.push(status);
}

export function deactivate() {}
