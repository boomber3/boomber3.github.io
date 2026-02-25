// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function () {
  // 获取弹窗和按钮元素
  const popup = document.getElementById('popup-announcement');
  const closeBtn = document.getElementById('popup-close');
  const confirmBtn = document.getElementById('popup-confirm');

  // 仅在首页显示弹窗
  if (popup && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
    popup.style.display = 'flex';
  }

  // 关闭弹窗的通用函数
  function closePopup() {
    if (popup) popup.style.display = 'none';
  }

  // 绑定关闭事件
  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (confirmBtn) confirmBtn.addEventListener('click', closePopup);
  
  // 点击遮罩层关闭弹窗
  if (popup) {
    popup.addEventListener('click', function (e) {
      if (e.target === popup) closePopup();
    });
  }
});