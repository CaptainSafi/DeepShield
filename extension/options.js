// options.js — Settings / Options Page
// Manages user preferences, pro activation, analysis history,
// feedback history, and account sign-in from the options page.

class OptionsManager {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
    this.loadHistory();
    this.loadFeedback();
    this.loadSubscription();
    this.loadOptionsAuth();
    // Scroll to pro section if hash matches
    if (window.location.hash === "#pro") {
      setTimeout(() => document.getElementById("proSection")?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }

  initializeElements() {
    this.optScoreThreshold = document.getElementById("optScoreThreshold");
    this.optAnalysisMode = document.getElementById("optAnalysisMode");
    this.optTheme = document.getElementById("optTheme");
    this.optHighlightEnabled = document.getElementById("optHighlightEnabled");
    this.saveSettingsBtn = document.getElementById("saveSettingsBtn");

    this.historyList     = document.getElementById("historyList");
    this.feedbackList    = document.getElementById("feedbackList");
    this.feedbackLoading = document.getElementById("feedbackLoading");
    this.feedbackEmpty   = document.getElementById("feedbackEmptyState");
    this.clearFeedbackBtn= document.getElementById("clearFeedbackBtn");
    this.clearAllBtn = document.getElementById("clearAllBtn");
    this.loading = document.getElementById("loading");
    this.emptyState = document.getElementById("emptyState");

    // Pro section
    this.currentTierBadge = document.getElementById("currentTierBadge");
    this.proActiveMsg = document.getElementById("proActiveMsg");
    this.proActivationForm = document.getElementById("proActivationForm");
    this.licenseKeyInput = document.getElementById("licenseKeyInput");
    this.activateProBtn  = document.getElementById("activateProBtn");
    this.activationStatus = document.getElementById("activationStatus");
    // Auth elements in pro section
    this.optionsLoginForm     = document.getElementById("optionsLoginForm");
    this.optionsLoggedInRow   = document.getElementById("optionsLoggedInRow");
    this.optionsUserEmail     = document.getElementById("optionsUserEmail");
    this.optionsLoginEmail    = document.getElementById("optionsLoginEmail");
    this.optionsLoginPassword = document.getElementById("optionsLoginPassword");
    this.optionsLoginBtn      = document.getElementById("optionsLoginBtn");
    this.optionsRegisterBtn   = document.getElementById("optionsRegisterBtn");
    this.optionsLogoutBtn     = document.getElementById("optionsLogoutBtn");
    this.optionsAuthStatus    = document.getElementById("optionsAuthStatus");
  }

  // ─── Event Binding ────────────────────────────────────────────────────
  bindEvents() {
    this.saveSettingsBtn.addEventListener("click", () => this.saveSettings());
    this.clearAllBtn?.addEventListener("click", () => this.clearHistory());
    this.clearFeedbackBtn?.addEventListener("click", () => this.clearFeedback());
    this.activateProBtn.addEventListener("click", () => this.activatePro());
    this.optionsLoginBtn?.addEventListener("click", () => this.optionsLogin());
    this.optionsRegisterBtn?.addEventListener("click", () => this.optionsRegister());
    this.optionsLogoutBtn?.addEventListener("click", () => this.optionsLogout());
    [this.optionsLoginEmail, this.optionsLoginPassword].forEach(el =>
      el?.addEventListener("keydown", e => { if (e.key === "Enter") this.optionsLogin(); })
    );
  }

  // ─── Subscription / Pro ────────────────────────────────────────────
  async loadSubscription() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "getSubscription" });
      if (resp?.success && resp?.data) {
        const { tier, aiUsedToday, aiLimit } = resp.data;
        if (tier === "pro") {
          this.currentTierBadge.textContent = "Pro Plan";
          this.currentTierBadge.className = "tier-badge-options pro";
          this.proActiveMsg.style.display = "block";
          this.proActivationForm.style.display = "none";
        } else {
          this.currentTierBadge.textContent = `Free Plan · ${aiUsedToday || 0}/${aiLimit || 5} AI scans today`;
          this.currentTierBadge.className = "tier-badge-options free";
        }
      }
    } catch (e) { /* silent */ }
  }

  async activatePro() {
    if (!this.currentUser) {
      this.setActivationStatus("Please sign in first.", "error");
      return;
    }
    const key = this.licenseKeyInput.value.trim();
    if (!key) {
      this.setActivationStatus("Please enter a license key.", "error");
      return;
    }
    this.activateProBtn.disabled = true;
    this.setActivationStatus("Validating key...", "info");
    try {
      const resp = await chrome.runtime.sendMessage({ type: "activatePro", licenseKey: key });
      if (resp?.success) {
        this.setActivationStatus("✅ Pro activated! Enjoy unlimited scans.", "success");
        this.currentTierBadge.textContent = "Pro Plan";
        this.currentTierBadge.className = "tier-badge-options pro";
        this.proActiveMsg.style.display = "block";
        setTimeout(() => { this.proActivationForm.style.display = "none"; }, 2000);
      } else {
        this.setActivationStatus(resp?.error || "Invalid license key.", "error");
        this.activateProBtn.disabled = false;
      }
    } catch (e) {
      this.setActivationStatus("Could not connect to server.", "error");
      this.activateProBtn.disabled = false;
    }
  }

  setActivationStatus(msg, type) {
    this.activationStatus.textContent = msg;
    this.activationStatus.style.color = type === "success" ? "#27ae60" : type === "error" ? "#e74c3c" : "#667eea";
  }

  // ─── Settings ────────────────────────────────────────────────────────
  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "getUserSettings",
      });
      if (response?.success && response?.data) {
        const s = response.data;
        this.optScoreThreshold.value = s.scoreThreshold || 50;
        this.optAnalysisMode.value = s.analysisMode || "classic";
        this.optTheme.value = s.theme || "system";
        this.optHighlightEnabled.value = String(s.highlightEnabled !== false);
        this.applyTheme(s.theme);
      }
    } catch (e) {
      console.error("Load settings failed", e);
    }
  }

  applyTheme(theme) {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.body.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      document.body.setAttribute("data-theme", theme);
    }
  }

  async saveSettings() {
    this.saveSettingsBtn.textContent = "Saving...";
    try {
      const settings = {
        scoreThreshold: Number(this.optScoreThreshold.value),
        analysisMode: this.optAnalysisMode.value,
        theme: this.optTheme.value,
        highlightEnabled: this.optHighlightEnabled.value === "true",
      };
      await chrome.runtime.sendMessage({
        type: "updateUserSettings",
        settings,
      });
      this.applyTheme(settings.theme);
      this.saveSettingsBtn.textContent = "Saved! ✨";
      setTimeout(
        () => (this.saveSettingsBtn.textContent = "Save Preferences"),
        2000,
      );
    } catch (e) {
      this.saveSettingsBtn.textContent = "Error ❌";
    }
  }

  // ─── Analysis History ──────────────────────────────────────────────
  async loadHistory() {
    this.loading.style.display = "block";
    this.historyList.innerHTML = "";
    try {
      const { ds_history = [] } = await chrome.storage.local.get("ds_history");
      this.loading.style.display = "none";
      if (ds_history.length > 0) {
        this.emptyState.style.display = "none";
        this.renderHistory(ds_history);
      } else {
        this.emptyState.style.display = "block";
      }
    } catch (e) {
      this.loading.textContent = "Error loading history.";
    }
  }

  renderHistory(items) {
    items
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
      .forEach((item) => {
        const div = document.createElement("div");
        div.className = "history-item";

        const mode = item.analysis_mode || "Classic Analysis";
        const isAI = mode.includes("AI");
        const badgeClass = isAI ? "badge-ai" : "badge-classic";

        const score = item.score || 0;
        let scoreColor = "#27ae60";
        if (score >= 80) scoreColor = "#e74c3c";
        else if (score >= 50) scoreColor = "#f39c12";

        div.innerHTML = `
        <div class="history-main">
          <h3>${(item.analyzedText || item.analysisType || "Analysis").substring(0, 80)}${(item.analyzedText || "").length > 80 ? "..." : ""}</h3>
          <div class="history-meta">
            <span class="badge ${badgeClass}">${mode}</span>
            <span>📅 ${new Date(item.timestamp || item.createdAt).toLocaleDateString()} ${new Date(item.timestamp || item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span>📍 ${item.sourceUrl ? (() => { try { return new URL(item.sourceUrl).hostname; } catch(_) { return item.sourceUrl; } })() : "Manual Input"}</span>
          </div>
        </div>
        <div class="history-score">
          <div class="score-big" style="color: ${scoreColor}">${score}%</div>
          <div style="font-size: 10px; font-weight: 700; color: ${scoreColor}">${item.result?.label || "Unknown"}</div>
        </div>
      `;
        this.historyList.appendChild(div);
      });
  }

  async clearHistory() {
    if (confirm("Permanently delete all analysis records?")) {
      await chrome.storage.local.remove("ds_history");
      this.loadHistory();
    }
  }

  // ─── Feedback History ──────────────────────────────────────────────
  async loadFeedback() {
    if (this.feedbackLoading) this.feedbackLoading.style.display = "block";
    if (this.feedbackEmpty)   this.feedbackEmpty.style.display   = "none";
    if (this.feedbackList)    this.feedbackList.innerHTML = "";
    try {
      const { ds_feedback = [] } = await chrome.storage.local.get("ds_feedback");
      if (this.feedbackLoading) this.feedbackLoading.style.display = "none";
      if (ds_feedback.length === 0) {
        if (this.feedbackEmpty) this.feedbackEmpty.style.display = "block";
      } else {
        this.renderFeedback(ds_feedback);
      }
    } catch (e) {
      if (this.feedbackLoading) this.feedbackLoading.textContent = "Error loading feedback.";
    }
  }

  renderFeedback(items) {
    if (!this.feedbackList) return;
    items.forEach(item => {
      const stars = "★".repeat(item.rating || 0) + "☆".repeat(5 - (item.rating || 0));
      const labelColor = item.label === "helpful" ? "#27ae60" : item.label === "incorrect" ? "#e74c3c" : "#f39c12";
      const date = new Date(item.timestamp || Date.now());
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div class="history-main">
          <div class="history-type">Feedback</div>
          <div style="font-size:18px;color:#f1c40f;letter-spacing:2px;">${stars}</div>
          ${item.comment ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">"${item.comment}"</div>` : ""}
          <div class="history-meta">
            <span style="color:${labelColor};font-weight:600;">${item.label || "—"}</span>
            <span>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      `;
      this.feedbackList.appendChild(div);
    });
  }

  async clearFeedback() {
    if (confirm("Delete all feedback history?")) {
      await chrome.storage.local.remove("ds_feedback");
      this.loadFeedback();
    }
  }

  // ─── Account / Auth ──────────────────────────────────────────────
  async loadOptionsAuth() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "authGetMe" });
      if (resp?.success && resp?.data) {
        this.currentUser = resp.data;
      } else {
        this.currentUser = null;
      }
    } catch (_) { this.currentUser = null; }
    this.updateOptionsAuthUI();
  }

  updateOptionsAuthUI() {
    const loggedIn = !!this.currentUser;
    if (this.optionsLoggedInRow) this.optionsLoggedInRow.style.display = loggedIn ? "block" : "none";
    if (this.optionsLoginForm)   this.optionsLoginForm.style.display   = loggedIn ? "none"  : "block";
    if (this.optionsUserEmail)   this.optionsUserEmail.textContent     = this.currentUser?.email || "";
    // Disable activate button if not signed in
    if (this.activateProBtn) {
      this.activateProBtn.disabled = !loggedIn;
      this.activateProBtn.title = loggedIn ? "" : "Sign in first";
    }
    if (this.licenseKeyInput) this.licenseKeyInput.disabled = !loggedIn;
  }

  async optionsLogin() {
    const email = this.optionsLoginEmail?.value?.trim();
    const password = this.optionsLoginPassword?.value;
    if (!email || !password) { this._setAuthStatus("Enter email and password.", "error"); return; }
    if (this.optionsLoginBtn) { this.optionsLoginBtn.disabled = true; this.optionsLoginBtn.textContent = "Signing in…"; }
    this._setAuthStatus("", "");
    try {
      const resp = await chrome.runtime.sendMessage({ type: "authLogin", email, password });
      if (resp?.success) {
        this.currentUser = resp.data;
        this.updateOptionsAuthUI();
        this._setAuthStatus("✓ Signed in as " + email, "success");
      } else {
        this._setAuthStatus(resp?.error || "Sign in failed.", "error");
      }
    } catch (_) { this._setAuthStatus("Connection error.", "error"); }
    finally { if (this.optionsLoginBtn) { this.optionsLoginBtn.disabled = false; this.optionsLoginBtn.textContent = "Sign In"; } }
  }

  async optionsRegister() {
    const email = this.optionsLoginEmail?.value?.trim();
    const password = this.optionsLoginPassword?.value;
    if (!email || !password) { this._setAuthStatus("Enter email and password.", "error"); return; }
    if (this.optionsRegisterBtn) { this.optionsRegisterBtn.disabled = true; this.optionsRegisterBtn.textContent = "Creating…"; }
    this._setAuthStatus("", "");
    try {
      const resp = await chrome.runtime.sendMessage({ type: "authRegister", email, password });
      if (resp?.success) {
        this.currentUser = resp.data;
        this.updateOptionsAuthUI();
        this._setAuthStatus("✓ Account created! You can now activate Pro.", "success");
      } else {
        this._setAuthStatus(resp?.error || "Registration failed.", "error");
      }
    } catch (_) { this._setAuthStatus("Connection error.", "error"); }
    finally { if (this.optionsRegisterBtn) { this.optionsRegisterBtn.disabled = false; this.optionsRegisterBtn.textContent = "Register"; } }
  }

  async optionsLogout() {
    try { await chrome.runtime.sendMessage({ type: "authLogout" }); } catch (_) {}
    this.currentUser = null;
    await chrome.storage.local.remove("ds_pro_activated");
    this.updateOptionsAuthUI();
    this._setAuthStatus("Signed out.", "info");
  }

  _setAuthStatus(msg, type) {
    if (!this.optionsAuthStatus) return;
    this.optionsAuthStatus.textContent = msg;
    this.optionsAuthStatus.style.color = type === "success" ? "#27ae60" : type === "error" ? "#e74c3c" : "#667eea";
  }
}

document.addEventListener("DOMContentLoaded", () => new OptionsManager());
