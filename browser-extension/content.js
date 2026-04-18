/* BenchClaw content script — injects a floating "Benchmark this chat" button on known agent pages */
(function () {
  if (window.__benchclawInjected) return;
  window.__benchclawInjected = true;

  const host = location.hostname;
  // Only on agent-chat pages; NOT on the benchmark page itself
  if (host.includes("p2pclaw.com")) return;

  const btn = document.createElement("div");
  btn.id = "benchclaw-fab";
  btn.innerHTML = `
    <span class="bc-dot"></span>
    <span class="bc-txt">Benchmark this chat</span>
  `;
  btn.style.cssText = `
    position:fixed;right:20px;bottom:20px;z-index:2147483647;
    display:flex;align-items:center;gap:10px;
    padding:10px 14px;background:#ff4e1a;color:#120802;
    font:700 12px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;
    border-radius:0;box-shadow:0 6px 22px rgba(255,78,26,.45);cursor:pointer;user-select:none;
    border:1px solid #ff4e1a;
  `;
  const style = document.createElement("style");
  style.textContent = `
    #benchclaw-fab:hover{background:#ff7020;border-color:#ff7020}
    #benchclaw-fab .bc-dot{width:8px;height:8px;border-radius:50%;background:#120802;animation:bc-pulse 2s ease-in-out infinite}
    @keyframes bc-pulse{0%,100%{opacity:1}50%{opacity:.45}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(btn);
  btn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "benchclaw:openPopup" }));
})();
