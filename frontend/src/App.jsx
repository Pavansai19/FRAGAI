import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "/api";

// ─── Color Map ────────────────────────────────────────────────────
const CAT_COLORS = {
  niche:            { bg: "#1a0a2e", text: "#c084fc" },
  designer:         { bg: "#0a1628", text: "#60a5fa" },
  budget:           { bg: "#0a2018", text: "#34d399" },
  "middle eastern": { bg: "#1e1208", text: "#f59e0b" },
};

const SAMPLE_QUERIES = [
  "romantic winter dinner date",
  "fresh summer beach casual",
  "powerful masculine office",
  "soft feminine spring daytime",
  "affordable everyday versatile",
  "recent niche exclusive night out",
  "arabic oud oriental winter",
  "light clean unisex commute",
];

// ─── Gender Label ─────────────────────────────────────────────────
function genderLabel(fi, mi) {
  if (fi > 0.7) return { label: "Feminine", color: "#f9a8d4" };
  if (mi > 0.7) return { label: "Masculine", color: "#93c5fd" };
  return { label: "Unisex", color: "#a3a3a3" };
}

// ─── Value Label ──────────────────────────────────────────────────
const VALUE_LABELS = {
  "great value": { label: "Great Value", color: "#34d399" },
  "good value":  { label: "Good Value",  color: "#86efac" },
  "ok":          { label: "Fair Value",  color: "#a3a3a3" },
  "overpriced":  { label: "Premium",     color: "#f87171" },
};

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState([]);
  const [llmText, setLlmText]     = useState("");
  const [phase, setPhase]         = useState("idle");
  const [error, setError]         = useState("");
  const [stats, setStats]         = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("all");
  const [catFilter,    setCatFilter]    = useState("all");
  const [yearMin,      setYearMin]      = useState(2021);
  const [yearMax,      setYearMax]      = useState(2026);
  const [alpha,        setAlpha]        = useState(0.005);

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {});
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
          year_min: yearMin,
          year_max: yearMax,
          alpha,
          top_k: 12,
          use_hybrid: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Search failed");
      }

      const data = await res.json();
      setResults(data.results);
      setLlmText(data.llm_recommendation);
    } catch (e) {
      setError(e.message);
    }
    setPhase("idle");
  };

  return (
    <div style={{
      background: "#f7f4ef",
      minHeight: "100vh",
      fontFamily: "'EB Garamond', 'Garamond', Georgia, serif",
      color: "#1a1a1a",
    }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        input::placeholder { color: #9ca3af; }
        input:focus { outline: none; }

        .result-card {
          border-bottom: 1px solid #e5e0d8;
          padding: 24px 0;
          transition: background 0.15s;
          cursor: default;
        }
        .result-card:hover { background: rgba(0,0,0,0.015); }
        .result-card:first-child { border-top: 1px solid #e5e0d8; }

        .chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 2px;
          font-size: 10px;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .sample-btn {
          background: none;
          border: 1px solid #d4cfc7;
          border-radius: 2px;
          padding: 6px 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          color: #6b6560;
          cursor: pointer;
          letter-spacing: 0.3px;
          transition: all 0.15s;
        }
        .sample-btn:hover {
          border-color: #1a1a1a;
          color: #1a1a1a;
          background: rgba(0,0,0,0.03);
        }

        .filter-btn {
          background: none;
          border: 1px solid #d4cfc7;
          border-radius: 2px;
          padding: 5px 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          color: #6b6560;
        }
        .filter-btn.active {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: #f7f4ef;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease forwards; }

        input[type=range] { accent-color: #1a1a1a; }
      `}</style>

      {/* ── Masthead ── */}
      <header style={{
        borderBottom: "2px solid #1a1a1a",
        padding: "0 48px",
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 0",
          borderBottom: "1px solid #e5e0d8",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "#9ca3af",
        }}>
          <span>Fragrance Intelligence</span>
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {stats && (
              <>
                <span>{stats.classic.toLocaleString()} Classic</span>
                <span style={{ color: "#d4cfc7" }}>·</span>
                <span>{stats.modern} Modern</span>
                <span style={{ color: "#d4cfc7" }}>·</span>
                <span>{stats.total.toLocaleString()} Total</span>
              </>
            )}
            <button
              onClick={() => setDebugMode(v => !v)}
              style={{
                background: debugMode ? "#1a1a1a" : "none",
                border: "1px solid #d4cfc7",
                borderRadius: "2px",
                padding: "3px 10px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "10px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor: "pointer",
                color: debugMode ? "#f7f4ef" : "#9ca3af",
                transition: "all 0.15s",
              }}
            >
              {debugMode ? "Debug On" : "Debug"}
            </button>
          </div>
        </div>

        {/* Logo */}
        <div style={{
          textAlign: "center",
          padding: "32px 0 24px",
        }}>
          <div style={{
            fontSize: "clamp(52px, 8vw, 96px)",
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 500,
            letterSpacing: "12px",
            lineHeight: 1,
            textTransform: "uppercase",
          }}>
            FRAGAI
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#9ca3af",
            marginTop: "8px",
          }}>
            AI-Powered Fragrance Discovery
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 24px" }}>

        {/* ── Search ── */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{
            display: "flex",
            borderBottom: "2px solid #1a1a1a",
            alignItems: "center",
            gap: "16px",
            paddingBottom: "4px",
          }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Describe your occasion, mood, or preference…"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                fontSize: "clamp(16px, 2.5vw, 22px)",
                fontFamily: "'EB Garamond', serif",
                fontStyle: "italic",
                color: "#1a1a1a",
                padding: "8px 0",
              }}
            />
            <button
              onClick={() => handleSearch()}
              disabled={phase !== "idle"}
              style={{
                background: phase !== "idle" ? "#9ca3af" : "#1a1a1a",
                color: "#f7f4ef",
                border: "none",
                padding: "10px 28px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                cursor: phase !== "idle" ? "wait" : "pointer",
                transition: "background 0.15s",
                flexShrink: 0,
              }}
            >
              {phase === "searching" ? "Searching…" : "Discover"}
            </button>
          </div>

          {/* Sample queries */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
            {SAMPLE_QUERIES.map(q => (
              <button key={q} className="sample-btn" onClick={() => handleSearch(q)}>{q}</button>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={{ marginBottom: "40px" }}>
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px", letterSpacing: "1.5px",
              textTransform: "uppercase", color: "#9ca3af",
              display: "flex", alignItems: "center", gap: "6px",
              padding: 0,
            }}
          >
            <span style={{ fontSize: "8px" }}>{showFilters ? "▲" : "▼"}</span>
            Filters & Settings
          </button>

          {showFilters && (
            <div className="fade-in" style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "24px",
              padding: "24px",
              background: "#efebe4",
              borderRadius: "2px",
            }}>
              {/* Dataset */}
              <div>
                <FilterLabel>Dataset</FilterLabel>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                  {[["all","All"], ["classic","Classic"], ["modern","Modern"]].map(([v, l]) => (
                    <button key={v} className={`filter-btn ${sourceFilter === v ? "active" : ""}`}
                      onClick={() => setSourceFilter(v)}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <FilterLabel>Category</FilterLabel>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                  {["all","designer","niche","budget","middle eastern"].map(c => (
                    <button key={c} className={`filter-btn ${catFilter === c ? "active" : ""}`}
                      onClick={() => setCatFilter(c)}>{c === "all" ? "All" : c}</button>
                  ))}
                </div>
              </div>

              {/* Year */}
              {sourceFilter !== "classic" && (
                <div>
                  <FilterLabel>Year Range — {yearMin}–{yearMax}</FilterLabel>
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                    <input type="range" min="2021" max="2026" value={yearMin}
                      onChange={e => setYearMin(Math.min(+e.target.value, yearMax))}
                      style={{ flex: 1 }} />
                    <input type="range" min="2021" max="2026" value={yearMax}
                      onChange={e => setYearMax(Math.max(+e.target.value, yearMin))}
                      style={{ flex: 1 }} />
                  </div>
                </div>
              )}

              {/* Alpha */}
              <div>
                <FilterLabel>Value Signal α = {alpha.toFixed(3)}</FilterLabel>
                <input type="range" min="0" max="0.02" step="0.001" value={alpha}
                  onChange={e => setAlpha(+e.target.value)}
                  style={{ width: "100%", marginTop: "12px" }} />
                <div style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif", marginTop: "4px" }}>
                  0 = pure relevance · 0.02 = max value boost
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            padding: "16px 20px", background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: "2px", marginBottom: "32px",
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#dc2626",
          }}>
            {error}
          </div>
        )}

        {/* ── LLM Recommendation ── */}
        {llmText && (
          <div className="fade-in" style={{ marginBottom: "48px" }}>
            {/* Editorial pull quote style */}
            <div style={{
              borderTop: "2px solid #1a1a1a",
              borderBottom: "1px solid #e5e0d8",
              padding: "32px 0",
              position: "relative",
            }}>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "10px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#9ca3af",
                marginBottom: "20px",
              }}>
                Our Recommendation
              </div>
              <div style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                lineHeight: "1.85",
                fontFamily: "'EB Garamond', serif",
                color: "#1a1a1a",
                whiteSpace: "pre-wrap",
              }}>
                {llmText}
              </div>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <div className="fade-in">
            <div style={{
              display: "flex", alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "10px", letterSpacing: "3px",
                textTransform: "uppercase", color: "#9ca3af",
              }}>
                Retrieved Fragrances
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "10px", color: "#9ca3af",
              }}>
                {results.length} matches
              </div>
            </div>

            <div>
              {results.map((p, i) => (
                <ResultCard key={i} p={p} rank={i + 1} debugMode={debugMode} />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {phase === "idle" && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              fontSize: "72px",
              fontFamily: "'EB Garamond', serif",
              fontStyle: "italic",
              color: "#d4cfc7",
              lineHeight: 1,
              marginBottom: "16px",
            }}>
              ◈
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#c4bfb7",
            }}>
              Describe your moment
            </div>
            {stats && (
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                color: "#d4cfc7",
                marginTop: "8px",
              }}>
                {stats.total.toLocaleString()} fragrances indexed
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid #e5e0d8",
        padding: "24px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "10px",
        letterSpacing: "1px",
        color: "#c4bfb7",
        textTransform: "uppercase",
      }}>
        <span>FRAGAI © 2026</span>
        <span>BM25 · Claude Haiku · 1,800 Fragrances</span>
      </footer>
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────
function ResultCard({ p, rank, debugMode }) {
  const cat    = CAT_COLORS[p.category] || { bg: "#1a1a1a", text: "#e5e0d8" };
  const gender = genderLabel(p.feminine_index, p.masculine_index);
  const value  = VALUE_LABELS[p.value_for_money] || VALUE_LABELS["ok"];

  const climateStr = p.climate.includes("all")
    ? "All Seasons"
    : p.climate.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(", ");

  const todStr = { night: "Evening", day: "Daytime", any: "Anytime" }[p.time_of_day] || p.time_of_day;
  const projStr = p.projection === "strong" ? "Strong Projection" : "Moderate Projection";

  return (
    <div className="result-card" style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

      {/* Rank number */}
      <div style={{
        fontFamily: "'EB Garamond', serif",
        fontSize: "13px",
        color: "#c4bfb7",
        minWidth: "24px",
        paddingTop: "2px",
        fontStyle: "italic",
      }}>
        {String(rank).padStart(2, "0")}
      </div>

      {/* Main content */}
      <div style={{ flex: 1 }}>

        {/* Name + Brand + Year */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
          <span style={{
            fontSize: "clamp(17px, 2vw, 21px)",
            fontFamily: "'EB Garamond', serif",
            fontWeight: 500,
            letterSpacing: "0.3px",
          }}>
            {p.name}
          </span>
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            color: "#6b6560",
            fontWeight: 300,
          }}>
            {p.brand}
          </span>
          {p.release_year && (
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "10px",
              color: "#9ca3af",
              letterSpacing: "0.5px",
            }}>
              {p.release_year}
            </span>
          )}
        </div>

        {/* Tags row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>

          {/* Category */}
          <span className="chip" style={{ background: cat.bg, color: cat.text }}>
            {p.category}
          </span>

          {/* Source */}
          <span className="chip" style={{
            background: p._source === "modern" ? "#1e0a1a" : "#1a1a1a",
            color: p._source === "modern" ? "#f9a8d4" : "#a3a3a3",
          }}>
            {p._source}
          </span>

          {/* Climate */}
          <span className="chip" style={{ background: "#f0ece5", color: "#6b6560" }}>
            {climateStr}
          </span>

          {/* Time of day */}
          <span className="chip" style={{ background: "#f0ece5", color: "#6b6560" }}>
            {todStr}
          </span>

          {/* Projection */}
          <span className="chip" style={{ background: "#f0ece5", color: "#6b6560" }}>
            {projStr}
          </span>

          {/* Value */}
          <span className="chip" style={{ background: "#f0ece5", color: value.color }}>
            {value.label}
          </span>

          {/* Gender */}
          <span className="chip" style={{ background: "#f0ece5", color: gender.color }}>
            {gender.label}
          </span>

          {/* Debug: BM25 score */}
          {debugMode && (
            <span className="chip" style={{
              background: "#1a1a1a", color: "#fbbf24",
              fontFamily: "monospace",
            }}>
              BM25 {typeof p.bm25_score === "number" ? p.bm25_score.toFixed(3) : "—"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────
function FilterLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: "10px",
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      color: "#9ca3af",
    }}>
      {children}
    </div>
  );
}
