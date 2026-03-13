import React, { useEffect, useState, useCallback } from "react";

const ANILIST_API = "https://graphql.anilist.co";

const GENRES = [
  "Action","Adventure","Comedy","Drama","Fantasy",
  "Horror","Mecha","Music","Mystery","Psychological",
  "Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"
];

async function anilistFetch(query, variables) {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

const TRENDING_QUERY = `
query ($page: Int, $perPage: Int, $genre: String) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage total }
    media(type: ANIME, sort: TRENDING_DESC, genre: $genre, isAdult: false) {
      id
      title { romaji english native }
      coverImage { large extraLarge }
      bannerImage
      averageScore popularity episodes status
      season seasonYear genres
      studios(isMain: true) { nodes { name } }
      description(asHtml: false)
      trailer { id site }
      characters(sort: ROLE, perPage: 6) {
        nodes { name { full } image { large } }
      }
      nextAiringEpisode { episode timeUntilAiring }
    }
  }
}`;

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, search: $search, isAdult: false) {
      id
      title { romaji english native }
      coverImage { large extraLarge }
      bannerImage
      averageScore popularity episodes status
      season seasonYear genres
      studios(isMain: true) { nodes { name } }
      description(asHtml: false)
      trailer { id site }
      characters(sort: ROLE, perPage: 6) {
        nodes { name { full } image { large } }
      }
    }
  }
}`;

function AnimeCard({ anime, onClick }) {
  const title = anime.title.english || anime.title.romaji;
  const studio = anime.studios?.nodes?.[0]?.name || "";
  const score = anime.averageScore;
  const scoreColor = score >= 80 ? "#1DB954" : score >= 60 ? "#FFB432" : "#FF6B6B";

  return (
    <button
      onClick={() => onClick(anime)}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px", overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        color: "#fff", padding: 0,
        textAlign: "left", cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex", flexDirection: "column", width: "100%"
      }}
      onMouseOver={e => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = "rgba(29,185,84,0.4)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden" }}>
        <img
          src={anime.coverImage.large}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
        {score && (
          <div style={{
            position: "absolute", top: "8px", right: "8px",
            background: scoreColor, color: "#fff",
            borderRadius: "8px", padding: "3px 8px",
            fontSize: "0.72rem", fontWeight: 800,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
          }}>? {(score/10).toFixed(1)}</div>
        )}
        {anime.nextAiringEpisode && (
          <div style={{
            position: "absolute", bottom: "8px", left: "8px",
            background: "rgba(0,0,0,0.85)", borderRadius: "6px",
            padding: "3px 8px", fontSize: "0.65rem", color: "#1DB954",
            fontWeight: 600
          }}>EP {anime.nextAiringEpisode.episode} soon</div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          fontWeight: 700, fontSize: "0.83rem",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          marginBottom: "4px", lineHeight: 1.4
        }}>{title}</div>
        {studio && (
          <div style={{
            fontSize: "0.7rem", color: "rgba(255,255,255,0.4)",
            marginBottom: "6px"
          }}>{studio}</div>
        )}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "auto" }}>
          {anime.genres?.slice(0, 2).map(g => (
            <span key={g} style={{
              fontSize: "0.62rem", padding: "2px 7px",
              borderRadius: "999px",
              background: "rgba(29,185,84,0.1)",
              border: "1px solid rgba(29,185,84,0.2)",
              color: "#1DB954"
            }}>{g}</span>
          ))}
          {anime.episodes && (
            <span style={{
              fontSize: "0.62rem", padding: "2px 7px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.45)"
            }}>{anime.episodes} eps</span>
          )}
        </div>
      </div>
    </button>
  );
}

function AnimeModal({ anime, onClose }) {
  const [showTrailer, setShowTrailer] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const [episodeNum, setEpisodeNum] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [videoId, setVideoId] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoNotFound, setVideoNotFound] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
  const title = anime.title.english || anime.title.romaji;
  const studio = anime.studios?.nodes?.[0]?.name || "";
  const totalEps = anime.episodes || 12;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    setSelectedSeason(1);
  }, [anime.id]);

  const playEpisode = async (epNum) => {
    setVideoLoading(true);
    setWatchMode(true);
    setVideoNotFound(false);
    setEpisodeNum(epNum);
    setVideoId("");
    setShowTrailer(false);
    try {
      const searchArtist = "anime english sub official";
      const titleVariants = [
        `${title} Season ${selectedSeason} Episode ${epNum}`,
        `${title} Episode ${epNum}`,
        `${title} S${selectedSeason}E${epNum}`,
        `${title} ep ${epNum}`,
      ];

      let resolvedVideoId = "";
      for (const searchTitle of titleVariants) {
        const res = await fetch(
          `${API_BASE}/api/music/youtube?title=${encodeURIComponent(searchTitle)}&artist=${encodeURIComponent(searchArtist)}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.videoId) {
          resolvedVideoId = data.videoId;
          break;
        }
      }

      if (resolvedVideoId) {
        setVideoId(resolvedVideoId);
      } else {
        throw new Error("Not found in fallback search");
      }
    } catch {
      setVideoNotFound(true);
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.93)",
        backdropFilter: "blur(10px)",
        overflowY: "auto", padding: "16px"
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        maxWidth: "880px", margin: "0 auto",
        background: "rgba(8,10,18,0.99)",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden", color: "#fff"
      }}>

        {/* Banner */}
        <div style={{
          position: "relative", height: "200px",
          background: anime.bannerImage
            ? `url(${anime.bannerImage}) center/cover no-repeat`
            : "linear-gradient(135deg, #0d1117, #1a1a2e)"
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(8,10,18,1))"
          }} />
          <button onClick={onClose} style={{
            position: "absolute", top: "12px", right: "12px",
            border: "none", background: "rgba(0,0,0,0.7)",
            color: "#fff", borderRadius: "50%",
            width: "34px", height: "34px",
            display: "grid", placeItems: "center",
            cursor: "pointer", zIndex: 2, fontSize: "0.9rem"
          }}>✕</button>

          <div style={{
            position: "absolute", bottom: "14px", left: "16px",
            right: "60px", zIndex: 2,
            display: "flex", alignItems: "flex-end", gap: "14px"
          }}>
            <img src={anime.coverImage.large} alt={title}
              style={{
                width: "72px", height: "100px",
                borderRadius: "10px", objectFit: "cover",
                border: "2px solid rgba(255,255,255,0.15)", flexShrink: 0
              }} />
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
              {anime.title.native && (
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>
                  {anime.title.native}
                </div>
              )}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {anime.averageScore && (
                  <span style={{
                    background: "#1DB954", color: "#fff",
                    borderRadius: "6px", padding: "2px 8px",
                    fontSize: "0.72rem", fontWeight: 700
                  }}>? {(anime.averageScore/10).toFixed(1)}</span>
                )}
                {anime.popularity && (
                  <span style={{
                    background: "rgba(255,255,255,0.1)", borderRadius: "6px",
                    padding: "2px 8px", fontSize: "0.72rem"
                  }}>?? {(anime.popularity/1000).toFixed(0)}K</span>
                )}
                {anime.status && (
                  <span style={{
                    background: "rgba(255,255,255,0.1)", borderRadius: "6px",
                    padding: "2px 8px", fontSize: "0.72rem"
                  }}>{anime.status.replace(/_/g, " ")}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 20px" }}>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
            <button
              onClick={() => playEpisode(1)}
              style={{
                border: "none", borderRadius: "10px",
                background: "linear-gradient(135deg, #1DB954, #0f9b43)",
                color: "#fff", padding: "10px 22px",
                fontWeight: 700, fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(29,185,84,0.3)"
              }}
            >? Watch Now</button>

            {anime.trailer?.site === "youtube" && anime.trailer?.id && (
              <button
                onClick={() => {
                  setShowTrailer(p => !p);
                  setWatchMode(false);
                }}
                style={{
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "10px",
                  background: showTrailer ? "rgba(255,255,255,0.1)" : "transparent",
                  color: "#fff", padding: "10px 22px",
                  fontWeight: 600, fontSize: "0.9rem", cursor: "pointer"
                }}
              >?? {showTrailer ? "Hide" : "Watch"} Trailer</button>
            )}
          </div>

          {/* Trailer */}
          {showTrailer && anime.trailer?.id && (
            <div style={{
              marginBottom: "18px", borderRadius: "12px",
              overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)"
            }}>
              <iframe
                width="100%" height="280"
                src={`https://www.youtube.com/embed/${anime.trailer.id}?autoplay=1&rel=0&modestbranding=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ border: "none", display: "block" }}
                title="Trailer"
              />
            </div>
          )}

          {/* Episode player - plays INSIDE app */}
          {watchMode && (
            <div style={{
              marginBottom: "18px", borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#000"
            }}>
              <div style={{
                padding: "8px 14px",
                background: "rgba(0,0,0,0.95)",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex", justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  ?? {title} � Episode {episodeNum}
                </span>
                <button
                  onClick={() => setWatchMode(false)}
                  style={{
                    border: "none", background: "transparent",
                    color: "rgba(255,255,255,0.5)", cursor: "pointer"
                  }}
                >✕</button>
              </div>

              {videoLoading && (
                <div style={{
                  aspectRatio: "16/9", display: "grid",
                  placeItems: "center", background: "#050508",
                  color: "rgba(255,255,255,0.4)", fontSize: "0.88rem"
                }}>Loading episode...</div>
              )}

              {!videoLoading && videoId && (
                <iframe
                  key={videoId}
                  width="100%"
                  style={{ aspectRatio: "16/9", display: "block", border: "none" }}
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3`}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  title={`${title} Episode ${episodeNum}`}
                />
              )}

              {!videoLoading && videoNotFound && (
                <div style={{
                  aspectRatio: "16/9", display: "grid",
                  placeItems: "center", background: "#050508"
                }}>
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <div style={{
                      fontSize: "0.88rem", marginBottom: "14px",
                      color: "rgba(255,255,255,0.5)"
                    }}>
                      Episode not found for this query. Try changing season or another episode.
                    </div>
                    <a
                      href={`https://www.crunchyroll.com/search?q=${encodeURIComponent(title)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        background: "#FF6B35", color: "#fff",
                        padding: "10px 20px", borderRadius: "8px",
                        fontWeight: 700, textDecoration: "none",
                        fontSize: "0.85rem", display: "inline-block"
                      }}
                    >Watch Free on Crunchyroll ?</a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Episode list */}
          {totalEps > 1 && (
            <div style={{ marginBottom: "18px" }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{
                  fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  fontWeight: 700, marginBottom: "8px"
                }}>Season</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5].map((season) => (
                    <button
                      key={season}
                      onClick={() => setSelectedSeason(season)}
                      style={{
                        border: selectedSeason === season
                          ? "1px solid #1DB954"
                          : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        background: selectedSeason === season
                          ? "rgba(29,185,84,0.18)"
                          : "rgba(255,255,255,0.04)",
                        color: selectedSeason === season ? "#1DB954" : "#fff",
                        padding: "5px 10px",
                        cursor: "pointer",
                        fontSize: "0.76rem",
                        fontWeight: selectedSeason === season ? 700 : 500
                      }}
                    >S{season}</button>
                  ))}
                </div>
              </div>

              <div style={{
                fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontWeight: 700, marginBottom: "8px"
              }}>?? Episodes ({totalEps}) - Season {selectedSeason}</div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: "6px",
                maxHeight: "110px", overflowY: "auto",
                scrollbarWidth: "thin"
              }}>
                {Array.from({ length: Math.min(totalEps, 500) }, (_, i) => i + 1).map(ep => (
                  <button
                    key={ep}
                    onClick={() => playEpisode(ep)}
                    style={{
                      border: ep === episodeNum && watchMode
                        ? "1px solid #1DB954"
                        : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      background: ep === episodeNum && watchMode
                        ? "rgba(29,185,84,0.18)"
                        : "rgba(255,255,255,0.04)",
                      color: ep === episodeNum && watchMode ? "#1DB954" : "#fff",
                      padding: "5px 11px",
                      cursor: "pointer", fontSize: "0.78rem",
                      fontWeight: ep === episodeNum && watchMode ? 700 : 400,
                      transition: "all 0.15s ease"
                    }}
                  >EP {ep}</button>
                ))}
              </div>
            </div>
          )}

          {/* Info grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "18px", marginBottom: "18px"
          }}>
            {/* Studio & Genre */}
            <div>
              <div style={{
                fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontWeight: 700, marginBottom: "8px"
              }}>?? Studio & Genre</div>
              {studio && (
                <div style={{ fontSize: "0.82rem", marginBottom: "8px" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>Studio: </span>{studio}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {anime.genres?.map(g => (
                  <span key={g} style={{
                    fontSize: "0.68rem", padding: "3px 9px",
                    borderRadius: "999px",
                    background: "rgba(29,185,84,0.1)",
                    border: "1px solid rgba(29,185,84,0.25)",
                    color: "#1DB954"
                  }}>{g}</span>
                ))}
              </div>
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {anime.season && (
                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>
                    ?? {anime.season} {anime.seasonYear}
                  </div>
                )}
                {anime.episodes && (
                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>
                    ?? {anime.episodes} episodes
                  </div>
                )}
              </div>
            </div>

            {/* Characters */}
            {anime.characters?.nodes?.length > 0 && (
              <div>
                <div style={{
                  fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  fontWeight: 700, marginBottom: "8px"
                }}>?? Characters</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {anime.characters.nodes.slice(0, 6).map((char, i) => (
                    <div key={i} style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "center", gap: "4px", width: "52px"
                    }}>
                      <img
                        src={char.image?.large}
                        alt={char.name?.full}
                        style={{
                          width: "44px", height: "44px",
                          borderRadius: "50%", objectFit: "cover",
                          border: "2px solid rgba(29,185,84,0.3)"
                        }}
                      />
                      <div style={{
                        fontSize: "0.58rem", textAlign: "center",
                        color: "rgba(255,255,255,0.55)",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", width: "100%"
                      }}>{char.name?.full?.split(" ")[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Synopsis */}
          {anime.description && (
            <div>
              <div style={{
                fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontWeight: 700, marginBottom: "8px"
              }}>?? Synopsis</div>
              <p style={{
                fontSize: "0.85rem", lineHeight: 1.75,
                color: "rgba(255,255,255,0.72)", margin: 0
              }}>
                {anime.description.replace(/<[^>]*>/g, "").slice(0, 500)}
                {anime.description.length > 500 ? "..." : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnimePage() {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchAnime = useCallback(async (q, genre, pageNum, append = false) => {
    setLoading(true);
    setError("");
    try {
      let data;
      if (q) {
        data = await anilistFetch(SEARCH_QUERY, { search: q, page: pageNum, perPage: 20 });
      } else {
        data = await anilistFetch(TRENDING_QUERY, {
          page: pageNum, perPage: 20, genre: genre || undefined
        });
      }
      const list = data.Page.media || [];
      setAnimeList(prev => append ? [...prev, ...list] : list);
      setHasMore(data.Page.pageInfo.hasNextPage);
    } catch (err) {
      setError("Failed to load anime. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnime("", "", 1); }, [fetchAnime]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAnime(query, selectedGenre, 1);
  };

  const handleGenre = (genre) => {
    const g = genre === selectedGenre ? "" : genre;
    setSelectedGenre(g);
    setPage(1);
    fetchAnime("", g, 1);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchAnime(query, selectedGenre, next, true);
  };

  return (
    <section style={{ minWidth: 0, color: "#fff", paddingBottom: "40px" }}>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(29,185,84,0.07), transparent)",
        borderRadius: "20px", padding: "26px",
        border: "1px solid rgba(255,255,255,0.06)",
        marginBottom: "22px"
      }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "2.2rem", fontWeight: 800 }}>?? Anime</h2>
        <p style={{ margin: "0 0 16px", color: "rgba(255,255,255,0.55)", fontSize: "0.92rem" }}>
          Trending anime - powered by AniList. Watch episodes inside LAYAVANI!
        </p>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", maxWidth: "480px" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anime..."
            style={{
              flex: 1, borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0d0d14", color: "#fff",
              padding: "10px 16px", outline: "none", fontSize: "0.9rem"
            }}
          />
          <button type="submit" style={{
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.08)",
            color: "#fff", padding: "0 18px",
            fontWeight: 700, cursor: "pointer"
          }}>Search</button>
        </form>
      </div>

      {/* Genre tabs */}
      <div style={{
        display: "flex", gap: "8px", overflowX: "auto",
        paddingBottom: "6px", marginBottom: "20px", scrollbarWidth: "none"
      }}>
        {GENRES.map(g => (
          <button key={g} onClick={() => handleGenre(g)} style={{
            border: selectedGenre === g
              ? "1px solid #1DB954"
              : "1px solid rgba(255,255,255,0.1)",
            borderRadius: "999px",
            background: selectedGenre === g
              ? "rgba(29,185,84,0.16)"
              : "rgba(255,255,255,0.04)",
            color: selectedGenre === g ? "#1DB954" : "#fff",
            padding: "7px 14px", whiteSpace: "nowrap",
            cursor: "pointer", fontSize: "0.82rem", fontWeight: 600
          }}>{g}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px", borderRadius: "10px",
          background: "rgba(255,80,80,0.08)",
          color: "#ffb1b1", marginBottom: "16px",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          {error}
          <button onClick={() => fetchAnime(query, selectedGenre, 1)} style={{
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px",
            background: "transparent", color: "#fff",
            padding: "6px 14px", cursor: "pointer", fontSize: "0.8rem"
          }}>Retry</button>
        </div>
      )}

      {loading && animeList.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 0",
          color: "rgba(255,255,255,0.35)", fontSize: "0.95rem"
        }}>Loading anime from AniList...</div>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
        gap: "16px"
      }}>
        {animeList.map(anime => (
          <AnimeCard key={anime.id} anime={anime} onClick={setSelectedAnime} />
        ))}
      </div>

      {!loading && animeList.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center",
          alignItems: "center", gap: "8px",
          marginTop: "32px", flexWrap: "wrap"
        }}>
          <button
            onClick={() => {
              const prev = page - 1;
              if (prev < 1) return;
              setPage(prev);
              fetchAnime(query, selectedGenre, prev);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page === 1}
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              background: page === 1 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.07)",
              color: page === 1 ? "rgba(255,255,255,0.25)" : "#fff",
              padding: "8px 16px", cursor: page === 1 ? "not-allowed" : "pointer",
              fontWeight: 600, fontSize: "0.88rem"
            }}
          >← Prev</button>

          {[...Array(5)].map((_, i) => {
            const p = Math.max(1, page - 2) + i;
            return (
              <button
                key={p}
                onClick={() => {
                  setPage(p);
                  fetchAnime(query, selectedGenre, p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={{
                  border: p === page
                    ? "1px solid #fff"
                    : "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  background: p === page
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.04)",
                  color: p === page ? "#fff" : "rgba(255,255,255,0.5)",
                  width: "38px", height: "38px",
                  cursor: "pointer",
                  fontWeight: p === page ? 700 : 400,
                  fontSize: "0.88rem"
                }}
              >{p}</button>
            );
          })}

          <button
            onClick={() => {
              const next = page + 1;
              setPage(next);
              fetchAnime(query, selectedGenre, next);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={!hasMore}
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              background: !hasMore ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.07)",
              color: !hasMore ? "rgba(255,255,255,0.25)" : "#fff",
              padding: "8px 16px", cursor: !hasMore ? "not-allowed" : "pointer",
              fontWeight: 600, fontSize: "0.88rem"
            }}
          >Next →</button>
        </div>
      )}

      {/* Modal */}
      {selectedAnime && (
        <AnimeModal anime={selectedAnime} onClose={() => setSelectedAnime(null)} />
      )}
    </section>
  );
}
