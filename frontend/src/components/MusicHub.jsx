import React, { useEffect, useMemo, useState } from "react";

const SAAVN_SEARCH_ENDPOINT = "https://saavn.dev/api/search/songs?query=";

// --- HELPER FUNCTIONS ---
const getImageUrl = (imageCollection) => {
  if (!Array.isArray(imageCollection) || imageCollection.length === 0) return "";
  const preferred =
    imageCollection.find((item) => item?.quality === "500x500") ||
    imageCollection.find((item) => item?.quality === "150x150") ||
    imageCollection[imageCollection.length - 1];
  return preferred?.url || preferred?.link || "";
};

const getArtistsLabel = (song) => {
  if (song?.artists?.primary?.length) {
    return song.artists.primary.map((artist) => artist?.name).filter(Boolean).join(", ");
  }
  return song?.primaryArtists || "Unknown Artist";
};

const getStreamUrl320 = (song) => {
  const urls = Array.isArray(song?.downloadUrl) ? song.downloadUrl : [];
  const exact = urls.find((item) => item?.quality === "320kbps");
  if (exact?.url || exact?.link) return exact.url || exact.link;
  return urls[urls.length - 1]?.url || urls[urls.length - 1]?.link || "";
};

const normalizeSongs = (payload) => {
  const rawResults = payload?.data?.results || payload?.results || payload?.data || [];
  if (!Array.isArray(rawResults)) return [];

  return rawResults
    .map((song) => ({
      id: song?.id || `${song?.name}-${song?.duration}`,
      title: (song?.name || "Untitled").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
      artists: getArtistsLabel(song).replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
      image: getImageUrl(song?.image),
      streamUrl: getStreamUrl320(song),
    }))
    .filter((song) => Boolean(song.streamUrl));
};

