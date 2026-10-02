// popup.js — Extension Popup
// Main UI controller: handles mode switching, analysis, results display,
// subscription state, auth flow, paywall, feedback, and history.

class AIDetectorPopup {
  constructor() {
    this.currentSettings = {
      highlightEnabled: true,
      scoreThreshold: 35,
      analysisMode: "classic",
    };
    this.latestAnalysisId = null;
    this.currentAbortController = null;
    this.activeInputMode = "text";
    this.uploadedImageBase64 = null;
    this.uploadedImageName = "";
    this.uploadedVideoBase64 = null;
    this.uploadedVideoName = "";
    this.subscriptionData = { tier: "free", tokensUsed: 0, tokenLimit: 100, canUseAI: true };
    this.currentUser = null;
    this.accountMenuOpen = false;

    this.initializeElements();
    this.bindEvents();
    this.setInputMode("text");
    // Wait for all async init before checking pending media
    // so applySettingsToUI / loadSubscription can't resetAnalysisUI after results are shown
    Promise.all([
      this.loadSettings(),
      this.loadSubscription(),
      this.loadAuthState(),
      this.loadTokenUsage(),
    ]).then(() => this.checkPendingMedia()).catch(() => this.checkPendingMedia());
  }

  initializeElements() {
    // Navigation
    this.viewHistoryBtn = document.getElementById("viewHistoryBtn");
    this.openOptionsBtn = document.getElementById("openOptionsBtn");
    this.viewFeedbackBtn = document.getElementById("viewFeedbackBtn");
    this.detectVideoBtn = document.getElementById("detectVideoBtn");

    // Input
    this.textInput = document.getElementById("textInput");
    this.analyzeBtn = document.getElementById("analyzeBtn");
    this.autoDetectBtn = document.getElementById("autoDetectBtn");
    this.detectImagesBtn = document.getElementById("detectImagesBtn");
    this.scanPageBtn = document.getElementById("scanPageBtn");

    // Upload Containers
    this.imageUploadContainer = document.getElementById("imageUploadContainer");
    this.imageFileInput = document.getElementById("imageFileInput");
    this.imageDropZone = document.getElementById("imageDropZone");
    this.imagePreviewContainer = document.getElementById("imagePreviewContainer");
    this.imagePreview = document.getElementById("imagePreview");
    this.removeImageBtn = document.getElementById("removeImageBtn");

    this.videoUploadContainer = document.getElementById("videoUploadContainer");
    this.videoFileInput = document.getElementById("videoFileInput");
    this.videoDropZone = document.getElementById("videoDropZone");
    this.videoPreviewContainer = document.getElementById("videoPreviewContainer");
    this.videoPreview = document.getElementById("videoPreview");
    this.removeVideoBtn = document.getElementById("removeVideoBtn");

    // Mode Selector
    this.modeClassic = document.getElementById("modeClassic");
    this.modeAI = document.getElementById("modeAI");
    this.analysisModeSelect = document.getElementById("analysisMode");

    // Settings
    this.scoreThresholdInput = document.getElementById("scoreThreshold");
    this.thresholdValue = document.getElementById("thresholdValue");
    this.thresholdRow = document.getElementById("thresholdRow");
    this.highlightEnabledInput = document.getElementById("highlightEnabled");
    this.themeSelect = document.getElementById("themeSelect");

    // Results
    this.resultsSection = document.getElementById("resultsSection");
    this.scoreCircle = document.getElementById("scoreCircle");
    this.scoreValue = document.getElementById("scoreValue");
    this.aiLabel = document.getElementById("aiLabel");
    this.confidenceLabel = document.getElementById("confidenceLabel");
    this.sourceBadgeContainer = document.getElementById("sourceBadgeContainer");
    this.resultTimestamp = document.getElementById("resultTimestamp");
    this.analysisDetails = document.getElementById("analysisDetails");

    // Feedback
    this.feedbackRating = document.getElementById("feedbackRating");
    this.feedbackComment = document.getElementById("feedbackComment");
    this.submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
    this.feedbackStatus = document.getElementById("feedbackStatus");

    // Subscription
    this.subscriptionBar = document.getElementById("subscriptionBar");
    this.tierBadge = document.getElementById("tierBadge");
    this.usageTrackFill = document.getElementById("usageTrackFill");
    this.usageTrack = this.usageTrackFill?.closest(".usage-track-wrapper");
    this.usageText = document.getElementById("usageText");
    this.upgradeBtn = document.getElementById("upgradeBtn");
    this.upgradePrompt = document.getElementById("upgradePrompt");
    this.upgradePromptBtn = document.getElementById("upgradePromptBtn");

    this.settingsToggle = document.getElementById("settingsToggle");
    this.settingsPanel = document.getElementById("settingsPanel");

    this.status = document.getElementById("status");

    // OCR
    this.ocrUploadBtn = document.getElementById("ocrUploadBtn");
    this.ocrFileInput = document.getElementById("ocrFileInput");
    this.textActionsRow = document.querySelector(".text-actions-row");

    // Auth Nav
    this.loginNavBtn = document.getElementById("loginNavBtn");
    this.accountBtn = document.getElementById("accountBtn");
    this.accountMenu = document.getElementById("accountMenu");
    this.accountMenuEmail = document.getElementById("accountMenuEmail");
    this.accountMenuPlan = document.getElementById("accountMenuPlan");
    this.accountMenuUpgradeBtn = document.getElementById("accountMenuUpgradeBtn");
    this.accountMenuLogoutBtn = document.getElementById("accountMenuLogoutBtn");

    // Auth Modal
    this.authModal = document.getElementById("authModal");
    this.authModalClose = document.getElementById("authModalClose");
    this.authModalReason = document.getElementById("authModalReason");
    this.tabLogin = document.getElementById("tabLogin");
    this.tabRegister = document.getElementById("tabRegister");
    this.authLoginForm = document.getElementById("authLoginForm");
    this.authRegisterForm = document.getElementById("authRegisterForm");
    this.loginEmail = document.getElementById("loginEmail");
    this.loginPassword = document.getElementById("loginPassword");
    this.loginSubmitBtn = document.getElementById("loginSubmitBtn");
    this.loginStatus = document.getElementById("loginStatus");
    this.registerEmail = document.getElementById("registerEmail");
    this.registerPassword = document.getElementById("registerPassword");
    this.registerSubmitBtn = document.getElementById("registerSubmitBtn");
    this.registerStatus = document.getElementById("registerStatus");

    // Paywall Modal
    this.paywallModal          = document.getElementById("paywallModal");
    this.paywallModalClose     = document.getElementById("paywallModalClose");
    this.paywallUpgradeFlow    = document.getElementById("paywallUpgradeFlow");
    this.paywallLimitFlow      = document.getElementById("paywallLimitFlow");
    this.paywallMessage        = document.getElementById("paywallMessage");
    this.paywallAuthSection    = document.getElementById("paywallAuthSection");
    // Upgrade-flow inputs
    this.paywallLicenseInput   = document.getElementById("paywallLicenseInput");
    this.paywallActivateBtn    = document.getElementById("paywallActivateBtn");
    this.paywallActivateStatus = document.getElementById("paywallActivateStatus");
    // Limit-flow inputs (second set)
    this.paywallLicenseInput2   = document.getElementById("paywallLicenseInput2");
    this.paywallActivateBtn2    = document.getElementById("paywallActivateBtn2");
    this.paywallActivateStatus2 = document.getElementById("paywallActivateStatus2");
    // Auth links
    this.paywallLoginNote       = document.getElementById("paywallLoginNote");
    this.paywallLoginBtn        = document.getElementById("paywallLoginBtn");
    this.paywallCreateAccountBtn= document.getElementById("paywallCreateAccountBtn");
    this.paywallSignInBtn       = document.getElementById("paywallSignInBtn");

    // Highlight panel
    this.highlightPanel = document.getElementById("highlightPanel");
    this.highlightedText = document.getElementById("highlightedText");
  }

