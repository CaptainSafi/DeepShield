// background.js — Service Worker
// Handles all extension messaging, API calls, auth, and media analysis.
// Runs in the background; communicates with popup.js and content.js via chrome.runtime.

class AIDetectorBackground {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    this.apiBaseUrl = "http://localhost:5000/api";
    this.requestTimeoutMs = 8000;
    this.maxRetries = 1;
    this.installIdKey = "installId";
    this.authTokenKey = "authToken";
    this.defaultSettings = {
      highlightEnabled: true,
      scoreThreshold: 50,
      analysisMode: "classic",
      theme: "system",
    };
    this.initializeMessageHandlers();
    this.initializeContextMenus();
  }

  // ─── Message Router ──────────────────────────────────────────────────────
  initializeMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.type) {
        case "analyzeText":
          this.analyzeText(request.text, sendResponse, request.mode);
          return true;
        case "analyzeImages":
          this.analyzeImages(request.images, sendResponse);
          return true;
        case "analyzeVideo":
          this.analyzeVideo(request.videoUrl, sendResponse);
          return true;
        case "analyzeUploadedImage":
          this.analyzeUploadedImage(request.base64Data, request.filename, sendResponse);
          return true;
        case "analyzeUploadedVideo":
          this.analyzeUploadedVideo(request.base64Data, request.filename, sendResponse);
          return true;
        case "getHistory":
          this.getHistory(sendResponse);
          return true;
        case "clearHistory":
          this.clearHistory(sendResponse);
          return true;
        case "saveHistory":
          this.saveHistory(request.entry, sendResponse);
          return true;
        case "deleteHistoryItem":
          this.deleteHistoryItem(request.id, sendResponse);
          return true;
        case "getUserSettings":
          this.getUserSettings(sendResponse);
          return true;
        case "updateUserSettings":
          this.updateUserSettings(request.settings, sendResponse);
          return true;
        case "submitFeedback":
          this.submitFeedback(request.feedback, sendResponse);
          return true;
        case "getFeedback":
          this.getFeedback(sendResponse);
          return true;
        case "getSubscription":
          this.getSubscription(sendResponse);
          return true;
        case "activatePro":
          this.activatePro(request.licenseKey, sendResponse);
          return true;
        case "authRegister":
          this.authRegister(request.email, request.password, sendResponse);
          return true;
        case "authLogin":
          this.authLogin(request.email, request.password, sendResponse);
          return true;
        case "authLogout":
          this.authLogout(sendResponse);
          return true;
        case "authGetMe":
          this.authGetMe(sendResponse);
          return true;
        case "performOcr":
          this.performOcr(request.base64Data, request.fileType, sendResponse);
          return true;
        case "analyzeSentences":
          this.analyzeSentencesHandler(request.text, sendResponse);
          return true;
        case "checkMediaUsage":
          this.checkMediaUsage(request.mediaType, sendResponse);
          return true;
        case "analyzePageImage":
          this.analyzePageImageHandler(request.src, sendResponse);
          return true;
        case "analyzePageVideo":
          this.analyzePageVideoHandler(request.src, sendResponse);
          return true;
        case "activateSubscription":
          this.activatePro(request.licenseKey, sendResponse);
          return true;
        case "analyzeVideoFrames":
          this.analyzeVideoFramesHandler(request.frames || [], sendResponse);
          return true;
        case "captureTabScreenshot":
          chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 85 }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              sendResponse({ success: false });
            } else {
              sendResponse({ success: true, dataUrl });
            }
          });
          return true;
        case "openPopupWithMedia":
          if (chrome.action.openPopup) {
            chrome.action.openPopup().catch(() => {});
          }
          // Badge tells user to click the icon if openPopup isn't supported
          chrome.action.setBadgeText({ text: "▶" });
          chrome.action.setBadgeBackgroundColor({ color: "#8b5cf6" });
          sendResponse({ success: true });
          return true;
        case "clearMediaBadge":
          chrome.action.setBadgeText({ text: "" });
          sendResponse({ success: true });
          return true;
      }
    });
  }

  generateInstallId() {
    const randomPart =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `ext-${randomPart}`;
  }

  async getOrCreateInstallId() {
    const result = await chrome.storage.local.get([this.installIdKey]);
    const existingInstallId = result[this.installIdKey];
    if (existingInstallId) return existingInstallId;
    const installId = this.generateInstallId();
    await chrome.storage.local.set({ [this.installIdKey]: installId });
    return installId;
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAuthToken() {
    const result = await chrome.storage.local.get([this.authTokenKey]);
    return result[this.authTokenKey] || null;
  }

  async setAuthToken(token) {
    await chrome.storage.local.set({ [this.authTokenKey]: token });
  }

  async clearAuthToken() {
    await chrome.storage.local.remove([this.authTokenKey]);
  }

  async apiRequest(path, { method = "GET", body } = {}) {
    const installId = await this.getOrCreateInstallId();
    const token = await this.getAuthToken();
    const url = `${this.apiBaseUrl}${path}`;
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const headers = {
          "Content-Type": "application/json",
          "x-install-id": installId,
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const response = await this.fetchWithTimeout(url, {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const err = new Error(payload.message || payload.error || `Request failed: ${response.status}`);
          err.status = response.status;
          err.payload = payload;
          throw err;
        }
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
    }
    throw lastError || new Error("Unknown API request error");
  }

  normalizeSettings(data) {
    const input = data || {};
    return {
      highlightEnabled: typeof input.highlightEnabled === "boolean" ? input.highlightEnabled : true,
      scoreThreshold: Math.min(100, Math.max(0, Number.isFinite(input.scoreThreshold) ? input.scoreThreshold : 50)),
      analysisMode: ["classic", "ai"].includes(input.analysisMode) ? input.analysisMode : "classic",
      theme: ["light", "dark", "system"].includes(input.theme) ? input.theme : "system",
    };
  }

  async getUserSettings(sendResponse) {
    // Read from local storage first — instant and works offline
    const { ds_settings } = await chrome.storage.local.get("ds_settings");
    if (ds_settings) {
      sendResponse({ success: true, data: this.normalizeSettings(ds_settings) });
    } else {
      sendResponse({ success: true, data: { ...this.defaultSettings } });
    }
    // Sync from server in background (non-blocking)
    this.apiRequest("/settings", { method: "GET" })
      .then(r => chrome.storage.local.set({ ds_settings: this.normalizeSettings(r.data) }))
      .catch(() => {});
  }

  async updateUserSettings(settings, sendResponse) {
    // Write locally first so settings survive popup close immediately
    const normalized = this.normalizeSettings(settings);
    await chrome.storage.local.set({ ds_settings: normalized });
    sendResponse({ success: true, data: normalized });
    // Sync to server in background (non-blocking)
    this.apiRequest("/settings", { method: "PUT", body: normalized }).catch(() => {});
  }

  async getSubscription(sendResponse) {
    try {
      const response = await this.apiRequest("/subscription", { method: "GET" });
      sendResponse({ success: true, data: response.data });
    } catch (error) {
      // Fallback: assume free with no usage tracked
      sendResponse({
        success: true,
        data: { tier: "free", aiUsedToday: 0, aiLimit: 5, canUseAI: true },
        warning: "Could not reach server.",
      });
    }
  }

  async activatePro(licenseKey, sendResponse) {
    try {
      const response = await this.apiRequest("/subscription/activate", {
        method: "POST",
        body: { licenseKey },
      });
      sendResponse({ success: true, data: response.data, message: response.message });
    } catch (error) {
      sendResponse({ success: false, error: error.payload?.message || error.message || "Activation failed" });
    }
  }

  async analyzeText(text, sendResponse, passedMode) {
    try {
      if (!text || text.trim().length < 10) {
        sendResponse({ success: false, error: "Text too short (minimum 10 characters)" });
        return;
      }

      // Resolve mode first so it's part of the cache key
      let mode = passedMode;
      if (!mode || (mode !== "classic" && mode !== "ai")) {
        // Fallback to server settings only if no valid mode was passed
        const settingsResponse = await this.apiRequest("/settings", { method: "GET" })
          .catch(() => ({ data: this.defaultSettings }));
        mode = settingsResponse.data?.analysisMode || "classic";
      }

      // Include mode in cache key — classic and AI results must be stored separately
      const cacheKey = `${mode}:${await this.generateCacheKey(text)}`;
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        sendResponse({ success: true, data: cachedResult, fromCache: true });
        return;
      }

      let result;

      if (mode === "ai") {
        // Always compute local features — used for Advanced Insights regardless of API path
        const localFeatures = this.extractTextFeatures(text);
        try {
          const aiResponse = await this.apiRequest("/analyze/ai", {
            method: "POST",
            body: { text },
          });
          if (aiResponse.success) {
            result = {
              score: aiResponse.data.score,
              reasoning: aiResponse.data.reason,
              label: aiResponse.data.label,
              confidence: aiResponse.data.confidence,
              source: aiResponse.data.source || "ai_model",
              model_used: aiResponse.data.model_used,
              analysis_mode: "AI Insight Engine",
              isAI: true,
              features: localFeatures,  // always populate for Advanced Insights panel
              timestamp: new Date().toISOString(),
            };
          } else {
            throw new Error(aiResponse.error || "AI analysis failed");
          }
        } catch (error) {
          // Check if it's an upgrade-required error
          if (error.payload?.upgradeRequired) {
            sendResponse({
              success: false,
              upgradeRequired: true,
              error: error.payload.error || "Daily AI limit reached. Upgrade to Pro.",
              data: error.payload.data,
            });
            return;
          }
          console.error("AI Insight Engine failed, falling back to Classic:", error);
          result = await this.performAnalysis(text);
          result.source = "ai_model";
          result.model_used = "fallback";
          result.analysis_mode = "AI Insight Engine (Fallback)";
          result.fallback = true;
          result.fallbackMessage = "AI engine unavailable, switched to Classic mode";
        }
      } else {
        result = await this.performAnalysis(text);
      }

      this.cache.set(cacheKey, result);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error("Analysis error:", error);
      sendResponse({ success: false, error: "Analysis failed. Please try again." });
    }
  }

  async generateCacheKey(text) {
    const cleanText = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (crypto?.subtle) {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cleanText));
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return cleanText.slice(0, 200);
  }

  // ─── Improved Classic Text Analysis Engine ───────────────────────────────

  async performAnalysis(text) {
    const features = this.extractTextFeatures(text);
    const { score, breakdown } = this.calculateAIScore(features);
    const matches = this.findAIPatterns(text, score);

    return {
      score: Math.round(score),
      features,
      matches,
      breakdown,
      reasoning: this.generateReasoning(features, score, breakdown),
      source: "manual",
      model_used: null,
      analysis_mode: "Classic Analysis",
      timestamp: new Date().toISOString(),
    };
  }

  extractTextFeatures(text) {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const cleanWords = words.map((w) => w.replace(/[^a-z']/g, "")).filter((w) => w.length > 2);

    return {
      length: text.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgWordLength: this.calculateAvgWordLength(cleanWords),
      avgSentenceLength: this.calculateAvgSentenceLength(sentences),
      perplexity: this.calculatePerplexity(text),
      burstiness: this.calculateBurstiness(sentences),
      repetition: this.calculateRepetitionScore(cleanWords),
      uniqueness: this.calculateUniqueness(cleanWords),
      readability: this.calculateReadability(text, words, sentences),
      aiVocabScore: this.calculateAIVocabularyScore(text, words),
      transitionDensity: this.calculateTransitionDensity(text, sentences),
      passiveVoiceRatio: this.calculatePassiveVoiceRatio(sentences),
      sentenceLengthCV: this.calculateSentenceLengthCV(sentences),
      hedgeLanguageScore: this.calculateHedgeLanguageScore(text),
    };
  }

  calculateAvgWordLength(words) {
    if (words.length === 0) return 0;
    return words.reduce((sum, w) => sum + w.length, 0) / words.length;
  }

  calculateAvgSentenceLength(sentences) {
    if (sentences.length === 0) return 0;
    return sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
  }

  calculatePerplexity(text) {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length < 10) return 50;
    const wordFreq = new Map();
    words.forEach((w) => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
    const total = words.length;
    const entropy = -Array.from(wordFreq.values()).reduce(
      (sum, freq) => sum + (freq / total) * Math.log2(freq / total),
      0
    );
    return Math.pow(2, entropy);
  }

  calculateBurstiness(sentences) {
    if (sentences.length < 3) return 0.5;
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
    return variance / (mean + 1);
  }

  calculateRepetitionScore(words) {
    if (words.length < 20) return 0;
    const freq = new Map();
    words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
    const repeated = Array.from(freq.values()).filter((c) => c > 2).length;
    return (repeated / words.length) * 100;
  }

  calculateUniqueness(words) {
    if (words.length === 0) return 0;
    return (new Set(words).size / words.length) * 100;
  }

  calculateReadability(text, words, sentences) {
    if (!words || words.length === 0 || !sentences || sentences.length === 0) return 100;
    const avgWPS = words.length / sentences.length;
    const complexWords = words.filter((w) => w.length > 6).length;
    const pctComplex = (complexWords / words.length) * 100;
    return 206.835 - 1.015 * avgWPS - (84.6 * pctComplex) / 100;
  }

  // AI-specific vocabulary commonly overused by LLMs
  calculateAIVocabularyScore(text, words) {
    const aiWords = new Set([
      "utilize", "utilizes", "utilized", "utilization",
      "leverage", "leverages", "leveraged", "leveraging",
      "delve", "delves", "delved", "delving",
      "crucial", "pivotal", "paramount", "indispensable",
      "intricate", "nuanced", "multifaceted", "comprehensive",
      "streamline", "streamlines", "streamlined",
      "underscore", "underscores", "underscored",
      "robust", "scalable", "holistic", "synergy", "synergistic",
      "optimal", "optimize", "optimizes", "optimized",
      "transformative", "groundbreaking", "revolutionary",
      "foster", "fosters", "fostered", "fostering",
      "ensure", "ensures", "ensured", "ensuring",
      "facilitate", "facilitates", "facilitated",
      "implement", "implements", "implemented", "implementing",
      "demonstrate", "demonstrates", "demonstrated",
      "encompass", "encompasses", "encompassed",
      "navigate", "navigates", "navigated", "navigating",
      "empower", "empowers", "empowered", "empowering",
      "paradigm", "paradigms", "ecosystem", "ecosystems",
    ]);

    const aiPhrases = [
      "it's worth noting", "it is worth noting",
      "it's important to note", "it is important to note",
      "in conclusion", "in summary", "to summarize",
      "as mentioned", "as previously mentioned",
      "needless to say", "it goes without saying",
      "rest assured", "a testament to",
      "it's crucial to", "it is crucial to",
      "plays a vital role", "play a vital role",
      "when it comes to", "dive deep", "deep dive",
    ];

    const lowerText = text.toLowerCase();
    let wordMatches = 0;
    words.forEach((w) => { if (aiWords.has(w)) wordMatches++; });

    let phraseMatches = 0;
    aiPhrases.forEach((p) => { if (lowerText.includes(p)) phraseMatches++; });

    const wordScore = Math.min((wordMatches / Math.max(words.length, 1)) * 1000, 50);
    const phraseScore = Math.min(phraseMatches * 8, 40);
    return Math.min(wordScore + phraseScore, 100);
  }

  // High transition density is a strong AI signal
  calculateTransitionDensity(text, sentences) {
    if (sentences.length === 0) return 0;
    const transitions = [
      /\bfurthermore\b/gi, /\bmoreover\b/gi, /\badditionally\b/gi,
      /\bhowever\b/gi, /\bnevertheless\b/gi, /\bconsequently\b/gi,
      /\btherefore\b/gi, /\bthus\b/gi, /\bhence\b/gi,
      /\bsimilarly\b/gi, /\blikewise\b/gi, /\bconversely\b/gi,
      /\bsubsequently\b/gi, /\bultimately\b/gi, /\bnotably\b/gi,
      /\bspecifically\b/gi, /\bin addition\b/gi, /\bfor instance\b/gi,
      /\bfor example\b/gi, /\bin contrast\b/gi, /\bin particular\b/gi,
    ];
    let count = 0;
    transitions.forEach((re) => { count += (text.match(re) || []).length; });
    return (count / sentences.length) * 10; // transitions per sentence × 10
  }

  // Passive voice ratio — AI tends to use more passive constructions
  calculatePassiveVoiceRatio(sentences) {
    if (sentences.length === 0) return 0;
    const passivePattern = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
    let passiveCount = 0;
    sentences.forEach((s) => {
      if (passivePattern.test(s)) passiveCount++;
      passivePattern.lastIndex = 0;
    });
    return (passiveCount / sentences.length) * 100;
  }

  // Low CV = very uniform sentence lengths = AI-like
  calculateSentenceLengthCV(sentences) {
    if (sentences.length < 3) return 0.5;
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (mean === 0) return 0;
    const stdDev = Math.sqrt(lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length);
    return stdDev / mean; // coefficient of variation; lower = more uniform = more AI-like
  }

  // Hedge language: "it seems", "appears to", "may suggest" etc.
  calculateHedgeLanguageScore(text) {
    const hedges = [
      /\bit seems\b/gi, /\bit appears\b/gi, /\bone might\b/gi,
      /\bcould be\b/gi, /\bmay suggest\b/gi, /\bappears to\b/gi,
      /\bseems to\b/gi, /\btends to\b/gi, /\bcan be\b/gi,
      /\boften\b/gi, /\btypically\b/gi, /\bgenerally\b/gi,
    ];
    let count = 0;
    hedges.forEach((re) => { count += (text.match(re) || []).length; });
    const words = text.split(/\s+/).length;
    return Math.min((count / Math.max(words, 1)) * 1000, 100);
  }

  calculateAIScore(features) {
    let score = 0;
    const breakdown = {};

    // 1. Perplexity (low = predictable = AI-like). Max 20 pts.
    let perplexityScore = 0;
    if (features.perplexity < 20) perplexityScore = 20;
    else if (features.perplexity < 40) perplexityScore = 14;
    else if (features.perplexity < 70) perplexityScore = 7;
    else if (features.perplexity < 100) perplexityScore = 3;
    breakdown.perplexity = perplexityScore;
    score += perplexityScore;

    // 2. AI Vocabulary. Max 25 pts.
    const vocabScore = Math.round((features.aiVocabScore / 100) * 25);
    breakdown.aiVocab = vocabScore;
    score += vocabScore;

    // 3. Transition density. Max 20 pts.
    let transScore = 0;
    if (features.transitionDensity > 3) transScore = 20;
    else if (features.transitionDensity > 2) transScore = 14;
    else if (features.transitionDensity > 1) transScore = 8;
    else if (features.transitionDensity > 0.5) transScore = 4;
    breakdown.transitions = transScore;
    score += transScore;

    // 4. Burstiness (low = uniform sentence lengths = AI-like). Max 15 pts.
    let burstScore = 0;
    if (features.burstiness < 0.3) burstScore = 15;
    else if (features.burstiness < 0.6) burstScore = 8;
    else if (features.burstiness < 1.0) burstScore = 3;
    breakdown.burstiness = burstScore;
    score += burstScore;

    // 5. Sentence Length CV (low = uniform = AI). Max 10 pts.
    let cvScore = 0;
    if (features.sentenceLengthCV < 0.2) cvScore = 10;
    else if (features.sentenceLengthCV < 0.35) cvScore = 6;
    else if (features.sentenceLengthCV < 0.5) cvScore = 2;
    breakdown.uniformity = cvScore;
    score += cvScore;

    // 6. Repetition. Max 5 pts.
    let repScore = 0;
    if (features.repetition > 15) repScore = 5;
    else if (features.repetition > 8) repScore = 3;
    breakdown.repetition = repScore;
    score += repScore;

    // 7. Passive voice ratio. Max 5 pts.
    let passiveScore = 0;
    if (features.passiveVoiceRatio > 40) passiveScore = 5;
    else if (features.passiveVoiceRatio > 25) passiveScore = 3;
    breakdown.passiveVoice = passiveScore;
    score += passiveScore;

    // Short text — reduce confidence
    if (features.wordCount < 30) {
      score = Math.round(score * 0.6);
    } else if (features.wordCount < 60) {
      score = Math.round(score * 0.8);
    }

    return { score: Math.min(Math.max(score, 0), 100), breakdown };
  }

  findAIPatterns(text, score) {
    if (score < 30) return [];
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const patterns = [
      { re: /\bhowever[,\s]/i, label: "contrast_opener" },
      { re: /\bmoreover[,\s]/i, label: "addition_transition" },
      { re: /\bfurthermore[,\s]/i, label: "addition_transition" },
      { re: /\bin conclusion[,\s]/i, label: "concluding_phrase" },
      { re: /\bit('s| is) (important|crucial|worth) to/i, label: "ai_hedging" },
      { re: /\bthis (suggests|indicates|demonstrates)/i, label: "analytical_phrase" },
      { re: /\bas a result[,\s]/i, label: "causal_transition" },
      { re: /\bultimately[,\s]/i, label: "concluding_adverb" },
      { re: /\bunderscores? the/i, label: "ai_vocabulary" },
      { re: /\bdelv(e|es|ing) (into|deeper)/i, label: "ai_vocabulary" },
      { re: /\bleverage[sd]?\b/i, label: "ai_vocabulary" },
      { re: /\bcomprehensive(ly)?\b/i, label: "ai_vocabulary" },
    ];
    const matches = [];
    sentences.forEach((sentence) => {
      const clean = sentence.trim();
      if (clean.split(/\s+/).length < 5) return;
      patterns.forEach(({ re, label }) => {
        if (re.test(clean) && !matches.some((m) => m.text === clean.substring(0, 100))) {
          matches.push({ text: clean.substring(0, 100), pattern: label, score: Math.min(score + 5, 95) });
        }
      });
    });
    return matches.slice(0, 5);
  }

  generateReasoning(features, score, breakdown) {
    const signals = [];

    if (breakdown.aiVocab >= 12) signals.push("heavy use of AI-associated vocabulary");
    if (breakdown.transitions >= 12) signals.push("high density of transition phrases");
    if (breakdown.perplexity >= 14) signals.push("low linguistic perplexity (predictable word choices)");
    if (breakdown.burstiness >= 12) signals.push("very uniform sentence lengths");
    if (breakdown.uniformity >= 8) signals.push("consistent sentence structure throughout");
    if (breakdown.passiveVoice >= 3) signals.push("frequent passive voice constructions");

    if (score >= 75) {
      return `Strong AI indicators: ${signals.length > 0 ? signals.join(", ") : "multiple statistical markers"}.`;
    } else if (score >= 50) {
      return `Moderate AI signals detected${signals.length > 0 ? ": " + signals.slice(0, 2).join(", ") : ""}. Could be AI-assisted or heavily edited.`;
    } else if (score >= 30) {
      return `Weak AI signals. Text shows some patterns consistent with AI generation but also natural variation.`;
    } else {
      return `Likely human-written. Text shows natural variability in structure, vocabulary, and sentence length.`;
    }
  }

  // ─── History / Settings / Feedback ───────────────────────────────────────

  async getHistory(sendResponse) {
    try {
      const response = await this.apiRequest("/history", { method: "GET" });
      sendResponse({ success: true, data: response.data });
    } catch (error) {
      sendResponse({ success: false, error: "Failed to fetch history" });
    }
  }

  async clearHistory(sendResponse) {
    try {
      await this.apiRequest("/history", { method: "DELETE" });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: "Failed to clear history" });
    }
  }

  async saveHistory(entry, sendResponse) {
    // Always write to local storage first so options page always has data
    try {
      const { ds_history = [] } = await chrome.storage.local.get("ds_history");
      const localEntry = {
        ...entry,
        id: entry.id || ("h-" + Date.now()),
        timestamp: entry.timestamp || new Date().toISOString(),
      };
      ds_history.unshift(localEntry);
      await chrome.storage.local.set({ ds_history: ds_history.slice(0, 500) });
    } catch (_) {}
    // Also sync to server (non-blocking)
    try {
      const response = await this.apiRequest("/history", { method: "POST", body: entry });
      sendResponse({ success: true, data: response.data });
    } catch (error) {
      sendResponse({ success: true, local: true }); // local save succeeded
    }
  }

  async deleteHistoryItem(id, sendResponse) {
    try {
      await this.apiRequest(`/history/${id}`, { method: "DELETE" });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: "Failed to delete history item" });
    }
  }

  async submitFeedback(feedback, sendResponse) {
    // Save locally first — always succeeds
    try {
      const { ds_feedback = [] } = await chrome.storage.local.get("ds_feedback");
      const entry = { ...feedback, id: feedback.id || ("fb-" + Date.now()), timestamp: feedback.timestamp || new Date().toISOString(), synced: false };
      ds_feedback.unshift(entry);
      await chrome.storage.local.set({ ds_feedback: ds_feedback.slice(0, 200) });
    } catch (_) {}
    sendResponse({ success: true });
    // Sync to server in background (non-blocking)
    this.apiRequest("/feedback", { method: "POST", body: feedback })
      .then(async () => {
        const { ds_feedback = [] } = await chrome.storage.local.get("ds_feedback");
        const updated = ds_feedback.map(f => f.id === feedback.id ? { ...f, synced: true } : f);
        await chrome.storage.local.set({ ds_feedback: updated });
      })
      .catch(() => {});
  }

  async getFeedback(sendResponse) {
    // Return local cache immediately — no waiting on server
    const { ds_feedback = [] } = await chrome.storage.local.get("ds_feedback").catch(() => ({ ds_feedback: [] }));
    sendResponse({ success: true, data: ds_feedback });
    // Sync from server in background and update local cache
    this.apiRequest("/feedback", { method: "GET" })
      .then(async r => {
        if (Array.isArray(r.data) && r.data.length > 0) {
          const serverIds = new Set(r.data.map(i => i.id || i._id).filter(Boolean));
          const { ds_feedback: local = [] } = await chrome.storage.local.get("ds_feedback");
          const localOnly = local.filter(i => !serverIds.has(i.id));
          await chrome.storage.local.set({ ds_feedback: [...r.data, ...localOnly].slice(0, 200) });
        }
      })
      .catch(() => {});
  }

  // ─── Image / Video Analysis ───────────────────────────────────────────────

  async uploadBase64File(base64Data, filename) {
    const spaceUrl = "https://jabrave-deepfake-api.hf.space";
    const response = await fetch(base64Data);
    const fileBlob = await response.blob();
    const form = new FormData();
    form.append("files", fileBlob, filename);
    const uploadRes = await fetch(`${spaceUrl}/gradio_api/upload`, { method: "POST", body: form });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const result = await uploadRes.json();
    return result[0];
  }

  async callGradioPredict(mediaUrl, isVideo = false, customFilename = null) {
    const spaceUrl = "https://jabrave-deepfake-api.hf.space";
    const endpoint = isVideo ? "predict_video" : "predict";
    const filename = customFilename || (isVideo ? "video.mp4" : "image.png");
    const mimeType = isVideo ? "video/mp4" : "image/png";

    const isServerPath = mediaUrl.startsWith("/") || mediaUrl.includes("/tmp/");
    const dataPayload = { path: mediaUrl, meta: { _type: "gradio.FileData" }, orig_name: filename };
    if (!isServerPath) {
      dataPayload.url = mediaUrl;
      dataPayload.mime_type = mimeType;
    }

    const callRes = await fetch(`${spaceUrl}/gradio_api/call/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [dataPayload] }),
    });
    if (!callRes.ok) throw new Error(`Gradio POST failed: ${callRes.status}`);

    const { event_id } = await callRes.json();
    if (!event_id) throw new Error("No event_id from Gradio");

    const streamRes = await fetch(`${spaceUrl}/gradio_api/call/${endpoint}/${event_id}`);
    if (!streamRes.ok) throw new Error(`Gradio stream failed: ${streamRes.status}`);

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let predictionData = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      let currentEvent = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.replace("event:", "").trim();
        } else if (trimmed.startsWith("data:")) {
          const dataStr = trimmed.replace("data:", "").trim();
          if (currentEvent === "complete") {
            try {
              const parsed = JSON.parse(dataStr);
              predictionData = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch (e) { /* ignore */ }
          } else if (currentEvent === "error") {
            throw new Error(`Gradio error: ${dataStr}`);
          }
        }
      }
      if (predictionData) break;
    }
    return predictionData;
  }

  parseGradioScore(apiResult) {
    if (!apiResult) return null;
    const label = (apiResult.label || "unknown").toLowerCase();

    // Gradio standard output has a `confidences` array with 0-1 values.
    // `final_score` is a custom field that may or may not be present.
    let finalScore = Number(apiResult.final_score) || 0;

    if (!finalScore && Array.isArray(apiResult.confidences) && apiResult.confidences.length) {
      // Find the confidence for the predicted label; fall back to first entry
      const match = apiResult.confidences.find(
        c => c.label && c.label.toLowerCase() === label
      ) || apiResult.confidences[0];
      // confidences are 0–1 fractions → convert to 0–100
      finalScore = Math.round((match?.confidence || 0) * 100);
    }

    // score: 0 = human/real, 100 = AI/fake
    let score;
    if (label === "fake" || label === "ai" || label === "artificial") {
      score = finalScore;
    } else if (label === "real" || label === "human") {
      score = 100 - finalScore;
    } else {
      // unknown — treat finalScore as AI probability directly
      score = finalScore;
    }
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  async analyzeImages(images, sendResponse) {
    const startTime = Date.now();
    try {
      const validImages = images.filter((img) => img.src && !img.src.startsWith("data:") && img.src.length > 10);
      const targetImages = validImages.slice(0, 3);
      let aiDetected = 0;

      const promises = targetImages.map(async (img) => {
        try {
          const apiResult = await this.callGradioPredict(img.src, false);
          const score = this.parseGradioScore(apiResult);
          if (score !== null) {
            if (score >= 50) aiDetected++;
            return { src: img.src, score, features: { apiRaw: apiResult }, timestamp: new Date().toISOString() };
          }
        } catch (err) {
          console.error("HF API failed for image:", img.src, err);
        }
        const localRes = this.performImageAnalysis(img);
        if (localRes.score >= 50) aiDetected++;
        return localRes;
      });

      const results = await Promise.all(promises);
      sendResponse({ success: true, aiDetected, totalAnalyzed: targetImages.length, images: results, processingTime: Date.now() - startTime });
    } catch (error) {
      sendResponse({ success: false, error: "Image analysis failed" });
    }
  }

  async analyzeVideo(videoUrl, sendResponse) {
    const startTime = Date.now();
    try {
      const apiResult = await this.callGradioPredict(videoUrl, true);
      const score = this.parseGradioScore(apiResult);
      if (score !== null) {
        sendResponse({
          success: true, score, confidence: score, source: "ai_model",
          reasoning: `Label: ${(apiResult.label || "").toUpperCase()} · Score: ${apiResult.final_score || 0}% · Fake frames: ${apiResult.fake_frames || 0}/${apiResult.total_frames || 0}`,
          processingTime: Date.now() - startTime,
        });
      } else {
        sendResponse({ success: false, error: "Failed to parse video prediction" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message || "Video analysis failed" });
    }
  }

  async analyzeUploadedImage(base64Data, filename, sendResponse) {
    const startTime = Date.now();
    try {
      // Pro users skip quota check entirely
      const { ds_pro_activated } = await chrome.storage.local.get("ds_pro_activated");
      // Check + increment media usage before calling HuggingFace
      const usageCheck = ds_pro_activated
        ? { data: { allowed: true } }
        : await this.apiRequest("/media/check", { method: "POST", body: { type: "image" } })
            .catch((err) => err.payload || null);
      if (usageCheck && usageCheck.data && usageCheck.data.allowed === false) {
        sendResponse({
          success: false,
          mediaLimitReached: true,
          authRequired: !!usageCheck.data.authRequired,
          upgradeRequired: !!usageCheck.data.upgradeRequired,
          message: usageCheck.message || "Scan limit reached.",
        });
        return;
      }

      const serverPath = await this.uploadBase64File(base64Data, filename);
      const apiResult = await this.callGradioPredict(serverPath, false, filename);
      const score = this.parseGradioScore(apiResult);
      if (score !== null) {
        sendResponse({
          success: true, score, confidence: score, source: "ai_model",
          reasoning: `Label: ${(apiResult.label || "").toUpperCase()} · Score: ${apiResult.final_score || 0}% · Face score: ${apiResult.face_score || 0}%`,
          processingTime: Date.now() - startTime,
        });
      } else {
        sendResponse({ success: false, error: "Failed to parse image prediction" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message || "Image analysis failed" });
    }
  }

  async analyzeUploadedVideo(base64Data, filename, sendResponse) {
    const startTime = Date.now();
    try {
      // Pro users skip quota check entirely
      const { ds_pro_activated } = await chrome.storage.local.get("ds_pro_activated");
      // Check + increment media usage before calling HuggingFace
      const usageCheck = ds_pro_activated
        ? { data: { allowed: true } }
        : await this.apiRequest("/media/check", { method: "POST", body: { type: "video" } })
            .catch((err) => err.payload || null);
      if (usageCheck && usageCheck.data && usageCheck.data.allowed === false) {
        sendResponse({
          success: false,
          mediaLimitReached: true,
          authRequired: !!usageCheck.data.authRequired,
          upgradeRequired: !!usageCheck.data.upgradeRequired,
          message: usageCheck.message || "Scan limit reached.",
        });
        return;
      }

      const serverPath = await this.uploadBase64File(base64Data, filename);
      const apiResult = await this.callGradioPredict(serverPath, true, filename);
      const score = this.parseGradioScore(apiResult);
      if (score !== null) {
        sendResponse({
          success: true, score, confidence: score, source: "ai_model",
          reasoning: `Label: ${(apiResult.label || "").toUpperCase()} · Score: ${apiResult.final_score || 0}% · Fake frames: ${apiResult.fake_frames || 0}/${apiResult.total_frames || 0}`,
          processingTime: Date.now() - startTime,
        });
      } else {
        sendResponse({ success: false, error: "Failed to parse video prediction" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message || "Video analysis failed" });
    }
  }

  performImageAnalysis(image) {
    const features = {
      sourceAIScore: this.analyzeImageSource(image.src),
      domainAIScore: this.analyzeImageDomain(image.src),
      altTextAnalysis: this.analyzeAltText(image.alt || ""),
      filenameAnalysis: this.analyzeFilename(image.src),
    };
    let score = 0;
    if (features.sourceAIScore > 0) score += 20;
    if (features.altTextAnalysis.hasAIPatterns) score += 40;
    if (features.filenameAnalysis.hasAIPatterns) score += 30;
    return { src: image.src, score: Math.min(score, 100), features, timestamp: new Date().toISOString() };
  }

  analyzeImageSource(src) {
    return ["midjourney", "dalle", "stable-diffusion", "generated"].some((s) => src.toLowerCase().includes(s)) ? 2 : 0;
  }

  analyzeImageDomain(src) {
    try {
      const url = new URL(src);
      return ["openai.com", "midjourney.com", "discordapp.com"].some((d) => url.hostname.includes(d)) ? 2 : 0;
    } catch { return 0; }
  }

  analyzeAltText(altText) {
    if (!altText) return { hasAlt: false, aiKeywords: [], hasAIPatterns: false };
    const aiPatterns = ["ai generated", "ai art", "midjourney", "dall-e", "stable diffusion"];
    const lower = altText.toLowerCase();
    const aiKeywords = aiPatterns.filter((p) => lower.includes(p));
    return { hasAlt: true, aiKeywords, hasAIPatterns: aiKeywords.length > 0 };
  }

  analyzeFilename(src) {
    const filename = src.split("/").pop().toLowerCase();
    const aiPatterns = ["generated", "v6", "upscaled", "grid", "dalle", "midjourney"];
    const matched = aiPatterns.filter((p) => filename.includes(p));
    return { aiPatterns: matched, hasAIPatterns: matched.length > 0 };
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async authRegister(email, password, sendResponse) {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        sendResponse({ success: false, error: data.message || "Registration failed." });
        return;
      }
      await this.setAuthToken(data.data.token);
      sendResponse({ success: true, data: data.data });
    } catch (err) {
      sendResponse({ success: false, error: "Could not reach server. Is it running?" });
    }
  }

  async authLogin(email, password, sendResponse) {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        sendResponse({ success: false, error: data.message || "Login failed." });
        return;
      }
      await this.setAuthToken(data.data.token);
      sendResponse({ success: true, data: data.data });
    } catch (err) {
      sendResponse({ success: false, error: "Could not reach server. Is it running?" });
    }
  }

  async authLogout(sendResponse) {
    await this.clearAuthToken();
    sendResponse({ success: true });
  }

  async authGetMe(sendResponse) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        sendResponse({ success: false, loggedOut: true });
        return;
      }
      const resp = await fetch(`${this.apiBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        await this.clearAuthToken();
        sendResponse({ success: false, loggedOut: true });
        return;
      }
      const data = await resp.json();
      sendResponse({ success: true, data: data.data });
    } catch (err) {
      sendResponse({ success: false, error: "Could not reach server." });
    }
  }

  // ─── Media Usage Check ────────────────────────────────────────────────────

  async checkMediaUsage(mediaType, sendResponse) {
    try {
      const response = await this.apiRequest("/media/check", {
        method: "POST",
        body: { type: mediaType },
      });
      sendResponse({ success: true, data: response.data });
    } catch (error) {
      if (error.payload?.data) {
        sendResponse({
          success: false,
          data: error.payload.data,
          message: error.payload.message || error.message,
        });
      } else {
        // Server down — allow locally (graceful degradation)
        sendResponse({ success: true, data: { allowed: true } });
      }
    }
  }

  // ─── OCR ──────────────────────────────────────────────────────────────────

  async performOcr(base64Data, fileType, sendResponse) {
    try {
      const ocrApiUrl = "https://api.ocr.space/parse/image";
      const formData = new FormData();

      // OCR.space accepts base64 for both images and PDFs
      // For PDFs the data URI must include the correct mime type prefix
      formData.append("base64Image", base64Data);
      formData.append("language", "eng");
      formData.append("isOverlayRequired", "false");
      formData.append("detectOrientation", "true");
      formData.append("scale", "true");
      formData.append("isTable", "false");
      // Engine 2 handles printed text and PDFs better than Engine 1
      formData.append("OCREngine", "2");
      if (fileType === "application/pdf") {
        formData.append("filetype", "PDF");
      }

      const resp = await fetch(ocrApiUrl, {
        method: "POST",
        headers: { apikey: "helloworld" }, // free public key
        body: formData,
      });

      if (!resp.ok) throw new Error(`OCR service error: ${resp.status}`);
      const data = await resp.json();

      if (data.IsErroredOnProcessing) {
        // Engine 2 sometimes fails on PDFs — retry with Engine 1
        if (fileType === "application/pdf") {
          formData.set("OCREngine", "1");
          const retry = await fetch(ocrApiUrl, {
            method: "POST",
            headers: { apikey: "helloworld" },
            body: formData,
          });
          const retryData = await retry.json();
          if (!retryData.IsErroredOnProcessing) {
            const text = retryData.ParsedResults?.map(r => r.ParsedText).join("\n\n").trim() || "";
            if (text) { sendResponse({ success: true, text }); return; }
          }
        }
        throw new Error(data.ErrorMessage?.[0] || "OCR processing failed");
      }

      const extractedText = data.ParsedResults
        ?.map(r => r.ParsedText)
        .join("\n\n")
        .trim() || "";

      if (!extractedText) {
        sendResponse({ success: false, error: "No text found. Try a higher-quality image or a text-based PDF." });
        return;
      }

      sendResponse({ success: true, text: extractedText });
    } catch (error) {
      sendResponse({ success: false, error: error.message || "OCR failed." });
    }
  }

  // ─── Sentence-Level Analysis (for text highlighting) ─────────────────────

  analyzeSentencesHandler(text, sendResponse) {
    try {
      const results = this.analyzeSentences(text);
      sendResponse({ success: true, data: results });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  analyzeSentences(text) {
    // Split on sentence-ending punctuation OR newlines, keeping delimiter with the chunk
    const raw = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If nothing split (e.g. no punctuation / newlines), chunk by ~120-char word boundaries
    const chunks = raw.length > 1 ? raw : this._chunkByWords(text, 25);

    let offset = 0;
    const sentences = chunks.map((chunk) => {
      const start = text.indexOf(chunk, offset);
      offset = start + chunk.length;
      return { text: chunk, start: start >= 0 ? start : 0 };
    });

    return sentences.map((s) => {
      const words = s.text.trim().split(/\s+/).filter(Boolean);
      if (words.length < 4) {
        return { ...s, score: 0, label: "short" };
      }
      const features = this.extractTextFeatures(s.text);
      const { score } = this.calculateAIScore(features);
      // Lower thresholds for sentence-level: short sentences have less signal
      const label = score >= 55 ? "high" : score >= 28 ? "medium" : "low";
      return { ...s, score, label };
    });
  }


  _chunkByWords(text, wordsPerChunk = 25) {
    const words = text.trim().split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    }
    return chunks;
  }

  initializeContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'ds-analyze-image', title: 'Analyze with Deep Shield', contexts: ['image'] });
      chrome.contextMenus.create({ id: 'ds-analyze-video', title: 'Analyze Video with Deep Shield', contexts: ['video'] });
    });
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (!tab || !tab.id || !info.srcUrl) return;
      const src = info.srcUrl;
      const handler = (result) => {
        chrome.tabs.sendMessage(tab.id, { type: 'inlineAnalysisResult', result, position: { fromContextMenu: true } }).catch(() => {});
      };
      if (info.menuItemId === 'ds-analyze-image') this.analyzePageImageHandler(src, handler);
      if (info.menuItemId === 'ds-analyze-video') this.analyzePageVideoHandler(src, handler);
    });
  }

  async fetchAsBase64(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 20 * 1024 * 1024) {
        throw new Error('File too large for inline analysis (max 20 MB).');
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
      }
      return btoa(binary);
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyzePageImageHandler(src, sendResponse) {
    try {
      const base64 = await this.fetchAsBase64(src);
      const filename = (src.split('/').pop().split('?')[0] || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      await this.analyzeUploadedImage(base64, filename, sendResponse);
    } catch (e) {
      sendResponse({ success: false, error: e.message || 'Image fetch failed' });
    }
  }

  async analyzePageVideoHandler(src, sendResponse) {
    try {
      const base64 = await this.fetchAsBase64(src);
      const filename = (src.split('/').pop().split('?')[0] || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
      await this.analyzeUploadedVideo(base64, filename, sendResponse);
    } catch (e) {
      sendResponse({ success: false, error: e.message || 'Video fetch failed' });
    }
  }

  // A+B: analyse canvas frames extracted by content script
  async analyzeVideoFramesHandler(frames, sendResponse) {
    const startTime = Date.now();
    if (!frames || frames.length === 0) {
      sendResponse({ success: false, error: 'No frames provided' });
      return;
    }

    // Analyze all frames in parallel with a 25-second hard timeout per frame
    // Pass full data URL -- uploadBase64File uses fetch(dataUrl) which requires it
    const analyzeOne = (frameDataUrl) => new Promise((resolve) => {
      if (!frameDataUrl || !frameDataUrl.startsWith('data:')) { resolve(null); return; }
      const timer = setTimeout(() => resolve(null), 25000);
      this.analyzeUploadedImage(frameDataUrl, 'frame.jpg', (r) => {
        clearTimeout(timer);
        resolve(r && r.success ? (r.score || 0) : null);
      });
    });

    const settled = await Promise.all(frames.map(analyzeOne));
    const results = settled.filter(s => s !== null);

    if (results.length === 0) {
      sendResponse({ success: false, error: 'All frame analyses failed' });
      return;
    }

    const aiScore = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    sendResponse({
      success: true,
      aiScore,
      framesAnalyzed: results.length,
      frameScores: results,
      processingTime: Date.now() - startTime,
    });
  }
}

const detector = new AIDetectorBackground();
