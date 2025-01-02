import { targetUrlPatterns, contextMenus } from '../common/const';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const originalUrl = await chrome.runtime.sendMessage({ type: 'getOriginalUrl' });
  if (!originalUrl) return;
  // show toast message that will fade out after 10 seconds
  const toast = document.createElement('div');
  toast.style.cssText = `
    cursor: pointer;
    position: fixed;
    bottom: 10px;
    left: 10px;
    background-color: #333;
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 10001;
  `;
  toast.innerHTML = `Click this to go to the original locale page.`;
  toast.addEventListener('click', () => {
    window.location.href = originalUrl;
  });
  document.body.appendChild(toast);
  await sleep(5000);
  // toast.style.cssText += `      animation: fadeOut 2s forwards;`;
  // await sleep(2000);
  toast.remove();
})();

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === contextMenus[1].id) {
    const pattern = targetUrlPatterns.find(p => location.href.match(p));
    navigator.clipboard.writeText(location.href.replace(pattern, ''));
  }
});