  bindEvents() {
    // Safe addEventListener helper — skips silently if element is null
    const on = (el, event, handler) => { if (el) el.addEventListener(event, handler); };

    on(this.analyzeBtn, "click", () => this.handleAnalyzeClick());

    // Tab switching
    on(this.autoDetectBtn,   "click", () => this.setInputMode("text"));
    on(this.detectImagesBtn, "click", () => this.setInputMode("image"));
    on(this.detectVideoBtn,  "click", () => this.setInputMode("video"));
    on(this.scanPageBtn,     "click", () => this.autoDetect());

    // Image upload
    on(this.imageDropZone,  "click",    () => this.imageFileInput.click());
    on(this.imageFileInput, "change",   (e) => this.handleImageFileSelect(e.target.files[0]));
    on(this.removeImageBtn, "click",    (e) => { e.stopPropagation(); this.clearUploadedImage(); });
    on(this.imageDropZone,  "dragover", (e) => { e.preventDefault(); this.imageDropZone.classList.add("dragover"); });
    on(this.imageDropZone,  "dragleave",() => this.imageDropZone.classList.remove("dragover"));
    on(this.imageDropZone,  "drop",     (e) => {
      e.preventDefault();
      this.imageDropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) this.handleImageFileSelect(e.dataTransfer.files[0]);
    });

