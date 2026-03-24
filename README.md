# Perfume RAG — Portfolio Project

A production-grade fragrance recommendation system using **Retrieval-Augmented Generation**.

- **1,800 perfumes** — 1,200 classic + 600 modern (2021–2026)
- **BM25** retrieval with value-signal tiebreaker (α)
- **ChromaDB** vector search with `all-MiniLM-L6-v2` embeddings
- **Hybrid RRF** fusion (BM25 + vector, Reciprocal Rank Fusion)
- **Claude Haiku** for natural language recommendations
- **FastAPI** backend · **React + Vite** frontend · **Docker Compose**

---

## Architecture

```
User query
    │
    ▼
┌─────────────────────────────────────────┐
│              FastAPI /search            │
│                                         │
│  Filter candidates by source/year/cat  │
│         │                              │
│    ┌────┴────┐                         │
│    │  BM25   │  ←── inverted index     │
│    └────┬────┘                         │
│         │  top-K hits                  │
│    ┌────┴────────┐                     │
│    │  ChromaDB   │  ←── MiniLM vectors │
│    └────┬────────┘                     │
│         │  top-K hits                  │
│    ┌────┴────┐                         │
│    │   RRF   │  ←── rank fusion k=60   │
│    └────┬────┘                         │
│         │  top-12 merged               │
│    ┌────┴──────────┐                   │
│    │  Claude Haiku │  ←── Anthropic    │
│    └────┬──────────┘                   │
│         │  recommendation text         │
└─────────┼───────────────────────────────┘
          ▼
      React UI
```

---

## Local Development

### Prerequisites
- Docker Desktop
- An Anthropic API key

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/perfume-rag.git
cd perfume-rag

# 2. Set your API key
cp .env.example .env
# Edit .env and add:  ANTHROPIC_API_KEY=sk-ant-...

# 3. Build and start everything
docker compose up --build

# 4. Open the app
# Frontend:  http://localhost:3000
# API docs:  http://localhost:8000/docs
# Health:    http://localhost:8000/health
```

### Enable vector search (optional but recommended)

After the containers are running, trigger ingestion once:

```bash
curl -X POST http://localhost:8000/ingest
```

This downloads `all-MiniLM-L6-v2`, embeds all 1,800 perfumes, and stores
vectors in ChromaDB. Takes ~2 minutes on first run. Results persist in the
`chroma_data` Docker volume across restarts.

---

## Deploy to Railway

Railway deploys the backend and frontend as two separate services, both
pointing at the same GitHub repo with different root directories.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/perfume-rag.git
git push -u origin main
```

### 2. Create a Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `perfume-rag`

### 3. Deploy the Backend

In your Railway project:

1. Click **Add Service** → **GitHub Repo** → `perfume-rag`
2. Set **Root Directory** to `backend`
3. Railway auto-detects the `Dockerfile`
4. Go to the service **Variables** tab and add:
   ```
   ANTHROPIC_API_KEY   =  sk-ant-...
   CHROMA_PATH         =  /app/chroma_db
   ```
5. Go to **Settings → Networking** → **Generate Domain**
   - Copy the URL, e.g. `https://perfume-rag-backend.up.railway.app`
6. Click **Deploy**

### 4. Add a Persistent Volume for ChromaDB

1. In the backend service → **Volumes** tab
2. Click **Add Volume**
3. Mount path: `/app/chroma_db`
4. This keeps your vectors across redeploys

### 5. Deploy the Frontend

1. Click **Add Service** → **GitHub Repo** → `perfume-rag` (same repo)
2. Set **Root Directory** to `frontend`
3. Go to **Variables** tab and add:
   ```
   VITE_API_URL  =  https://perfume-rag-backend.up.railway.app
   ```
   *(Use your actual backend URL from step 3)*
4. Go to **Settings → Networking** → **Generate Domain**
5. Click **Deploy**

### 6. Trigger vector ingestion (once, after deploy)

```bash
curl -X POST https://perfume-rag-backend.up.railway.app/ingest
```

Watch logs in Railway dashboard — ingestion takes ~2 minutes.
After that, hybrid RRF is automatically enabled for all searches.

### 7. Done

Your app is live at the frontend Railway URL.

---

## API Reference

### `GET /health`
```json
{
  "status": "ok",
  "total_perfumes": 1800,
  "chroma_ready": true,
  "chroma_count": 1800
}
```

### `GET /stats`
```json
{
  "total": 1800,
  "classic": 1200,
  "modern": 600,
  "year_range": [2021, 2026],
  "categories": { "designer": 1377, "niche": 267, ... }
}
```

### `POST /search`
```json
// Request
{
  "query": "romantic winter dinner date",
  "source_filter": "all",
  "category_filter": "all",
  "year_min": 2021,
  "year_max": 2026,
  "alpha": 0.005,
  "top_k": 12,
  "use_hybrid": true
}

// Response
{
  "results": [ ...perfume objects with bm25_score... ],
  "llm_recommendation": "For a romantic winter dinner...",
  "retrieval_mode": "hybrid_rrf",
  "total_candidates": 1800,
  "query_tokens": ["romantic", "winter", "dinner", "date"]
}
```

### `POST /ingest`
Triggers ChromaDB ingestion. Run once after first deploy.

---

## Project Structure

```
perfume-rag/
├── backend/
│   ├── main.py               # FastAPI app, BM25, RRF, ChromaDB, Anthropic
│   ├── classic_dataset.json  # 1,200 classic perfumes
│   ├── modern_dataset.json   # 600 modern perfumes (2021–2026)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.toml
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # React UI, calls /search
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml        # Local dev
├── .env.example
├── .gitignore
└── README.md
```

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Primary retrieval | BM25 | Structured catalog data — finite keyword values map perfectly to term matching |
| Embeddings | `all-MiniLM-L6-v2` | 384-dim, fast, free, runs on CPU, strong semantic coverage |
| Vector DB | ChromaDB | Zero-config, persistent, sufficient for 1,800–100K docs |
| Fusion | RRF (k=60) | No training data needed, robust to score scale differences |
| Business signal | α tiebreaker | Keeps commercial logic decoupled from retrieval logic |
| LLM | Claude Haiku | Fastest + cheapest for generation-only tasks |

---

## Roadmap

- [ ] Evaluation pipeline — Precision@K on 30 labelled queries
- [ ] Query routing — explicit summer/winter/niche intent detection  
- [ ] Re-ranking — cross-encoder on top-20 before generation
- [ ] User feedback loop — thumbs up/down stored per query
- [ ] Expand dataset — scrape Fragrantica top 500 per year
