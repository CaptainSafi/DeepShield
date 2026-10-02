// content.js — Content Script (injected into every page)
// Two classes:
//   ContentScript  — handles page text extraction and highlight rendering
//   DeepShieldInline — floating inline UI: image hover badges, video analyze button

class ContentScript {
  constructor() {
    this.highlightedElements = new Set();
    this.initialize();
  }

  // ─── Message Listener ──────────────────────────────────────────────────
  initialize() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.type) {
        case "extractText":
          this.extractText(sendResponse);
          return true;
        case "extractImages":
          this.extractImages(sendResponse);
          return true;
        case "extractVideos":
          this.extractVideos(sendResponse);
          return true;
        case "highlightText":
          this.highlightText(request.data);
          sendResponse({ success: true });
          break;
        case "highlightImages":
          this.highlightImages(request.data);
          sendResponse({ success: true });
          break;
        case "clearHighlights":
          this.clearHighlights();
          sendResponse({ success: true });
          break;
      }
    });
  }

  extractText(sendResponse) {
    try {
      const text = this.getAllTextContent();
      sendResponse({
        success: true,
        text: text,
        characterCount: text.length,
        wordCount: text.split(/\s+/).filter((word) => word.length > 0).length,
      });
    } catch (error) {
      console.error("Error extracting text:", error);
      sendResponse({
        success: false,
        error: "Failed to extract text from page",
      });
    }
  }

  getAllTextContent() {
    const bodyText = document.body.innerText || "";

    const unwantedSelectors = [
      "script",
      "style",
      "noscript",
      "iframe",
      "canvas",
      "svg",
      "nav",
      "footer",
      "header",
      ".ad",
      ".advertisement",
      ".banner",
      ".menu",
      ".sidebar",
      ".comments",
      ".social-share",
    ];

    let cleanText = bodyText;

    unwantedSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        const elementText = element.textContent || "";
        cleanText = cleanText.replace(elementText, "");
      });
    });

    cleanText = cleanText
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return cleanText.substring(0, 10000);
  }

  highlightText(data) {
    this.clearHighlights();

    if (!data.matches || data.matches.length === 0) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (
            node.parentElement &&
            !["SCRIPT", "STYLE", "NOSCRIPT"].includes(
              node.parentElement.tagName
            ) &&
            node.textContent.trim().length > 20
          ) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        },
      }
    );

    let node;
    const textNodes = [];

    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    data.matches.forEach((match) => {
      if (match.score >= 50) {
        textNodes.forEach((textNode) => {
          const nodeText = textNode.textContent;
          if (nodeText.includes(match.text)) {
            this.highlightNode(textNode, match.text, data);
          }
        });
      }
    });
  }

  highlightNode(textNode, textToHighlight, data) {
    const parent = textNode.parentNode;
    if (!parent || parent.classList.contains("ai-highlighted")) return;

    const text = textNode.textContent;
    const index = text.indexOf(textToHighlight);

    if (index === -1) return;

    const before = text.substring(0, index);
    const match = text.substring(index, index + textToHighlight.length);
    const after = text.substring(index + textToHighlight.length);

    const beforeNode = document.createTextNode(before);
    const matchNode = this.createHighlightSpan(match, data);
    const afterNode = document.createTextNode(after);

    parent.replaceChild(beforeNode, textNode);
    parent.insertBefore(matchNode, beforeNode.nextSibling);
    parent.insertBefore(afterNode, matchNode.nextSibling);

    this.highlightedElements.add(parent);
  }

  createHighlightSpan(text, data) {
    const span = document.createElement("span");
    span.className = "ai-highlighted";
    span.textContent = text;

    const score = data.score || 0;
    const isAI = score >= 50;
    const status = isAI ? "AI-Generated" : "Original Content";
    const features = data.features || {};

    const intensity = Math.min(score / 100, 0.8);
    const opacity = 0.3 + intensity * 0.5;

    span.style.cssText = `
            background: rgba(231, 76, 60, ${opacity});
            border: 2px solid rgba(231, 76, 60, ${intensity});
            border-radius: 3px;
            padding: 2px 4px;
            margin: 0 1px;
            cursor: help;
            position: relative;
        `;

    span.title = `
    Content Type: Universal (Text, Articles, Blogs, Video Analysis)
    Status: ${status}
    Confidence: ${score}%

    Analysis Details:
    • Perplexity: ${
      features.perplexity ? features.perplexity.toFixed(2) : "N/A"
    }
    • Burstiness: ${
      features.burstiness ? features.burstiness.toFixed(2) : "N/A"
    }
    • Repetition Score: ${
      features.repetition ? features.repetition.toFixed(2) : "N/A"
    }
    • Uniqueness: ${
      features.uniqueness ? features.uniqueness.toFixed(2) : "N/A"
    }
    • Readability: ${
      features.readability ? features.readability.toFixed(2) : "N/A"
    }
    `;

    span.addEventListener("mouseenter", (e) => {
      e.target.style.boxShadow = "0 0 8px rgba(231, 76, 60, 0.6)";
    });

    span.addEventListener("mouseleave", (e) => {
      e.target.style.boxShadow = "none";
    });

    return span;
  }

  extractImages(sendResponse) {
    try {
      const images = Array.from(document.querySelectorAll("img")).filter(
        (img) => {
          const src = img.src || "";
          return src && !src.startsWith("data:") && src.length > 10;
        }
      );

      const imageData = images.map((img, index) => ({
        id: `img-${index}`,
        src: img.src,
        alt: img.alt || "",
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        crossOrigin: img.crossOrigin,
        currentSrc: img.currentSrc,
      }));

      sendResponse({
        success: true,
        images: imageData,
        totalCount: imageData.length,
      });
    } catch (error) {
      console.error("Error extracting images:", error);
      sendResponse({
        success: false,
        error: "Failed to extract images from page",
        images: [],
      });
    }
  }

  extractVideos(sendResponse) {
    try {
      const videos = [];
      document.querySelectorAll("video").forEach((video) => {
        const src = video.src || "";
        if (src && !src.startsWith("blob:") && !src.startsWith("data:") && src.length > 10) {
          videos.push(src);
        }
        video.querySelectorAll("source").forEach((source) => {
          const sourceSrc = source.src || "";
          if (sourceSrc && !sourceSrc.startsWith("blob:") && !sourceSrc.startsWith("data:") && sourceSrc.length > 10) {
            videos.push(sourceSrc);
          }
        });
      });
      document.querySelectorAll("source").forEach((source) => {
        const src = source.src || "";
        if (src && !src.startsWith("blob:") && !src.startsWith("data:") && src.length > 10) {
          videos.push(src);
        }
      });
      const uniqueVideos = Array.from(new Set(videos));
      sendResponse({
        success: true,
        videos: uniqueVideos,
        totalCount: uniqueVideos.length,
      });
    } catch (error) {
      console.error("Error extracting videos:", error);
      sendResponse({
        success: false,
        error: "Failed to extract videos from page",
        videos: [],
      });
    }
  }

  highlightImages(data) {
    this.clearImageHighlights();

    if (!data.images || data.images.length === 0) return;

    data.images.forEach((imageResult) => {
      if (imageResult.score >= 50) {
        const imgElement = document.querySelector(
          `img[src="${imageResult.src}"]`
        );
        if (
          imgElement &&
          !imgElement.classList.contains("ai-image-highlighted")
        ) {
          this.highlightImageElement(imgElement, imageResult);
        }
      }
    });
  }

  highlightImageElement(imgElement, imageResult) {
    const wrapper = document.createElement("div");
    wrapper.className = "ai-image-highlighted";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    wrapper.style.maxWidth = "100%";

    const overlay = document.createElement("div");
    overlay.className = "ai-image-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.backgroundColor = "rgba(231, 76, 60, 0.3)";
    overlay.style.border = "3px solid rgba(231, 76, 60, 0.8)";
    overlay.style.borderRadius = "4px";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "1000";

    const badge = document.createElement("div");
    badge.className = "ai-image-badge";
    badge.style.position = "absolute";
    badge.style.top = "5px";
    badge.style.right = "5px";
    badge.style.background = "rgba(231, 76, 60, 0.9)";
    badge.style.color = "white";
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "3px";
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "bold";
    badge.style.zIndex = "1001";
    badge.textContent = `AI ${imageResult.score}%`;

    const tooltip = document.createElement("div");
    tooltip.className = "ai-image-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.bottom = "5px";
    tooltip.style.left = "5px";
    tooltip.style.right = "5px";
    tooltip.style.background = "rgba(0, 0, 0, 0.8)";
    tooltip.style.color = "white";
    tooltip.style.padding = "4px 6px";
    tooltip.style.borderRadius = "3px";
    tooltip.style.fontSize = "10px";
    tooltip.style.zIndex = "1001";
    tooltip.style.display = "none";
    tooltip.textContent = this.generateImageTooltip(imageResult);

    wrapper.appendChild(imgElement.cloneNode(true));
    wrapper.appendChild(overlay);
    wrapper.appendChild(badge);
    wrapper.appendChild(tooltip);

    imgElement.parentNode.replaceChild(wrapper, imgElement);

    wrapper.addEventListener("mouseenter", () => {
      tooltip.style.display = "block";
      overlay.style.backgroundColor = "rgba(231, 76, 60, 0.5)";
    });

    wrapper.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
      overlay.style.backgroundColor = "rgba(231, 76, 60, 0.3)";
    });

    this.highlightedElements.add(wrapper);
  }

  generateImageTooltip(imageResult) {
    return (
      `AI Detection: ${imageResult.score}%\n` +
      `Confidence: ${imageResult.confidence || "Medium"}\n` +
      `Signs: ${imageResult.signs?.join(", ") || "AI characteristics detected"}`
    );
  }

  clearImageHighlights() {
    const highlightedImages = document.querySelectorAll(
      ".ai-image-highlighted"
    );
    highlightedImages.forEach((wrapper) => {
      const imgElement = wrapper.querySelector("img");
      if (imgElement && wrapper.parentNode) {
        wrapper.parentNode.replaceChild(imgElement, wrapper);
      }
    });
  }

  clearHighlights() {
    this.clearImageHighlights();

    this.highlightedElements.forEach((element) => {
      const highlightedSpans = element.querySelectorAll(".ai-highlighted");
      highlightedSpans.forEach((span) => {
        const text = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(text, span);
      });
    });

    this.highlightedElements.clear();
  }
}

