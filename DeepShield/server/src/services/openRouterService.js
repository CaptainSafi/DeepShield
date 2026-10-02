const axios = require("axios");
const crypto = require("crypto");
const env = require("../config/env");

class OpenRouterService {
  constructor() {
    this.apiKey = env.openRouterApiKey;
    this.baseUrl = "https://openrouter.ai/api/v1";

    // Primary model list as requested
    this.models = ["openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free"];

    // Caching: { hash: { result, timestamp } }
    this.cache = new Map();
    this.cacheTTL = 20 * 60 * 1000; // 20 minutes

    // Cooldowns and Rate Limiting
    this.modelCooldowns = new Map(); // { model: cooldownUntilTimestamp }
    this.lastRequestTimestamp = 0;
    this.minRequestDelay = 3000; // 3 seconds debounce

    this.maxRetriesPerModel = 2;
  }

  generateHash(text) {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  async analyzeWithFailover(text) {
    // 1. Check Cache
    const hash = this.generateHash(text);
    const cached = this.cache.get(hash);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(
        "Returning cached result for text hash:",
        hash.substring(0, 8)
      );
      return cached.result;
    }

    // 2. Minimum Delay (Debounce)
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTimestamp;
    if (timeSinceLastRequest < this.minRequestDelay) {
      const waitTime = this.minRequestDelay - timeSinceLastRequest;
      console.log(`Debouncing: Waiting ${waitTime}ms before next request...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTimestamp = Date.now();

    // 3. Try Models in Order
    for (const model of this.models) {
      // Check if model is in cooldown
      const cooldownUntil = this.modelCooldowns.get(model) || 0;
      if (Date.now() < cooldownUntil) {
        console.log(
          `Skipping ${model}: Model is in cooldown for ${Math.round(
            (cooldownUntil - Date.now()) / 1000
          )}s`
        );
        continue;
      }

      let attempt = 0;
      while (attempt < this.maxRetriesPerModel) {
        try {
          console.log(
            `Attempting analysis with ${model} (Attempt ${attempt + 1}/${
              this.maxRetriesPerModel
            })...`
          );
          const result = await this.callOpenRouter(text, model);

          const standardizedResponse = {
            ...result,
            source: "ai_model",
            model_used: model,
          };

          // Cache the successful result
          this.cache.set(hash, {
            result: standardizedResponse,
            timestamp: Date.now(),
          });

          console.log(`SUCCESS: Analysis complete using ${model}`);
          return standardizedResponse;
        } catch (error) {
          attempt++;
          const statusCode = error.response?.status;
          const errorData = error.response?.data;
          const retryAfter = error.response?.headers?.["retry-after"];

          console.error(
            `FAILURE: Model ${model} failed (Status ${statusCode}):`,
            errorData?.error?.message || error.message
          );

          // Handle 429 Rate Limit
          if (statusCode === 429) {
            const waitSeconds = retryAfter
              ? parseInt(retryAfter)
              : Math.pow(2, attempt); // Exponential backoff: 2s, 4s
            const waitMs = Math.min(waitSeconds * 1000, 4000); // Cap at 4s as requested

            console.log(
              `Rate limited (429). Waiting ${waitMs}ms before ${
                attempt < this.maxRetriesPerModel ? "retry" : "fallback"
              }...`
            );

            // Set global cooldown for this model if it keeps failing
            if (attempt >= this.maxRetriesPerModel) {
              this.modelCooldowns.set(model, Date.now() + 30000); // 30s cooldown
            }

            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue; // Retry same model
          }

          // For other errors (404, 500, etc.), break retry loop and move to next model
          console.log(
            `Error ${statusCode} is not retryable for this model. Moving to next...`
          );
          break;
        }
      }
    }

    // 4. Final Safety Fallback
    console.warn("CRITICAL: All AI models failed or are unavailable.");
    return {
      source: "ai_model",
      model_used: "fallback",
      label: "Unknown",
      score: 0,
      confidence: "low",
      reason: "All AI models temporarily unavailable",
    };
  }

  async callOpenRouter(text, model) {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is not configured.");
    }

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: "system",
            content: `You are an AI detection assistant. Analyze the provided text and determine if it was written by an AI or a Human.
            Respond ONLY with a valid JSON object in the following format:
            {
              "label": "AI" or "Human",
              "score": 0-100 (where 100 means definitely AI),
              "confidence": "low" or "medium" or "high",
              "reason": "a brief explanation of your analysis"
            }`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://ai-detector-extension.com",
          "X-Title": "AI Detector Extension",
          "Content-Type": "application/json",
        },
        timeout: 20000, // 20 seconds timeout
      }
    );

    const content = response.data.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error("Model returned invalid JSON format");
    }
  }

  // Deprecated: kept for backward compatibility if needed, but redirects to new system
  async analyzeText(text) {
    return this.analyzeWithFailover(text);
  }
}

module.exports = new OpenRouterService();