    // Video upload
    on(this.videoDropZone,  "click",    () => this.videoFileInput.click());
    on(this.videoFileInput, "change",   (e) => this.handleVideoFileSelect(e.target.files[0]));
    on(this.removeVideoBtn, "click",    (e) => { e.stopPropagation(); this.clearUploadedVideo(); });
    on(this.videoDropZone,  "dragover", (e) => { e.preventDefault(); this.videoDropZone.classList.add("dragover"); });
    on(this.videoDropZone,  "dragleave",() => this.videoDropZone.classList.remove("dragover"));
    on(this.videoDropZone,  "drop",     (e) => {
      e.preventDefault();
      this.videoDropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) this.handleVideoFileSelect(e.dataTransfer.files[0]);
    });

    // Navigation
    on(this.viewHistoryBtn, "click", () => chrome.tabs.create({ url: "history.html" }));
    on(this.openOptionsBtn, "click", () => chrome.tabs.create({ url: "options.html#settings" }));
    on(this.viewFeedbackBtn,"click", () => chrome.tabs.create({ url: "feedback.html" }));

    // Mode toggle
    on(this.modeClassic, "click", () => this.setMode("classic"));
    on(this.modeAI,      "click", () => this.handleAIModeClick());

    // Settings
    on(this.scoreThresholdInput, "input", () => {
      this.thresholdValue.textContent = `${this.scoreThresholdInput.value}%`;
      this.saveSettings();
    });
    on(this.highlightEnabledInput, "change", () => this.saveSettings());
    on(this.themeSelect, "change", () => {
      this.applyTheme(this.themeSelect.value);
      this.saveSettings();
    });
    on(this.textInput, "input", () => this.updateAnalyzeButtonState());

    // Feedback
    on(this.feedbackRating,    "click", (e) => {
      if (e.target.tagName === "SPAN") this.updateStarRating(e.target.dataset.value);
    });
    on(this.submitFeedbackBtn, "click", () => this.submitFeedback());

    // Subscription upgrade buttons
    on(this.upgradeBtn,       "click", () => this.showPaywallModal("Upgrade to Pro for unlimited scans.", "upgrade"));
    on(this.upgradePromptBtn, "click", () => this.showPaywallModal("Upgrade to Pro for unlimited scans.", "upgrade"));

    // Settings collapsible
    on(this.settingsToggle, "click", () => {
      const isOpen = this.settingsPanel.style.display !== "none";
      this.settingsPanel.style.display = isOpen ? "none" : "block";
      this.settingsToggle.classList.toggle("open", !isOpen);
    });

    // OCR
    on(this.ocrUploadBtn, "click",  () => this.ocrFileInput && this.ocrFileInput.click());
    on(this.ocrFileInput, "change", (e) => { if (e.target.files[0]) this.handleOcrUpload(e.target.files[0]); });

    // Auth nav
    on(this.loginNavBtn, "click", () => this.openAuthModal());
    on(this.accountBtn,  "click", (e) => { e.stopPropagation(); this.toggleAccountMenu(); });
    document.addEventListener("click", () => this.closeAccountMenu());

    // Account menu
    on(this.accountMenuLogoutBtn,  "click", () => this.handleLogout());
    on(this.accountMenuUpgradeBtn, "click", () => {
      this.closeAccountMenu();
      this.showPaywallModal("Upgrade to Pro for unlimited scans.", "upgrade");
    });

    // Auth modal
    on(this.authModalClose, "click", () => this.closeAuthModal());
    on(this.authModal,      "click", (e) => { if (e.target === this.authModal) this.closeAuthModal(); });
    on(this.tabLogin,       "click", () => this.switchAuthTab("login"));
    on(this.tabRegister,    "click", () => this.switchAuthTab("register"));
    on(this.loginSubmitBtn,    "click", () => this.handleLogin());
    on(this.registerSubmitBtn, "click", () => this.handleRegister());
    [this.loginEmail, this.loginPassword].filter(Boolean).forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") this.handleLogin(); })
    );
    [this.registerEmail, this.registerPassword].filter(Boolean).forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") this.handleRegister(); })
    );

    // Paywall modal — shared close
    on(this.paywallModalClose, "click", () => this.closePaywallModal());
    on(this.paywallModal, "click", (e) => { if (e.target === this.paywallModal) this.closePaywallModal(); });
    // Upgrade-flow activate
    on(this.paywallActivateBtn,  "click",   () => this.handlePaywallActivate("upgrade"));
    on(this.paywallLicenseInput, "keydown", (e) => { if (e.key === "Enter") this.handlePaywallActivate("upgrade"); });
    // Limit-flow activate (second input)
    on(this.paywallActivateBtn2,  "click",   () => this.handlePaywallActivate("limit"));
    on(this.paywallLicenseInput2, "keydown", (e) => { if (e.key === "Enter") this.handlePaywallActivate("limit"); });
    // Gate sign-in buttons
    on(this.paywallGateSignInBtn,    "click", () => { this.closePaywallModal(); this._pendingPaywall = "upgrade"; this.openAuthModal("Sign in to activate your Pro license.", "login"); });
    // Open settings page buttons
    on(document.getElementById("paywallOpenSettingsBtn"),  "click", () => { this.closePaywallModal(); chrome.tabs.create({ url: "options.html#pro" }); });
    on(document.getElementById("paywallOpenSettingsBtn2"), "click", () => { this.closePaywallModal(); chrome.tabs.create({ url: "options.html#pro" }); });
    on(this.paywallGateSignInBtn2,   "click", () => { this.closePaywallModal(); this._pendingPaywall = "limit";   this.openAuthModal("Sign in to activate your Pro license.", "login"); });
    on(this.paywallGateRegisterBtn,  "click", () => { this.closePaywallModal(); this._pendingPaywall = "upgrade"; this.openAuthModal("Create an account to activate Pro.", "register"); });
    on(this.paywallGateRegisterBtn2, "click", () => { this.closePaywallModal(); this._pendingPaywall = "limit";   this.openAuthModal("Create an account to activate Pro.", "register"); });
    // Auth links inside limit flow
    on(this.paywallCreateAccountBtn, "click", () => {
      this.closePaywallModal();
      this.openAuthModal("Create a free account to continue scanning.", "register");
    });
    on(this.paywallSignInBtn, "click", () => {
      this.closePaywallModal();
      this.openAuthModal("Sign in to continue scanning.", "login");
    });
    on(this.paywallLoginBtn, "click", () => {
      this.closePaywallModal();
      this.openAuthModal("Sign in to your account.", "login");
    });
  }

  // ─── Pending Media (queued from page badge/drag/video button) ────────────

  async checkPendingMedia() {
    try {
      const result = await chrome.storage.local.get(["ds_pending_media"]);
      const pending = result.ds_pending_media;
      if (!pending) return;

      // Stale if older than 60 seconds
      if (Date.now() - (pending.ts || 0) > 60000) {
        await chrome.storage.local.remove(["ds_pending_media"]);
        return;
      }

      await chrome.storage.local.remove(["ds_pending_media"]);
      chrome.runtime.sendMessage({ type: "clearMediaBadge" }).catch(() => {});

      if (pending.type === "image" && pending.dataUrl) {
        // Fully fetched image — load exactly like a local file upload
        this.uploadedImageBase64 = pending.dataUrl;
        this.uploadedImageName   = pending.filename || "image.jpg";
        this.setInputMode("image");
        this.imagePreview.src = pending.dataUrl;
        this.imageDropZone.style.display = "none";
        this.imagePreviewContainer.style.display = "flex";
        this.updateAnalyzeButtonState();
        this.showStatus(`Image from page loaded — analyzing…`);
        setTimeout(() => this.analyzeUploadedImage(), 300);

      } else if (pending.type === "image_url" && pending.src) {
        // Couldn't fetch in content script — let background fetch with extension permissions
        this.setInputMode("image");
        this.showStatus("Loading image from page…");
        this.setLoading(true);
        chrome.runtime.sendMessage({ type: "analyzePageImage", src: pending.src }, (res) => {
          this.setLoading(false);
          if (res && res.success) {
            this.displayResults({ ...res, processingTime: 0 });
            const cost = res.fromCache ? 0 : this.deductTokens("image");
            this.showStatus(res.fromCache ? "Cached result · no tokens used" : `Scan complete · used ${cost} tokens`);
          } else {
            this.showError((res && res.error) || "Failed to load image");
          }
        });

      } else if (pending.type === "video_url" && pending.src) {
        // Video from page — fetch and analyze via background
        this.setInputMode("video");
        this.showStatus("Fetching video from page…");
        this.setLoading(true);
        chrome.runtime.sendMessage({ type: "analyzePageVideo", src: pending.src }, (res) => {
          this.setLoading(false);
          if (res && res.success) {
            this.displayResults({ ...res, processingTime: 0 });
            const cost = res.fromCache ? 0 : this.deductTokens("video");
            this.showStatus(res.fromCache ? "Cached result · no tokens used" : `Scan complete · used ${cost} tokens`);
          } else {
            this.showError((res && res.error) || "Failed to load video");
          }
        });

      } else if (pending.type === "video_frames_result" && pending.result) {
        // Frame-sampled result -- show exactly like a local video upload
        const r = pending.result;
        this.setInputMode("video");
        const aiScore  = r.aiScore || 0;
        const humanPct = 100 - aiScore;
        const label    = aiScore >= 65 ? "Likely Deepfake" : aiScore >= 40 ? "Uncertain" : "Likely Real";
        const resultData = {
          success: true, score: aiScore, confidence: aiScore, source: "ai_model", label,
          reasoning: label + " · " + humanPct + "% real · " + (r.framesAnalyzed || "?") + " frames sampled",
          processingTime: r.processingTime || 0,
          frameScores: r.frameScores || [],
        };
        this.displayResults(resultData);
        const cost = this.deductTokens("video");
        this.showStatus("Video scan complete · used " + cost + " tokens");
        // Save to history
        try {
          const id = "h-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
          this.latestAnalysisId = id;
          const entry = { id, analysisType: "video", sourceUrl: "Page Video",
            analyzedText: "Video frame analysis: " + label, score: aiScore,
            analysis_mode: "AI Insight Engine (Video Frames)", timestamp: new Date().toISOString() };
          const { ds_history = [] } = await chrome.storage.local.get("ds_history");
          ds_history.unshift(entry); if (ds_history.length > 100) ds_history.splice(100);
          await chrome.storage.local.set({ ds_history });
        } catch (_) {}
      }
    } catch (e) {
      // Non-critical — silently ignore
    }
  }

  // ─── Subscription ─────────────────────────────────────────────────────────

  async loadSubscription() {
    // Check local pro activation first (works offline)
    try {
      const local = await chrome.storage.local.get(["ds_pro_activated"]);
      if (local.ds_pro_activated) {
        this.subscriptionData.tier = "pro";
        this.subscriptionData.tokenLimit = 2000;
        this.subscriptionData.canUseAI = true;
        this.updateSubscriptionUI();
        this.updateAuthUI();
      }
    } catch (_) {}
    // Try server for live subscription data (non-blocking)
    try {
      const resp = await chrome.runtime.sendMessage({ type: "getSubscription" });
      if (resp && resp.success && resp.data) {
        const d = resp.data;
        this.subscriptionData = {
          ...this.subscriptionData,
          tier: d.tier ?? this.subscriptionData.tier,
          canUseAI: d.canUseAI ?? this.subscriptionData.canUseAI,
          ...(d.tokensUsed != null ? { tokensUsed: d.tokensUsed } : {}),
          ...(d.tokenLimit != null ? { tokenLimit: d.tokenLimit } : {}),
        };
        if (d.tier === "pro") await chrome.storage.local.set({ ds_pro_activated: true });
        this.updateSubscriptionUI();
        this.updateAuthUI();
      }
    } catch (e) {
      // Server unreachable — local state already applied above
    }
  }

  // Token costs — must match background.js calculateTokenCost()
  static tokenCost(type, wordCount = 0) {
    switch (type) {
      case "text_classic": return Math.max(1, Math.ceil(wordCount / 150));
      case "text_ai":      return Math.max(3, Math.ceil(wordCount / 75));
      case "ocr":          return 3;
      case "image":        return 10;
      case "video":        return 25;
      default:             return 1;
    }
  }

  updateSubscriptionUI() {
    const { tier, tokensUsed, tokenLimit, aiUsedToday, aiLimit, canUseAI } = this.subscriptionData;
    const isPro = tier === "pro";
    const used  = tokensUsed ?? aiUsedToday ?? 0;
    // tokenLimit comes from local subscriptionData; ignore legacy aiLimit (old scan count)
    const limit = tokenLimit ?? (isPro ? 2000 : 100);

    this.subscriptionBar.style.display = "flex";
    this.tierBadge.textContent = isPro ? "PRO" : "FREE";
    this.tierBadge.className   = `tier-badge ${isPro ? "pro" : "free"}`;

    if (isPro) {
      // Pro: unlimited scans — hide track bar and all upgrade prompts
      this.usageText.textContent = "✓ Pro — Unlimited scans";
      if (this.usageTrack)    this.usageTrack.style.display    = "none";
      if (this.upgradeBtn)    this.upgradeBtn.style.display    = "none";
      if (this.upgradePrompt) this.upgradePrompt.style.display = "none";
      if (this.modeAI) this.modeAI.classList.remove("locked");
    } else {
      if (this.usageTrack) this.usageTrack.style.display = "";
      const pct = Math.min((used / limit) * 100, 100);
      this.usageText.textContent      = `${used} / ${limit} tokens`;
      this.usageTrackFill.style.width = `${pct}%`;
      this.usageTrackFill.className   = `usage-fill${pct >= 100 ? " full" : pct >= 70 ? " warning" : ""}`;
      if (this.upgradeBtn) this.upgradeBtn.style.display = pct >= 75 ? "block" : "none";

      // Lock AI mode if out of tokens
      const locked = !canUseAI;
      if (this.modeAI) this.modeAI.classList.toggle("locked", locked);
      if (this.upgradePrompt) this.upgradePrompt.style.display = locked ? "flex" : "none";
      if (locked && this.currentSettings.analysisMode === "ai") this.setMode("classic", false);
    }
  }

  // Call after any scan to deduct tokens locally and show cost in status bar
  deductTokens(type, wordCount = 0) {
    const cost = AIDetectorPopup.tokenCost(type, wordCount);
    if (this.subscriptionData.tier === "pro") return cost; // pro: unlimited, no deduction
    this.subscriptionData.tokensUsed = (this.subscriptionData.tokensUsed || 0) + cost;
    this.subscriptionData.aiUsedToday = this.subscriptionData.tokensUsed;
    this.updateSubscriptionUI();
    chrome.storage.local.set({
      ds_token_usage: { tokensUsed: this.subscriptionData.tokensUsed, date: new Date().toDateString() }
    });
    return cost;
  }

  async loadTokenUsage() {
    try {
      const result = await chrome.storage.local.get(["ds_token_usage"]);
      const saved = result.ds_token_usage;
      if (saved && saved.date === new Date().toDateString()) {
        this.subscriptionData.tokensUsed  = saved.tokensUsed || 0;
        this.subscriptionData.aiUsedToday = saved.tokensUsed || 0;
        this.updateSubscriptionUI();
      }
      // Different day → leave tokensUsed at 0 (fresh daily allowance)
    } catch (e) { /* non-critical */ }
  }

  handleAIModeClick() {
    if (!this.subscriptionData.canUseAI && this.subscriptionData.tier !== "pro") {
      this.upgradePrompt.style.display = "flex";
      return;
    }
    this.setMode("ai");
  }

  // ─── Input Mode ───────────────────────────────────────────────────────────

  setInputMode(mode) {
    this.activeInputMode = mode;
    this.resetAnalysisUI();

    this.autoDetectBtn.classList.toggle("active", mode === "text");
    this.detectImagesBtn.classList.toggle("active", mode === "image");
    this.detectVideoBtn.classList.toggle("active", mode === "video");

    this.textInput.style.display = mode === "text" ? "block" : "none";
    if (this.textActionsRow) this.textActionsRow.style.display = mode === "text" ? "flex" : "none";
    this.imageUploadContainer.style.display = mode === "image" ? "flex" : "none";
    this.videoUploadContainer.style.display = mode === "video" ? "flex" : "none";

    this.thresholdRow.style.display =
      mode === "text" && this.currentSettings.analysisMode === "classic" ? "block" : "none";

    this.updateAnalyzeButtonState();
  }

  updateAnalyzeButtonState() {
    if (this.activeInputMode === "text") {
      this.analyzeBtn.disabled = !this.textInput.value.trim();
    } else if (this.activeInputMode === "image") {
      this.analyzeBtn.disabled = !this.uploadedImageBase64;
    } else if (this.activeInputMode === "video") {
      this.analyzeBtn.disabled = !this.uploadedVideoBase64;
    }
  }

  // ─── File Handling ────────────────────────────────────────────────────────

  handleImageFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { this.showError("Please select an image file."); return; }
    this.uploadedImageName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.uploadedImageBase64 = reader.result;
      this.imagePreview.src = reader.result;
      this.imageDropZone.style.display = "none";
      this.imagePreviewContainer.style.display = "flex";
      this.updateAnalyzeButtonState();
      this.showStatus(`"${file.name}" loaded.`);
    };
    reader.readAsDataURL(file);
  }

  clearUploadedImage() {
    this.uploadedImageBase64 = null;
    this.uploadedImageName = "";
    this.imagePreview.src = "";
    this.imagePreviewContainer.style.display = "none";
    this.imageDropZone.style.display = "flex";
    this.imageFileInput.value = "";
    this.updateAnalyzeButtonState();
    this.showStatus("");
  }

  handleVideoFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith("video/")) { this.showError("Please select a video file."); return; }
    this.uploadedVideoName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.uploadedVideoBase64 = reader.result;
      this.videoPreview.src = reader.result;
      this.videoDropZone.style.display = "none";
      this.videoPreviewContainer.style.display = "flex";
      this.updateAnalyzeButtonState();
      this.showStatus(`"${file.name}" loaded.`);
    };
    reader.readAsDataURL(file);
  }

  clearUploadedVideo() {
    this.uploadedVideoBase64 = null;
    this.uploadedVideoName = "";
    this.videoPreview.src = "";
    this.videoPreviewContainer.style.display = "none";
    this.videoDropZone.style.display = "flex";
    this.videoFileInput.value = "";
    this.updateAnalyzeButtonState();
    this.showStatus("");
  }

  // ─── Analysis ─────────────────────────────────────────────────────────────

  handleAnalyzeClick() {
    if (this.activeInputMode === "text") this.analyzeText();
    else if (this.activeInputMode === "image") this.analyzeUploadedImage();
    else if (this.activeInputMode === "video") this.analyzeUploadedVideo();
  }

  async autoDetect() {
    this.setLoading(true);
    this.showStatus("Extracting text from page...");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Block pages where scripting is never allowed
      const blocked = !tab || ["chrome://", "chrome-extension://", "about:", "edge://", "data:"].some(
        (p) => tab.url?.startsWith(p)
      );
      if (blocked) {
        this.showError("Cannot extract text from this page type.");
        return;
      }

      let text = null;

      // 1. Try the content script already running on the page
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: "extractText" });
        if (result?.text) text = result.text;
      } catch (_) {
        // Content script not injected (page was open before extension loaded) —
        // fall back to a direct scripting injection
        try {
          const [exec] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body?.innerText?.trim() ?? "",
          });
          text = exec?.result || null;
        } catch (e2) {
          console.warn("scripting.executeScript failed:", e2.message);
        }
      }

      if (text && text.length > 10) {
        this.textInput.value = text;
        this.analyzeBtn.disabled = false;
        this.showStatus("Text extracted. Analyzing...");
        this.analyzeText();
      } else {
        this.showError("No text found on this page.");
      }
    } catch (error) {
      this.showError("Could not extract text from page.");
    } finally {
      this.setLoading(false);
    }
  }

  async analyzeText() {
    const text = this.textInput.value.trim();
    if (!text) return;

    this.resetAnalysisUI();
    this.setLoading(true);
    this.showStatus("Analyzing patterns...");
    const startTime = Date.now();
    this.currentAbortController = new AbortController();

    try {
      const currentMode = this.currentSettings.analysisMode || "classic";
      const result = await chrome.runtime.sendMessage({ type: "analyzeText", text, mode: currentMode });
      const processingTime = Date.now() - startTime;

      if (!result) { this.showError("Analysis failed. Please try again."); return; }

      if (result.upgradeRequired) {
        // Hit the daily AI limit
        this.setMode("classic", false);
        this.upgradePrompt.style.display = "flex";
        this.subscriptionData.canUseAI = false;
        this.updateSubscriptionUI();
        this.showError("Daily AI limit reached. Switched to Classic mode.");
        // Re-run in classic
        const classicResult = await chrome.runtime.sendMessage({ type: "analyzeText", text, mode: "classic" });
        if (classicResult.success) {
          this.displayResults({ ...classicResult.data, processingTime, analyzedText: text });
          await this.saveToHistory(text, classicResult.data);
        }
        return;
      }

      if (result.success) {
        const dataWithMeta = { ...result.data, processingTime, analyzedText: text };
        this.displayResults(dataWithMeta);
        await this.saveToHistory(text, dataWithMeta);
        if (this.currentSettings.highlightEnabled) this.highlightTextOnPage(result.data);
        if (currentMode === "ai" && !result.fromCache) {
          // Only AI mode uses API resources — Classic runs locally, no token cost
          // Don't charge for cache hits (same text re-scanned)
          const wordCount = text.split(/\s+/).filter(Boolean).length;
          const cost = this.deductTokens("text_ai", wordCount);
          this.showStatus(`Analysis complete · used ${cost} token${cost !== 1 ? "s" : ""}`);
        } else if (result.fromCache) {
          this.showStatus("Analysis complete · cached result, no tokens used");
        } else {
          this.showStatus("Analysis complete · Classic mode is free");
        }
      } else {
        this.showError(result.error || "Analysis failed.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        this.showError("Analysis failed. Please try again.");
      }
    } finally {
      this.setLoading(false);
      this.currentAbortController = null;
    }
  }

  async analyzeUploadedImage() {
    if (!this.uploadedImageBase64) return;
    this.resetAnalysisUI();
    this.setLoading(true);
    this.showStatus("Uploading and analyzing image...");
    try {
      const result = await chrome.runtime.sendMessage({
        type: "analyzeUploadedImage",
        base64Data: this.uploadedImageBase64,
        filename: this.uploadedImageName,
      });
      if (result && result.success) {
        const cost = result.fromCache ? 0 : this.deductTokens("image");
        this.showStatus(result.fromCache ? "Scan complete · cached result, no tokens used" : `Scan complete · used ${cost} tokens`);
        this.displayResults(result);
        await chrome.runtime.sendMessage({
          type: "saveHistory",
          entry: {
            analysisType: "image",
            sourceUrl: "Uploaded File",
            analyzedText: `Analyzed uploaded image: ${this.uploadedImageName}`,
            result,
            score: result.score,
            analysis_mode: "AI Insight Engine (Image Upload)",
          },
        });
      } else if (result && result.mediaLimitReached) {
        this.setLoading(false);
        if (result.authRequired) {
          this.showPaywallModal(result.message, "auth");
        } else {
          this.showPaywallModal(result.message, "upgrade");
        }
      } else {
        this.showError((result && result.error) || "Image analysis failed.");
      }
    } catch (error) {
      this.showError("Could not analyze uploaded image.");
    } finally {
      this.setLoading(false);
    }
  }

  async analyzeUploadedVideo() {
    if (!this.uploadedVideoBase64) return;
    this.resetAnalysisUI();
    this.setLoading(true);
    this.showStatus("Uploading and analyzing video (this may take a moment)...");
    try {
      const result = await chrome.runtime.sendMessage({
        type: "analyzeUploadedVideo",
        base64Data: this.uploadedVideoBase64,
        filename: this.uploadedVideoName,
      });
      if (result && result.success) {
        const cost = result.fromCache ? 0 : this.deductTokens("video");
        this.showStatus(result.fromCache ? "Scan complete · cached result, no tokens used" : `Scan complete · used ${cost} tokens`);
        this.displayResults(result);
        await chrome.runtime.sendMessage({
          type: "saveHistory",
          entry: {
            analysisType: "video",
            sourceUrl: "Uploaded File",
            analyzedText: `Analyzed uploaded video: ${this.uploadedVideoName}`,
            result,
            score: result.score,
            analysis_mode: "AI Insight Engine (Video Upload)",
          },
        });
      } else if (result && result.mediaLimitReached) {
        this.setLoading(false);
        if (result.authRequired) {
          this.showPaywallModal(result.message, "auth");
        } else {
          this.showPaywallModal(result.message, "upgrade");
        }
      } else {
        this.showError((result && result.error) || "Video analysis failed.");
      }
    } catch (error) {
      this.showError("Could not analyze uploaded video.");
    } finally {
      this.setLoading(false);
    }
  }

  // ─── Results Display ──────────────────────────────────────────────────────

  displayResults(data) {
    this.resultsSection.style.display = "block";
    const aiScore = data.score || 0;          // internal: 0=human, 100=AI
    const displayScore = 100 - aiScore;        // display:  0=AI,   100=human
    const threshold = this.currentSettings.scoreThreshold;
    // threshold slider is now also a "human" threshold — invert for comparison
    const aiThreshold = 100 - threshold;

    let label, color, lowConfidence = false;
    if (aiScore >= Math.max(75, aiThreshold)) {
      label = "Likely AI Generated";
      color = "#e74c3c";
      lowConfidence = (aiScore < 85); // 75–84: flag as uncertain
    } else if (aiScore >= aiThreshold) {
      label = "Mixed / Uncertain";
      color = "#f39c12";
      lowConfidence = true;
    } else {
      label = "Likely Human";
      color = "#27ae60";
      lowConfidence = (aiScore >= 35); // 35–64 display: borderline real
    }

    this.scoreCircle.style.setProperty("--score-percent", `${displayScore}%`);
    this.scoreCircle.style.background = `conic-gradient(${color} ${displayScore}%, var(--border-color) ${displayScore}% 100%)`;
    this.scoreValue.textContent = `${displayScore}%`;
    this.aiLabel.textContent = label;
    this.aiLabel.style.color = color;
    // Low-confidence disclaimer
    let disclaimer = this.resultsSection.querySelector(".ds-low-conf-note");
    if (lowConfidence) {
      if (!disclaimer) {
        disclaimer = document.createElement("p");
        disclaimer.className = "ds-low-conf-note";
        this.aiLabel.insertAdjacentElement("afterend", disclaimer);
      }
      const contentNoun = this.activeInputMode === "text" ? "text" : this.activeInputMode === "video" ? "video" : "image";
      disclaimer.textContent = `⚠️ Low confidence — result may not be reliable for this ${contentNoun}.`;
      disclaimer.style.cssText = "font-size:11px;color:#888;margin:4px 0 0;text-align:center;";
    } else if (disclaimer) {
      disclaimer.remove();
    }
    const rawConf = (typeof data.confidence === "number" && !isNaN(data.confidence))
      ? data.confidence
      : aiScore;
    const confValue = Math.round(100 - rawConf);
    this.confidenceLabel.textContent = `Confidence: ${confValue}%`;
    this.resultTimestamp.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    this.renderSourceBadge(data);
    this.analysisDetails.innerHTML = this.generateAnalysisDetails(data);

    // Advanced Insights toggle
    const moreDetailsBtn = document.createElement("button");
    moreDetailsBtn.className = "more-details-toggle";
    moreDetailsBtn.innerHTML = `<span>Advanced Insights</span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    const moreDetailsContent = document.createElement("div");
    moreDetailsContent.className = "details-grid";
    moreDetailsContent.style.display = "none";
    moreDetailsContent.innerHTML = this.generateAdvancedDetails(data);

    moreDetailsBtn.onclick = () => {
      const isHidden = moreDetailsContent.style.display === "none";
      moreDetailsContent.style.display = isHidden ? "grid" : "none";
      moreDetailsBtn.querySelector("svg").style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
    };

    this.analysisDetails.appendChild(moreDetailsBtn);
    this.analysisDetails.appendChild(moreDetailsContent);
    this.resetFeedbackUI();

    // Sentence-level highlighting (text mode only)
    if (this.activeInputMode === "text" && data.analyzedText) {
      try { this.renderSentenceHighlights(data.analyzedText, data.score || 0); }
      catch (e) { if (this.highlightPanel) this.highlightPanel.style.display = "none"; }
    } else if (this.highlightPanel) {
      this.highlightPanel.style.display = "none";
    }
  }

  displayImageResults(data) {
    this.resultsSection.style.display = "block";
    const avgScore = data.images && data.images.length > 0
      ? data.images.reduce((sum, img) => sum + img.score, 0) / data.images.length : 0;
    const color = avgScore >= 50 ? "#e74c3c" : "#27ae60";

    this.scoreCircle.style.setProperty("--score-percent", `${avgScore}%`);
    this.scoreCircle.style.background = `conic-gradient(${color} ${avgScore}%, var(--border-color) ${avgScore}% 100%)`;
    this.scoreValue.textContent = `${Math.round(avgScore)}%`;
    this.aiLabel.textContent = data.aiDetected > 0 ? "AI Images Detected" : "No AI Images";
    this.aiLabel.style.color = color;
    this.confidenceLabel.textContent = `Images Analyzed: ${data.totalAnalyzed}`;
    this.resultTimestamp.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    this.renderSourceBadge({ source: "manual", model_used: null });
    this.analysisDetails.innerHTML = `<p>Found <strong>${data.aiDetected}</strong> suspicious image(s) out of ${data.totalAnalyzed} analyzed.</p>`;
    this.resetFeedbackUI();
  }

  generateAdvancedDetails(data) {
    const f = data.features || {};
    const b = data.breakdown || {};
    const processingTime = data.processingTime ? `${(data.processingTime / 1000).toFixed(2)}s` : "N/A";
    // Use null/undefined checks (not falsy) so legitimate 0 values still display
    const fmt = (v, fn) => (v != null ? fn(v) : "N/A");

    const details = [
      { label: "Processing Time", value: processingTime },
      { label: "Word Count",        value: fmt(f.wordCount,         (v) => v) },
      { label: "Sentences",         value: fmt(f.sentenceCount,     (v) => v) },
      { label: "Perplexity",        value: fmt(f.perplexity,        (v) => v.toFixed(1)) },
      { label: "Burstiness",        value: fmt(f.burstiness,        (v) => v.toFixed(2)) },
      { label: "AI Vocab Score",    value: fmt(f.aiVocabScore,      (v) => `${Math.round(v)}%`) },
      { label: "Transition Density",value: fmt(f.transitionDensity, (v) => v.toFixed(2)) },
      { label: "Uniqueness",        value: fmt(f.uniqueness,        (v) => `${v.toFixed(1)}%`) },
    ];

    return details.map((d) => `
      <div class="detail-item">
        <span class="detail-label">${d.label}</span>
        <span class="detail-value">${d.value}</span>
      </div>`).join("");
  }

  renderSourceBadge(data) {
    this.sourceBadgeContainer.innerHTML = ""; // clear before adding
    const isFallback = data.model_used === "fallback";
    let badgeClass = "manual", badgeText = "🧠 Classic", tooltip = "Local heuristic engine";
    if (data.source === "ai_model") {
      if (isFallback) {
        badgeClass = "fallback"; badgeText = "🟠 AI Fallback"; tooltip = "AI unavailable, used local engine";
      } else {
        badgeClass = "ai"; badgeText = "🤖 AI Insight"; tooltip = "Powered by advanced language models";
      }
    }
    const badge = document.createElement("div");
    badge.className = `source-badge ${badgeClass}`;
    badge.textContent = badgeText;
    badge.title = tooltip;
    this.sourceBadgeContainer.appendChild(badge);
  }

  generateAnalysisDetails(data) {
    if (data.source === "ai_model" && data.model_used !== "fallback") {
      return `<p>${data.reasoning || "No detailed reasoning available."}</p>`;
    }
    const f = data.features || {};
    let html = "";
    if (data.reasoning) html += `<p style="margin-bottom:8px;">${data.reasoning}</p>`;
    if (f.perplexity || f.burstiness) {
      html += "<ul>";
      if (f.perplexity) html += `<li>Perplexity: ${f.perplexity.toFixed(1)}</li>`;
      if (f.burstiness) html += `<li>Burstiness: ${f.burstiness.toFixed(2)}</li>`;
      if (f.aiVocabScore) html += `<li>AI Vocabulary: ${Math.round(f.aiVocabScore)}%</li>`;
      html += "</ul>";
    }
    if (data.matches && data.matches.length > 0) {
      html += `<p class="mt-2">Found ${data.matches.length} AI pattern(s).</p>`;
    }
    return html || "<p>Analysis complete.</p>";
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "getUserSettings" });
      if (response && response.success && response.data) this.applySettingsToUI(response.data);
    } catch (error) { /* use defaults */ }
  }

  applySettingsToUI(settings) {
    this.currentSettings = { ...this.currentSettings, ...settings };
    this.setMode(this.currentSettings.analysisMode || "classic", false);
    // Migrate old default of 50 → 35 on first load after update
    if (this.currentSettings.scoreThreshold === 50) this.currentSettings.scoreThreshold = 35;
    this.scoreThresholdInput.value = this.currentSettings.scoreThreshold;
    this.thresholdValue.textContent = `${this.currentSettings.scoreThreshold}%`;
    this.highlightEnabledInput.checked = this.currentSettings.highlightEnabled;
    this.themeSelect.value = this.currentSettings.theme || "system";
    this.applyTheme(this.currentSettings.theme);
  }

  applyTheme(theme) {
    if (theme === "system") {
      document.body.setAttribute("data-theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } else {
      document.body.setAttribute("data-theme", theme);
    }
  }

  async saveSettings() {
    try {
      const settings = {
        analysisMode: this.currentSettings.analysisMode ?? "classic",
        scoreThreshold: Number(this.scoreThresholdInput.value),
        highlightEnabled: this.highlightEnabledInput.checked,
        theme: this.themeSelect.value,
      };
      await chrome.runtime.sendMessage({ type: "updateUserSettings", settings });
      this.currentSettings = { ...this.currentSettings, ...settings };
    } catch (error) { /* silent fail */ }
  }

  setMode(mode, shouldSave = true) {
    this.currentSettings.analysisMode = mode;  // update immediately — don't wait for async save
    this.modeClassic.classList.toggle("active", mode === "classic");
    this.modeAI.classList.toggle("active", mode === "ai");
    if (this.analysisModeSelect) this.analysisModeSelect.value = mode;
    if (this.thresholdRow) this.thresholdRow.style.display = (mode === "classic" && this.activeInputMode === "text") ? "block" : "none";
    this.resetAnalysisUI();
    if (shouldSave) this.saveSettings();
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async saveToHistory(text, result) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const id = "h-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      this.latestAnalysisId = id;
      const entry = {
        id,
        analysisType: "text",
        sourceUrl: tab?.url || "",
        analyzedText: text.substring(0, 1000),
        score: result.score,
        result,
        analysis_mode: this.analysisModeSelect?.value === "ai" ? "AI Insight Engine" : "Classic Analysis",
        timestamp: new Date().toISOString(),
      };
      // saveHistory in background handles both local write and server sync
      chrome.runtime.sendMessage({ type: "saveHistory", entry }).catch(() => {});
    } catch (e) { /* silent fail */ }
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  updateStarRating(value) {
    this.feedbackRating.querySelectorAll("span").forEach((star) => {
      star.classList.toggle("selected", star.dataset.value <= value);
      star.dataset.current = star.dataset.value === value;
    });
  }

  getRatingValue() {
    const selected = this.feedbackRating.querySelector("span[data-current='true']");
    return selected ? Number(selected.dataset.value) : 3;
  }

  async submitFeedback() {
    const rating = this.getRatingValue();
    if (!this.latestAnalysisId) {
      this.latestAnalysisId = "local-" + Date.now();
    }
    const comment = this.feedbackComment.value.trim();
    this.submitFeedbackBtn.disabled = true;
    this.feedbackStatus.textContent = "Sending...";
    this.feedbackStatus.style.color = "";

    const entry = {
      id: this.latestAnalysisId,
      rating,
      label: rating >= 4 ? "helpful" : rating <= 2 ? "incorrect" : "uncertain",
      comment,
      timestamp: new Date().toISOString(),
    };

    try {
      // Background handles local save + server sync
      await chrome.runtime.sendMessage({ type: "submitFeedback", feedback: entry });
      this.feedbackStatus.textContent = "✓ Feedback submitted!";
      this.feedbackStatus.style.color = "#27ae60";
    } catch (e) {
      this.feedbackStatus.textContent = "Something went wrong. Please try again.";
      this.feedbackStatus.style.color = "#e74c3c";
    } finally {
      this.submitFeedbackBtn.disabled = false;
    }
  }

  // ─── Paywall Activation ──────────────────────────────────────────────────

  async handlePaywallActivate(flowType) {
    const input = flowType === "limit" ? this.paywallLicenseInput2 : this.paywallLicenseInput;
    const statusEl = flowType === "limit" ? this.paywallActivateStatus2 : this.paywallActivateStatus;
    const btn = flowType === "limit" ? this.paywallActivateBtn2 : this.paywallActivateBtn;
    if (!input) return;
    // Must be signed in to activate
    if (!this.currentUser) {
      if (statusEl) { statusEl.textContent = "Please sign in first."; statusEl.style.color = "#e74c3c"; }
      return;
    }
    const key = input.value.trim();
    if (!key) { if (statusEl) { statusEl.textContent = "Please enter a license key."; statusEl.style.color = "#e74c3c"; } return; }
    if (btn) btn.disabled = true;
    if (statusEl) { statusEl.textContent = "Activating..."; statusEl.style.color = ""; }
    try {
      const resp = await chrome.runtime.sendMessage({ type: "activateSubscription", licenseKey: key });
      if (resp && resp.success) {
        // Server bound the key to this account — update local state
        this.subscriptionData.tier = "pro";
        this.subscriptionData.canUseAI = true;
        await chrome.storage.local.set({ ds_pro_activated: true, ds_license_key: key });
        this.updateSubscriptionUI();
        this.updateAuthUI();
        if (statusEl) { statusEl.textContent = "✓ Pro activated! Welcome."; statusEl.style.color = "#27ae60"; }
        setTimeout(() => this.closePaywallModal(), 1500);
      } else {
        const msg = (resp && resp.error) || "Invalid key. Please try again.";
        if (statusEl) { statusEl.textContent = msg; statusEl.style.color = "#e74c3c"; }
      }
    } catch (e) {
      if (statusEl) { statusEl.textContent = "Activation failed. Check connection."; statusEl.style.color = "#e74c3c"; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  showPaywallModal(message, flowType = "upgrade") {
    if (!this.paywallModal) return;
    // Never show paywall to pro users
    if (this.subscriptionData?.tier === "pro") return;
    const loggedIn = !!this.currentUser;
    const email = this.currentUser?.email || "";

    // Hide all inner flows first
    if (this.paywallUpgradeFlow) this.paywallUpgradeFlow.style.display = "none";
    const limitFlow = document.getElementById("paywallLimitFlow");
    if (limitFlow) limitFlow.style.display = "none";

    // Helper: wire gate vs license section for a given flow index
    const wireFlow = (gate, licSection, signedInAs) => {
      if (!gate || !licSection) return;
      if (loggedIn) {
        gate.style.display = "none";
        licSection.style.display = "block";
        if (signedInAs) signedInAs.textContent = `Activating as: ${email}`;
      } else {
        gate.style.display = "block";
        licSection.style.display = "none";
      }
    };

    if (flowType === "upgrade" || flowType === "auth") {
      if (this.paywallUpgradeFlow) this.paywallUpgradeFlow.style.display = "block";
      wireFlow(this.paywallSigninGate, this.paywallLicenseSection, this.paywallSignedInAs);
    } else {
      // "limit" flow
      if (limitFlow) limitFlow.style.display = "block";
      const msgEl = document.getElementById("paywallMessage");
      if (msgEl && message) msgEl.textContent = message;
      wireFlow(this.paywallSigninGate2, this.paywallLicenseSection2, this.paywallSignedInAs2);
    }

    this.paywallModal.style.display = "flex";
    this.paywallModal.classList.add("active");
    // Clear previous status messages
    if (this.paywallActivateStatus)  this.paywallActivateStatus.textContent  = "";
    if (this.paywallActivateStatus2) this.paywallActivateStatus2.textContent = "";
  }

  // ─── OCR Upload ───────────────────────────────────────────────────────────

  async handleOcrUpload(file) {
    const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
    const isPdf = file.type === "application/pdf";
    if (!allowedImages.includes(file.type) && !isPdf) {
      this.showError("Supported formats: JPG, PNG, WebP, PDF.");
      return;
    }
    this.setInputMode("text");
    this.setLoading(true);
    this.showStatus(isPdf ? "Extracting text from PDF..." : "Extracting text from image...");
    try {
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const result = await chrome.runtime.sendMessage({
        type: "performOcr",
        base64Data: dataUrl,
        fileType: file.type,
      });
      if (result && result.success && result.text) {
        this.textInput.value = result.text;
        this.setInputMode("text");
        this.showStatus("Text extracted — click Analyze to check for AI content.");
        this.updateAnalyzeButtonState();
        // Auto-scroll text input into view
        this.textInput.scrollTop = 0;
      } else {
        this.showError(result?.error || "No text found. Try a clearer image.");
      }
    } catch (e) {
      this.showError("Extraction failed: " + (e.message || e));
    } finally {
      this.setLoading(false);
    }
  }

  resetFeedbackUI() {
    this.updateStarRating(3);
    this.feedbackComment.value = "";
    this.feedbackStatus.textContent = "";
    this.submitFeedbackBtn.disabled = false;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  resetAnalysisUI() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.resultsSection.style.display = "none";
    this.sourceBadgeContainer.innerHTML = "";
    this.analysisDetails.innerHTML = "";
    // Clear stale score/label so they never bleed into the next analysis
    if (this.scoreValue)      this.scoreValue.textContent      = "";
    if (this.aiLabel)         this.aiLabel.textContent         = "";
    if (this.confidenceLabel) this.confidenceLabel.textContent = "";
    if (this.highlightPanel)  this.highlightPanel.style.display = "none";
    this.setLoading(false);
    // Clear both status text and any lingering error colour
    this.status.textContent  = "";
    this.status.style.color  = "var(--text-secondary)";
  }

  closePaywallModal() {
    if (this.paywallModal) {
      this.paywallModal.style.display = "none";
      this.paywallModal.classList.remove("active");
    }
    if (this.paywallUpgradeFlow) this.paywallUpgradeFlow.style.display = "none";
    if (this.paywallLimitFlow)   this.paywallLimitFlow.style.display   = "none";
  }

  setLoading(loading) {
    document.body.classList.toggle("loading", loading);
    const btnText = this.analyzeBtn.querySelector(".btn-text");
    if (btnText) btnText.textContent = loading ? "Analyzing..." : "Analyze";
  }

  showStatus(message) {
    this.status.textContent = message;
    this.status.style.color = "var(--text-secondary)";
  }

  showError(message) {
    this.status.textContent = message;
    this.status.style.color = "var(--error-color)";
  }

  renderSentenceHighlights(text, overallAiScore) {
    if (!this.highlightPanel || !this.highlightedText) return;

    // ── Split into sentences ──────────────────────────────────────────────
    const raw = text.match(/[^.!?]+[.!?]*/g) || [text];
    const sentences = raw.map(s => s.trim()).filter(s => s.length > 0);
    if (sentences.length === 0) { this.highlightPanel.style.display = "none"; return; }

    // ── Per-sentence AI likelihood heuristic ─────────────────────────────
    // Weighted combination of:
    //  1. Normalised sentence length vs average (very uniform = AI-like)
    //  2. AI marker phrase density
    //  3. Vocabulary repetition within the sentence
    // Final score biased toward the overall result so colours are consistent.

    const AI_PHRASES = [
      "in conclusion", "furthermore", "moreover", "it is important to note",
      "it should be noted", "as a result", "in addition", "on the other hand",
      "this highlights", "this demonstrates", "this underscores", "this ensures",
      "plays a crucial role", "plays an important role", "a key aspect",
      "it is worth noting", "needless to say", "in today's world",
      "in summary", "to summarize", "overall", "ultimately", "delve", "delving",
      "revolutionize", "revolutionizing", "game-changing", "cutting-edge",
      "state-of-the-art", "leverage", "leveraging", "utilize", "utilizing",
    ];

    const avgLen = sentences.reduce((s, x) => s + x.split(/\s+/).length, 0) / sentences.length;

    const scoreSentence = (sent) => {
      const words = sent.toLowerCase().split(/\s+/).filter(Boolean);
      const wc = words.length || 1;

      // 1. Length uniformity (0–30 pts): close to average → AI
      const lenRatio = Math.abs(wc - avgLen) / (avgLen || 1);
      const lenScore = Math.max(0, 30 - lenRatio * 40);

      // 2. AI phrase density (0–50 pts)
      const lower = sent.toLowerCase();
      let phraseHits = 0;
      for (const ph of AI_PHRASES) if (lower.includes(ph)) phraseHits++;
      const phraseScore = Math.min(50, phraseHits * 18);

      // 3. Vocabulary diversity (0–20 pts): low diversity → AI
      const unique = new Set(words).size;
      const diversityScore = Math.max(0, 20 - (unique / wc) * 20);

      return lenScore + phraseScore + diversityScore; // 0–100
    };

    const rawScores = sentences.map(scoreSentence);
    const maxRaw = Math.max(...rawScores, 1);

    // Blend each sentence score toward the overall document score
    const finalScores = rawScores.map(r => {
      const normalised = (r / maxRaw) * 100;
      return Math.round(normalised * 0.55 + overallAiScore * 0.45);
    });

    // ── Render ────────────────────────────────────────────────────────────
    this.highlightedText.innerHTML = finalScores.map((score, i) => {
      const cls = score >= 65 ? "hl-high" : score >= 40 ? "hl-medium" : "hl-low";
      const humanPct = Math.round(100 - score);
      const sent = sentences[i].replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<span class="hl-sentence ${cls}" title="${humanPct}% human-like">${sent}</span> `;
    }).join("");

    this.highlightPanel.style.display = "block";
  }

  async highlightTextOnPage(resultData) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "highlightText", data: resultData });
    } catch (e) { /* silent */ }
  }

  // ─── Auth State ───────────────────────────────────────────────────────────

  async loadAuthState() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "authGetMe" });
      if (resp && resp.success && resp.data) {
        this.currentUser = resp.data;
        this.updateAuthUI();
      } else {
        this.currentUser = null;
        this.updateAuthUI();
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  updateAuthUI() {
    const loggedIn = !!this.currentUser;
    if (this.loginNavBtn) this.loginNavBtn.style.display = loggedIn ? "none" : "flex";
    if (this.accountBtn)  this.accountBtn.style.display  = loggedIn ? "flex" : "none";
    if (this.accountMenuEmail) this.accountMenuEmail.textContent = this.currentUser?.email || "";
    if (this.accountMenuPlan) {
      const isPro = this.subscriptionData?.tier === "pro" || this.currentUser?.isPro;
      this.accountMenuPlan.textContent = isPro ? "⚡ Pro Plan" : "Free Plan";
      if (this.accountMenuUpgradeBtn)
        this.accountMenuUpgradeBtn.style.display = isPro ? "none" : "block";
    }
  }

  toggleAccountMenu() {
    this.accountMenuOpen = !this.accountMenuOpen;
    if (this.accountMenu) this.accountMenu.style.display = this.accountMenuOpen ? "block" : "none";
  }

  closeAccountMenu() {
    this.accountMenuOpen = false;
    if (this.accountMenu) this.accountMenu.style.display = "none";
  }

  openAuthModal(reason, tab = "login") {
    if (!this.authModal) return;
    this.authModal.style.display = "flex";
    // Show reason text if provided
    if (this.authModalReason) {
      if (reason) {
        this.authModalReason.textContent = reason;
        this.authModalReason.style.display = "block";
      } else {
        this.authModalReason.style.display = "none";
      }
    }
    this.switchAuthTab(tab);
    // Focus first input
    const firstInput = tab === "login" ? this.loginEmail : this.registerEmail;
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  async handleLogin() {
    const email = this.loginEmail?.value?.trim();
    const password = this.loginPassword?.value;
    if (!email || !password) {
      if (this.loginStatus) this.loginStatus.textContent = "Please enter your email and password.";
      return;
    }
    if (this.loginSubmitBtn) { this.loginSubmitBtn.disabled = true; this.loginSubmitBtn.textContent = "Signing in…"; }
    if (this.loginStatus) this.loginStatus.textContent = "";
    try {
      const resp = await chrome.runtime.sendMessage({ type: "authLogin", email, password });
      if (resp && resp.success) {
        this.currentUser = resp.data;
        this.closeAuthModal();
        this.updateAuthUI();
        await this.loadSubscription();
        // Re-open paywall if user came from there
        if (this._pendingPaywall) {
          const flow = this._pendingPaywall;
          this._pendingPaywall = null;
          setTimeout(() => this.showPaywallModal(null, flow === "limit" ? "limit" : "upgrade"), 100);
        }
      } else {
        if (this.loginStatus) this.loginStatus.textContent = (resp && resp.error) || "Sign in failed. Check your credentials.";
      }
    } catch (e) {
      if (this.loginStatus) this.loginStatus.textContent = "Connection error. Try again.";
    } finally {
      if (this.loginSubmitBtn) { this.loginSubmitBtn.disabled = false; this.loginSubmitBtn.textContent = "Sign In"; }
    }
  }

  async handleRegister() {
    const email = this.registerEmail?.value?.trim();
    const password = this.registerPassword?.value;
    if (!email || !password) {
      if (this.registerStatus) this.registerStatus.textContent = "Please enter your email and password.";
      return;
    }
    if (this.registerSubmitBtn) { this.registerSubmitBtn.disabled = true; this.registerSubmitBtn.textContent = "Creating…"; }
    if (this.registerStatus) this.registerStatus.textContent = "";
    try {
      const resp = await chrome.runtime.sendMessage({ type: "authRegister", email, password });
      if (resp && resp.success) {
        this.currentUser = resp.data;
        this.closeAuthModal();
        this.updateAuthUI();
        await this.loadSubscription();
        if (this._pendingPaywall) {
          const flow = this._pendingPaywall;
          this._pendingPaywall = null;
          setTimeout(() => this.showPaywallModal(null, flow === "limit" ? "limit" : "upgrade"), 100);
        }
      } else {
        if (this.registerStatus) this.registerStatus.textContent = (resp && resp.error) || "Registration failed.";
      }
    } catch (e) {
      if (this.registerStatus) this.registerStatus.textContent = "Connection error. Try again.";
    } finally {
      if (this.registerSubmitBtn) { this.registerSubmitBtn.disabled = false; this.registerSubmitBtn.textContent = "Create Account"; }
    }
  }

  async handleLogout() {
    try {
      await chrome.runtime.sendMessage({ type: "authLogout" });
    } catch (_) {}
    this.currentUser = null;
    this.subscriptionData = { tier: "free", tokensUsed: 0, tokenLimit: 100, canUseAI: true };
    await chrome.storage.local.remove("ds_pro_activated");
    this.updateAuthUI();
    this.updateSubscriptionUI();
    this.closeAccountMenu();
  }

  closeAuthModal() {
    if (this.authModal) this.authModal.style.display = "none";
    if (this.loginStatus) this.loginStatus.textContent = "";
    if (this.registerStatus) this.registerStatus.textContent = "";
  }

    switchAuthTab(tab) {
    const isLogin = tab === 'login';
    this.tabLogin.classList.toggle('active', isLogin);
    this.tabRegister.classList.toggle('active', !isLogin);
    this.authLoginForm.style.display = isLogin ? 'flex' : 'none';
    this.authRegisterForm.style.display = isLogin ? 'none' : 'flex';
  }
}

// Apply saved theme immediately to prevent white flash before async loadSettings resolves
chrome.storage.local.get("ds_settings").then(({ ds_settings }) => {
  const theme = ds_settings?.theme || "system";
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.body.setAttribute("data-theme", resolved);
}).catch(() => {});

document.addEventListener('DOMContentLoaded', () => new AIDetectorPopup());