// Try multiple proxies/endpoints in order (Avast-safe, no corsproxy.io)
const FETCH_STRATEGIES = [
  // Strategy 1: Direct fetch (fastest, works if saavn.dev allows CORS)
  async (keyword) => {
    const url = SAAVN_SEARCH_ENDPOINT + encodeURIComponent(keyword);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
    return res.json();
  },
  // Strategy 2: allorigins.win (safe, returns { contents: "..." })
  async (keyword) => {
    const targetUrl = SAAVN_SEARCH_ENDPOINT + encodeURIComponent(keyword);
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`allorigins failed: ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.contents);
  },
  // Strategy 3: jsonp.afeld.me proxy
  async (keyword) => {
    const targetUrl = SAAVN_SEARCH_ENDPOINT + encodeURIComponent(keyword);
    const proxyUrl = `https://jsonp.afeld.me/?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`jsonp proxy failed: ${res.status}`);
    return res.json();
  },
  // Strategy 4: thingproxy (reliable fallback)
  async (keyword) => {
    const targetUrl = SAAVN_SEARCH_ENDPOINT + encodeURIComponent(keyword);
    const proxyUrl = `https://thingproxy.freeboard.io/fetch/${targetUrl}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`thingproxy failed: ${res.status}`);
    return res.json();
  },
];

// --- MAIN COMPONENT ---
function MusicHub() {
  const [songs, setSongs] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSong, setActiveSong] = useState(null);
  const [networkBlocked, setNetworkBlocked] = useState(false);

  const hasResults = songs.length > 0;

  const fetchSongs = async (keyword) => {
    const trimmed = (keyword || "").trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setNetworkBlocked(false);

    let payload = null;
    let lastError = null;

    // Try each strategy until one works
    for (const strategy of FETCH_STRATEGIES) {
      try {
        payload = await strategy(trimmed);
        if (payload) break; // Success!
      } catch (err) {
        console.warn("Strategy failed, trying next...", err.message);
        lastError = err;
      }
    }

    if (!payload) {
      console.error("All fetch strategies failed:", lastError);
      setError("Unable to load music right now. Please try again.");
      setNetworkBlocked(true);
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeSongs(payload);
      setSongs(normalized);

      if (normalized.length > 0) {
        setActiveSong(normalized[0]);
      } else {
        setActiveSong(null);
        setError("No songs found for this search.");
      }
    } catch (err) {
      console.error("Parse error:", err);
      setError("Failed to parse song data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs("2026 hits");
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchSongs(query);
  };

  const headingText = useMemo(() => (query.trim() ? "Search Results" : "Trending Now"), [query]);
  const fallbackQuery = (query.trim() || activeSong?.title || "2026 hits").trim();

  return (
    <section style={{ minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.85rem" }}>Music Hub</h2>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.72)" }}>
            High-quality streaming for LAYAVANI
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "10px", marginBottom: "16px", maxWidth: "620px" }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search songs or artists..."
          style={{
            flex: 1,
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            padding: "11px 14px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            border: "1px solid rgba(255,255,255,0.26)",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.14)",
            color: "#fff",
            padding: "10px 14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* --- PLAYER BAR --- */}
      {activeSong ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "16px",
            background: "rgba(14,18,28,0.92)",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {activeSong.image ? (
            <img
              src={activeSong.image}
              alt={activeSong.title}
              style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover" }}
            />
          ) : null}
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeSong.title}
            </div>
            <div style={{ marginTop: "4px", color: "rgba(255,255,255,0.72)", fontSize: "0.9rem" }}>
              {activeSong.artists}
            </div>
          </div>
          <audio
            key={activeSong.id}
            controls
            autoPlay
            preload="auto"
            src={activeSong.streamUrl}
            style={{ width: "min(520px, 100%)" }}
          />
        </div>
      ) : null}

      {/* --- TRENDING / SEARCH HEADER --- */}
      <div style={{ marginBottom: "10px", color: "rgba(255,255,255,0.72)", fontWeight: 600 }}>
        {headingText}
      </div>

      {/* --- ERROR & FALLBACK --- */}
      {error ? <p style={{ color: "#ffb1b1", margin: "0 0 14px" }}>{error}</p> : null}

      {networkBlocked && (
        <div
          style={{
            border: "1px solid rgba(255,120,120,0.5)",
            borderRadius: "14px",
            background: "rgba(42,16,16,0.42)",
            padding: "12px",
            marginBottom: "14px",
          }}
        >
          <div style={{ fontWeight: 700 }}>Network Connection Issue</div>
          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)" }}>
            Your antivirus or network might be blocking the stream. All proxy attempts failed.
          </p>
          <button
            onClick={() =>
              window.open(
                `https://www.youtube.com/results?search_query=${encodeURIComponent(fallbackQuery)}`,
                "_blank"
              )
            }
            style={{
              border: "1px solid rgba(255,255,255,0.28)",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Search on YouTube
          </button>
        </div>
      )}

      {/* --- LOADING STATE --- */}
      {loading && (
        <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", padding: "30px 0" }}>
          Loading songs...
        </p>
      )}

      {/* --- SONG GRID --- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "14px",
        }}
      >
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => setActiveSong(song)}
            style={{
              border:
                activeSong?.id === song.id
                  ? "2px solid #1DB954"
                  : "1px solid rgba(255,255,255,0.14)",
              borderRadius: "16px",
              overflow: "hidden",
              background: "rgba(13,17,27,0.9)",
              color: "#fff",
              textAlign: "left",
              cursor: "pointer",
              padding: 0,
              transition: "transform 0.2s ease",
              boxShadow:
                activeSong?.id === song.id ? "0 0 14px rgba(29,185,84,0.35)" : "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {song.image ? (
              <img
                src={song.image}
                alt={song.title}
                style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }}
              />
            ) : (
              <div style={{ height: "190px", display: "grid", placeItems: "center" }}>No Art</div>
            )}
            <div style={{ padding: "10px 12px" }}>
              <div
                style={{
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {song.title}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.72)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {song.artists}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default MusicHub;
