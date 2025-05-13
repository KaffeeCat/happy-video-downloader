// 插件内容脚本，负责注入navbar和按钮，监听视频变化
const NAVBAR_ID = 'rule34-downloader-navbar';

function createNavbar() {
  if (document.getElementById(NAVBAR_ID)) return;

  const navbar = document.createElement('div');
  navbar.id = NAVBAR_ID;
  navbar.innerHTML = `
    <button id="rule34-download-btn" disabled>
      <span style="margin-left:0;">Download</span>
    </button>
  `;
  document.body.appendChild(navbar);
}

function setButtonState(enabled, videoUrl = '') {
  const btn = document.getElementById('rule34-download-btn');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.background = enabled ? 'linear-gradient(90deg, #43e97b 0%, #18a9d7 100%)' : '#bdbdbd';
  btn.style.color = '#fff';
  btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  btn.dataset.videourl = videoUrl || '';
  btn.innerText = enabled ? 'Download' : 'No Video Found';
}

// rule34video.com 相关逻辑
function rule34_findVideoUrl() {
  // 1. 弹窗中的视频
  const popupVideo = document.querySelector('.popup-holder .fp-player video.fp-engine');
  if (popupVideo && popupVideo.src) return popupVideo.src;
  // 2. 页面上的视频
  const player = document.querySelector('.fp-player');
  if (!player) return '';
  const video = player.querySelector('video.fp-engine');
  return video ? video.src : '';
}

function rule34_updateButton() {
  const videoUrl = rule34_findVideoUrl();
  setButtonState(!!videoUrl, videoUrl);
}

let rule34DebounceTimer = null;
function debounceRule34UpdateButton() {
  clearTimeout(rule34DebounceTimer);
  rule34DebounceTimer = setTimeout(rule34_updateButton, 200); // 200ms内只触发一次
}

function rule34_observeDomChanges() {
  const observer = new MutationObserver(debounceRule34UpdateButton);
  observer.observe(document.body, { childList: true, subtree: true });
}

// javtiful.com 相关逻辑
function javtiful_findVideoUrl() {
  const hlsVideo = document.getElementById('hls-video');
  if (hlsVideo && hlsVideo.src && hlsVideo.src.startsWith('https://')) {
    return hlsVideo.src;
  }
  return '';
}

function javtiful_updateButton() {
  const videoUrl = javtiful_findVideoUrl();
  setButtonState(!!videoUrl, videoUrl);
}

function javtiful_observeDomChanges() {
  // 监听 #hls-video 的 src 属性变化
  const hlsVideo = document.getElementById('hls-video');
  if (hlsVideo) {
    const observer = new MutationObserver(() => {
      javtiful_updateButton();
    });
    observer.observe(hlsVideo, { attributes: true, attributeFilter: ['src'] });
  }
}

