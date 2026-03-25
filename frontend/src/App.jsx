import { useState, useEffect } from "react";

// ─── API base URL ─────────────────────────────────────────────────
// In prod: VITE_API_URL is set to the Railway backend URL
// In dev:  Vite proxy forwards /api → http://backend:8000
const API = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "/api";

// ─── Constants ────────────────────────────────────────────────────
const CAT_COLORS = {
  niche:            "#a78bfa",
  designer:         "#60a5fa",
  budget:           "#34d399",
  "middle eastern": "#d4a96a",
};

const SOURCE_COLORS = {
  classic: "#9ca3af",
  modern:  "#f472b6",
};

const SAMPLE_QUERIES = [
  "romantic winter dinner date evening",
  "fresh summer beach day casual",
  "powerful masculine office cold weather",
  "soft feminine floral spring daytime",
  "affordable budget versatile everyday",
  "recent 2024 niche exclusive night out",
  "arabic oud oriental winter evening",
  "light clean unisex work commute",
];

// ─── Main Component ───────────────────────────────────────────────
export default function App() {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [llmText, setLlmText]       = useState("");
  const [phase, setPhase]           = useState("idle");
  const [error, setError]           = useState("");
  const [stats, setStats]           = useState(null);
  const [retrievalMode, setRetrievalMode] = useState("");
  const [queryTokens, setQueryTokens]     = useState([]);

  // Filters
  const [showFilters,   setShowFilters]   = useState(false);
  const [sourceFilter,  setSourceFilter]  = useState("all");
  const [catFilter,     setCatFilter]     = useState("all");
  const [yearMin,       setYearMin]       = useState(2021);
  const [yearMax,       setYearMax]       = useState(2026);
  const [alpha,         setAlpha]         = useState(0.005);
  const [useHybrid,     setUseHybrid]     = useState(true);

  // Load stats on mount
  useEffect(() => {
    fetch(`${API}/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const handleSearch = async (q = query) => {
    if (!q.trim()) return;
    setQuery(q);
    setError("");
    setLlmText("");
    setResults([]);
    setPhase("searching");

    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          source_filter:   sourceFilter,
          category_filter: catFilter,
          year_min:        yearMin,
          year_max:        yearMax,
          alpha,
          top_k: 12,
          use_hybrid: useHybrid,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Search failed");
      }

      const data = await res.json();
      setResults(data.results);
      setLlmText(data.llm_recommendation);
      setRetrievalMode(data.retrieval_mode);
      setQueryTokens(data.query_tokens);
    } catch (e) {
      setError(e.message);
    }

    setPhase("idle");
  };

  const gold   = "#d4a96a";
  const pink   = "#f472b6";
  const border = "rgba(255,255,255,0.07)";
  const surf   = "rgba(255,255,255,0.025)";

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "#e5e7eb", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${border}`, padding: "26px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "22px", letterSpacing: "4px", color: gold, textTransform: "uppercase", fontWeight: 300 }}>
            Perfume RAG
          </div>
          <div style={{ fontSize: "11px", color: "#4b5563", letterSpacing: "2px", fontFamily: "monospace", marginTop: "4px" }}>
            BM25 + ChromaDB · Hybrid RRF · Claude Haiku
          </div>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Pill color="#9ca3af">Classic <b>{stats.classic.toLocaleString()}</b></Pill>
            <Pill color={pink}>Modern 2021–26 <b>{stats.modern}</b></Pill>
            <Pill color="#60a5fa">Total <b>{stats.total.toLocaleString()}</b></Pill>
          </div>
        )}
      </div>

      <div style={{ maxWidth: "880px", margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Search bar ── */}
        <div style={{ position: "relative", marginBottom: "14px" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Describe your occasion — romantic winter dinner, fresh summer day…"
            style={{
              width: "100%", background: surf,
              border: `1px solid rgba(212,169,106,0.3)`,
              borderRadius: "10px", padding: "15px 110px 15px 20px",
              color: "#f0e8dc", fontSize: "15px", outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button onClick={() => handleSearch()} disabled={phase !== "idle"} style={{
            position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
            background: phase !== "idle" ? "rgba(212,169,106,0.2)" : "rgba(212,169,106,0.12)",
            border: `1px solid rgba(212,169,106,0.4)`, borderRadius: "6px",
            color: gold, padding: "8px 18px", cursor: phase !== "idle" ? "wait" : "pointer",
            fontSize: "12px", letterSpacing: "2px", fontFamily: "monospace",
          }}>
            {phase === "searching" ? "…" : "SEARCH"}
          </button>
        </div>

        {/* ── Sample queries ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "18px" }}>
          {SAMPLE_QUERIES.map(q => (
            <button key={q} onClick={() => handleSearch(q)} style={{
              background: surf, border: `1px solid ${border}`, borderRadius: "20px",
              padding: "5px 12px", color: "#9ca3af", fontSize: "11px", cursor: "pointer",
              fontFamily: "monospace",
            }}
            onMouseEnter={e => { e.target.style.color = gold; e.target.style.borderColor = "rgba(212,169,106,0.4)"; }}
            onMouseLeave={e => { e.target.style.color = "#9ca3af"; e.target.style.borderColor = border; }}
            >{q}</button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ marginBottom: "22px" }}>
          <button onClick={() => setShowFilters(v => !v)} style={{
            background: "none", border: `1px solid ${border}`, borderRadius: "6px",
            color: "#6b7280", padding: "6px 14px", cursor: "pointer",
            fontSize: "11px", letterSpacing: "2px", fontFamily: "monospace",
          }}>
            {showFilters ? "▲ HIDE FILTERS" : "▼ FILTERS & SETTINGS"}
          </button>

          {showFilters && (
            <div style={{
              marginTop: "12px", background: surf, border: `1px solid ${border}`,
              borderRadius: "10px", padding: "20px 24px",
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px",
            }}>
              {/* Dataset */}
              <div>
                <Label>Dataset</Label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                  {[["all","All (1800)"], ["classic","Classic (1200)"], ["modern","Modern 2021–26 (600)"]].map(([v, label]) => (
                    <FilterBtn key={v} active={sourceFilter === v} color={v === "modern" ? pink : "#9ca3af"} onClick={() => setSourceFilter(v)}>{label}</FilterBtn>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <Label>Category</Label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                  {["all","designer","niche","budget","middle eastern"].map(c => (
                    <FilterBtn key={c} active={catFilter === c} color={CAT_COLORS[c] || gold} onClick={() => setCatFilter(c)}>
                      {c === "all" ? "All" : c}
                    </FilterBtn>
                  ))}
                </div>
              </div>

              {/* Year range */}
              {sourceFilter !== "classic" && (
                <div>
                  <Label>Year Range — {yearMin}–{yearMax}</Label>
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <input type="range" min="2021" max="2026" value={yearMin}
                      onChange={e => setYearMin(Math.min(+e.target.value, yearMax))}
                      style={{ flex: 1, accentColor: pink }} />
                    <input type="range" min="2021" max="2026" value={yearMax}
                      onChange={e => setYearMax(Math.max(+e.target.value, yearMin))}
                      style={{ flex: 1, accentColor: pink }} />
                  </div>
                </div>
              )}

              {/* Alpha */}
              <div>
                <Label>Value Signal α = {alpha.toFixed(4)}</Label>
                <input type="range" min="0" max="0.02" step="0.001" value={alpha}
                  onChange={e => setAlpha(+e.target.value)}
                  style={{ width: "100%", marginTop: "10px", accentColor: gold }} />
                <div style={{ fontSize: "10px", color: "#4b5563", fontFamily: "monospace", marginTop: "4px" }}>
                  0 = pure BM25 · 0.02 = max value boost
                </div>
              </div>

              {/* Hybrid toggle */}
              <div>
                <Label>Retrieval Mode</Label>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <FilterBtn active={useHybrid} color="#a78bfa" onClick={() => setUseHybrid(true)}>Hybrid RRF</FilterBtn>
                  <FilterBtn active={!useHybrid} color={gold} onClick={() => setUseHybrid(false)}>BM25 only</FilterBtn>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Status / Error ── */}
        {phase === "searching" && <StatusBar color={gold}>⟳ Retrieving and generating…</StatusBar>}
        {error && <StatusBar color="#f87171">✗ {error}</StatusBar>}

        {/* ── Retrieval metadata ── */}
        {results.length > 0 && retrievalMode && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <Tag color={retrievalMode.includes("hybrid") ? "#a78bfa" : gold}>
              {retrievalMode === "hybrid_rrf" ? "Hybrid RRF" : "BM25"}
            </Tag>
            {queryTokens.map(t => <Tag key={t} color="#4b5563">{t}</Tag>)}
          </div>
        )}

        {/* ── LLM Recommendation ── */}
        {llmText && (
          <div style={{
            background: "rgba(212,169,106,0.06)", border: `1px solid rgba(212,169,106,0.2)`,
            borderRadius: "12px", padding: "24px 28px", marginBottom: "28px",
          }}>
            <SectionLabel color={gold}>Claude's Recommendation</SectionLabel>
            <div style={{ lineHeight: "1.9", fontSize: "15px", whiteSpace: "pre-wrap", marginTop: "12px" }}>
              {llmText}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <div>
            <SectionLabel color="#6b7280">Retrieved candidates — {results.length}</SectionLabel>
            <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
              {results.map((p, i) => <ResultCard key={i} p={p} rank={i + 1} />)}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {phase === "idle" && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#374151" }}>
            <div style={{ fontSize: "52px", marginBottom: "16px", opacity: 0.3 }}>◈</div>
            <div style={{ fontFamily: "monospace", fontSize: "12px", letterSpacing: "3px" }}>
              DESCRIBE YOUR OCCASION ABOVE
            </div>
            {stats && (
              <div style={{ fontFamily: "monospace", fontSize: "10px", marginTop: "8px", color: "#1f2937" }}>
                {stats.total.toLocaleString()} fragrances indexed across {stats.classic} classic + {stats.modern} modern
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────
function ResultCard({ p, rank }) {
  const bdr = "rgba(255,255,255,0.07)";
  return (
    <div style={{
      background: "rgba(255,255,255,0.022)", border: `1px solid ${bdr}`,
      borderRadius: "10px", padding: "14px 18px",
      display: "flex", alignItems: "center", gap: "14px",
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(212,169,106,0.3)"}
    onMouseLeave={e => e.currentTarget.style.borderColor = bdr}
    >
      <div style={{
        width: "26px", height: "26px", borderRadius: "50%",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "11px", fontFamily: "monospace", color: "#6b7280", flexShrink: 0,
      }}>{rank}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "15px", color: "#f0e8dc" }}>{p.name}</span>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>{p.brand}</span>
          {p.release_year && (
            <span style={{ fontSize: "11px", color: "#f472b6", fontFamily: "monospace" }}>{p.release_year}</span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "7px" }}>
          <Tag color={CAT_COLORS[p.category]}>{p.category}</Tag>
          <Tag color={SOURCE_COLORS[p._source]}>{p._source}</Tag>
          <Tag>{p.climate.join("/")}</Tag>
          <Tag>{p.time_of_day}</Tag>
          <Tag>{p.projection}</Tag>
          <Tag color={p.value_for_money === "great value" ? "#34d399" : p.value_for_money === "overpriced" ? "#f87171" : "#9ca3af"}>
            {p.value_for_money}
          </Tag>
          {p.feminine_index > 0.7 && <Tag color="#f9a8d4">♀ {p.feminine_index}</Tag>}
          {p.masculine_index > 0.7 && <Tag color="#93c5fd">♂ {p.masculine_index}</Tag>}
        </div>
        {p.source_url && (
          <a href={p.source_url} target="_blank" rel="noreferrer"
            style={{ display: "inline-block", marginTop: "5px", fontSize: "10px", color: "#4b5563", fontFamily: "monospace", textDecoration: "none" }}
            onMouseEnter={e => e.target.style.color = "#9ca3af"}
            onMouseLeave={e => e.target.style.color = "#4b5563"}
          >↗ parfumo.com</a>
        )}
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: "13px", color: "#d4a96a" }}>
          {typeof p.bm25_score === "number" ? p.bm25_score.toFixed(3) : "—"}
        </div>
        <div style={{ fontSize: "10px", color: "#374151", fontFamily: "monospace" }}>score</div>
      </div>
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{
      padding: "2px 7px", borderRadius: "4px", fontSize: "10px",
      fontFamily: "monospace", background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)", color: color || "#6b7280",
    }}>{children}</span>
  );
}

function Pill({ children, color }) {
  return (
    <span style={{
      padding: "4px 12px", borderRadius: "20px", fontSize: "11px",
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
      color: color || "#9ca3af", fontFamily: "monospace",
    }}>{children}</span>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#6b7280", textTransform: "uppercase", fontFamily: "monospace" }}>{children}</div>;
}

function SectionLabel({ children, color }) {
  return <div style={{ fontSize: "10px", letterSpacing: "3px", color: color || "#6b7280", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "10px" }}>{children}</div>;
}

function FilterBtn({ children, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: "5px", fontSize: "10px", fontFamily: "monospace",
      cursor: "pointer", background: active ? "rgba(255,255,255,0.07)" : "none",
      border: `1px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
      color: active ? color : "#6b7280",
    }}>{children}</button>
  );
}

function StatusBar({ children, color }) {
  return (
    <div style={{
      padding: "10px 16px", borderRadius: "8px", marginBottom: "16px",
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      fontSize: "12px", fontFamily: "monospace", color: color || "#9ca3af",
    }}>{children}</div>
  );
}
