import { targetUrlPatterns, contextMenus } from '../common/const';

console.debug('Start service-worker.js');
startHeartbeat();

const updateContextMenus = async (url) => {
  const pattern = targetUrlPatterns.find(p => url.match(p));
  const { exclusionUrlPatterns } = await chrome.storage.local.get({ exclusionUrlPatterns: {} });
  try {
    const exclusionUrlPatternsByHost = exclusionUrlPatterns[new URL(url).host] || [];
    for await (const menu of contextMenus) {
      await chrome.contextMenus.update(menu.id, { visible: !!pattern && ((menu.id !== contextMenus[3].id && menu.id !== contextMenus[4].id) || exclusionUrlPatternsByHost.length > 0) });
    };
    for await (const host of Object.keys(exclusionUrlPatterns)) {
      for await (const pattern of exclusionUrlPatterns[host]) {
        await chrome.contextMenus.update(
          `exclusion_path_pattern_${host}_${pattern}`, {
          visible: host === new URL(url).host
        }
        );
      }
    }
  } catch { }
}

chrome.runtime.onInstalled.addListener(async () => {
  for await (const menu of contextMenus) {
    await chrome.contextMenus.create(menu);
  };
  const { exclusionUrlPatterns } = await chrome.storage.local.get({ exclusionUrlPatterns: {} });
  for await (const host of Object.keys(exclusionUrlPatterns)) {
    for await (const pattern of exclusionUrlPatterns[host]) {
      await chrome.contextMenus.create({
        id: `exclusion_path_pattern_${host}_${pattern}`,
        title: pattern,
        parentId: contextMenus[3].id,
      });
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await updateContextMenus(tab.url);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const pattern = targetUrlPatterns.find(p => tab.url.match(p));
  switch (info.menuItemId) {
    case contextMenus[0].id:
      await chrome.tabs.update(tab.id, { url: tab.url.replace(pattern, '') });
      break;
    case contextMenus[1].id:
    case contextMenus[2].id:
      await chrome.tabs.sendMessage(tab.id, { type: info.menuItemId });
      break;
    case contextMenus[4].id:
      await chrome.storage.local.set({ exclusionUrlPatterns: {} });
      await updateContextMenus(tab.url);
      break;
    default:
      const menuId = info.menuItemId.toString();
      if (!menuId.startsWith('exclusion_path_pattern_')) return;
      const { exclusionUrlPatterns } = await chrome.storage.local.get({ exclusionUrlPatterns: {} });
      for (const host of Object.keys(exclusionUrlPatterns)) {
        if (new URL(tab.url).host !== host) continue;
        exclusionUrlPatterns[host] = exclusionUrlPatterns[host].filter(p => p !== menuId.replace(`exclusion_path_pattern_${host}_`, ''));
        if (exclusionUrlPatterns[host].length === 0) delete exclusionUrlPatterns[host];
      }
      await chrome.contextMenus.remove(menuId);
      await chrome.storage.local.set({ exclusionUrlPatterns });
      await updateContextMenus(tab.url);
      break;
  }
});

const urlMap = new Map();
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  urlMap.set(details.tabId, { processing: true });
  // Skip if the navigation is in a sub frame.
  if (details.frameType !== 'outermost_frame') return;

  const tab = await chrome.tabs.get(details.tabId);
  // Skip if the URL is in exclusion URL patterns.
  const items = await chrome.storage.local.get({ exclusionUrlPatterns: {} });
  const url = new URL(details.url);
  const exclusionUrlPatterns = items.exclusionUrlPatterns[url.host] || [];
  if (exclusionUrlPatterns.find(p => new RegExp(p).test(url.href.replace(url.origin, ''))) != null) {
    urlMap.set(details.tabId, null);
    await updateContextMenus(details.url);
    return
  };

  // Skip if the navigation is within the same domain.
  if (tab.url && new URL(tab.url).host === new URL(details.url).host) return;

  urlMap.set(details.tabId, { from: tab.url, tab });
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  const urls = await (async () => {
    do {
      await new Promise(resolve => setTimeout(resolve, 10));
      const urls = urlMap.get(details.tabId);
      if (!(urls?.processing)) return urls;
    } while (true);
    return urls;
  })();
  if (urls?.from == null) return;
  urlMap.set(details.tabId, null);

  const pattern = targetUrlPatterns.find(p => details.url.match(p));
  if (urls.tab.active) {
    await updateContextMenus(details.url);
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

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'getOriginalUrl') {
    const urls = urlMap.get(sender.tab.id);
    if (urls?.original === sender.url) return;
    sendResponse(urls?.original);
    urlMap.set(sender.tab.id, null);
  } else if (request.type === contextMenus[2].id) {
    const { host, pattern } = request;
    const items = await chrome.storage.local.get({ exclusionUrlPatterns: {} });
    items.exclusionUrlPatterns[host] = items.exclusionUrlPatterns[host] || [];
    if (items.exclusionUrlPatterns[host].includes(pattern)) return;
    items.exclusionUrlPatterns[host].push(pattern);
    await chrome.storage.local.set({ exclusionUrlPatterns: items.exclusionUrlPatterns });
    await chrome.contextMenus.create({
      id: `exclusion_path_pattern_${host}_${pattern}`,
      title: pattern,
      parentId: contextMenus[3].id
    });
    await updateContextMenus(sender.url);
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