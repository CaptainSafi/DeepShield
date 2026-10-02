// history-back.js — back button handler for history.html
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("backBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      chrome.action.openPopup().catch(() => window.close());
    });
  }
});
