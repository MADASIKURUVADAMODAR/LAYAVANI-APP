import React, { useEffect, useState } from "react";
import TvDetailsModal from "./TvDetailsModal";
import { fetchTrendingTvShows, fetchTvDetails, fetchTvVideos, getTvPosterUrl, searchTvShows } from "../../services/tvService";

export default function TvShowsHub() {
  const [query, setQuery] = useState("");
  const [tvResults, setTvResults] = useState([]);
  const [trendingTv, setTrendingTv] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");

  const [selectedTv, setSelectedTv] = useState(null);
  const [selectedTvDetails, setSelectedTvDetails] = useState(null);
  const [tvVideos, setTvVideos] = useState([]);
  const [tvTrailerKey, setTvTrailerKey] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const loadTrending = async () => {
    setTrendingLoading(true);
    setError("");
    try {
      const payload = await fetchTrendingTvShows({ page: 1 });
      setTrendingTv(Array.isArray(payload?.results) ? payload.results : []);
      setHasSearched(false);
    } catch (err) {
      setTrendingTv([]);
      setError("Unable to load TV shows right now.");
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => {
    loadTrending();
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setTvResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await searchTvShows(trimmed, 1);
      setTvResults(Array.isArray(payload?.results) ? payload.results : []);
      setHasSearched(true);
    } catch (err) {
      setTvResults([]);
      setError("TV search failed.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTv = async (tv) => {
    if (!tv?.id) return;

    setSelectedTv(tv);
    setModalOpen(true);
    setModalLoading(true);
    setTvTrailerKey("");

    try {
      const [details, videosPayload] = await Promise.all([
        fetchTvDetails(tv.id),
        fetchTvVideos(tv.id)
      ]);

      setSelectedTvDetails(details);
      setTvVideos(Array.isArray(videosPayload?.results) ? videosPayload.results : []);
    } catch (error) {
      setSelectedTvDetails(null);
      setTvVideos([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handlePlayTrailer = () => {
    const trailer = tvVideos.find((video) => video?.type === "Trailer" && video?.site === "YouTube");
    if (!trailer?.key) return;
    setTvTrailerKey(trailer.key);
  };

  const displayList = tvResults.length > 0 ? tvResults : trendingTv;
  const skeletonCards = Array.from({ length: 12 }, (_, index) => index);

  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.9rem" }}>TV Shows Premium</h2>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.72)" }}>Trending and searchable TMDB TV catalog with instant playback.</p>
        </div>
        <button
          type="button"
          onClick={loadTrending}
          style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: "14px", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "9px 14px", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginBottom: "16px", maxWidth: "620px" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search TV shows..."
          style={{ flex: 1, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "11px 14px", outline: "none" }}
        />
        <button type="submit" style={{ border: "1px solid rgba(255,255,255,0.28)", borderRadius: "12px", background: "rgba(255,255,255,0.14)", color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? <p style={{ color: "#ffb1b1", margin: "0 0 14px" }}>{error}</p> : null}
      {hasSearched && !loading && tvResults.length === 0 ? <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.72)" }}>No TV shows found.</p> : null}

      <h3 style={{ margin: "0 0 14px", fontSize: "1.45rem" }}>{tvResults.length > 0 ? "Search Results" : "🔥 Trending TV Shows"}</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px" }}>
        {(loading || trendingLoading)
          ? skeletonCards.map((item) => (
            <div key={item} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", background: "rgba(13,17,27,0.9)", overflow: "hidden" }}>
              <div style={{ width: "100%", aspectRatio: "2 / 3", background: "linear-gradient(110deg, rgba(255,255,255,0.06) 8%, rgba(255,255,255,0.14) 18%, rgba(255,255,255,0.06) 33%)" }} />
              <div style={{ padding: "10px 12px" }}>
                <div style={{ height: "14px", borderRadius: "6px", background: "rgba(255,255,255,0.12)", marginBottom: "8px" }} />
                <div style={{ height: "12px", width: "70%", borderRadius: "6px", background: "rgba(255,255,255,0.08)" }} />
              </div>
            </div>
          ))
          : displayList.map((tv) => (
            <button
              key={tv.id}
              type="button"
              onClick={() => handleSelectTv(tv)}
              style={{ border: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px", overflow: "hidden", background: "rgba(13,17,27,0.9)", color: "#fff", textAlign: "left", cursor: "pointer", padding: 0, transition: "transform 0.2s ease, border-color 0.2s ease" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-3px)";
                event.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              }}
            >
              {tv.poster_path ? <img src={getTvPosterUrl(tv.poster_path)} alt={tv.name} style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", background: "#151c2a" }} /> : <div style={{ width: "100%", aspectRatio: "2 / 3", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", background: "#151c2a" }}>No Poster</div>}
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{tv.name}</div>
                <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.72)", fontSize: "0.85rem" }}>⭐ {Number(tv.vote_average || 0).toFixed(1)} • {(tv.first_air_date || "").slice(0, 4) || "N/A"}</div>
              </div>
            </button>
          ))}
      </div>

      <TvDetailsModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTv(null);
          setSelectedTvDetails(null);
          setTvVideos([]);
          setTvTrailerKey("");
        }}
        tv={selectedTv}
        tvDetails={selectedTvDetails}
        trailerKey={tvTrailerKey}
        onPlayTrailer={handlePlayTrailer}
        loading={modalLoading}
      />
    </section>
  );
}
