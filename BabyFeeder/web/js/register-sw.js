/**
 * 注册 Service Worker，支持离线缓存和 PWA 安装
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      console.log('SW 注册成功:', registration.scope);
    }).catch((error) => {
      console.log('SW 注册失败:', error);
    });
  });
}

// 检测是否以 standalone 模式运行（已安装到主屏幕）
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
  document.body.classList.add('pwa-mode');
}
