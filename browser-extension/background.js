chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "benchclaw:openPopup") chrome.action.openPopup?.();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: "https://www.p2pclaw.com/app/benchmark" });
});
