// history.js — Analysis History Page
// Reads analysis history directly from local storage and renders as cards.

class HistoryManager {
  constructor() {
    this.historyList = document.getElementById("historyList");
    this.loading     = document.getElementById("loading");
    this.emptyState  = document.getElementById("emptyState");
    document.getElementById("clearAllBtn").addEventListener("click", () => this.clearAll());
    this.initTheme();
    this.loadHistory();
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

  async loadHistory() {
    this.loading.style.display = "block";
    this.historyList.innerHTML = "";
    try {
      const { ds_history = [] } = await chrome.storage.local.get("ds_history");
      this.loading.style.display = "none";
      if (ds_history.length === 0) {
        this.emptyState.style.display = "block";
        return;
      }
      this.emptyState.style.display = "none";
      const sorted = [...ds_history].sort(
        (a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
      );
      this.renderHistory(sorted);
    } catch (e) {
      this.loading.textContent = "Error loading history.";
    }
  }

  renderHistory(items) {
    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";

      const mode = item.analysis_mode || item.analysisType || "Classic";
      const badgeClass = mode.toLowerCase().includes("ai") ? "badge-ai"
                       : mode.toLowerCase().includes("image") ? "badge-image"
                       : mode.toLowerCase().includes("video") ? "badge-video"
                       : "badge-classic";

      const score = item.score ?? 0;
      const scoreColor = score >= 75 ? "#e74c3c" : score >= 40 ? "#f39c12" : "#27ae60";

      const rawDate = item.timestamp || item.createdAt || Date.now();
      const date = new Date(rawDate);
      const dateStr = date.toLocaleDateString() + " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      let source = "Manual Input";
      if (item.sourceUrl) {
        try { source = new URL(item.sourceUrl).hostname; }
        catch (_) { source = item.sourceUrl; }
      }

      const title = (item.analyzedText || item.analysisType || "Analysis").substring(0, 90);
      const truncated = (item.analyzedText || "").length > 90 ? "…" : "";
      const label = item.result?.label || item.label || "";

      div.innerHTML = `
        <div class="history-main">
          <h3>${this.escapeHtml(title)}${truncated}</h3>
          <div class="history-meta">
            <span class="badge ${badgeClass}">${this.escapeHtml(mode)}</span>
            <span>📅 ${dateStr}</span>
            <span>📍 ${this.escapeHtml(source)}</span>
          </div>
        </div>
        <div class="history-score">
          <div class="score-big" style="color:${scoreColor}">${score}%</div>
          ${label ? `<div class="score-label" style="color:${scoreColor}">${this.escapeHtml(label)}</div>` : ""}
        </div>
      `;
      this.historyList.appendChild(div);
    });
  }

  async clearAll() {
    if (!confirm("Permanently delete all analysis history?")) return;
    await chrome.storage.local.remove("ds_history");
    this.loadHistory();
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

document.addEventListener("DOMContentLoaded", () => new HistoryManager());
