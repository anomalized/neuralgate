# ⚡ NeuralGate — Personal AI API Gateway

A Cloudflare Workers-powered AI gateway that intelligently routes requests to the best free AI provider (Gemini, Groq, Mistral) based on task type, with automatic failover and a live monitoring dashboard.

---

## Features

- **Smart routing** — auto-detects best provider based on task type or prompt analysis
- **Automatic failover** — if a provider fails or rate-limits, retries the next in chain
- **Unified response format** — consistent JSON shape regardless of provider
- **KV logging** — every request logged to Cloudflare KV with 7-day TTL
- **Live dashboard** — real-time stats, provider breakdown, request feed, and a test panel
- **Zero cost** — all providers have free tiers, Cloudflare Workers free tier is generous

---

## Step 1 — Get Your API Keys (all free)

### Gemini (Google AI Studio)
1. Go to https://aistudio.google.com/apikey
2. Sign in with Google — **no credit card required**
3. Click "Create API key" → copy it

### Groq
1. Go to https://console.groq.com
2. Sign up — **no credit card required**
3. Go to API Keys → Create API Key → copy it

### Mistral
1. Go to https://console.mistral.ai
2. Sign up (may require card for higher tiers, but `mistral-small-latest` is accessible on free/trial tier)
3. Go to API Keys → Create new key → copy it

---

## Step 2 — Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

This opens a browser to authenticate with your Cloudflare account.

---

## Step 3 — Create a KV Namespace

```bash
cd neuralgate
wrangler kv:namespace create LOGS
```

This outputs something like:
```
{ binding = "LOGS", id = "abc123..." }
```

Also create a preview namespace for local dev:
```bash
wrangler kv:namespace create LOGS --preview
```

Copy both IDs into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "LOGS"
id = "your-actual-id-here"
preview_id = "your-preview-id-here"
```

---

## Step 4 — Set Secrets

Run each of these and paste your key when prompted:

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put GROQ_API_KEY
wrangler secret put MISTRAL_API_KEY
wrangler secret put GATEWAY_API_KEY
```

For `GATEWAY_API_KEY`, make up any random string (e.g. `ng_mysecretkey_abc123`). This is the key you'll use to authenticate your own requests.

---

## Step 5 — Install Dependencies & Deploy the Worker

```bash
npm install
wrangler deploy
```

After deployment, Wrangler prints your Worker URL:
```
https://neuralgate.<your-subdomain>.workers.dev
```

Save this URL — you'll need it for the dashboard.

---

## Step 6 — Deploy the Dashboard to Cloudflare Pages

1. Go to https://dash.cloudflare.com → **Pages** → **Create a project**
2. Choose **"Upload assets"** (drag and drop — no CLI needed)
3. Drag `dashboard.html` into the upload area
4. Name your project (e.g. `neuralgate-dashboard`)
5. Click **Deploy site**

Your dashboard will be live at:
```
https://neuralgate-dashboard.pages.dev
```

6. Open the dashboard and paste your Worker URL into the top-right input box.

---

## Step 7 — Test with curl

### Basic request:
```bash
curl -X POST https://neuralgate.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain what a Cloudflare Worker is in 2 sentences.",
    "task_type": "speed",
    "api_key": "your-gateway-key-here"
  }'
```

### Auto mode (gateway decides):
```bash
curl -X POST https://neuralgate.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a Python function to flatten a nested list recursively.",
    "task_type": "auto",
    "api_key": "your-gateway-key-here"
  }'
```

### Using Authorization header instead of body key:
```bash
curl -X POST https://neuralgate.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-gateway-key-here" \
  -d '{"message": "What is 42?", "task_type": "speed"}'
```

### Check stats:
```bash
curl https://neuralgate.<your-subdomain>.workers.dev/stats
```

---

## Request Format

```json
{
  "message": "Your prompt here",
  "task_type": "auto",
  "api_key": "your-gateway-key"
}
```

**task_type options:**
| Value | Provider | Use for |
|-------|----------|---------|
| `auto` | Gateway decides | General use |
| `speed` | Groq | Quick answers, low latency |
| `quality` | Gemini | Best output quality |
| `long` | Gemini | Long documents, big context |
| `code` | Groq | Programming tasks |

---

## Response Format

```json
{
  "response": "The AI's answer",
  "provider_used": "groq",
  "task_type_detected": "code",
  "fallback_used": false,
  "latency_ms": 342,
  "tokens_used": 180,
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Local Development

```bash
wrangler dev
```

This runs the Worker locally at `http://localhost:8787`. Note: KV in local dev uses the `preview_id` namespace.

---

## Auto-Routing Logic (auto mode)

When `task_type` is `"auto"`, the Worker analyzes the prompt:

1. **Speed keywords** (`fast`, `quick`, `brief`, `short`, `tldr`, etc.) → **Groq**
2. **Long prompt** (>500 characters) → **Gemini** (1M context)
3. **Code keywords** (`function`, `class`, `def`, `import`, code blocks, etc.) → **Groq**
4. **Default** → **Gemini**

---

## Failover Chain

If the primary provider fails:
```
Primary → Gemini → Groq → Mistral
```

The response will include `"fallback_used": true` so you know it happened.

---

## Finding Your Worker URL After Deployment

```bash
wrangler deployments list
```

Or check: https://dash.cloudflare.com → Workers & Pages → neuralgate → your deployment URL.

---

## Viewing Logs

```bash
wrangler tail
```

This streams live logs from your Worker as requests come in.

---

## Project Structure

```
neuralgate/
├── src/
│   ├── index.ts              # Main router (POST /chat, GET /stats)
│   ├── router.ts             # Task-type detection & provider selection
│   ├── logger.ts             # KV logging functions
│   └── providers/
│       ├── gemini.ts         # Gemini API integration
│       ├── groq.ts           # Groq API integration
│       └── mistral.ts        # Mistral API integration
├── dashboard.html            # Stats dashboard (deploy to Cloudflare Pages)
├── wrangler.toml             # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── README.md
```
