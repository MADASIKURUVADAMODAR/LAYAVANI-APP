const express = require("express");
const router = express.Router();
const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");

router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

const ITUNES_BASE = "https://itunes.apple.com";

async function itunesFetch(path) {
  const res = await fetch(`${ITUNES_BASE}${path}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!res.ok) throw new Error(`iTunes fetch failed: ${res.status}`);
  return res.json();
}

function normalizeItunesTrack(track) {
  return {
    id: String(track.trackId || track.collectionId || ""),
    title: track.trackName || "Unknown",
    artists: track.artistName || "Unknown Artist",
    image: (track.artworkUrl100 || "").replace("100x100", "500x500"),
    album: track.collectionName || "",
    preview: track.previewUrl || "",
    duration: Math.floor((track.trackTimeMillis || 0) / 1000),
    genre: track.primaryGenreName || "",
  };
}

function scoreVideoMatch(video, title, artist) {
  const hay = `${video?.title || ""} ${video?.author?.name || ""}`.toLowerCase();
  const wantedTitle = (title || "").toLowerCase();
  const wantedArtist = (artist || "").toLowerCase();

  let score = 0;
  if (wantedTitle && hay.includes(wantedTitle)) score += 6;
  if (wantedArtist && hay.includes(wantedArtist)) score += 4;
  if (hay.includes("official")) score += 2;
  if (hay.includes("lyrics")) score += 1;
  if (hay.includes("audio")) score += 1;
  if (hay.includes("episode")) score += 2;
  if (video?.seconds && video.seconds > 60) score += 1;
  return score;
}

async function searchYoutubeWithFallbacks(title, artist, lang = "") {
  const cleanTitle = (title || "").trim();
  const cleanArtist = (artist || "").trim();
  const cleanLang = (lang || "").toLowerCase().trim();

  let searchQuery;
  if (cleanLang && cleanLang !== "hindi" && cleanLang !== "bollywood") {
    searchQuery = `${cleanTitle} ${cleanArtist} ${cleanLang} official audio`;
  } else {
    searchQuery = `${cleanTitle} ${cleanArtist} official audio`;
  }

  const baseQuery = `${cleanTitle} ${cleanArtist}`.trim();

  const queryVariants = [
    searchQuery,
    baseQuery,
    `${cleanTitle} full song`,
    cleanTitle,
  ].filter(Boolean);

  const badKeywords = ["remix", "lyric", "lyrics", "cover", "dubbed", "karaoke", "mashup", "lofi", "lo-fi", "slowed", "reverb", "unplugged"];

  let bestVideo = null;
  let bestScore = -1;

  for (const q of queryVariants) {
    const result = await yts(q);
    const videos = result?.videos || [];
    if (!videos.length) continue;

    // Prefer results that don't have remix/lyric/cover/dubbed in the title
    const cleanResults = videos.filter(v => {
      const t = (v.title || v.snippet?.title || "").toLowerCase();
      return !badKeywords.some(k => t.includes(k));
    });

    // Use best clean result, fallback to first result if none pass filter
    const candidatePool = cleanResults.length ? cleanResults : videos;
    const bestResult = cleanResults[0] || videos[0];
    const videoId = bestResult?.videoId || bestResult?.id?.videoId;
    if (videoId && bestResult && scoreVideoMatch(bestResult, cleanTitle, cleanArtist) > bestScore) {
      bestScore = scoreVideoMatch(bestResult, cleanTitle, cleanArtist);
      bestVideo = bestResult;
    }

    const ranked = candidatePool
      .slice(0, 20)
      .map((video) => ({ video, score: scoreVideoMatch(video, cleanTitle, cleanArtist) }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score > bestScore) {
      bestScore = ranked[0].score;
      bestVideo = ranked[0].video;
    }
    if (bestScore >= 8) break;
  }

  return bestVideo;
}

// GET /api/music/search?query=KEYWORD&limit=30&country=IN
router.get("/search", async (req, res) => {
  try {
    const query = req.query.query || "hindi hits";
    const limit = req.query.limit || 30;
    const country = req.query.country || "IN";
    console.log("Fetching from iTunes:", query);
    const data = await itunesFetch(
      `/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=${country}`
    );
    const tracks = Array.isArray(data?.results) ? data.results : [];
    const normalized = tracks
      .filter((t) => t.kind === "song" || t.wrapperType === "track")
      .map(normalizeItunesTrack);
    console.log(`iTunes returned ${normalized.length} songs`);
    res.json({ results: normalized });
  } catch (err) {
    console.error("iTunes search error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/music/youtube?title=TITLE&artist=ARTIST
// Finds YouTube video ID using yt-search - NO API KEY, NO QUOTA!
router.get("/youtube", async (req, res) => {
  try {
    const title = req.query.title || "";
    const artist = req.query.artist || "";
    const lang = (req.query.lang || "").toLowerCase();

    // Build a smarter query that avoids remix/lyric/cover videos
    let searchQuery;
    if (lang && lang !== "hindi" && lang !== "bollywood") {
      // Regional songs: add language + "official audio" to avoid Hindi dubs
      searchQuery = `${title} ${artist} ${lang} official audio`;
    } else {
      // Hindi/English: just add "official audio" to avoid remixes & lyric videos
      searchQuery = `${title} ${artist} official audio`;
    }

    console.log("Searching YouTube for:", searchQuery.trim());

    const best = await searchYoutubeWithFallbacks(title, artist, lang);

    if (!best?.videoId) {
      return res.status(404).json({ error: "No video found" });
    }

    console.log("Found YouTube video:", best.videoId, best.title);
    
    res.json({
      videoId: best.videoId,
      title: best.title,
      url: best.url,
      duration: best.duration?.seconds || 0,
    });
  } catch (err) {
    console.error("YouTube search error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

router.get("/audio-stream", async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) {
      return res.status(400).json({ error: "No videoId provided" });
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Get video info
    const info = await ytdl.getInfo(url);

    // Get best audio-only format
    const audioFormats = ytdl.filterFormats(info.formats, "audioonly");

    if (!audioFormats || audioFormats.length === 0) {
      return res.status(404).json({ error: "No audio formats available" });
    }

    // Sort by bitrate - pick highest quality
    audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    const bestAudio = audioFormats[0];

    if (!bestAudio?.url) {
      return res.status(404).json({ error: "No audio URL found" });
    }

    console.log(`Audio stream found: ${bestAudio.mimeType} @ ${bestAudio.audioBitrate}kbps`);

    res.json({
      audioUrl: bestAudio.url,
      mimeType: bestAudio.mimeType || "audio/webm",
      bitrate: bestAudio.audioBitrate
    });

  } catch (err) {
    console.error("Audio stream error:", err.message);

    // Specific error messages for debugging
    if (err.message?.includes("410")) {
      return res.status(410).json({ error: "Video unavailable" });
    }
    if (err.message?.includes("private")) {
      return res.status(403).json({ error: "Video is private" });
    }

    res.status(500).json({ error: err.message });
  }
});

// GET /api/music/metadata?title=TITLE&artist=ARTIST
// Fetches rich metadata from MusicBrainz (free, no key needed)
router.get("/metadata", async (req, res) => {
  try {
    const title = (req.query.title || "").trim();
    const artist = (req.query.artist || "").trim();
    if (!title) return res.status(400).json({ error: "title required" });

    console.log("Fetching metadata for:", title, artist);

    // Step 1: Search MusicBrainz for recording
    const searchQuery = artist
      ? `recording:"${title}" AND artist:"${artist}"`
      : `recording:"${title}"`;

    const mbSearchRes = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(searchQuery)}&limit=1&fmt=json`,
      {
        headers: {
          "User-Agent": "LAYAVANI/1.0 (student-project)",
          "Accept": "application/json"
        }
      }
    );

    if (!mbSearchRes.ok) throw new Error("MusicBrainz search failed");
    const mbSearchData = await mbSearchRes.json();
    const recording = mbSearchData?.recordings?.[0];

    if (!recording?.id) {
      return res.json({
        singers: [artist].filter(Boolean),
        musicDirectors: [],
        lyricists: [],
        instruments: [],
        album: "",
        releaseYear: "",
        genre: "",
        found: false
      });
    }

    // Step 2: Get full recording details with relationships
    const mbDetailRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/${recording.id}?inc=artist-credits+releases+work-rels+artist-rels&fmt=json`,
      {
        headers: {
          "User-Agent": "LAYAVANI/1.0 (student-project)",
          "Accept": "application/json"
        }
      }
    );

    if (!mbDetailRes.ok) throw new Error("MusicBrainz detail fetch failed");
    const detail = await mbDetailRes.json();

    // Extract singers from artist-credits
    const singers = (detail["artist-credit"] || [])
      .filter(ac => ac?.artist?.name)
      .map(ac => ac.artist.name);

    // Extract album and release year
    const release = detail?.releases?.[0];
    const album = release?.title || "";
    const releaseYear = (release?.date || "").slice(0, 4);

    // Extract relationships (music director, lyricist, instruments)
    const relations = detail?.relations || [];
    const musicDirectors = [];
    const lyricists = [];
    const instruments = [];
    const producers = [];

    relations.forEach(rel => {
      const type = (rel.type || "").toLowerCase();
      const name = rel?.artist?.name || rel?.work?.title || "";

      if (!name) return;

      if (type.includes("composer") || type.includes("music")) {
        musicDirectors.push(name);
      } else if (type.includes("lyricist") || type.includes("writer")) {
        lyricists.push(name);
      } else if (type.includes("instrument") || type.includes("performer")) {
        const instrument = rel?.attributes?.[0] || type;
        if (instrument && instrument !== type) {
          instruments.push(`${name} (${instrument})`);
        } else {
          instruments.push(name);
        }
      } else if (type.includes("producer")) {
        producers.push(name);
      }
    });

    res.json({
      singers: singers.length > 0 ? singers : [artist].filter(Boolean),
      musicDirectors,
      lyricists,
      instruments,
      producers,
      album,
      releaseYear,
      recordingId: recording.id,
      found: true
    });

  } catch (err) {
    console.error("Metadata fetch error:", err.message);
    // Return basic info even on error
    res.json({
      singers: [req.query.artist].filter(Boolean),
      musicDirectors: [],
      lyricists: [],
      instruments: [],
      album: "",
      releaseYear: "",
      found: false,
      error: err.message
    });
  }
});

// GET /api/music/lyrics?title=TITLE&artist=ARTIST
router.get("/lyrics", async (req, res) => {
  try {
    const title = (req.query.title || "").trim();
    const artist = (req.query.artist || "").trim();
    if (!title) return res.status(400).json({ error: "title required" });

    // Try LRCLIB first (has synced lyrics)
    const lrclibRes = await fetch(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      { headers: { "User-Agent": "LAYAVANI/1.0" } }
    );

    if (lrclibRes.ok) {
      const lrclibData = await lrclibRes.json();
      const track = lrclibData?.[0];
      if (track?.plainLyrics) {
        return res.json({
          lyrics: track.plainLyrics,
          source: "lrclib",
          found: true
        });
      }
    }

    // Fallback: lyrics.ovh
    const ovhRes = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );

    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData?.lyrics) {
        return res.json({
          lyrics: ovhData.lyrics,
          source: "lyrics.ovh",
          found: true
        });
      }
    }

    res.json({ lyrics: "", found: false });
  } catch (err) {
    console.error("Lyrics error:", err.message);
    res.json({ lyrics: "", found: false, error: err.message });
  }
});

// POST /api/music/like - toggle like a song
router.post("/like", async (req, res) => {
  try {
    const { userId, song } = req.body;
    if (!userId || !song) return res.status(400).json({ error: "missing fields" });

    const User = require("../models/User");
    const user = await User.findOne({ userId });

    if (!user) return res.status(404).json({ error: "user not found" });

    const exists = user.likedSongs?.find(s => s.title === song.title && s.artists === song.artists);

    if (exists) {
      await User.findOneAndUpdate(
        { userId },
        { $pull: { likedSongs: { title: song.title, artists: song.artists } } }
      );
      return res.json({ liked: false });
    } else {
      await User.findOneAndUpdate(
        { userId },
        { $push: { likedSongs: { $each: [{ ...song, likedAt: new Date() }], $position: 0 } } },
        { upsert: true }
      );
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error("Like error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/music/liked?userId=XXX - get liked songs
router.get("/liked", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const User = require("../models/User");
    const user = await User.findOne({ userId });
    res.json({ songs: user?.likedSongs || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/music/download - toggle save for watch-later/downloaded section
router.post("/download", async (req, res) => {
  try {
    const { userId, song } = req.body;
    if (!userId || !song) return res.status(400).json({ error: "missing fields" });

    const User = require("../models/User");
    const user = await User.findOne({ userId });

    if (!user) return res.status(404).json({ error: "user not found" });

    const exists = user.downloadedSongs?.find(
      (s) => s.title === song.title && s.artists === song.artists
    );

    if (exists) {
      await User.findOneAndUpdate(
        { userId },
        { $pull: { downloadedSongs: { title: song.title, artists: song.artists } } }
      );
      return res.json({ saved: false });
    }

    await User.findOneAndUpdate(
      { userId },
      { $push: { downloadedSongs: { $each: [{ ...song, savedAt: new Date() }], $position: 0 } } },
      { upsert: true }
    );

    return res.json({ saved: true });
  } catch (err) {
    console.error("Download save error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/music/downloaded?userId=XXX - get saved downloaded/watch-later songs
router.get("/downloaded", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const User = require("../models/User");
    const user = await User.findOne({ userId });
    return res.json({ songs: user?.downloadedSongs || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/music/lyrics-synced - get synced LRC lyrics
router.get("/lyrics-synced", async (req, res) => {
  try {
    const title = (req.query.title || "").trim();
    const artist = (req.query.artist || "").trim();
    if (!title) return res.status(400).json({ error: "title required" });

    const lrclibRes = await fetch(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      { headers: { "User-Agent": "LAYAVANI/1.0" } }
    );

    if (lrclibRes.ok) {
      const data = await lrclibRes.json();
      const track = data?.[0];
      if (track?.syncedLyrics) {
        return res.json({ synced: true, lyrics: track.syncedLyrics, plain: track.plainLyrics });
      }
      if (track?.plainLyrics) {
        return res.json({ synced: false, lyrics: track.plainLyrics, plain: track.plainLyrics });
      }
    }

    // Fallback lyrics.ovh
    const ovhRes = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData?.lyrics) {
        return res.json({ synced: false, lyrics: ovhData.lyrics, plain: ovhData.lyrics });
      }
    }

    res.json({ synced: false, lyrics: "", plain: "" });
  } catch (err) {
    res.json({ synced: false, lyrics: "", plain: "" });
  }
});

router.use((err, req, res, next) => {
  console.error("Music route error:", err.message);
  res.status(500).json({ error: err.message });
});

module.exports = router;
