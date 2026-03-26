import os
import math
import json
import re
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import chromadb

# ─── App Setup ────────────────────────────────────────────────────
app = FastAPI(title="FRAGAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

# ─── Load Data ────────────────────────────────────────────────────
def load_datasets():
    base = os.path.dirname(__file__)

    with open(os.path.join(base, "classic_dataset.json")) as f:
        classic = json.load(f)
    for p in classic:
        p["_source"] = "classic"
        p.setdefault("release_year", None)
        p.setdefault("source_url", None)

    with open(os.path.join(base, "modern_dataset.json")) as f:
        modern = json.load(f)
    for p in modern:
        p["_source"] = "modern"

    all_perfumes = classic + modern
    print(f"[DATA] Loaded {len(classic)} classic + {len(modern)} modern = {len(all_perfumes)} total")
    return all_perfumes

ALL_PERFUMES = load_datasets()

# ─── Tokenizer ────────────────────────────────────────────────────
STOPWORDS = {
    "i","a","an","the","and","or","for","to","in","on","at","is","it",
    "be","of","my","me","want","something","that","this","with","very",
    "really","like","need","get","find","looking","give","some","would",
}

def tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return [t for t in text.split() if len(t) > 1 and t not in STOPWORDS]

# ─── Document Builder ─────────────────────────────────────────────
def perfume_to_doc(p: dict) -> str:
    fi = p.get("feminine_index", 0.5)
    mi = p.get("masculine_index", 0.5)
    if fi > 0.7:
        gender = "feminine womens ladies female floral soft delicate"
    elif mi > 0.7:
        gender = "masculine mens male bold strong woody rugged"
    else:
        gender = "unisex gender neutral versatile"

    tod = p.get("time_of_day", "any")
    occasion = {
        "night": "evening night club dinner party date romantic seductive",
        "day":   "daytime casual office work everyday fresh light",
        "any":   "versatile day night anytime",
    }.get(tod, "")

    climates = p.get("climate", [])
    if "all" in climates:
        climate_str = "all seasons year round every weather"
    else:
        climate_str = " ".join(climates)
        if "summer" in climates: climate_str += " hot warm fresh light beach outdoor"
        if "winter" in climates: climate_str += " cold cozy warm heavy rich dark spicy"
        if "spring" in climates: climate_str += " fresh floral blooming airy"

    proj = "strong loud noticeable powerful sillage beast long lasting" \
        if p.get("projection") == "strong" \
        else "subtle soft light moderate intimate skin"

    vfm_map = {
        "great value": "affordable cheap budget friendly bargain",
        "good value":  "good value worth price reasonable",
        "ok":          "average mid range standard",
        "overpriced":  "luxury premium expensive high end exclusive",
    }
    value_str = vfm_map.get(p.get("value_for_money", "ok"), "")

    cat_map = {
        "niche":           "niche artisan unique special exclusive indie",
        "designer":        "designer brand popular mainstream well known",
        "budget":          "cheap affordable budget friendly entry level",
        "middle eastern":  "arabic oud oriental exotic middle eastern bakhoor",
    }
    cat_str = cat_map.get(p.get("category", ""), "")

    year = p.get("release_year")
    year_str = f"{year} recent modern new" if year else "classic vintage"

    return " ".join([
        p.get("name", ""), p.get("brand", ""),
        gender, occasion, climate_str, proj, value_str, cat_str, year_str
    ])

# ─── BM25 ─────────────────────────────────────────────────────────
class BM25:
    def __init__(self, docs: list[dict], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.docs = docs
        self.N = len(docs)
        self.tokenized = [tokenize(perfume_to_doc(p)) for p in docs]
        self.avgdl = sum(len(t) for t in self.tokenized) / self.N
        self.df: dict[str, int] = defaultdict(int)
        for tokens in self.tokenized:
            for t in set(tokens):
                self.df[t] += 1

    def _idf(self, term: str) -> float:
        n = self.df.get(term, 0)
        return math.log((self.N - n + 0.5) / (n + 0.5) + 1)

    def score(self, idx: int, q_terms: list[str]) -> float:
        tokens = self.tokenized[idx]
        dl = len(tokens)
        tf: dict[str, int] = defaultdict(int)
        for t in tokens:
            tf[t] += 1
        s = 0.0
        for term in q_terms:
            if term not in tf:
                continue
            idf = self._idf(term)
            freq = tf[term]
            s += idf * (freq * (self.k1 + 1)) / (
                freq + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            )
        return s

    def search(
        self,
        query: str,
        candidate_indices: list[int],
        top_k: int = 20,
        alpha: float = 0.005,
    ) -> list[tuple[int, float]]:
        q_terms = tokenize(query)
        if not q_terms:
            return []
        value_scores = {"great value": 1.0, "good value": 0.75, "ok": 0.5, "overpriced": 0.25}
        results = []
        for i in candidate_indices:
            bm25 = self.score(i, q_terms)
            if bm25 <= 0:
                continue
            vs = value_scores.get(self.docs[i].get("value_for_money", "ok"), 0.5)
            final = bm25 + alpha * vs
            results.append((i, bm25, final))
        results.sort(key=lambda x: x[2], reverse=True)
        return [(i, bm25) for i, bm25, _ in results[:top_k]]

# Build index at startup
print("[BM25] Building index...")
BM25_INDEX = BM25(ALL_PERFUMES)
print("[BM25] Index ready")

# ─── ChromaDB ─────────────────────────────────────────────────────
CHROMA_PATH = os.environ.get("CHROMA_PATH", "/app/chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

try:
    chroma_collection = chroma_client.get_collection("perfumes")
    chroma_ready = chroma_collection.count() > 0
    print(f"[ChromaDB] Collection loaded: {chroma_collection.count()} vectors")
except Exception:
    chroma_collection = chroma_client.get_or_create_collection("perfumes")
    chroma_ready = False
    print("[ChromaDB] Empty collection — run /ingest to populate vector index")

# ─── RRF Fusion ───────────────────────────────────────────────────
def reciprocal_rank_fusion(
    bm25_results: list[tuple[int, float]],
    vector_results: list[tuple[int, float]],
    k: int = 60,
) -> list[tuple[int, float]]:
    scores: dict[int, float] = defaultdict(float)
    for rank, (idx, _) in enumerate(bm25_results):
        scores[idx] += 1.0 / (k + rank + 1)
    for rank, (idx, _) in enumerate(vector_results):
        scores[idx] += 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)

# ─── Anthropic Client ─────────────────────────────────────────────
anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# ─── Request / Response Models ────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    source_filter: str = "all"       # all | classic | modern
    category_filter: str = "all"
    year_min: int = 2021
    year_max: int = 2026
    alpha: float = 0.005
    top_k: int = 12
    use_hybrid: bool = True           # BM25 + vector RRF if chroma ready

class PerfumeResult(BaseModel):
    brand: str
    name: str
    category: str
    climate: list[str]
    time_of_day: str
    value_for_money: str
    projection: str
    feminine_index: float
    masculine_index: float
    release_year: Optional[int]
    source_url: Optional[str]
    _source: str
    bm25_score: float

class SearchResponse(BaseModel):
    results: list[dict]
    llm_recommendation: str
    retrieval_mode: str
    total_candidates: int
    query_tokens: list[str]

# ─── Endpoints ────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "total_perfumes": len(ALL_PERFUMES),
        "chroma_ready": chroma_ready,
        "chroma_count": chroma_collection.count() if chroma_ready else 0,
    }

@app.get("/stats")
def stats():
    classic = sum(1 for p in ALL_PERFUMES if p["_source"] == "classic")
    modern  = sum(1 for p in ALL_PERFUMES if p["_source"] == "modern")
    years = sorted({p["release_year"] for p in ALL_PERFUMES if p.get("release_year")})
    return {
        "total": len(ALL_PERFUMES),
        "classic": classic,
        "modern": modern,
        "year_range": [min(years), max(years)] if years else [],
        "categories": {
            cat: sum(1 for p in ALL_PERFUMES if p["category"] == cat)
            for cat in ["designer", "niche", "budget", "middle eastern"]
        },
    }

@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # ── 1. Build candidate pool ──────────────────────────────────
    candidates = []
    for i, p in enumerate(ALL_PERFUMES):
        if req.source_filter != "all" and p["_source"] != req.source_filter:
            continue
        if req.category_filter != "all" and p["category"] != req.category_filter:
            continue
        if p["_source"] == "modern" and p.get("release_year"):
            if not (req.year_min <= p["release_year"] <= req.year_max):
                continue
        candidates.append(i)

    if not candidates:
        raise HTTPException(status_code=400, detail="No perfumes match your filters")

    # ── 2. BM25 retrieval ────────────────────────────────────────
    bm25_hits = BM25_INDEX.search(req.query, candidates, top_k=req.top_k * 2, alpha=req.alpha)
    retrieval_mode = "bm25"

    # ── 3. Vector retrieval + RRF (if chroma is ready) ──────────
    if req.use_hybrid and chroma_ready:
        try:
            vector_hits_raw = chroma_collection.query(
                query_texts=[req.query],
                n_results=min(req.top_k * 2, chroma_collection.count()),
            )
            vector_ids = vector_hits_raw["ids"][0]
            vector_hits = [(int(vid), 1.0) for vid in vector_ids if int(vid) in set(candidates)]
            fused = reciprocal_rank_fusion(bm25_hits, vector_hits)
            final_indices = [(idx, score) for idx, score in fused[:req.top_k]]
            retrieval_mode = "hybrid_rrf"
        except Exception as e:
            print(f"[ChromaDB] Query failed, falling back to BM25: {e}")
            final_indices = bm25_hits[:req.top_k]
    else:
        final_indices = bm25_hits[:req.top_k]

    # ── 4. Build result objects ──────────────────────────────────
    result_perfumes = []
    for idx, score in final_indices:
        p = ALL_PERFUMES[idx].copy()
        p["bm25_score"] = round(score, 4)
        result_perfumes.append(p)

    # ── 5. LLM recommendation ────────────────────────────────────
    context_lines = []
    for i, p in enumerate(result_perfumes[:8]):
        year_str = f" ({p['release_year']})" if p.get("release_year") else ""
        context_lines.append(
            f"{i+1}. {p['brand']} – {p['name']}{year_str} | "
            f"{p['category']} | Climate: {'/'.join(p['climate'])} | "
            f"Time: {p['time_of_day']} | Projection: {p['projection']} | "
            f"Value: {p['value_for_money']}"
        )

    message = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=(
            "You are an expert perfume consultant. Given the user's occasion and "
            "retrieved fragrance candidates, recommend the top 3 most suitable. "
            "Be specific about why each suits the occasion. Keep it elegant and concise. "
            "Never mention scores, BM25, or system internals."
        ),
        messages=[{
            "role": "user",
            "content": f"Occasion: {req.query}\n\nCandidates:\n" + "\n".join(context_lines)
        }]
    )
    llm_text = message.content[0].text

    return SearchResponse(
        results=result_perfumes,
        llm_recommendation=llm_text,
        retrieval_mode=retrieval_mode,
        total_candidates=len(candidates),
        query_tokens=tokenize(req.query),
    )

@app.post("/ingest")
async def ingest():
    """Populate ChromaDB with sentence-transformer embeddings. Run once after deploy."""
    global chroma_ready, chroma_collection
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")

        # Clear and recreate
        try:
            chroma_client.delete_collection("perfumes")
        except Exception:
            pass
        chroma_collection = chroma_client.create_collection("perfumes")

        docs    = [perfume_to_doc(p) for p in ALL_PERFUMES]
        ids     = [str(i) for i in range(len(ALL_PERFUMES))]

        BATCH = 256
        for start in range(0, len(docs), BATCH):
            batch_docs = docs[start:start + BATCH]
            batch_ids  = ids[start:start + BATCH]
            embeddings = model.encode(batch_docs, show_progress_bar=False).tolist()
            chroma_collection.add(documents=batch_docs, embeddings=embeddings, ids=batch_ids)
            print(f"[Ingest] {start + len(batch_docs)}/{len(docs)}")

        chroma_ready = True
        return {"status": "done", "vectors_indexed": len(ALL_PERFUMES)}
    except ImportError:
        return {"status": "skipped", "reason": "sentence-transformers not installed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
