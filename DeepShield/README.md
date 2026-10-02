# Deep Shield: AI-Generated and Deepfake Content Detector

Deep Shield is a Chrome extension (Manifest V3) that detects AI-generated text, images and video while you browse. It scores content directly on the page, explains its reasoning, and keeps a history of past scans. It was built as my BSc capstone project in Computer Science and Engineering at BRAC University (2026).

## Features

**Text detection**
- **Classic mode (offline):** runs entirely inside the extension with no API calls. Scores perplexity, burstiness, repetition, lexical uniqueness and Flesch-Kincaid readability, then combines them into a 0 to 100 human-likelihood score with sentence-level highlighting.
- **AI Insight mode:** sends text to an OpenRouter-hosted language model for deeper semantic analysis, with automatic model failover, response caching and per-model cooldowns.

**Image and video detection**
- Right-click any image or video and choose **Analyze with Deep Shield**.
- Media is checked by a deepfake detection model served through a Hugging Face Space (Gradio API).
- OCR (via OCR.space) pulls text out of images so it can be scored too.

**Account and usage**
- Optional sign-up and login with JWT authentication; anonymous use works through a per-install ID.
- Scan history, user settings and feedback stored in MongoDB.
- Free-tier daily limits enforced on the server, with an optional Stripe checkout flow for a Pro plan.

**Backend hardening**
- Rate limiting, input sanitisation, centralised error handling and a health-check endpoint.

## Tech stack

| Layer | Technology |
|---|---|
| Extension | JavaScript, Chrome Extension APIs (Manifest V3), HTML, CSS |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Auth | JSON Web Tokens, bcrypt |
| AI services | OpenRouter (text), Hugging Face Gradio Space (image/video deepfake model), OCR.space |
| Payments | Stripe (optional) |

## Project structure

```
DeepShield/
├── extension/          Chrome extension (load this folder in Chrome)
│   ├── manifest.json
│   ├── background.js   Service worker: analysis, API calls, context menus
│   ├── content.js      On-page highlighting and result overlays
│   ├── popup.*         Main popup UI (scan, upload, results)
│   ├── options.*       Settings page
│   ├── history.*       Scan history page
│   ├── feedback.*      Feedback page
│   └── icons/
├── server/             Express API
│   ├── .env.example    Template for environment variables
│   └── src/
│       ├── app.js, server.js
│       ├── config/     Environment and database setup
│       ├── controllers/
│       ├── middleware/ Auth, install ID, rate limit, sanitising, errors
│       ├── models/     Mongoose schemas
│       ├── routes/
│       └── services/   OpenRouter integration
├── dev/                Standalone scripts used to test the Gradio API
└── docs/               Full feature reference (DeepShield_Feature_List.docx)
```

## Getting started

### Prerequisites
- Node.js 18 or newer
- MongoDB running locally, or a MongoDB Atlas connection string
- Google Chrome (or any Chromium browser)
- An OpenRouter API key if you want AI Insight mode (Classic mode works without one)

### 1. Run the backend

```bash
cd server
npm install
cp .env.example .env      # on Windows: copy .env.example .env
# open .env and fill in MONGODB_URI, JWT_SECRET and OPENROUTER_API_KEY
npm run dev               # or: npm start
```

The API starts on `http://localhost:5000`. Visit `http://localhost:5000/api/health` to confirm it is running.

### 2. Load the extension

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin **AI Content Detector** to the toolbar.

The extension talks to the backend at `http://localhost:5000/api` (set in `extension/background.js`). Change `apiBaseUrl` there if you deploy the server elsewhere.

### 3. Use it
- **Text:** open the popup and scan the current page, or paste text. Switch between Classic and AI Insight in settings.
- **Images/video:** right-click media on any page and choose **Analyze with Deep Shield**, or upload a file from the popup.
- **History:** open the history page from the popup to review or clear past scans.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | Current user (requires JWT) |
| POST | `/api/analyze/ai` | AI Insight text analysis |
| POST | `/api/media/check` | Check and count media scan allowance |
| GET | `/api/media/usage` | Media usage for this install/user |
| GET / POST / DELETE | `/api/history` | Read, add or clear scan history |
| GET / PUT | `/api/settings` | Read or update settings |
| GET / POST | `/api/feedback` | Read or submit feedback |
| GET | `/api/subscription` | Plan status and limits |
| POST | `/api/stripe/...` | Checkout and webhook (optional) |

Most endpoints identify the client by an install ID header sent automatically by the extension.

## Notes and limitations
- Detection results are probabilistic signals, not proof. Treat scores as guidance.
- Image and video analysis depends on a public Hugging Face Space, which can be slow to wake up or rate-limited.
- Stripe is wired up for test mode only and is not required to run the project.
- `.env` is git-ignored. Never commit real API keys.

## Author

**Safiur Rahman Safi**, BSc in Computer Science and Engineering, BRAC University
GitHub: [@CaptainSafi](https://github.com/CaptainSafi)
