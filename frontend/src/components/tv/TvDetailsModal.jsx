import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchTvSeasonEpisodes, getTvBackdropUrl, getTvPosterUrl } from "../../services/tvService";

export default function TvDetailsModal({
  isOpen,
  onClose,
  tv,
  tvDetails,
  trailerKey,
  onPlayTrailer,
  loading
}) {
  const [showStreamPlayer, setShowStreamPlayer] = useState(false);
  const [streamServerIndex, setStreamServerIndex] = useState(0);
  const [streamError, setStreamError] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState("");
  const seasonCacheRef = useRef(new Map());

  const source = tvDetails || tv || null;
  const genres = source?.genres || [];
  const currentEpisode = episodes.find((episode) => Number(episode?.episodeNumber) === Number(selectedEpisode));

  const streamServers = useMemo(() => ([
    `https://vidsrc.xyz/embed/tv/${source?.id}/${selectedSeason}/${selectedEpisode}`,
    `https://vidsrc.to/embed/tv/${source?.id}/${selectedSeason}/${selectedEpisode}`,
    `https://vidsrc.me/embed/tv/${source?.id}/${selectedSeason}/${selectedEpisode}`,
  ]), [source?.id, selectedSeason, selectedEpisode]);

  useEffect(() => {
    if (!isOpen || !source?.id) return;

    const totalSeasons = Math.max(1, Number(source?.number_of_seasons) || 1);
    const seasonOptions = Array.from({ length: totalSeasons }, (_, index) => index + 1);

    setSeasons(seasonOptions);
    setSelectedSeason(1);
    setSelectedEpisode(1);
    setEpisodes([]);
    setEpisodesError("");
    setShowStreamPlayer(false);
    setStreamServerIndex(0);
    setStreamError(false);
    setStreamLoading(false);
  }, [isOpen, source?.id, source?.number_of_seasons]);

  useEffect(() => {
    if (!isOpen || !source?.id || !selectedSeason) return;

    const cacheKey = `${source.id}-${selectedSeason}`;
    const cachedSeason = seasonCacheRef.current.get(cacheKey);

    if (cachedSeason) {
      setEpisodes(cachedSeason.episodes || []);
      setSelectedEpisode(cachedSeason.episodes?.[0]?.episodeNumber || 1);
      setEpisodesError("");
      return;
    }

    let active = true;

    const loadEpisodes = async () => {
      setEpisodesLoading(true);
      setEpisodesError("");

      try {
        const normalized = await fetchTvSeasonEpisodes(source.id, selectedSeason);
        if (!active) return;

        seasonCacheRef.current.set(cacheKey, normalized);
        setEpisodes(Array.isArray(normalized?.episodes) ? normalized.episodes : []);
        setSelectedEpisode(normalized?.episodes?.[0]?.episodeNumber || 1);
      } catch (error) {
        if (!active) return;
        setEpisodes([]);
        setEpisodesError("Unable to load episodes right now.");
      } finally {
        if (active) setEpisodesLoading(false);
      }
    };

    loadEpisodes();

    return () => {
      active = false;
    };
  }, [isOpen, source?.id, selectedSeason]);

  const handleClose = () => {
    setShowStreamPlayer(false);
    setStreamServerIndex(0);
    setStreamError(false);
    setStreamLoading(false);
    onClose();
  };

  if (!isOpen || !tv) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3300,
        background: "rgba(4,6,11,0.7)",
        backdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: "20px"
      }}
      onClick={handleClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(9,12,20,0.95)",
          boxShadow: "0 20px 55px rgba(0,0,0,0.45)"
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: "200px",
            backgroundImage: getTvBackdropUrl(source?.backdrop_path || tv?.backdrop_path)
              ? `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(9,12,20,0.98)), url(${getTvBackdropUrl(source?.backdrop_path || tv?.backdrop_path)})`
              : "linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(9,12,20,0.98))",
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              width: "36px",
              height: "36px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(10,10,14,0.7)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px", padding: "18px" }}>
          <div>
            {(source?.poster_path || tv?.poster_path) ? (
              <img
                src={getTvPosterUrl(source?.poster_path || tv?.poster_path)}
                alt={source?.name || tv?.name}
                loading="lazy"
                style={{ width: "100%", borderRadius: "14px", aspectRatio: "2 / 3", objectFit: "cover", background: "#141b2a" }}
              />
            ) : (
              <div style={{ width: "100%", borderRadius: "14px", aspectRatio: "2 / 3", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", background: "#141b2a" }}>
                No Poster
              </div>
            )}
          </div>

          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.8rem" }}>{source?.name || tv?.name}</h2>
            <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: "10px" }}>
              {(source?.first_air_date || "").slice(0, 4) || "Unknown year"} • Seasons: {source?.number_of_seasons || "N/A"} • ⭐ {Number(source?.vote_average || 0).toFixed(1)}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {genres.length > 0 ? genres.map((genre) => (
                <span key={genre.id} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 10px", fontSize: "0.8rem" }}>
                  {genre.name}
                </span>
              )) : <span style={{ color: "rgba(255,255,255,0.7)" }}>Genres unavailable</span>}
            </div>

            {loading ? <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "10px" }}>Loading TV show details...</div> : null}

            <p style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: "0 0 14px" }}>
              {source?.overview || "No overview available."}
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
              {trailerKey ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowStreamPlayer(false);
                    onPlayTrailer();
                  }}
                  style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "#fff", color: "#000", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                >
                  ▶ Trailer
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowStreamPlayer(true);
                  setStreamError(false);
                  setStreamLoading(true);
                }}
                style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                ▶ Play
              </button>
            </div>

            {showStreamPlayer ? (
              <>
                <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: "12px", overflow: "hidden", background: "#000", border: "1px solid rgba(255,255,255,0.15)", position: "relative" }}>
                  {streamLoading ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.72)", background: "rgba(0,0,0,0.35)" }}>Loading stream...</div> : null}
                  <iframe
                    src={streamServers[streamServerIndex % streamServers.length]}
                    width="100%"
                    height="100%"
                    allowFullScreen
                    frameBorder="0"
                    loading="lazy"
                    onLoad={() => setStreamLoading(false)}
                    onError={() => {
                      setStreamError(true);
                      setStreamLoading(false);
                    }}
                    title="tv-stream"
                  />
                </div>
                {streamError ? (
                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ color: "rgba(255,255,255,0.72)" }}>Source unavailable</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStreamServerIndex((prev) => prev + 1);
                        setStreamError(false);
                        setStreamLoading(true);
                      }}
                      style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "7px 11px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Try Another Server
                    </button>
                  </div>
                ) : null}
              </>
            ) : trailerKey ? (
              <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
                <iframe
                  title="TV trailer"
                  width="100%"
                  style={{ aspectRatio: "16 / 9" }}
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ padding: "0 18px 18px" }}>
          <h3 style={{ margin: "4px 0 10px", fontSize: "1.9rem" }}>Episodes</h3>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
            <select
              value={selectedSeason}
              onChange={(event) => {
                const season = Number(event.target.value) || 1;
                setSelectedSeason(season);
                setShowStreamPlayer(false);
                setStreamServerIndex(0);
                setStreamError(false);
                setStreamLoading(false);
              }}
              style={{ borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", color: "#fff", padding: "9px 12px", minWidth: "170px" }}
            >
              {(seasons.length ? seasons : [1]).map((season) => (
                <option key={season} value={season} style={{ background: "#111725" }}>
                  Season {season}
                </option>
              ))}
            </select>

            {currentEpisode ? (
              <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>
                Playing S{selectedSeason} • E{selectedEpisode}
              </span>
            ) : null}
          </div>

          {episodesLoading ? <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "10px" }}>Loading episodes...</div> : null}
          {episodesError ? <div style={{ color: "#ffb1b1", marginBottom: "10px" }}>{episodesError}</div> : null}
          {!episodesLoading && !episodesError && episodes.length === 0 ? <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "10px" }}>No episodes available</div> : null}

          <div style={{ display: "grid", gap: "10px" }}>
            {episodes.map((episode) => {
              const isActive = Number(episode?.episodeNumber) === Number(selectedEpisode);
              return (
                <div
                  key={`${selectedSeason}-${episode?.episodeNumber}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(130px, 180px) 1fr auto",
                    gap: "10px",
                    alignItems: "stretch",
                    border: `1px solid ${isActive ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: "12px",
                    background: isActive ? "rgba(59,76,105,0.5)" : "rgba(34,42,60,0.6)",
                    overflow: "hidden"
                  }}
                >
                  {episode?.still_path ? (
                    <img
                      src={getTvBackdropUrl(episode.still_path)}
                      alt={episode?.name || `Episode ${episode?.episodeNumber}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", minHeight: "92px", objectFit: "cover", background: "#151c2a" }}
                    />
                  ) : (
                    <div style={{ minHeight: "92px", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.62)", background: "#151c2a", fontSize: "0.85rem" }}>
                      No Image
                    </div>
                  )}

                  <div style={{ padding: "10px 4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                      <span style={{ borderRadius: "6px", border: "1px solid rgba(255,255,255,0.22)", padding: "2px 7px", fontSize: "0.78rem", color: "rgba(255,255,255,0.9)" }}>
                        {episode?.episodeNumber}
                      </span>
                      <strong style={{ fontSize: "1.05rem" }}>{episode?.name || `Episode ${episode?.episodeNumber}`}</strong>
                    </div>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.45, fontSize: "0.95rem" }}>
                      {episode?.overview || "No description available."}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEpisode(Number(episode?.episodeNumber) || 1);
                        setShowStreamPlayer(true);
                        setStreamServerIndex(0);
                        setStreamError(false);
                        setStreamLoading(true);
                      }}
                      style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "7px 11px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      ▶ Play
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEpisode(Number(episode?.episodeNumber) || 1);
                        setShowStreamPlayer(true);
                        setStreamServerIndex(0);
                        setStreamError(false);
                        setStreamLoading(true);
                      }}
                      aria-label="Download"
                      title="Download"
                      style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "7px 10px", fontWeight: 700, cursor: "pointer" }}
                    >
                      ⤓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
