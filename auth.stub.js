/**
 * 开源版：无云登录，直接进入桌面；账号相关功能在 app 内按 __xxjCloudAuthEnabled 关闭。
 * 克隆后复制为 auth.js：copy auth.stub.js auth.js
 */
window.__xxjCloudAuthEnabled = false;

(async () => {
  try {
    await window.XXJ_DB.ready;
  } catch (err) {
    console.error("XXJ_DB.ready failed:", err);
  }

  function unlockApp() {
    document.body.classList.remove("is-locked");
    document.body.classList.remove("activation-open");
    document.documentElement.classList.remove("xxj-oauth-return");
    if (location.hash === "#activation") {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  document.addEventListener("rp-open-auth-overlay", () => {
    unlockApp();
    if (typeof showToast === "function") {
      showToast("账号登录仅正式版可用");
    }
    window.dispatchEvent(new CustomEvent("rp-auth-changed"));
  });

  unlockApp();
  window.__xxjAuthBootPromise = Promise.resolve();
})();
