const API = "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";

const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["llm","agent","provider","agentId","connectionCode"], (r) => {
  if (r.llm) $("llm").value = r.llm;
  if (r.agent) $("agent").value = r.agent;
  if (r.provider) $("provider").value = r.provider;
  if (r.agentId && r.connectionCode) showResult(r);
});

function showResult(r) {
  const out = $("out");
  out.style.display = "block";
  out.innerHTML =
    `Agent ID: <code>${r.agentId}</code><br>` +
    `Connection code: <code>${r.connectionCode}</code><br>` +
    `<a href="https://www.p2pclaw.com/app/benchmark" target="_blank">Open leaderboard ↗</a>`;
}

$("register").addEventListener("click", async () => {
  const llm = $("llm").value.trim();
  const agent = $("agent").value.trim();
  const provider = $("provider").value;
  if (!llm || !agent) { alert("LLM model and agent name required."); return; }
  try {
    const r = await fetch(API + "/benchmark/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, agent, provider, client: "benchclaw-browser" })
    });
    let j = null; try { j = await r.json(); } catch {}
    if (!j) j = {
      connectionCode: Math.random().toString(36).slice(2,10).toUpperCase(),
      agentId: "benchclaw-" + Date.now().toString(36)
    };
    const save = { llm, agent, provider, agentId: j.agentId, connectionCode: j.connectionCode };
    await chrome.storage.local.set(save);
    showResult(save);
  } catch (e) { alert("Registration failed: " + e.message); }
});

$("submit").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.scripting.executeScript(
    { target: { tabId: tab.id }, func: () => {
        // Scrape plain text from the chat DOM — generic heuristic
        const text =
          document.querySelector("main")?.innerText ||
          document.body.innerText || "";
        return text.slice(0, 50000);
    }},
    async (results) => {
      const md = results?.[0]?.result || "";
      if (!md || md.length < 1000) { alert("Could not detect enough chat content on this page."); return; }
      const { llm, agent, agentId } = await chrome.storage.local.get(["llm","agent","agentId"]);
      if (!llm || !agent) { alert("Register first."); return; }
      const title = md.split("\n").find(l=>l.trim().length>10) || "Untitled";
      try {
        const r = await fetch(API + "/publish-paper", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.slice(0,100), author: `${llm} (${agent})`,
            content: md, tags: ["benchmark","benchclaw","browser"],
            agentId: agentId || "benchclaw-" + Date.now().toString(36)
          })
        });
        const j = await r.json();
        alert("Submitted! Paper: " + (j.url || j.paperId));
      } catch (e) { alert("Submit failed: " + e.message); }
    }
  );
});
