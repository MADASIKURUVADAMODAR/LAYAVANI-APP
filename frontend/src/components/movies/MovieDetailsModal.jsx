import React, { useState, useRef } from "react";
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
  const [streamLoading, setStreamLoading] = useState(false);
  const iframeRef = useRef(null);

  if (!isOpen || !movie) return null;

  const providers = movieProviders?.results?.IN?.flatrate || [];
  const genres = movieDetails?.genres || [];
  const streamServers = [
    `https://vidsrc.xyz/embed/movie/${movie?.id}`,
    `https://vidsrc.to/embed/movie/${movie?.id}`,
    `https://vidsrc.me/embed/movie?tmdb=${movie?.id}`,
    `https://embed.su/embed/movie/${movie?.id}`,
    `https://multiembed.mov/?video_id=${movie?.id}&tmdb=1`,
    `https://vidsrc.icu/embed/movie/${movie?.id}`,
    `https://vidlink.pro/movie/${movie?.id}`,
    `https://player.autoembed.cc/embed/movie/${movie?.id}`,
  ];

  const handleClose = () => {
    setShowStreamPlayer(false);
    setStreamServerIndex(0);
    setStreamError(false);
    setStreamLoading(false);
    onClose();
  };

  const handleNextServer = () => {
    const next = streamServerIndex + 1;
    if (next >= streamServers.length) {
      setStreamError(true);
    } else {
      setStreamServerIndex(next);
      setStreamLoading(true);
      setStreamError(false);
    }
  };

  // ✅ THE REAL FIX: call requestFullscreen() directly on the iframe element
  // This bypasses CSS overflow restrictions completely — works even with overflowY:"auto" on parent
  const handleFullscreen = () => {
    const el = iframeRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
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
        {/* Banner */}
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
          >✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px", padding: "18px" }}>
          {/* Poster */}
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

          {/* Info */}
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.8rem" }}>{movieDetails?.title || movie.title}</h2>
            <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: "10px" }}>
              {movieDetails?.release_date || "Unknown release"} •{" "}
              {movieDetails?.runtime ? `${movieDetails.runtime} min` : "Runtime N/A"} •{" "}
              ⭐ {Number(movieDetails?.vote_average || movie.vote_average || 0).toFixed(1)}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {genres.length > 0 ? genres.map((genre) => (
                <span key={genre.id} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 10px", fontSize: "0.8rem" }}>
                  {genre.name}
                </span>
              )) : <span style={{ color: "rgba(255,255,255,0.7)" }}>Genres unavailable</span>}
            </div>

            {movieDetails?.spoken_languages?.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <div style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                  marginBottom: "8px"
                }}>🌐 Available Languages</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {movieDetails.spoken_languages.map((lang) => (
                    <span
                      key={lang.iso_639_1}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        background: lang.iso_639_1 === movieDetails.original_language
                          ? "rgba(29,185,84,0.2)"
                          : "rgba(255,255,255,0.06)",
                        border: lang.iso_639_1 === movieDetails.original_language
                          ? "1px solid rgba(29,185,84,0.5)"
                          : "1px solid rgba(255,255,255,0.15)",
                        color: lang.iso_639_1 === movieDetails.original_language
                          ? "#1DB954"
                          : "rgba(255,255,255,0.7)"
                      }}
                    >
                      {lang.iso_639_1 === movieDetails.original_language ? "🎬 " : ""}
                      {lang.english_name}
                      {lang.iso_639_1 === movieDetails.original_language ? " (Original)" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "10px" }}>Loading movie details...</div>
            )}

            <p style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: "0 0 14px" }}>
              {movieDetails?.overview || movie.overview || "No overview available."}
            </p>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => { setShowStreamPlayer(false); onPlayTrailer(); }}
                style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "#fff", color: "#000", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >▶ Trailer</button>

              <button
                type="button"
                onClick={() => {
                  setShowStreamPlayer(true);
                  setStreamError(false);
                  setStreamLoading(true);
                  setStreamServerIndex(0);
                }}
                style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >▶ Play Movie</button>

              <button
                type="button"
                onClick={onToggleWatchlist}
                style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >{watchlisted ? "❤️ Watchlist" : "🤍 Watchlist"}</button>
            </div>

            {/* Providers */}
            <div style={{ marginBottom: "8px", fontWeight: 700 }}>Available On</div>
            {providers.length > 0 ? (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                {providers.map((provider) => (
                  <div key={provider.provider_id} style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "999px", padding: "6px 10px", background: "rgba(255,255,255,0.05)" }}>
                    {provider.logo_path && (
                      <img src={getPosterUrl(provider.logo_path)} alt={provider.provider_name} loading="lazy" style={{ width: "20px", height: "20px", borderRadius: "999px", objectFit: "cover" }} />
                    )}
                    <span style={{ fontSize: "0.82rem" }}>{provider.provider_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: "14px" }}>Streaming availability not found</div>
            )}

            {/* Stream Player */}
            {showStreamPlayer && (
              <>
                {/* Server selector */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginRight: "4px" }}>Servers:</span>
                  {streamServers.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setStreamServerIndex(i);
                        setStreamError(false);
                        setStreamLoading(true);
                      }}
                      style={{
                        border: i === streamServerIndex ? "1px solid #fff" : "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "8px",
                        background: i === streamServerIndex ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                        color: i === streamServerIndex ? "#fff" : "rgba(255,255,255,0.4)",
                        padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem",
                        fontWeight: i === streamServerIndex ? 700 : 400
                      }}
                    >S{i + 1}</button>
                  ))}
                </div>

                {/* Player */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", overflow: "hidden" }}>
                  {streamLoading && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.8)", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
                      Loading Server {streamServerIndex + 1}...
                    </div>
                  )}
                  <iframe
                    ref={iframeRef}
                    key={`${movie?.id}-${streamServerIndex}`}
                    src={streamServers[streamServerIndex]}
                    width="100%"
                    height="100%"
                    allowFullScreen={true}
                    frameBorder="0"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    referrerPolicy="no-referrer"
                    onLoad={() => setStreamLoading(false)}
                    onError={handleNextServer}
                    title="movie-stream"
                    style={{ display: "block", border: "none" }}
                  />
                </div>

                {/* Bottom bar: server info + fullscreen button + next */}
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)" }}>
                    Server {streamServerIndex + 1} of {streamServers.length}
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {/* ✅ Custom fullscreen button — calls requestFullscreen() on iframe directly */}
                    <button type="button" onClick={handleFullscreen}
                      title="Fullscreen"
                      style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}>
                      ⛶ Fullscreen
                    </button>
                    <button type="button" onClick={handleNextServer}
                      style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}>
                      Not Working? Try Next →
                    </button>
                  </div>
                </div>

                {/* All servers failed */}
                {streamError && streamServerIndex >= streamServers.length - 1 && (
                  <div style={{ marginTop: "12px", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", marginBottom: "10px" }}>
                      All servers tried. Watch free on:
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <a href={`https://www.tubitv.com/search/${encodeURIComponent(movieDetails?.title || movie.title)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ background: "#333", color: "#fff", padding: "7px 14px", borderRadius: "8px", fontWeight: 700, textDecoration: "none", fontSize: "0.8rem" }}>
                        Tubi Free
                      </a>
                      <a href={`https://pluto.tv/search#${encodeURIComponent(movieDetails?.title || movie.title)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ background: "#333", color: "#fff", padding: "7px 14px", borderRadius: "8px", fontWeight: 700, textDecoration: "none", fontSize: "0.8rem" }}>
                        Pluto TV Free
                      </a>
                      <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent((movieDetails?.title || movie.title) + " full movie free")}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ background: "#333", color: "#fff", padding: "7px 14px", borderRadius: "8px", fontWeight: 700, textDecoration: "none", fontSize: "0.8rem" }}>
                        YouTube Free
                      </a>
                      <button
                        onClick={() => { setStreamServerIndex(0); setStreamError(false); setStreamLoading(true); }}
                        style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", background: "transparent", color: "#fff", padding: "7px 14px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                      >↺ Retry</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Trailer fallback */}
            {!showStreamPlayer && trailerKey && (
              <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
                <iframe
                  title="Movie trailer"
                  width="100%"
                  style={{ aspectRatio: "16 / 9", display: "block", border: "none" }}
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
                  allowFullScreen
                  allow="autoplay; encrypted-media; fullscreen"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}