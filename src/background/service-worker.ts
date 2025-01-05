import { targetUrlPatterns, contextMenus } from '../common/const';

console.debug('Start service-worker.js');
startHeartbeat();

chrome.runtime.onInstalled.addListener(async () => {
  for await (const menu of contextMenus) {
    await chrome.contextMenus.create(menu);
  };
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  const pattern = targetUrlPatterns.find(p => tab.url.match(p));
  for await (const menu of contextMenus) {
    await chrome.contextMenus.update(menu.id, { visible: !!pattern });
  };
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case contextMenus[0].id:
      const pattern = targetUrlPatterns.find(p => tab.url.match(p));
      await chrome.tabs.update(tab.id, { url: tab.url.replace(pattern, '') });
      break;
    case contextMenus[1].id:
      await chrome.tabs.sendMessage(tab.id, { type: info.menuItemId });
      break;
  }
});

const urlMap = new Map();
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {

  // Skip if the navigation is in a sub frame.
  if (details.frameType !== 'outermost_frame') return;

  const tab = await chrome.tabs.get(details.tabId);
  // Skip if the navigation is within the same domain.
  if (tab.url && new URL(tab.url).host === new URL(details.url).host) return;

  urlMap.set(details.tabId, { from: tab.url, tab });
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  const urls = urlMap.get(details.tabId);
  if (urls?.from == null) return;
  urlMap.set(details.tabId, null);

  const pattern = targetUrlPatterns.find(p => details.url.match(p));
  if (urls.tab.active) {
    for await (const menu of contextMenus) {
      await chrome.contextMenus.update(menu.id, { visible: !!pattern });
    }
  }
  // Skip if the navigation is not for target domains.
  if (!pattern) return;

  // Skip if the navigation is by forward/back button.
  if (details.transitionQualifiers.indexOf('forward_back') >= 0) return;

  urls.from = null;
  urls.original = details.url;
  urlMap.set(details.tabId, urls);
  await chrome.tabs.update(details.tabId, { url: details.url.replace(pattern, '') });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getOriginalUrl') {
    const urls = urlMap.get(sender.tab.id);
    if (urls?.original === sender.url) return;
    sendResponse(urls?.original);
    urlMap.set(sender.tab.id, null);
  }
});

// https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#convert-timers
/**
 * Tracks when a service worker was last alive and extends the service worker
 * lifetime by writing the current time to extension storage every 20 seconds.
 * You should still prepare for unexpected termination - for example, if the
 * extension process crashes or your extension is manually stopped at
 * chrome://serviceworker-internals. 
 */
let heartbeatInterval;

async function runHeartbeat() {
  await chrome.storage.local.set({ 'last-heartbeat': new Date().getTime() });
}

/**
 * Starts the heartbeat interval which keeps the service worker alive. Call
 * this sparingly when you are doing work which requires persistence, and call
 * stopHeartbeat once that work is complete.
 */
async function startHeartbeat() {
  // Run the heartbeat once at service worker startup.
  runHeartbeat().then(() => {
    // Then again every 20 seconds.
    heartbeatInterval = setInterval(runHeartbeat, 20 * 1000);
  });
}

async function stopHeartbeat() {
  clearInterval(heartbeatInterval);
}

/**
 * Returns the last heartbeat stored in extension storage, or undefined if
 * the heartbeat has never run before.
 */
async function getLastHeartbeat() {
  return (await chrome.storage.local.get('last-heartbeat'))['last-heartbeat'];
}