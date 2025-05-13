// 负责处理下载请求
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'download' && msg.url) {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename || 'rule34video.mp4'
    });
  }
}); 