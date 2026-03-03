import React, { useState } from "react";
import { getPosterUrl, getBackdropUrl } from "../../services/tmdbService";

export default function MovieDetailsModal({
  isOpen,
  onClose,
  movie,
  movieDetails,
  movieProviders,
  trailerKey,
  onPlayTrailer,
  watchlisted,
  onToggleWatchlist,
  loading
}) {
  const [showStreamPlayer, setShowStreamPlayer] = useState(false);
  const [streamServerIndex, setStreamServerIndex] = useState(0);
  const [streamError, setStreamError] = useState(false);

  if (!isOpen || !movie) return null;

  const providers = movieProviders?.results?.IN?.flatrate || [];
  const genres = movieDetails?.genres || [];
  const streamServers = [
    `https://vidsrc.xyz/embed/movie/${movie?.id}`,
    `https://vidsrc.to/embed/movie/${movie?.id}`,
    `https://vidsrc.me/embed/movie/${movie?.id}`,
  ];

  const handleClose = () => {
    setShowStreamPlayer(false);
    setStreamServerIndex(0);
    setStreamError(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3200,
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
            backgroundImage: getBackdropUrl(movieDetails?.backdrop_path || movie.backdrop_path)
              ? `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(9,12,20,0.98)), url(${getBackdropUrl(movieDetails?.backdrop_path || movie.backdrop_path)})`
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
            {(movieDetails?.poster_path || movie.poster_path) ? (
              <img
                src={getPosterUrl(movieDetails?.poster_path || movie.poster_path)}
                alt={movieDetails?.title || movie.title}
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
            <h2 style={{ margin: "0 0 8px", fontSize: "1.8rem" }}>{movieDetails?.title || movie.title}</h2>
            <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: "10px" }}>
              {movieDetails?.release_date || "Unknown release"} • {movieDetails?.runtime ? `${movieDetails.runtime} min` : "Runtime N/A"} • ⭐ {Number(movieDetails?.vote_average || movie.vote_average || 0).toFixed(1)}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {genres.length > 0 ? genres.map((genre) => (
                <span key={genre.id} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 10px", fontSize: "0.8rem" }}>
                  {genre.name}
                </span>
              )) : <span style={{ color: "rgba(255,255,255,0.7)" }}>Genres unavailable</span>}
            </div>

            {loading ? (
              <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "10px" }}>Loading movie details...</div>
            ) : null}

            <p style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: "0 0 14px" }}>
              {movieDetails?.overview || movie.overview || "No overview available."}
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
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
              <button
                type="button"
                onClick={() => {
                  setShowStreamPlayer(true);
                  setStreamError(false);
                }}
                style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                ▶ Play Movie
              </button>
              <button
                type="button"
                onClick={onToggleWatchlist}
                style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                {watchlisted ? "❤️ Watchlist" : "🤍 Watchlist"}
              </button>
            </div>

            <div style={{ marginBottom: "8px", fontWeight: 700 }}>Available On</div>
            {providers.length > 0 ? (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                {providers.map((provider) => (
                  <div key={provider.provider_id} style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "999px", padding: "6px 10px", background: "rgba(255,255,255,0.05)" }}>
                    {provider.logo_path ? <img src={getPosterUrl(provider.logo_path)} alt={provider.provider_name} loading="lazy" style={{ width: "20px", height: "20px", borderRadius: "999px", objectFit: "cover" }} /> : null}
                    <span style={{ fontSize: "0.82rem" }}>{provider.provider_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "14px" }}>Streaming availability not found</div>
            )}

            {showStreamPlayer ? (
              <>
                <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: "12px", overflow: "hidden", background: "#000", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <iframe
                    src={streamServers[streamServerIndex % streamServers.length]}
                    width="100%"
                    height="100%"
                    allowFullScreen
                    frameBorder="0"
                    onError={() => setStreamError(true)}
                    title="movie-stream"
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
                  title="Movie trailer"
                  width="100%"
                  style={{ aspectRatio: "16 / 9" }}
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                  allowFullScreen
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