new ContentScript();


// ==========================================================
// DEEP SHIELD INLINE FEATURES
// Badge · Drag-zone · Video overlay · queues media for popup
// ==========================================================


// ─── Inline Detection UI ─────────────────────────────────────────────────────
class DeepShieldInline {
  constructor() {
    this.dropZone    = null;
    this._draggedImg = null;
    this.videoButtons = new Map();
    this.observer    = null;
    this.init();
  }

  init() {
    this.injectStyles();
    this.setupImageHoverBadges();
    this.setupDragDropZone();
    this.setupVideoOverlays();
    this.setupMutationObserver();
  }

  // ---- STYLES ----

  injectStyles() {
    if (document.getElementById('ds-inline-styles')) return;
    const s = document.createElement('style');
    s.id = 'ds-inline-styles';
    s.textContent = `
      .ds-badge {
        width: 26px; height: 26px;
        background: rgba(13,15,30,0.88);
        border: 1.5px solid rgba(139,92,246,0.7);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 2147483640;
        font-size: 13px; line-height: 1;
        transition: background 0.15s, transform 0.15s, box-shadow 0.15s, opacity 0.15s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      }
      .ds-badge:hover { background: rgba(139,92,246,0.9); transform: scale(1.15); box-shadow: 0 0 10px rgba(139,92,246,0.5); }
      .ds-badge.ds-loading { animation: ds-spin 0.9s linear infinite; opacity: 1; pointer-events: none; }
      @keyframes ds-spin { to { transform: rotate(360deg); } }

      .ds-drop-zone {
        position: fixed; bottom: 28px; right: 28px;
        width: 170px; height: 76px;
        background: rgba(13,15,30,0.96);
        border: 2px dashed rgba(139,92,246,0.85);
        border-radius: 14px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 2147483647; color: #c4b5fd;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px; font-weight: 600; gap: 4px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        pointer-events: all; user-select: none; transition: all 0.2s ease;
      }
      .ds-drop-zone.ds-drag-over { background: rgba(139,92,246,0.18); border-color: #a78bfa; box-shadow: 0 0 24px rgba(139,92,246,0.45); transform: scale(1.04); }
      .ds-drop-zone-icon { font-size: 20px; }

      .ds-video-btn {
        position: fixed;
        background: rgba(13,15,30,0.92);
        border: 1.5px solid rgba(139,92,246,0.65);
        border-radius: 7px; padding: 4px 10px;
        color: #c4b5fd;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px; font-weight: 600;
        cursor: pointer; z-index: 2147483647;
        display: flex; align-items: center; gap: 5px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        transition: background 0.15s, box-shadow 0.15s, opacity 0.15s;
        pointer-events: none; white-space: nowrap; user-select: none; opacity: 0;
      }
      .ds-video-btn:hover { background: rgba(139,92,246,0.88); box-shadow: 0 0 10px rgba(139,92,246,0.5); }
      .ds-video-btn:disabled { opacity: 0.7; cursor: default; pointer-events: none; }
      .ds-video-wrapper { position: relative !important; display: inline-block !important; }

      /* Live score badge (B) */

      /* Inline score overlay after analysis */
      .ds-video-score {
        position: absolute; bottom: 10px; right: 10px;
        background: rgba(13,15,30,0.92);
        border-radius: 7px; padding: 5px 10px;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px; font-weight: 600;
        z-index: 2147483640; pointer-events: none;
        display: flex; align-items: center; gap: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        border: 1.5px solid rgba(255,255,255,0.08);
      }

      .ds-toast {
        position: fixed; z-index: 2147483647;
        background: rgba(13,15,30,0.97);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 10px; padding: 10px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px; color: #e2e8f0;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55);
        max-width: 240px; pointer-events: none;
        animation: ds-fadein 0.2s ease forwards;
      }
      @keyframes ds-fadein { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- IMAGE HOVER BADGE ----

  setupImageHoverBadges() {
    // Single floating badge — no DOM restructuring, zero layout breakage
    const badge = document.createElement('div');
    badge.className = 'ds-badge';
    badge.title = 'Analyze with Deep Shield';
    badge.textContent = '🛡️';
    badge.style.cssText = 'position:fixed;opacity:0;pointer-events:none;transition:opacity 0.15s;';
    document.documentElement.appendChild(badge);

    let currentImg = null;
    let hideTimer  = null;

    const show = (img) => {
      const r = img.getBoundingClientRect();
      if (r.width < 80 || r.height < 80) return;
      const src = img.currentSrc || img.src || '';
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
      // Reset badge to shield icon when hovering a new image
      if (currentImg !== img) {
        badge.textContent = '🛡️';
        badge.classList.remove('ds-loading');
      }
      currentImg = img;
      clearTimeout(hideTimer);
      badge.style.top    = (r.top  + 6) + 'px';
      badge.style.left   = (r.right - 32) + 'px';
      badge.style.opacity       = '1';
      badge.style.pointerEvents = 'all';
    };

    const hide = () => {
      badge.style.opacity       = '0';
      badge.style.pointerEvents = 'none';
      currentImg = null;
    };

    document.addEventListener('mouseover', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      show(img);
    }, true);

    document.addEventListener('mouseout', (e) => {
      if (!e.target.closest('img')) return;
      const to = e.relatedTarget;
      if (to === badge || (to && badge.contains(to))) return;
      hideTimer = setTimeout(hide, 120);
    }, true);

    badge.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    badge.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, 120); });

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!currentImg) return;
      const src = currentImg.currentSrc || currentImg.src;
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
      this._queueImageForPopup(src, badge);
    });
  }

  // ---- DRAG TO DROP ZONE ----

  setupDragDropZone() {
    document.addEventListener('dragstart', (e) => {
      const img = e.target.closest('img') || (e.target.tagName === 'IMG' ? e.target : null);
      if (img && img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
        this._draggedImg = img;
        this._showDropZone();
      }
    }, true);

    document.addEventListener('dragend', () => {
      setTimeout(() => this._hideDropZone(), 250);
    }, true);
  }

  _showDropZone() {
    if (this.dropZone) return;
    const zone = document.createElement('div');
    zone.className = 'ds-drop-zone';
    zone.innerHTML = '<div class="ds-drop-zone-icon">🛡️</div><div>Drop to Analyze</div>';
    document.body.appendChild(zone);
    this.dropZone = zone;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('ds-drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('ds-drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('ds-drag-over');
      const src = e.dataTransfer.getData('text/uri-list')
        || e.dataTransfer.getData('text/plain')
        || (this._draggedImg && (this._draggedImg.currentSrc || this._draggedImg.src));

      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        zone.innerHTML = '<div class="ds-drop-zone-icon">⏳</div><div>Opening popup…</div>';
        this._queueImageForPopup(src, null, () => this._hideDropZone());
      } else {
        zone.innerHTML = '<div class="ds-drop-zone-icon">❌</div><div>No image URL found</div>';
        setTimeout(() => this._hideDropZone(), 2000);
      }
    });
  }

  _hideDropZone() {
    if (this.dropZone) { this.dropZone.remove(); this.dropZone = null; }
    this._draggedImg = null;
  }

  // ---- MUTATION OBSERVER ----

  setupMutationObserver() {
    if (this.observer) return;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          // Attach badges to any new images
          // Image hover badge is handled globally; no per-image attachment needed.
          // Attach buttons to any new videos only.
          // Attach buttons to any new videos
          if (node.tagName === 'VIDEO') this._attachVideoButton(node);
          node.querySelectorAll?.('video').forEach(v => this._attachVideoButton(v));
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---- VIDEO OVERLAY ----

  setupVideoOverlays() {
    // Register existing videos
    document.querySelectorAll('video').forEach((v) => this._attachVideoButton(v));
    // Single document-level mousemove detects videos even through overlay divs
    this._setupVideoHoverDetection();
  }

  _attachVideoButton(video) {
    if (this.videoButtons.has(video)) return;
    this.videoButtons.set(video, true);

    // Create the shared floating button once
    if (!this._videoBtn) {
      const btn = document.createElement('button');
      btn.className = 'ds-video-btn';
      btn.innerHTML = '🛡️ Analyze';
      document.documentElement.appendChild(btn);
      this._videoBtn = btn;
      this._videoBtnTarget = null;

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const vid = this._videoBtnTarget;
        if (!vid) return;

        btn.textContent = '⏳ Sampling…';
        btn.disabled = true;

        try {
          // Capture frames from current playback position -- no seeking
          const frames = await this._captureCurrentFrames(vid, 3);
          if (frames.length === 0) throw new Error('no frames captured (video may be cross-origin)');

          btn.textContent = '🔍 Analyzing…';

          // Wake service worker before long async call
          await new Promise(r => {
            try { chrome.runtime.sendMessage({ type: 'ping' }, () => { chrome.runtime.lastError; r(); }); }
            catch (_) { r(); }
          });

          const result = await new Promise((res) => {
            const fallback = setTimeout(() => res(null), 35000);
            try {
              chrome.runtime.sendMessage({ type: 'analyzeVideoFrames', frames }, (r) => {
                clearTimeout(fallback);
                chrome.runtime.lastError; // suppress unchecked error
                res(r || null);
              });
            } catch (_) { clearTimeout(fallback); res(null); }
          });

          if (result && result.success) {
            const human = 100 - (result.aiScore || 0);
            btn.textContent = '🛡️ ' + human + '% Real';
            await chrome.storage.local.set({
              ds_pending_media: { type: 'video_frames_result', result, ts: Date.now() }
            });
            chrome.runtime.sendMessage({ type: 'openPopupWithMedia' }).catch(() => {
              chrome.action.setBadgeText({ text: '▶' });
              chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
            });
          } else {
            btn.innerHTML = '🛡️ Analyze';
            this._showToast('Analysis failed — try again');
          }
        } catch (err) {
          this._showToast('Capture failed: ' + (err.message || err));
          btn.innerHTML = '🛡️ Analyze';
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  _setupVideoHoverDetection() {
    if (this._videoMoveListener) return;
    let hideTimer = null;

    this._videoMoveListener = (e) => {
      const btn = this._videoBtn;

      // Keep visible if cursor is geometrically over the button rect
      // (pointer-events may still be 'none' during the opacity transition,
      //  so e.target check alone is unreliable)
      if (btn) {
        const br = btn.getBoundingClientRect();
        const overBtn = e.clientX >= br.left && e.clientX <= br.right &&
                        e.clientY >= br.top  && e.clientY <= br.bottom;
        if (overBtn) { clearTimeout(hideTimer); return; }
      }

      // elementsFromPoint returns ALL elements at cursor including those under overlays
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const video = stack.find(el => el.tagName === 'VIDEO' && this.videoButtons.has(el));

      if (video) {
        clearTimeout(hideTimer);
        this._positionVideoBtn(video, e.clientX, e.clientY);
      } else {
        clearTimeout(hideTimer);
        // Generous delay so user can move from video to button without it vanishing
        hideTimer = setTimeout(() => {
          // Don't hide or null target while analysis is running
          if (btn && btn.disabled) return;
          if (btn) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
          }
          this._videoBtnTarget = null;
        }, 600);
      }
    };

    document.addEventListener('mousemove', this._videoMoveListener, { passive: true });
  }

  _positionVideoBtn(video, mx, my) {
    const btn = this._videoBtn;
    const r = video.getBoundingClientRect();

    // Skip tiny thumbnail previews (e.g. YouTube home page)
    if (r.width < 200 || r.height < 120) return;

    btn.disabled = false; // always ensure clickable when shown
    if (this._videoBtnTarget !== video) {
      btn.innerHTML = '🛡️ Analyze';
    }
    this._videoBtnTarget = video;
    const btnW = btn.offsetWidth || 90;
    const btnH = btn.offsetHeight || 28;

    // Prefer just ABOVE the top-right corner; fall back to inside top edge
    const topAbove = r.top - btnH - 4;
    const topInside = r.top + 8;
    btn.style.top  = (topAbove >= 4 ? topAbove : topInside) + 'px';

    // Prefer right-aligned within video; shift left if it would clip viewport
    const leftIdeal = r.right - btnW - 10;
    btn.style.left = Math.max(4, Math.min(leftIdeal, window.innerWidth - btnW - 4)) + 'px';

    btn.style.opacity = '1';
    btn.style.pointerEvents = 'all';
  }

  // ---- A: extract N evenly-spaced frames via canvas ----
  // Capture frames -- canvas first, tab screenshot fallback for cross-origin video
  async _captureCurrentFrames(video, count = 3) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = Math.min(video.videoWidth  || 640, 640);
    const h = Math.min(video.videoHeight || 360, 360);
    canvas.width  = w;
    canvas.height = h;

    const frames = [];
    for (let i = 0; i < count; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 400));
      try {
        ctx.drawImage(video, 0, 0, w, h);
        const d = canvas.toDataURL('image/jpeg', 0.78);
        if (d && d.length > 200) frames.push(d);
      } catch (_) { /* cross-origin taint */ }
    }

    if (frames.length > 0) return frames;

    // Canvas blocked (cross-origin) -- capture visible tab as screenshot instead
    try {
      const shot = await new Promise((res) => {
        chrome.runtime.sendMessage({ type: 'captureTabScreenshot' }, (r) => {
          chrome.runtime.lastError;
          res(r && r.dataUrl ? r.dataUrl : null);
        });
      });
      if (shot) {
        // Crop to the video's bounding rect so we send only the video area
        const r = video.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width  = Math.round(r.width  * dpr);
        cropCanvas.height = Math.round(r.height * dpr);
        const cropCtx = cropCanvas.getContext('2d');
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
        cropCtx.drawImage(img,
          r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr,
          0, 0, cropCanvas.width, cropCanvas.height
        );
        const cropped = cropCanvas.toDataURL('image/jpeg', 0.85);
        if (cropped && cropped.length > 200) frames.push(cropped);
      }
    } catch (_) {}

    return frames;
  }

  async _extractVideoFrames(video, count = 6) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = Math.min(video.videoWidth  || 640, 640);
    const h = Math.min(video.videoHeight || 360, 360);
    canvas.width  = w;
    canvas.height = h;

    const duration = video.duration;
    const hasDuration = duration && isFinite(duration) && duration > 0;

    const frames = [];
    const wasPaused    = video.paused;
    const originalTime = video.currentTime;

    if (!hasDuration) {
      try {
        ctx.drawImage(video, 0, 0, w, h);
        const d = canvas.toDataURL('image/jpeg', 0.75);
        if (d && d.length > 100) frames.push(d);
      } catch (_) {}
    } else {
      const start = duration * 0.05;
      const end   = duration * 0.95;
      const step  = count > 1 ? (end - start) / (count - 1) : 0;

      for (let i = 0; i < count; i++) {
        await this._seekTo(video, start + i * step);
        try {
          ctx.drawImage(video, 0, 0, w, h);
          const d = canvas.toDataURL('image/jpeg', 0.75);
          if (d && d.length > 100) frames.push(d);
        } catch (_) { /* cross-origin taint -- skip */ }
      }

      video.currentTime = originalTime;
      if (!wasPaused) video.play().catch(() => {});
    }

    return frames;
  }

  _seekTo(video, time) {
    return new Promise((resolve) => {
      const done = () => { video.removeEventListener('seeked', done); resolve(); };
      video.addEventListener('seeked', done);
      video.currentTime = time;
      setTimeout(resolve, 600);
    });
  }

  // ---- Show score as a toast (video result) ----
  _showVideoScore(video, result) {
    if (!result || !result.success) {
      this._showToast('Video analysis failed');
      return;
    }
    const ai    = result.aiScore || 0;
    const human = 100 - ai;
    const label = ai >= 65 ? 'Likely Deepfake' : ai >= 40 ? 'Uncertain' : 'Likely Real';
    const frames = result.framesAnalyzed || '?';
    this._showToast(label + ' - ' + human + '% real - ' + frames + ' frames sampled');
  }


  // ---- FETCH IMAGE IN PAGE CONTEXT ----
  // Tries three methods in order so CDN-hosted images (Getty, Cloudinary, etc.) work.

  async _fetchAsDataUrl(src) {
    // Method 1: draw the already-rendered <img> to canvas -- zero network, works
    // on same-origin images and anything the browser already decoded.
    const existing = document.querySelector(
      'img[src="' + CSS.escape(src) + '"], img[currentSrc="' + CSS.escape(src) + '"]'
    );
    if (existing && existing.complete && existing.naturalWidth > 0) {
      try {
        const c = document.createElement('canvas');
        c.width  = existing.naturalWidth;
        c.height = existing.naturalHeight;
        c.getContext('2d').drawImage(existing, 0, 0);
        const d = c.toDataURL('image/jpeg', 0.88);
        if (d && d.length > 200) return d;
      } catch (_) { /* tainted canvas -- cross-origin, try next */ }
    }

    // Method 2: reload with crossOrigin=anonymous. Most CDNs (Cloudinary,
    // imgix, AWS CloudFront with CORS enabled) serve CORS headers for
    // anonymous requests even when they refuse credentialed ones.
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width  = img.naturalWidth  || 800;
            c.height = img.naturalHeight || 600;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve(c.toDataURL('image/jpeg', 0.88));
          } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('crossOrigin load failed'));
        img.src = src + (src.includes('?') ? '&' : '?') + '_ds=' + Date.now();
        setTimeout(() => reject(new Error('timeout')), 8000);
      });
    } catch (_) {}

    // Method 3: credentialed fetch
    const resp = await fetch(src, { credentials: 'include' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ---- QUEUE IMAGE AND OPEN POPUP ----

  async _queueImageForPopup(src, badgeEl, onDone) {
    if (badgeEl) { badgeEl.textContent = '\u23F3'; badgeEl.classList.add('ds-loading'); }

    const filename = src.split('/').pop().split('?')[0].split('#')[0].replace(/[^a-zA-Z0-9._-]/g, '_') || 'image.jpg';

    try {
      const dataUrl = await this._fetchAsDataUrl(src);
      await chrome.storage.local.set({
        ds_pending_media: { type: 'image', dataUrl, filename, ts: Date.now() }
      });
      await chrome.runtime.sendMessage({ type: 'openPopupWithMedia' });
    } catch (_) {}
  }
}

// Guard against double-injection on SPA navigation
if (!window.__deepShieldInjected) {
  window.__deepShieldInjected = true;
  new ContentScript();
  new DeepShieldInline();
}
