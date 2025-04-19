import { targetUrlPatterns, contextMenus } from '../common/const';

// console.debug('Start service-worker.js');
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
  // console.debug(`[onBeforeNavigate]start: ${details.url}`);
  if (urlMap.has(details.tabId)) {
    // console.debug(`[onBeforeNavigate]exit: ${details.url}, already in progress`);
    return;
  }

  // Skip if the navigation is not for target domains.
  const pattern = targetUrlPatterns.find(p => details.url.match(p));
  if (!pattern) {
    // console.debug(`[onCommitted]exit: ${details.url} not for target domains`);
    urlMap.delete(details.tabId);
    return;
  };
  // Skip if the navigation is in a sub frame.
  if (details.frameType !== 'outermost_frame') return;

  urlMap.set(details.tabId, { status: 'varidating' });
  const tab = await chrome.tabs.get(details.tabId);
  // Skip if the navigation is within the same domain.
  if (tab.url && new URL(tab.url).host === new URL(details.url).host) {
    // console.debug(`[onBeforeNavigate]exit: ${details.url}, same domain`);
    urlMap.delete(details.tabId);
    return;
  };

  const items = await chrome.storage.local.get({ exclusionUrlPatterns: {} });
  const url = new URL(details.url);
  const exclusionUrlPatterns = items.exclusionUrlPatterns[url.host] || [];

  // Skip if the URL is in exclusion URL patterns.
  if (exclusionUrlPatterns.find(p => new RegExp(p).test(url.href.replace(url.origin, ''))) != null) {
    // console.debug(`[onBeforeNavigate]exit: ${details.url}, in exclusion URL patterns`);
    urlMap.delete(details.tabId);
    await updateContextMenus(details.url);
    return;
  };

  urlMap.set(details.tabId, { from: tab.url, tab, status: 'passed' });
  // console.debug(`[onBeforeNavigate]exit: ${details.url}, passed`);
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  // console.debug(`[onCommitted]start: ${details.url}`);
  const urls = await (async () => {
    let urls = null;
    let i = 0;
    do {
      await new Promise(resolve => setTimeout(resolve, 100));
      urls = urlMap.get(details.tabId);
      if (!urls || urls.status === 'passed' || urls.status === 'navigating') break;
      urls = null;
      i++;
    } while (i < 100);
    // console.debug(`[onCommitted]info: ${i}times waited`);
    return urls;
  })();
  if (urls?.status === 'navigating') {
    // console.debug(`[onCommitted]exit: ${details.url} already in progress`);
    return;
  } else if (!(urls?.from)) {
    // console.debug(`[onCommitted]exit: ${details.url} not in progress`);
    urlMap.delete(details.tabId);
    return;
  }
  if (urls.tab.active) {
    await updateContextMenus(details.url);
  }

  // Skip if the navigation is by forward/back button.
  if (details.transitionQualifiers.indexOf('forward_back') >= 0) {
    // console.debug(`[onCommitted]exit: ${details.url} by forward/back button`);
    urlMap.delete(details.tabId);
    return;
  };

  urls.from = null;
  urls.original = details.url;
  urls.status = 'navigating';
  urlMap.set(details.tabId, urls);
  const pattern = targetUrlPatterns.find(p => details.url.match(p));
  await chrome.tabs.update(details.tabId, { url: details.url.replace(pattern, '') });
  // console.debug(`[onCommitted]exit: ${details.url} navigated`);
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'getOriginalUrl') {
    // console.debug(`[onMessage]start: ${sender.url}`);
    const urls = urlMap.get(sender.tab.id);
    if (!(urls?.original)) {
      // console.debug(`[onMessage]exit: ${sender.url} not in progress`);
    } else if (urls.original === sender.url) {
      // console.debug(`[onMessage]exit: ${sender.url} sent original URL`);
    } else {
      // console.debug(`[onMessage]exit: ${sender.url} sent response`);
      urlMap.delete(sender.tab.id);
    }
    sendResponse(urls?.original === sender.url ? null : urls?.original);
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