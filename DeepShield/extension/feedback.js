// feedback.js — Feedback History Page
// Reads submitted feedback directly from local storage and renders as cards.

class FeedbackManager {
  constructor() {
    this.feedbackList = document.getElementById("feedbackList");
    this.loading = document.getElementById("loading");
    this.emptyState = document.getElementById("emptyState");
    this.initTheme();
    this.loadFeedback();
  }

  async initTheme() {
    try {
      const { ds_settings } = await chrome.storage.local.get("ds_settings");
      const theme = ds_settings?.theme || "system";
      const resolved = theme === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;
      document.body.setAttribute("data-theme", resolved);
    } catch (_) {}
  }

  async loadFeedback() {
    this.loading.style.display = "block";
    this.feedbackList.innerHTML = "";

    try {
      const { ds_feedback = [] } = await chrome.storage.local.get("ds_feedback");
      this.loading.style.display = "none";

      if (ds_feedback.length === 0) {
        this.emptyState.style.display = "block";
        return;
      }

      this.emptyState.style.display = "none";
      const sorted = [...ds_feedback].sort(
        (a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
      );
      this.renderFeedback(sorted);
    } catch (e) {
      this.loading.textContent = "Error loading feedback.";
    }
  }

  renderFeedback(items) {
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "feedback-card";

      const stars = "⭐".repeat(Math.min(5, Math.max(0, item.rating || 0)));
      const rawDate = item.timestamp || item.createdAt || Date.now();
      const date = new Date(rawDate);
      const timestamp = date.toLocaleDateString() + " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const syncBadge = item.synced === false
        ? '<span class="pending-badge">Pending sync</span>'
        : '';

      card.innerHTML = `
        <div class="feedback-card-header">
          <span class="feedback-stars">${stars}</span>
          <span class="feedback-date">${timestamp}</span>
          ${syncBadge}
        </div>
        ${item.comment ? `<p class="feedback-comment">${this.escapeHtml(item.comment)}</p>` : ''}
        ${item.label ? `<span class="feedback-label">${item.label}</span>` : ''}
      `;

      this.feedbackList.appendChild(card);
    });
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

document.addEventListener("DOMContentLoaded", () => new FeedbackManager());
