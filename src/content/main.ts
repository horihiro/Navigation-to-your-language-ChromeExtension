import { targetUrlPatterns, contextMenus } from '../common/const';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const originalUrl = await chrome.runtime.sendMessage({ type: 'getOriginalUrl' });
  if (!originalUrl) return;
  // show toast message that will fade out after 10 seconds
  const toast = document.createElement('div');
  toast.style.cursor = 'pointer';
  toast.style.position = 'fixed';
  toast.style.bottom = '10px';
  toast.style.left = '10px';
  toast.style.backgroundColor = '#333';
  toast.style.color = 'white';
  toast.style.padding = '10px';
  toast.style.borderRadius = '5px';
  toast.style.zIndex = '10001';
  toast.style.animationDuration = '1s';
  toast.innerHTML = `Click this to go to the original locale page.`;
  const style = document.createElement('style');
  style.innerHTML = `
.nav2yourlocale-fadeOut {
  animation-name: fadeOut;
}
@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
`;
  toast.appendChild(style);
  toast.addEventListener('click', () => {
    window.location.href = originalUrl;
  });
  document.body.addEventListener('click', () => {
    toast.classList.add('nav2yourlocale-fadeOut');
  });
  toast.addEventListener('animationend', () => {
    toast.remove();
  });
  document.body.appendChild(toast);
})();

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.type) {
    case contextMenus[1].id:
      const pattern = targetUrlPatterns.find(p => location.href.match(p));
      navigator.clipboard.writeText(location.href.replace(pattern, ''));
      break;
    case contextMenus[2].id:
      const pathPattern = window.prompt(
        'Enter the path pattern on this domain to exclude:',
        `^${location.href.replace(location.origin, '').replace(/([\/.?*+\[\]\(\)\\^$])/g, '\\$1')}$`
      );
      if (pathPattern) {
        const host = location.host;
        await chrome.runtime.sendMessage({ type: contextMenus[2].id, host, pattern: pathPattern });
      }
      break;
  }
});