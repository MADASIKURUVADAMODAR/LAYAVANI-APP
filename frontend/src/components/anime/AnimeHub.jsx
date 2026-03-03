import React, { useEffect, useState } from "react";
import AnimeDetailsModal from "./AnimeDetailsModal";
import { fetchAnimeDetails, fetchAnimeList, getAnimeGenres, getAnimePosterUrl, searchAnime } from "../../services/animeService";

export default function AnimeHub() {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedAnime, setSelectedAnime] = useState(null);
  const [selectedAnimeDetails, setSelectedAnimeDetails] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  const loadAnime = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAnimeList({ page: 1 });
      setAnimeList(Array.isArray(payload?.data) ? payload.data : []);
      setHasSearched(false);
    } catch (err) {
      setAnimeList([]);
      setError("Unable to load anime right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnime();
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      loadAnime();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await searchAnime(trimmed, 1);
      setAnimeList(Array.isArray(payload?.data) ? payload.data : []);
      setHasSearched(true);
    } catch (err) {
      setAnimeList([]);
      setError("Anime search failed.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnime = async (anime) => {
    if (!anime?.mal_id) return;
    setSelectedAnime(anime);
    setModalOpen(true);
    setModalLoading(true);
    setShowTrailer(false);

    try {
      const details = await fetchAnimeDetails(anime.mal_id);
      setSelectedAnimeDetails(details);
    } catch (error) {
      setSelectedAnimeDetails(null);
    } finally {
      setModalLoading(false);
    }
  };

  const skeletonCards = Array.from({ length: 12 }, (_, index) => index);

  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.9rem" }}>Anime Premium</h2>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.72)" }}>Top-rated anime metadata with instant stream access.</p>
        </div>
        <button
          type="button"
          onClick={loadAnime}
          style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: "14px", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "9px 14px", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginBottom: "16px", maxWidth: "620px" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search anime..."
          style={{ flex: 1, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "11px 14px", outline: "none" }}
        />
        <button type="submit" style={{ border: "1px solid rgba(255,255,255,0.28)", borderRadius: "12px", background: "rgba(255,255,255,0.14)", color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? <p style={{ color: "#ffb1b1", margin: "0 0 14px" }}>{error}</p> : null}
      {hasSearched && !loading && animeList.length === 0 ? <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.72)" }}>No anime found.</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px" }}>
        {loading
          ? skeletonCards.map((item) => (
            <div key={item} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", background: "rgba(13,17,27,0.9)", overflow: "hidden" }}>
              <div style={{ width: "100%", aspectRatio: "2 / 3", background: "linear-gradient(110deg, rgba(255,255,255,0.06) 8%, rgba(255,255,255,0.14) 18%, rgba(255,255,255,0.06) 33%)" }} />
              <div style={{ padding: "10px 12px" }}>
                <div style={{ height: "14px", borderRadius: "6px", background: "rgba(255,255,255,0.12)", marginBottom: "8px" }} />
                <div style={{ height: "12px", width: "70%", borderRadius: "6px", background: "rgba(255,255,255,0.08)" }} />
              </div>
            </div>
          ))
          : animeList.map((anime) => {
            const genres = getAnimeGenres(anime);
            return (
              <button
                key={anime.mal_id}
                type="button"
                onClick={() => handleSelectAnime(anime)}
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
                {getAnimePosterUrl(anime) ? (
                  <img src={getAnimePosterUrl(anime)} alt={anime.title} loading="lazy" style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", background: "#151c2a" }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "2 / 3", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", background: "#151c2a" }}>No Poster</div>
                )}
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{anime.title}</div>
                  <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.72)", fontSize: "0.85rem" }}>
                    ⭐ {Number(anime.score || 0).toFixed(1)} • {anime.year || "N/A"}
                  </div>
                  <div style={{ marginTop: "5px", color: "rgba(255,255,255,0.64)", fontSize: "0.78rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {genres.length ? genres.slice(0, 2).join(" • ") : "Genres unavailable"}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <AnimeDetailsModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedAnime(null);
          setSelectedAnimeDetails(null);
          setShowTrailer(false);
        }}
        anime={selectedAnime}
        animeDetails={selectedAnimeDetails}
        onPlayTrailer={() => setShowTrailer(true)}
        trailerUrl={showTrailer ? (selectedAnimeDetails?.trailer?.embed_url || selectedAnime?.trailer?.embed_url || "") : ""}
        loading={modalLoading}
      />
    </section>
  );
}
