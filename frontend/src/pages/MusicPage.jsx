import React, { useEffect, useState, useRef, useCallback } from "react";
import AiDj from "../components/AiDj";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const CATEGORIES = [
  { label: "Trending", query: "top hits 2025" },
  { label: "Bollywood", query: "bollywood hindi 2025" },
  { label: "Hollywood", query: "english pop hits 2025" },
  { label: "Telugu", query: "telugu hits 2025" },
  { label: "Tamil", query: "tamil hits 2025" },
  { label: "Punjabi", query: "punjabi hits 2025" },
  { label: "Lo-fi", query: "lofi chill beats" },
  { label: "Sandalwood", query: "kannada hits 2025" },
  { label: "Tollywood", query: "tollywood songs 2025" },
  { label: "Retro", query: "90s hindi classic hits" },
];

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MusicPage({ user }) {
  const [songs, setSongs] = useState([]);
  const [activeSong, setActiveSong] = useState(null);
  const [playMode, setPlayMode] = useState("video");
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [previewAudio, setPreviewAudio] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [likedSongs, setLikedSongs] = useState([]);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [libraryView, setLibraryView] = useState("All Songs");
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [syncedLyrics, setSyncedLyrics] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [showLyrics, setShowLyrics] = useState(true);
  const [recentSongs, setRecentSongs] = useState([]);
  const previewAudioRef = useRef(null);
  const [artistModal, setArtistModal] = useState(null);
  const [artistLoading, setArtistLoading] = useState(false);
  const lyricsContainerRef = useRef(null);
  const iframeRef = useRef(null);
  const currentSong = activeSong;

  const parseLRC = (lrcText) => {
    const lines = lrcText.split("\n");
    const parsed = [];
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, "0"));
        const time = mins * 60 + secs + ms / 1000;
        const text = match[4].trim();
        if (text) parsed.push({ time, text });
      }
    }
    return parsed;
  };

  // Fetch songs from iTunes via backend
  const fetchSongs = async (searchQuery) => {
    setLoading(true);
    setError("");
    setSongs([]);
    setVideoId("");
    setActiveSong(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/music/search?query=${encodeURIComponent(searchQuery)}&limit=30&country=IN`
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const tracks = Array.isArray(data?.results) ? data.results : [];
      setSongs(tracks);
      if (tracks.length > 0) {
        setActiveSong(tracks[0]);
      }
    } catch (err) {
      console.error("fetchSongs error:", err);
      setError("Unable to load songs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Find YouTube video ID and play inside app - NO API KEY!
  const playInApp = useCallback(async (song) => {
    if (!song) return;
    setActiveSong(song);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || "Unknown",
        artist: song.artists || "Unknown",
        album: song.album || "LAYAVANI",
        artwork: [{
          src: song.image || "/icon-192.png",
          sizes: "512x512",
          type: "image/jpeg"
        }]
      });
    }

    fetchLyrics(song);
    setRecentSongs(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 20);
    });
    fetchMetadata(song);
    setVideoId("");
    setVideoError("");
    setVideoLoading(true);

    // Stop preview audio
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewAudio(null);
    }

    try {
      // Detect language from song genre or active category
      const songGenre = (song.genre || "").toLowerCase();
      const langHints = {
        telugu: ["telugu", "tollywood", "telugu film"],
        tamil: ["tamil", "kollywood"],
        kannada: ["kannada", "sandalwood"],
        punjabi: ["punjabi"],
        malayalam: ["malayalam"],
      };
      let langTag = "";
      for (const [lang, keywords] of Object.entries(langHints)) {
        if (keywords.some(k => songGenre.includes(k))) {
          langTag = lang;
          break;
        }
      }
      // Also check activeCategory state as fallback
      if (!langTag) {
        const cat = (activeCategory || "").toLowerCase();
        if (cat === "telugu" || cat === "tollywood") langTag = "telugu";
        else if (cat === "tamil") langTag = "tamil";
        else if (cat === "sandalwood") langTag = "kannada";
        else if (cat === "punjabi") langTag = "punjabi";
      }

      const ytUrl = langTag
        ? `${API_BASE}/api/music/youtube?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artists)}&lang=${encodeURIComponent(langTag)}`
        : `${API_BASE}/api/music/youtube?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artists)}`;
      const res = await fetch(ytUrl);
      if (!res.ok) throw new Error("Video not found");
      const data = await res.json();
      if (data.videoId) {
        setVideoId(data.videoId);
      } else {
        throw new Error("No video ID returned");
      }
    } catch (err) {
      console.error("playInApp error:", err);
      setVideoError("Could not find this song on YouTube. Try another.");
    } finally {
      setVideoLoading(false);
    }
  }, [activeCategory]);

  const fetchMetadata = async (song) => {
    if (!song?.title) return;
    setMetadata(null);
    setMetaLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/music/metadata?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artists)}`
      );
      if (!res.ok) throw new Error("Metadata fetch failed");
      const data = await res.json();
      setMetadata(data);
    } catch (err) {
      console.error("fetchMetadata error:", err);
      setMetadata(null);
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchLyrics = async (song) => {
    if (!song?.title) return;
    setLyrics("");
    setSyncedLyrics([]);
    setIsSynced(false);
    setCurrentLyricIndex(-1);
    setLyricsLoading(true);
    setLyricsOpen(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/music/lyrics-synced?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artists)}`
      );
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (data.synced && data.lyrics) {
        const parsed = parseLRC(data.lyrics);
        if (parsed.length > 0) {
          setSyncedLyrics(parsed);
          setIsSynced(true);
          setLyrics(data.plain || "");
          return;
        }
      }
      setLyrics(data.plain || data.lyrics || "");
      setIsSynced(false);
    } catch {
      setLyrics("");
    } finally {
      setLyricsLoading(false);
    }
  };

  const fetchArtistInfo = async (artistName) => {
    if (!artistName) return;

    // Split "KK & Pritam" or "KK, Pritam" into ["KK", "Pritam"]
    const splitNames = artistName
      .split(/[,&]|\band\b/i)
      .map(n => n.trim())
      .filter(Boolean);

    // Use first artist name for search
    const primaryName = splitNames[0];

    setArtistModal({
      name: artistName,
      primaryName,
      allNames: splitNames,
      loading: true
    });

    try {
      // 1. Wikipedia search - try primary name first
      const wikiSearchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro&explaintext&titles=${encodeURIComponent(primaryName)}&pithumbsize=500&origin=*`
      );
      const wikiData = await wikiSearchRes.json();
      const pages = wikiData?.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      const page = pageId !== "-1" ? pages[pageId] : null;

      // If no direct match, try search API
      let finalPage = page;
      if (!page || pageId === "-1") {
        const searchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(primaryName + " singer")}&srlimit=1&origin=*`
        );
        const searchData = await searchRes.json();
        const firstResult = searchData?.query?.search?.[0];

        if (firstResult?.title) {
          const detailRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro&explaintext&titles=${encodeURIComponent(firstResult.title)}&pithumbsize=500&origin=*`
          );
          const detailData = await detailRes.json();
          const detailPages = detailData?.query?.pages || {};
          const detailPageId = Object.keys(detailPages)[0];
          if (detailPageId !== "-1") {
            finalPage = detailPages[detailPageId];
          }
        }
      }

      // 2. iTunes search for artist image + songs
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(primaryName)}&entity=song&limit=8&sort=popular`
      );
      const itunesData = await itunesRes.json();
      const itunesSongs = itunesData?.results || [];

      // Get best image - prefer Wikipedia, fallback to iTunes
      const wikiImage = finalPage?.thumbnail?.source;
      const itunesImage = itunesSongs[0]?.artworkUrl100?.replace("100x100bb", "500x500bb");
      const artistImage = wikiImage || itunesImage || null;

      // Build top songs list
      const topSongs = itunesSongs
        .filter(s => s.trackName)
        .slice(0, 6)
        .map(s => ({
          title: s.trackName,
          album: s.collectionName,
          image: s.artworkUrl100,
          duration: s.trackTimeMillis,
          preview: s.previewUrl
        }));

      // Extract clean bio (first 450 chars)
      const rawBio = finalPage?.extract || "";
      const cleanBio = rawBio
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 450);

      setArtistModal({
        name: artistName,
        primaryName,
        allNames: splitNames,
        loading: false,
        bio: cleanBio || null,
        image: artistImage,
        wikiUrl: finalPage
          ? `https://en.wikipedia.org/wiki/${encodeURIComponent(finalPage.title)}`
          : null,
        topSongs
      });
    } catch (err) {
      console.error("Artist fetch failed:", err);
      setArtistModal({
        name: artistName,
        primaryName,
        allNames: splitNames,
        loading: false,
        bio: null,
        image: null,
        topSongs: []
      });
    }
  };

  const loadLikedSongs = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${API_BASE}/api/music/liked?userId=${user.uid}`);
      const data = await res.json();
      setLikedSongs(data.songs || []);
    } catch {}
  };

  const toggleLike = async (song) => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${API_BASE}/api/music/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, song })
      });
      const data = await res.json();
      if (data.liked) {
        setLikedSongs(prev => [song, ...prev]);
      } else {
        setLikedSongs(prev => prev.filter(s => !(s.title === song.title && s.artists === song.artists)));
      }
    } catch {}
  };

  const isLiked = (song) => likedSongs.some(s => s.title === song?.title && s.artists === song?.artists);

  const loadDownloadedSongs = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${API_BASE}/api/music/downloaded?userId=${user.uid}`);
      const data = await res.json();
      setDownloadedSongs(data.songs || []);
    } catch {}
  };

  const toggleDownload = async (song) => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${API_BASE}/api/music/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, song })
      });
      const data = await res.json();
      if (data.saved) {
        setDownloadedSongs(prev => [song, ...prev]);
      } else {
        setDownloadedSongs(prev => prev.filter(s => !(s.title === song.title && s.artists === song.artists)));
      }
    } catch {}
  };

  const isDownloaded = (song) => downloadedSongs.some(s => s.title === song?.title && s.artists === song?.artists);

  // 30 sec preview on hover
  const handlePreviewStart = (song) => {
    if (!song.preview) return;
    if (previewAudioRef.current) previewAudioRef.current.pause();
    const audio = new Audio(song.preview);
    previewAudioRef.current = audio;
    audio.volume = 0.5;
    audio.play().catch(() => {});
    setPreviewAudio(song.id);
  };

  const handlePreviewStop = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewAudio(null);
  };

  useEffect(() => {
    fetchSongs("top hindi bollywood hits 2025");
  }, []);

  useEffect(() => {
    loadLikedSongs();
    loadDownloadedSongs();
  }, [user]);

  useEffect(() => {
    if (!activeSong || !videoId || songs.length < 2) return;

    const songIndex = songs.findIndex(
      (song) => song.id === activeSong.id || (song.title === activeSong.title && song.artists === activeSong.artists)
    );
    if (songIndex < 0 || songIndex + 1 >= songs.length) return;

    const timeoutMs = Math.max(20000, Math.min((activeSong.duration || 180) * 1000 + 1200, 12 * 60 * 1000));
    const timer = setTimeout(() => {
      playInApp(songs[songIndex + 1]);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [activeSong, videoId, songs, playInApp]);

  useEffect(() => {
    if (!isSynced || syncedLyrics.length === 0 || !videoId) {
      setCurrentLyricIndex(-1);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      let idx = -1;
      for (let i = 0; i < syncedLyrics.length; i += 1) {
        if (elapsed >= syncedLyrics[i].time) idx = i;
        else break;
      }
      setCurrentLyricIndex(idx);
    }, 300);

    return () => clearInterval(interval);
  }, [isSynced, syncedLyrics, videoId]);

  useEffect(() => {
    if (!lyricsContainerRef.current || currentLyricIndex < 0) return;
    const lines = lyricsContainerRef.current.children;
    const activeLine = lines[currentLyricIndex];
    if (activeLine?.scrollIntoView) {
      activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentLyricIndex]);

  const handleCategory = (cat) => {
    setActiveCategory(cat.label);
    setActiveSong(null);
    setVideoId("");
    fetchSongs(cat.query);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setActiveCategory("");
    fetchSongs(query.trim());
  };

  const heroImage = activeSong?.image || songs[0]?.image || "";

  return (
    <section style={{ minWidth: 0, color: "#fff", paddingBottom: "40px" }}>

      {/* HERO */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.1)", background: "#0a0a0f",
        minHeight: "200px", padding: "28px", marginBottom: "22px"
      }}>
        {heroImage && (
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${heroImage})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(32px)", opacity: 0.25, transform: "scale(1.15)"
          }} />
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "2.4rem", fontWeight: 800 }}>
            Music
          </h2>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.7)" }}>
            Hollywood to Sandalwood — every song, free, plays here.
          </p>
          {activeSong && (
            <div style={{
              display: "flex", alignItems: "center", gap: "14px",
              marginTop: "18px", background: "rgba(0,0,0,0.45)",
              borderRadius: "14px", padding: "12px", maxWidth: "500px"
            }}>
              {activeSong.image && (
                <img src={activeSong.image} alt={activeSong.title}
                  style={{ width: "56px", height: "56px", borderRadius: "10px", objectFit: "cover" }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeSong.title}
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.85rem" }}>
                  {activeSong.artists}
                </div>
              </div>
              <button
                onClick={() => playInApp(activeSong)}
                style={{
                  border: "none", borderRadius: "50%",
                  width: "42px", height: "42px",
                  background: "#1DB954", color: "#fff",
                  display: "grid", placeItems: "center",
                  cursor: "pointer", fontSize: "1rem", flexShrink: 0
                }}
              >▶</button>
            </div>
          )}
        </div>
      </div>

      {(videoLoading || videoId || videoError) && activeSong && (
        <div style={{
          marginBottom: "22px",
          display: "grid",
          gridTemplateColumns: lyrics ? "1fr 320px" : "1fr",
          gap: "14px",
          alignItems: "start"
        }}>

          {/* LEFT: Video player */}
          <div style={{
            borderRadius: "16px", overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#000"
          }}>
            {/* Player header */}
            <div style={{
              padding: "8px 14px",
              background: "rgba(0,0,0,0.95)",
              display: "flex", justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.07)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                {activeSong.image && (
                  <img src={activeSong.image} alt=""
                    style={{ width: "28px", height: "28px", borderRadius: "5px", objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: "0.82rem",
                    whiteSpace: "nowrap", overflow: "hidden",
                    textOverflow: "ellipsis", maxWidth: "260px"
                  }}>{activeSong.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>{activeSong.artists}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setVideoId("");
                  setVideoError("");
                  setLyrics("");
                }}
                style={{
                  border: "none", background: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "0.95rem", cursor: "pointer", flexShrink: 0
                }}
              >✕</button>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginBottom: "12px",
              gap: "10px",
              padding: "12px 14px 0"
            }}>
              <span style={{
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.55)"
              }}>
                {playMode === "video" ? "🎬 Video Mode" : "🎵 Audio Mode"}
              </span>

              <div
                onClick={() => setPlayMode(prev => prev === "video" ? "audio" : "video")}
                style={{
                  width: "52px",
                  height: "28px",
                  borderRadius: "999px",
                  background: playMode === "audio" ? "#22c55e" : "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 250ms ease"
                }}
              >
                <div style={{
                  position: "absolute",
                  top: "3px",
                  left: playMode === "audio" ? "26px" : "3px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 250ms ease",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                }} />
              </div>
            </div>

            {videoLoading && (
              <div style={{
                width: "100%", aspectRatio: "16/9",
                display: "grid", placeItems: "center",
                background: "#050508", color: "rgba(255,255,255,0.4)",
                fontSize: "0.85rem"
              }}>Finding song...</div>
            )}
            {videoError && !videoLoading && (
              <div style={{
                padding: "20px", textAlign: "center",
                color: "#ffb1b1", background: "#050508"
              }}>{videoError}</div>
            )}
            {videoId && !videoLoading && (
              <div style={{ position: "relative" }}>

                {/* Single YouTube iframe - height:0 in audio mode stops audio without unmounting */}
                <div style={{ height: playMode === "video" ? "auto" : "0px", overflow: "hidden" }}>
                  <iframe
                    ref={iframeRef}
                    key={videoId}
                    width="100%"
                    style={{ aspectRatio: "16/9", display: "block", border: "none" }}
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${videoId}`}
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    title={activeSong.title}
                  />
                </div>

                {/* Audio mode custom UI */}
                {playMode === "audio" && (
                  <div style={{
                    background: "rgba(10,12,18,0.95)",
                    borderRadius: "20px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "28px 24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "18px",
                    minHeight: "300px",
                    justifyContent: "center"
                  }}>
                    {/* Spinning album art */}
                    <img
                      src={currentSong?.image || "/icon-192.png"}
                      alt={currentSong?.title || "song"}
                      style={{
                        width: "130px",
                        height: "130px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                        border: "3px solid rgba(34,197,94,0.5)",
                        animation: videoId ? "spin 8s linear infinite" : "none"
                      }}
                    />

                    <style>{`
                      @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                      }
                    `}</style>

                    {/* Song info */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontWeight: 800,
                        fontSize: "1.2rem",
                        marginBottom: "6px"
                      }}>
                        {currentSong?.title || "Select a song"}
                      </div>
                      <div style={{
                        color: "rgba(255,255,255,0.55)",
                        fontSize: "0.88rem"
                      }}>
                        {currentSong?.artists || ""}
                      </div>
                    </div>

                    {/* Now playing indicator */}
                    {videoId ? (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: "999px",
                        padding: "6px 14px",
                        fontSize: "0.8rem",
                        color: "#22c55e"
                      }}>
                        <span style={{
                          width: "8px", height: "8px",
                          borderRadius: "50%",
                          background: "#22c55e",
                          animation: "pulse 1.5s ease-in-out infinite"
                        }} />
                        Playing in background
                      </div>
                    ) : (
                      <div style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: "0.85rem"
                      }}>
                        Select a song to play
                      </div>
                    )}

                    <style>{`
                      @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(0.8); }
                      }
                    `}</style>

                    {/* Info note */}
                    <div style={{
                      fontSize: "0.75rem",
                      color: "rgba(255,255,255,0.25)",
                      textAlign: "center",
                      maxWidth: "280px"
                    }}>
                      🔒 Audio continues when screen is locked
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Lyrics panel */}
          {(lyricsLoading || lyrics || syncedLyrics.length > 0) && (
            <div style={{
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(13,17,27,0.98)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "400px"
            }}>
              {/* Lyrics header with toggle */}
              <div style={{
                padding: "10px 14px",
                borderBottom: lyricsOpen ? "1px solid rgba(255,255,255,0.07)" : "none",
                display: "flex", justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255,255,255,0.03)",
                flexShrink: 0, cursor: "pointer"
              }}
                onClick={() => setLyricsOpen(prev => !prev)}
              >
                <div style={{
                  fontSize: "0.7rem", color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  fontWeight: 700, display: "flex", alignItems: "center", gap: "6px"
                }}>
                  🎤 Lyrics
                  {isSynced && (
                    <span style={{
                      fontSize: "0.6rem", padding: "1px 6px",
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: "999px", color: "rgba(255,255,255,0.5)"
                    }}>LIVE</span>
                  )}
                </div>
                <span style={{
                  color: "rgba(255,255,255,0.35)", fontSize: "0.8rem"
                }}>{lyricsOpen ? "▲" : "▼"}</span>
              </div>

              {lyricsOpen && (
                <div
                  ref={lyricsContainerRef}
                  style={{
                    flex: 1, overflowY: "auto",
                    padding: "16px",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.08) transparent"
                  }}
                >
                  {lyricsLoading ? (
                    <div style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "0.82rem", textAlign: "center",
                      paddingTop: "20px"
                    }}>Loading lyrics...</div>
                  ) : isSynced && syncedLyrics.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {syncedLyrics.map((line, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: i === currentLyricIndex ? "1.05rem" : "0.88rem",
                            lineHeight: 1.9,
                            color: i === currentLyricIndex
                              ? "#ffffff"
                              : i < currentLyricIndex
                                ? "rgba(255,255,255,0.35)"
                                : "rgba(255,255,255,0.55)",
                            fontWeight: i === currentLyricIndex ? 700 : 400,
                            transition: "all 0.3s ease",
                            padding: "2px 4px",
                            borderRadius: "6px",
                            background: i === currentLyricIndex
                              ? "rgba(255,255,255,0.06)"
                              : "transparent",
                            cursor: "default"
                          }}
                        >
                          {line.text}
                        </div>
                      ))}
                    </div>
                  ) : lyrics ? (
                    <div style={{
                      fontSize: "0.92rem",
                      lineHeight: 2.0,
                      color: "#ffffff",
                      whiteSpace: "pre-wrap",
                      fontWeight: 400
                    }}>{lyrics}</div>
                  ) : (
                    <div style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "0.82rem", textAlign: "center",
                      paddingTop: "20px"
                    }}>Lyrics not available</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* METADATA PANEL */}
      {activeSong && (metadata || metaLoading) && (
        <div style={{
          marginBottom: "22px",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(13,17,27,0.95)",
          overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: "12px"
            ,
            background: "rgba(29,185,84,0.05)"
          }}>
            {activeSong.image && (
              <img src={activeSong.image} alt={activeSong.title}
                style={{ width: "52px", height: "52px", borderRadius: "8px", objectFit: "cover" }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "2px" }}>
                {activeSong.title}
              </div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.82rem" }}>
                {[activeSong.album, activeSong.genre, metadata?.releaseYear]
                  .filter(Boolean).join(" • ")}
              </div>
            </div>
            {activeSong.duration > 0 && (
              <div style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "0.8rem", flexShrink: 0
              }}>
                {Math.floor(activeSong.duration / 60)}:{String(activeSong.duration % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          {metaLoading ? (
            <div style={{ padding: "20px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              Loading song credits...
            </div>
          ) : (
            <div style={{ padding: "16px 18px" }}>
              {/* Credits grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px"
              }}>

                {/* Singers */}
                {metadata?.singers?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>🎤 Singers</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {metadata.singers.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => fetchArtistInfo(s)}
                          style={{
                            border: "1px solid rgba(29,185,84,0.4)",
                            borderRadius: "999px", padding: "4px 10px",
                            fontSize: "0.78rem", color: "#1DB954",
                            background: "rgba(29,185,84,0.08)",
                            cursor: "pointer",
                            fontWeight: 600,
                            transition: "background 200ms ease"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(29,185,84,0.2)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(29,185,84,0.08)"}
                        >🎤 {s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Music Directors */}
                {metadata?.musicDirectors?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>🎵 Music Director</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {metadata.musicDirectors.map((m, i) => (
                        <span key={i} style={{
                          border: "1px solid rgba(255,180,50,0.4)",
                          borderRadius: "999px", padding: "4px 10px",
                          fontSize: "0.78rem", color: "#FFB432",
                          background: "rgba(255,180,50,0.08)"
                        }}>{m}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lyricists */}
                {metadata?.lyricists?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>✍️ Lyricist</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {metadata.lyricists.map((l, i) => (
                        <span key={i} style={{
                          border: "1px solid rgba(150,100,255,0.4)",
                          borderRadius: "999px", padding: "4px 10px",
                          fontSize: "0.78rem", color: "#A78BFA",
                          background: "rgba(150,100,255,0.08)"
                        }}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instruments */}
                {metadata?.instruments?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>🎸 Instruments</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {metadata.instruments.map((inst, i) => (
                        <span key={i} style={{
                          border: "1px solid rgba(100,200,255,0.4)",
                          borderRadius: "999px", padding: "4px 10px",
                          fontSize: "0.78rem", color: "#67E8F9",
                          background: "rgba(100,200,255,0.08)"
                        }}>{inst}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Producers */}
                {metadata?.producers?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>🎛️ Producer</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {metadata.producers.map((p, i) => (
                        <span key={i} style={{
                          border: "1px solid rgba(255,100,100,0.4)",
                          borderRadius: "999px", padding: "4px 10px",
                          fontSize: "0.78rem", color: "#FCA5A5",
                          background: "rgba(255,100,100,0.08)"
                        }}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Album */}
                {(metadata?.album || activeSong?.album) && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>💿 Album</div>
                    <span style={{
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "999px", padding: "4px 10px",
                      fontSize: "0.78rem", color: "rgba(255,255,255,0.7)",
                      background: "rgba(255,255,255,0.05)"
                    }}>{metadata?.album || activeSong?.album}</span>
                  </div>
                )}

                {/* Genre */}
                {(metadata?.genre || activeSong?.genre) && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>🎭 Genre</div>
                    <span style={{
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "999px", padding: "4px 10px",
                      fontSize: "0.78rem", color: "rgba(255,255,255,0.7)",
                      background: "rgba(255,255,255,0.05)"
                    }}>{metadata?.genre || activeSong?.genre}</span>
                  </div>
                )}

                {/* Release Year */}
                {metadata?.releaseYear && (
                  <div>
                    <div style={{
                      fontSize: "0.68rem", color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700
                    }}>📅 Released</div>
                    <span style={{
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "999px", padding: "4px 10px",
                      fontSize: "0.78rem", color: "rgba(255,255,255,0.7)",
                      background: "rgba(255,255,255,0.05)"
                    }}>{metadata.releaseYear}</span>
                  </div>
                )}

              </div>

              {/* No metadata message */}
              {metadata && !metadata.found && (
                <div style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "0.82rem", marginTop: "8px"
                }}>
                  Full credits not available for this song on MusicBrainz.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEARCH */}
      <form onSubmit={handleSearch}
        style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any song, artist, movie..."
          style={{
            flex: 1, borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#0d0d14", color: "#fff",
            padding: "12px 16px", outline: "none", fontSize: "0.95rem"
          }}
        />
        <button type="submit" style={{
          border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px",
          background: "rgba(255,255,255,0.12)", color: "#fff",
          padding: "0 20px", fontWeight: 700, cursor: "pointer"
        }}>
          Search
        </button>
      </form>

      {/* CATEGORIES */}
      <div style={{
        display: "flex", gap: "10px", overflowX: "auto",
        paddingBottom: "6px", marginBottom: "20px", scrollbarWidth: "none"
      }}>
        {CATEGORIES.map((cat) => (
          <button key={cat.label} type="button"
            onClick={() => handleCategory(cat)}
            style={{
              border: activeCategory === cat.label
                ? "1px solid #1DB954"
                : "1px solid rgba(255,255,255,0.14)",
              borderRadius: "999px",
              background: activeCategory === cat.label
                ? "rgba(29,185,84,0.18)"
                : "rgba(255,255,255,0.06)",
              color: "#fff", fontWeight: 600,
              padding: "8px 16px", whiteSpace: "nowrap",
              cursor: "pointer", fontSize: "0.88rem"
            }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* MUSIC LIBRARY */}
      {user && (
        <div style={{
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          background: "rgba(255,255,255,0.03)",
          padding: "14px",
          marginBottom: "18px"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
            flexWrap: "wrap"
          }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Your Music Section</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {["All Songs", "Liked Songs", "Watch Later"].map((view) => (
                <button
                  key={view}
                  onClick={() => setLibraryView(view)}
                  style={{
                    border: libraryView === view ? "1px solid #1DB954" : "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "999px",
                    background: libraryView === view ? "rgba(29,185,84,0.2)" : "rgba(255,255,255,0.04)",
                    color: "#fff",
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {view}
                  {view === "Liked Songs" ? ` (${likedSongs.length})` : ""}
                  {view === "Watch Later" ? ` (${downloadedSongs.length})` : ""}
                </button>
              ))}
            </div>
          </div>

          {libraryView !== "All Songs" && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: "10px"
            }}>
              {(libraryView === "Liked Songs" ? likedSongs : downloadedSongs).map((song, idx) => (
                <button
                  key={`${song.title}-${song.artists}-${idx}`}
                  onClick={() => playInApp(song)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  {song.image ? (
                    <img
                      src={song.image}
                      alt={song.title}
                      style={{ width: "38px", height: "38px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "#141822", display: "grid", placeItems: "center", flexShrink: 0 }}>🎵</div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.artists}</div>
                  </div>
                </button>
              ))}

              {(libraryView === "Liked Songs" ? likedSongs : downloadedSongs).length === 0 && (
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.84rem" }}>
                  No songs in {libraryView.toLowerCase()} yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STATUS */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.5)" }}>
          Loading songs...
        </div>
      )}
      {error && (
        <div style={{
          color: "#ffb1b1", marginBottom: "16px",
          padding: "12px", background: "rgba(255,80,80,0.08)",
          borderRadius: "10px"
        }}>
          {error}
        </div>
      )}

      {/* SONG GRID */}
      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "20px",
          alignItems: "start"
        }}>
          {songs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => playInApp(song)}
              onMouseEnter={() => handlePreviewStart(song)}
              onMouseLeave={handlePreviewStop}
              style={{
                border: activeSong?.id === song.id
                  ? "2px solid #1DB954"
                  : "1px solid rgba(255,255,255,0.1)",
                borderRadius: "14px", overflow: "hidden",
                background: activeSong?.id === song.id
                  ? "rgba(29,185,84,0.08)"
                  : "rgba(255,255,255,0.04)",
                color: "#fff", padding: 0,
                textAlign: "left", cursor: "pointer",
                transition: "transform 0.18s ease",
                boxShadow: activeSong?.id === song.id
                  ? "0 0 20px rgba(29,185,84,0.25)"
                  : "none",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%"
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              {/* Album art */}
              <div style={{ position: "relative" }}>
                {song.image ? (
                  <img src={song.image} alt={song.title}
                    style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{
                    aspectRatio: "1/1", display: "grid",
                    placeItems: "center", background: "#10131b", fontSize: "2rem"
                  }}>🎵</div>
                )}

                {/* Play overlay when active */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.45)",
                  display: "grid", placeItems: "center",
                  opacity: activeSong?.id === song.id ? 1 : 0,
                  transition: "opacity 0.2s"
                }}>
                  <div style={{
                    width: "46px", height: "46px", borderRadius: "50%",
                    background: "#1DB954", display: "grid",
                    placeItems: "center", fontSize: "1.2rem"
                  }}>▶</div>
                </div>

                {/* Preview badge */}
                {previewAudio === song.id && (
                  <div style={{
                    position: "absolute", top: "8px", right: "8px",
                    background: "rgba(29,185,84,0.92)", borderRadius: "6px",
                    padding: "2px 7px", fontSize: "0.68rem", fontWeight: 700
                  }}>♪ Preview</div>
                )}
              </div>

              {/* Song info */}
              <div style={{ padding: "10px 12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{
                  fontWeight: 700, fontSize: "0.88rem",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>{song.title}</div>
                <div style={{
                  marginTop: "3px", color: "rgba(255,255,255,0.6)",
                  fontSize: "0.78rem", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis"
                }}>{song.artists}</div>
                {song.duration > 0 && (
                  <div style={{
                    marginTop: "4px", color: "rgba(255,255,255,0.38)",
                    fontSize: "0.72rem"
                  }}>{formatDuration(song.duration)}</div>
                )}
              </div>

              <div style={{
                display: "flex", gap: "6px",
                padding: "6px 10px 8px",
                borderTop: "1px solid rgba(255,255,255,0.05)"
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(song); }}
                  title={isLiked(song) ? "Unlike" : "Like"}
                  style={{
                    border: "none", background: "transparent",
                    color: isLiked(song) ? "#fff" : "rgba(255,255,255,0.3)",
                    cursor: "pointer", fontSize: "1rem",
                    padding: "2px 6px", borderRadius: "6px",
                    transition: "all 0.15s ease"
                  }}
                >{isLiked(song) ? "♥" : "♡"}</button>

                <button
                  onClick={(e) => { e.stopPropagation(); toggleDownload(song); }}
                  title={isDownloaded(song) ? "Remove from Watch Later" : "Save to Watch Later"}
                  style={{
                    border: "none", background: "transparent",
                    color: isDownloaded(song) ? "#67E8F9" : "rgba(255,255,255,0.3)",
                    cursor: "pointer", fontSize: "0.85rem",
                    padding: "2px 6px", borderRadius: "6px",
                    transition: "all 0.15s ease"
                  }}
                >⤓</button>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && songs.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <button
            onClick={() => {
              const currentCategory = CATEGORIES.find(c => c.label === activeCategory);
              if (currentCategory) {
                setLoading(true);
                fetch(`${API_BASE}/api/music/search?query=${encodeURIComponent(currentCategory.query)}&limit=30&country=IN&offset=${songs.length}`)
                  .then(r => r.json())
                  .then(data => {
                    const newTracks = Array.isArray(data?.results) ? data.results : [];
                    setSongs(prev => [...prev, ...newTracks]);
                  })
                  .catch(console.error)
                  .finally(() => setLoading(false));
              } else if (query) {
                setLoading(true);
                fetch(`${API_BASE}/api/music/search?query=${encodeURIComponent(query)}&limit=30&country=IN&offset=${songs.length}`)
                  .then(r => r.json())
                  .then(data => {
                    const newTracks = Array.isArray(data?.results) ? data.results : [];
                    setSongs(prev => [...prev, ...newTracks]);
                  })
                  .catch(console.error)
                  .finally(() => setLoading(false));
              }
            }}
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              padding: "12px 32px",
              fontWeight: 700,
              fontSize: "0.92rem",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = "rgba(29,185,84,0.15)";
              e.currentTarget.style.borderColor = "rgba(29,185,84,0.4)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
          >
            Load More Songs
          </button>
        </div>
      )}

      {!loading && songs.length === 0 && !error && (
        <div style={{
          textAlign: "center", padding: "60px 0",
          color: "rgba(255,255,255,0.35)"
        }}>
          No songs found. Try a different search.
        </div>
      )}

      <AiDj
        user={user}
        recentSongs={recentSongs}
        onPlaySong={(song) => playInApp(song)}
      />

      {/* ARTIST INFO MODAL */}
      {artistModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setArtistModal(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(12px)",
            display: "grid",
            placeItems: "center",
            padding: "20px"
          }}
        >
          <div style={{
            background: "rgba(10,12,18,0.98)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "24px",
            width: "min(520px, 100%)",
            maxHeight: "85vh",
            overflowY: "auto",
            padding: "24px",
            position: "relative",
            scrollbarWidth: "none"
          }}>
            {/* Close button */}
            <button
              onClick={() => setArtistModal(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "1rem",
                display: "grid",
                placeItems: "center"
              }}
            >✕</button>

            {artistModal.loading ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                padding: "40px"
              }}>
                <div style={{
                  width: "48px", height: "48px",
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.1)",
                  borderTop: "3px solid #22c55e",
                  animation: "spin 1s linear infinite"
                }} />
                <span style={{ color: "rgba(255,255,255,0.5)" }}>
                  Loading artist info...
                </span>
              </div>
            ) : (
              <>
                {/* Artist header */}
                <div style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                  marginBottom: "20px"
                }}>
                  {artistModal.image ? (
                    <img
                      src={artistModal.image}
                      alt={artistModal.name}
                      style={{
                        width: "90px",
                        height: "90px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid rgba(34,197,94,0.4)",
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "90px",
                      height: "90px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "2rem",
                      flexShrink: 0
                    }}>🎤</div>
                  )}

                  <div>
                    <h2 style={{
                      margin: "0 0 6px",
                      fontSize: "1.4rem",
                      fontWeight: 800
                    }}>
                      {artistModal.primaryName || artistModal.name}
                    </h2>

                    {/* Show other artists if combined name */}
                    {artistModal.allNames?.length > 1 && (
                      <div style={{
                        display: "flex", gap: "6px",
                        flexWrap: "wrap", marginBottom: "4px"
                      }}>
                        {artistModal.allNames.map((n, i) => (
                          <button
                            key={i}
                            onClick={() => fetchArtistInfo(n)}
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              borderRadius: "999px",
                              color: "rgba(255,255,255,0.7)",
                              padding: "3px 10px",
                              fontSize: "0.75rem",
                              cursor: "pointer"
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{
                      fontSize: "0.8rem",
                      color: "rgba(255,255,255,0.45)"
                    }}>
                      Artist{artistModal.allNames?.length > 1 ? " • tap name above to switch" : ""}
                    </div>
                    {artistModal.wikiUrl && (
                      <button
                        onClick={() => window.open(artistModal.wikiUrl, "_blank", "noopener,noreferrer")}
                        style={{
                          marginTop: "8px",
                          background: "none",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: "8px",
                          color: "rgba(255,255,255,0.7)",
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        📖 Wikipedia
                      </button>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {artistModal.bio && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "8px",
                      fontWeight: 700
                    }}>
                      About
                    </div>
                    <p style={{
                      margin: 0,
                      color: "rgba(255,255,255,0.72)",
                      fontSize: "0.88rem",
                      lineHeight: 1.6
                    }}>
                      {artistModal.bio}...
                    </p>
                  </div>
                )}

                {/* Top songs */}
                {artistModal.topSongs?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "10px",
                      fontWeight: 700
                    }}>
                      Popular Songs
                    </div>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                      {artistModal.topSongs.map((song, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            playInApp({
                              title: song.title,
                              artists: artistModal.primaryName || artistModal.name,
                              image: song.image || currentSong?.image || "",
                              preview: song.preview || "",
                              duration: song.duration ? Math.floor(song.duration / 1000) : 0,
                              album: song.album || "",
                              id: `artist-${i}-${song.title}`
                            });
                            setArtistModal(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "8px",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#fff",
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                            transition: "background 150ms ease"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(29,185,84,0.12)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        >
                          {song.image && (
                            <img
                              src={song.image}
                              alt={song.title}
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "8px",
                                objectFit: "cover"
                              }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}>
                              {song.title}
                            </div>
                            <div style={{
                              fontSize: "0.75rem",
                              color: "rgba(255,255,255,0.45)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}>
                              {song.album}
                            </div>
                          </div>
                          <div style={{
                            fontSize: "0.72rem",
                            color: "rgba(255,255,255,0.35)"
                          }}>
                            {song.duration
                              ? `${Math.floor(song.duration / 60000)}:${String(Math.floor((song.duration % 60000) / 1000)).padStart(2, "0")}`
                              : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!artistModal.bio && artistModal.topSongs?.length === 0 && (
                  <div style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.4)",
                    padding: "20px"
                  }}>
                    No information found for this artist.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