function javtiful_observeAndRemoveAd() {
  function removeJavtifulAdSection() {
    const adSection = document.querySelector('section.v3sb-box');
    if (adSection && adSection.querySelector('iframe#__clb-2004725_1_container')) {
      adSection.remove();
    }
  }
  removeJavtifulAdSection();
  const observer = new MutationObserver(() => {
    removeJavtifulAdSection();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// 公共逻辑
function setupDownloadHandler(findVideoUrlFn) {
  document.body.addEventListener('click', function (e) {
    const btn = e.target.closest('#rule34-download-btn');
    if (!btn || btn.disabled) return;
    const videoUrl = btn.dataset.videourl || findVideoUrlFn();
    if (videoUrl) {
      let filename = 'video.mp4';
      if (window.location.host.includes('javtiful.com')) {
        // 优先用 .video-title
        let title = document.querySelector('.video-title');
        if (title && title.textContent) {
          filename = title.textContent.trim().replace(/[\\/:*?"<>|]/g, '') + '.mp4';
        } else {
          // 兼容旧逻辑
          let fallback = document.querySelector('h1.title_video');
          if (fallback && fallback.textContent) {
            filename = fallback.textContent.trim().replace(/[\\/:*?"<>|]/g, '') + '.mp4';
          }
        }
      } else {
        // rule34video.com 逻辑
        let title = document.querySelector('h1.title_video');
        if (title && title.textContent) {
          filename = title.textContent.trim().replace(/[\\/:*?"<>|]/g, '') + '.mp4';
        }
      }
      try {
        chrome.runtime.sendMessage({ action: 'download', url: videoUrl, filename });
      } catch (err) {
        alert('插件环境失效，请刷新页面或重载插件后重试');
      }
    }
  });
}

let debounceTimer = null;
function debounceUpdateButton() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateButton, 200);
}

function injectStyles() {
  // 也可以用 styles.css 注入
  const style = document.createElement('style');
  style.textContent = `
    #${NAVBAR_ID} {
      position: fixed;
      top: 12px;
      right: 12px;
      left: auto;
      width: auto;
      z-index: 2147483647;
      background: rgba(128,128,128,0.92);
      padding: 8px 14px;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.13);
      border-radius: 8px;
      transition: box-shadow 0.2s;
    }
    #rule34-download-btn {
      border: none;
      outline: none;
      background: linear-gradient(90deg, #43e97b 0%, #38f9d7 100%);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      border-radius: 4px;
      padding: 8px 20px;
      display: flex;
      align-items: center;
      box-shadow: 0 1px 4px rgba(67,233,123,0.10);
      transition: background 0.2s, color 0.2s;
    }
    #rule34-download-btn:disabled {
      background: #bdbdbd;
      color: #fff;
      opacity: 0.7;
      box-shadow: none;
    }
  `;
  document.head.appendChild(style);
}

function blockJavtifulAdTabOpen() {
  // 1. 强制拦截 window.open，无论域名，全部返回 null
  try {
    Object.defineProperty(window, 'open', {
      configurable: false,
      enumerable: true,
      writable: false,
      value: function() { return null; }
    });
  } catch (e) {
    window.open = function() { return null; };
  }

  // 2. 拦截 window.location 跳转
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  window.location.assign = function(url) {
    if (url && typeof url === 'string' && !url.includes(window.location.host)) return;
    return originalAssign.apply(window.location, arguments);
  };
  window.location.replace = function(url) {
    if (url && typeof url === 'string' && !url.includes(window.location.host)) return;
    return originalReplace.apply(window.location, arguments);
  };

  // 3. 拦截 setTimeout 异步 open
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    if (typeof fn === 'function') {
      const wrapped = function() {
        try {
          window.open = function() { return null; };
        } catch(e){}
        return fn.apply(this, arguments);
      };
      return originalSetTimeout(wrapped, delay, ...args);
    }
    return originalSetTimeout(fn, delay, ...args);
  };

  // 4. 拦截所有 a[target=_blank] 的点击
  document.addEventListener('click', function(e) {
    const a = e.target.closest('a[target=\"_blank\"]');
    if (a && a.href && !a.href.includes(window.location.host)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);

  // 5. 拦截 postMessage
  window.addEventListener('message', function(e) {
    if (typeof e.data === 'string' && e.data.includes('open') && e.data.includes('http')) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  }, true);

  // 6. 拦截 iframe 跳转
  const observer = new MutationObserver(() => {
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        iframe.contentWindow.open = function() { return null; };
      } catch(e){}
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// 初始化
(function () {
  createNavbar();
  injectStyles();
  if (window.location.host.includes('rule34video.com')) {
    rule34_updateButton();
    setupDownloadHandler(rule34_findVideoUrl);
    rule34_observeDomChanges();
  } else if (window.location.host.includes('javtiful.com')) {
    javtiful_updateButton();
    setupDownloadHandler(javtiful_findVideoUrl);
    javtiful_observeDomChanges();
    javtiful_observeAndRemoveAd();
    blockJavtifulAdTabOpen(); // 只调用一次
  }
})(); 