import React, { useState, useEffect, useMemo, useRef } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { searchStations, searchStationsByName } from "./services/radioService";
import { searchMovies, fetchMovieDetails, fetchMovieVideos, fetchMovieProviders, getPosterUrl } from "./services/tmdbService";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import MovieDetailsModal from "./components/movies/MovieDetailsModal";
import MusicHub from "./components/MusicHub";
import StudentPulse from './components/StudentPulse';
import AnimeHub from "./components/anime/AnimeHub";
import TvShowsHub from "./components/tv/TvShowsHub";
import useActivityTracker from "./hooks/useActivityTracker";
import SmartImage from "./components/ui/SmartImage";
import { MediaCardSkeleton } from "./components/ui/Skeletons";

// --- HELPERS ---

const cleanTrackTitle = (title) =>
  title
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/official|video|8k|4k|audio|lyric|lyrics|full song|hd|music video/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const cleanSearchQuery = (query) =>
  cleanTrackTitle(query)
    .replace(/official\s*video/gi, "")
    .replace(/\s+/g, " ")
    .trim();

export function getLocalDateKey(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const local = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const toWikiUrl = (name) => `https://en.wikipedia.org/wiki/${encodeURIComponent((name || "").trim().replace(/\s+/g, "_"))}`;

const splitPeopleNames = (value) =>
  (value || "")
    .replace(/\([^)]*\)/g, "")
    .split(/,| and | & |\//gi)
    .map((item) => item.trim())
    .filter(Boolean);

const extractFirstMatch = (text, regexList) => {
  for (const regex of regexList) {
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const extractAllMatches = (text, regexList) => {
  const found = [];
  for (const regex of regexList) {
    const match = text.match(regex);
    if (match?.[1]) found.push(match[1].trim());
  }
  return found;
};

const uniqueNames = (names) => [...new Set((names || []).map((name) => name.trim()).filter(Boolean))];

const parseWikipediaCredits = (extract) => {
  const plainText = (extract || "").replace(/\s+/g, " ").trim();
  if (!plainText) return { musicDirector: null, singers: [], movieName: null };

  const directorRaw = extractFirstMatch(plainText, [
    /composed by\s+([^.;]+)/i,
    /music by\s+([^.;]+)/i,
    /music composed by\s+([^.;]+)/i,
    /soundtrack composed by\s+([^.;]+)/i
  ]);

  const singerRawCollection = extractAllMatches(plainText, [
    /vocals by\s+([^.;]+)/i,
    /sung by\s+([^.;]+)/i,
    /singer(?:s)?\s*[:\-]?\s*([^.;]+)/i,
    /performed by\s+([^.;]+)/i
  ]);

  const movieName = extractFirstMatch(plainText, [
    /recorded for the film\s+([A-Za-z0-9'’:&\-\s]+?)(?:[.,;]|\s+where|\s+which|\s+and\s+released|$)/i,
    /from the film\s+([A-Za-z0-9'’:&\-\s]+?)(?:[.,;]|\s+where|\s+which|\s+and\s+released|$)/i,
    /featured in the film\s+([A-Za-z0-9'’:&\-\s]+?)(?:[.,;]|\s+where|\s+which|\s+and\s+released|$)/i
  ]);

  const musicDirector = splitPeopleNames(directorRaw)[0] || null;
  const singers = uniqueNames(singerRawCollection.flatMap((value) => splitPeopleNames(value)));

  return { musicDirector, singers, movieName: movieName ? movieName.trim() : null };
};

const parseMovieDirector = (extract) => {
  const plainText = (extract || "").replace(/\s+/g, " ").trim();
  if (!plainText) return null;

  const directorRaw = extractFirstMatch(plainText, [
    /directed by\s+([^.;]+)/i
  ]);

  return splitPeopleNames(directorRaw)[0] || null;
};

const parseVideoFallbackCredits = (video) => {
  const title = video?.snippet?.title || "";
  const channel = (video?.snippet?.channelTitle || "").replace(/-\s*topic/gi, "").trim();
  const titleParts = title.split(/[|:-]/).map((part) => part.trim()).filter(Boolean);

  return {
    musicDirector: titleParts[1] || channel || null,
    singers: channel ? [channel] : [],
    movieName: titleParts.find((part) => /movie|film|from/i.test(part)) || null
  };
};

const fetchWikipediaData = async (name) => {
  if (!name || name === "Unknown") return null;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro&explaintext&titles=${encodeURIComponent(name)}&pithumbsize=400&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") return null;
    return {
      title: pages[pageId].title,
      summary: pages[pageId].extract,
      image: pages[pageId].thumbnail?.source,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`
    };
  } catch (err) { return null; }
};

const fetchWikipediaFromSearch = async (query) => {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&origin=*`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    const firstTitle = data?.query?.search?.[0]?.title;
    if (!firstTitle) return null;
    return fetchWikipediaData(firstTitle);
  } catch (err) {
    return null;
  }
};

const fetchWikipediaBestMatch = async (query) => {
  const cleanedQuery = cleanSearchQuery(query);
  if (!cleanedQuery) return null;

  const [directWiki, songWiki] = await Promise.all([
    fetchWikipediaData(cleanedQuery),
    fetchWikipediaData(`${cleanedQuery} song`)
  ]);

  if (songWiki && (songWiki.summary?.length || 0) > (directWiki.summary?.length || 0)) return songWiki;
  if (directWiki) return directWiki;
  if (songWiki) return songWiki;
  return fetchWikipediaFromSearch(`${cleanedQuery} song`);
};

// --- COMPONENTS ---

function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;

      fetch("http://localhost:5000/api/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: loggedUser.uid,
          name: loggedUser.displayName,
          email: loggedUser.email,
          photoURL: loggedUser.photoURL,
        }),
      }).catch(() => {
        console.warn("User sync failed (non-blocking)");
      });
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  if (initializing) return (
    <div style={{ background: "#000", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Inter', 'Roboto', sans-serif" }}>
      Waking up...
    </div>
  );

  return (
    <div style={{ background: "#000", color: "#ffffff", minHeight: "100vh", fontFamily: "'Inter', 'Roboto', sans-serif" }}>
      {user ? <Dashboard user={user} onLogout={() => signOut(auth)} onLogin={handleGoogleLogin} /> : <LandingPage onLogin={handleGoogleLogin} />}
    </div>
  );
}

function Dashboard({ user, onLogout, onLogin }) {
  const [activeTab, setActiveTab] = useState("Home");
  const [searchTerm, setSearchTerm] = useState("");
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoShouldAutoplay, setVideoShouldAutoplay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState("");
  const [movieQuery, setMovieQuery] = useState("");
  const [movieResults, setMovieResults] = useState([]);
  const [movieLoading, setMovieLoading] = useState(false);
  const [movieTrending, setMovieTrending] = useState([]);
  const [movieTrendingLoading, setMovieTrendingLoading] = useState(false);
  const [movieHasSearched, setMovieHasSearched] = useState(false);
  const [moviePage, setMoviePage] = useState(1);
  const [totalMoviePages, setTotalMoviePages] = useState(1);
  const MOVIE_MAX_PAGES = 100;
  const [movieHasMore, setMovieHasMore] = useState(true);
  const [movieSelectedDetails, setMovieSelectedDetails] = useState(null);
  const [movieSelectedProviders, setMovieSelectedProviders] = useState({ results: {} });
  const [movieModalOpen, setMovieModalOpen] = useState(false);
  const [movieModalLoading, setMovieModalLoading] = useState(false);
  const [movieVideos, setMovieVideos] = useState([]);
  const [movieTrailerKey, setMovieTrailerKey] = useState("");
  const [movieModalMovie, setMovieModalMovie] = useState(null);
  const [movieWatchlistIds, setMovieWatchlistIds] = useState([]);
  const [movieWatchlistItems, setMovieWatchlistItems] = useState([]);
  const [movieSearchDebouncedQuery, setMovieSearchDebouncedQuery] = useState("");
  const [verifiedCredits, setVerifiedCredits] = useState({ musicDirector: null, singers: [], movieName: null, movieDirector: null });
  const [wikiBio, setWikiBio] = useState(null);
  const [movieArt, setMovieArt] = useState(null);
  const [radioStations, setRadioStations] = useState([]);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState("");
  const [radioOffset, setRadioOffset] = useState(0);
  const [radioHasMore, setRadioHasMore] = useState(true);
  const [radioSearchInput, setRadioSearchInput] = useState("");
  const [radioSearching, setRadioSearching] = useState(false);
  const [radioCountryFilter, setRadioCountryFilter] = useState("ALL_COUNTRIES");
  const [radioLanguageFilter, setRadioLanguageFilter] = useState("ALL_LANGUAGES");
  const [filteredStations, setFilteredStations] = useState([]);
  const [userData, setUserData] = useState(null);
  const [currentStation, setCurrentStation] = useState(null);
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(false);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [watchlistPop, setWatchlistPop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const categoryScrollRefs = useRef({});
  const moviesEndRef = useRef(null);
  const toastIdRef = useRef(0);
  const moreMenuRef = useRef(null);

  const isYouTubePlaying = Boolean(activeVideo && videoShouldAutoplay && activeTab !== "Radio" && activeTab !== "Movies");
  const isTrailerPlaying = Boolean(movieTrailerKey);

  useActivityTracker(user?.uid, {
    isRadioPlaying,
    isYouTubePlaying,
    isTrailerPlaying,
  });

  const primaryNavTabs = ["Home", "Movies", "TV Shows", "Anime", "Radio", "Watchlist"];
  const moreNavTabs = ["Music Hub", "Student Pulse"];
  const fallbackRadioIcon =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320'%3E%3Crect width='320' height='320' rx='36' fill='%23151c2a'/%3E%3Cpath d='M100 212a60 60 0 0 1 120 0' stroke='%23ffffff' stroke-width='18' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='160' cy='212' r='16' fill='%23ffffff'/%3E%3C/svg%3E";

  const radioCountries = useMemo(() => {
    const countries = [...new Set(radioStations.map((station) => station.country).filter(Boolean))];
    return countries.sort((first, second) => first.localeCompare(second));
  }, [radioStations]);

  const radioLanguages = useMemo(() => {
    const languages = [...new Set(radioStations.map((station) => station.language).filter(Boolean))];
    return languages.sort((first, second) => first.localeCompare(second));
  }, [radioStations]);

  const filteredRadioStations = useMemo(() => {
    return radioStations.filter((station) => {
      const matchesCountry = radioCountryFilter === "ALL_COUNTRIES" || (station.country || "") === radioCountryFilter;
      const matchesLanguage = radioLanguageFilter === "ALL_LANGUAGES" || (station.language || "") === radioLanguageFilter;
      return matchesCountry && matchesLanguage;
    });
  }, [radioStations, radioCountryFilter, radioLanguageFilter]);

  useEffect(() => {
    setFilteredStations(filteredRadioStations);
  }, [filteredRadioStations]);

  const loadTrendingMovies = async (page = 1) => {
    setMovieTrendingLoading(true);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${import.meta.env.VITE_TMDB_KEY}&page=${page}`
      );
      const data = await res.json();
      setMovieTrending(Array.isArray(data?.results) ? data.results : []);
      setTotalMoviePages(Math.min(data?.total_pages || 1, MOVIE_MAX_PAGES));
    } catch (err) {
      console.error("Failed to load trending movies", err);
      setMovieTrending([]);
      setTotalMoviePages(1);
    } finally {
      setMovieTrendingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Movies") {
      loadTrendingMovies(moviePage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab, moviePage]);

  useEffect(() => {
    if (activeTab !== "Movies") return undefined;
    const timeoutId = setTimeout(() => {
      setMovieSearchDebouncedQuery(movieQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [movieQuery, activeTab]);

  useEffect(() => {
    if (activeTab !== "Movies") return;
    const trimmed = movieSearchDebouncedQuery.trim();
    if (!trimmed) {
      setMovieResults([]);
      setMovieHasSearched(false);
      return;
    }
    searchMoviesTMDB(trimmed, 1);
  }, [movieSearchDebouncedQuery, activeTab]);

  useEffect(() => {
    if (!["Movies", "Watchlist"].includes(activeTab)) return;
    if (!user?.uid) return;

    fetch(`http://localhost:5000/api/watchlist/${user.uid}`)
      .then((response) => response.json())
      .then((payload) => {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const ids = items.map((item) => item.movieId).filter(Boolean);
        setMovieWatchlistIds(ids);
        setMovieWatchlistItems(items);
      })
      .catch(() => {
        setMovieWatchlistIds([]);
        setMovieWatchlistItems([]);
      });
  }, [activeTab, user?.uid]);

  useEffect(() => {
    if (!user) return;

    fetch(`http://localhost:5000/api/users/${user.uid}`)
      .then((res) => res.json())
      .then((data) => setUserData(data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!moreMenuRef.current?.contains(event.target)) {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [activeTab]);

  const radioCategories = useMemo(() => {
    const popularMix = filteredStations.slice(0, 18);
    const byCountry = [...filteredStations]
      .sort((first, second) => (second.clickcount || 0) - (first.clickcount || 0))
      .filter((station, index, allStations) => allStations.findIndex((item) => (item.country || "Unknown") === (station.country || "Unknown")) === index)
      .slice(0, 18);
    const byLanguage = [...filteredStations]
      .filter((station) => station.language)
      .sort((first, second) => (second.votes || 0) - (first.votes || 0))
      .slice(0, 18);

    return [
      { key: "popular", title: "Popular Mix", stations: popularMix },
      { key: "country", title: "By Country", stations: byCountry },
      { key: "language", title: "By Language", stations: byLanguage }
    ];
  }, [filteredStations]);

  const loadRadioStations = async ({ reset }) => {
    if (radioLoading) return;

    setRadioLoading(true);
    setRadioError("");

    try {
      const nextOffset = reset ? 0 : radioOffset;
      const incoming = await searchStations({ offset: nextOffset });

      setRadioStations((previous) => {
        if (reset) return incoming;
        const known = new Set(previous.map((station) => station.stationuuid));
        const uniqueIncoming = incoming.filter((station) => !known.has(station.stationuuid));
        return [...previous, ...uniqueIncoming];
      });

      setRadioOffset(nextOffset + 100);
      setRadioHasMore(incoming.length === 100);
    } catch {
      if (reset) setRadioStations([]);
      setRadioError("Unable to load radio stations right now.");
    } finally {
      setRadioLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Radio" && radioStations.length === 0 && !radioLoading) {
      loadRadioStations({ reset: true });
    }
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderScrolled(window.scrollY > 40);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const showToast = (message) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToasts((previous) => [...previous, { id, message }]);
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, 1800);
  };

  const handleDownloadFeedback = () => {
    showToast("Download started");
  };

  useEffect(() => {
    if (activeTab !== "Radio") return undefined;

    const trimmedQuery = radioSearchInput.trim();

    if (!trimmedQuery) {
      if (radioStations.length === 0 && !radioLoading) {
        loadRadioStations({ reset: true });
      }
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      setRadioSearching(true);
      setRadioError("");

      try {
        const results = await searchStationsByName(trimmedQuery);
        setRadioStations(results);
        setRadioHasMore(false);
        setRadioOffset(0);
      } catch {
        setRadioError("Unable to search stations right now.");
      } finally {
        setRadioSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [radioSearchInput, activeTab]);

  const handleRadioSearch = async (event) => {
    event.preventDefault();
    const trimmedQuery = radioSearchInput.trim();

    if (!trimmedQuery) {
      loadRadioStations({ reset: true });
      return;
    }

    setRadioSearching(true);
    setRadioError("");

    try {
      const results = await searchStationsByName(trimmedQuery);
      setRadioStations(results);
      setRadioHasMore(false);
      setRadioOffset(0);
    } catch {
      setRadioError("Unable to search stations right now.");
    } finally {
      setRadioSearching(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanedQuery = cleanSearchQuery(searchTerm);
    setActiveTab("Home");
    setVideoShouldAutoplay(false);

    if (!cleanedQuery) {
      setVideos([]);
      setActiveVideo(null);
      setWikiBio(null);
      setMovieArt(null);
      setVerifiedCredits({ musicDirector: null, singers: [], movieName: null, movieDirector: null });
      return;
    }

    setLoading(true);
    setYoutubeError("");
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

    try {
      const youtubeRequest = fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(cleanedQuery)}&type=video&maxResults=8&key=${apiKey}`)
        .then(async (res) => {
          const payload = await res.json();
          if (!res.ok) {
            if (res.status === 403) {
              throw new Error("YOUTUBE_QUOTA_EXCEEDED");
            }
            throw new Error(payload?.error?.message || `YouTube request failed with status ${res.status}`);
          }
          return payload;
        });
      const wikipediaRequest = fetchWikipediaBestMatch(cleanedQuery);

      const [data, primaryWikiData] = await Promise.all([youtubeRequest, wikipediaRequest]);
      const wikiData = primaryWikiData;

      setVideos(data.items || []);
      if (data.items?.length > 0) setActiveVideo(data.items[0]);
      setWikiBio(wikiData);

      const parsedCredits = parseWikipediaCredits(wikiData?.summary || "");
      const fallbackCredits = parseVideoFallbackCredits(data.items?.[0]);
      let parsedMovieDirector = null;

      if (parsedCredits.movieName) {
        const movieWikiData = await fetchWikipediaData(parsedCredits.movieName);
        parsedMovieDirector = parseMovieDirector(movieWikiData?.summary || "");
        setMovieArt(movieWikiData?.image ? {
          title: movieWikiData.title || parsedCredits.movieName,
          image: movieWikiData.image,
          url: movieWikiData.url
        } : null);
      } else {
        setMovieArt(null);
      }

      setVerifiedCredits({
        musicDirector: parsedCredits.musicDirector || fallbackCredits.musicDirector,
        singers: parsedCredits.singers.length ? parsedCredits.singers : fallbackCredits.singers,
        movieName: parsedCredits.movieName || fallbackCredits.movieName,
        movieDirector: parsedMovieDirector
      });
    } catch (err) {
      if (err?.message === "YOUTUBE_QUOTA_EXCEEDED") {
        setYoutubeError("YouTube quota exceeded. Please try again tomorrow.");
      } else {
        setYoutubeError("Unable to load YouTube videos right now.");
      }
      setVideos([]);
      setActiveVideo(null);
      console.error(err);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialFeed = async () => {
      const defaultKeywords = [
        "New Music 2026",
        "Coding Tutorials",
        "Gaming Highlights",
        "Bangalore Events"
      ];

      setLoading(true);
      setYoutubeError("");
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

      try {
        const requests = defaultKeywords.map((keyword) =>
          fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=6&key=${apiKey}`)
            .then(async (res) => {
              const payload = await res.json();
              if (!res.ok) {
                if (res.status === 403) {
                  throw new Error("YOUTUBE_QUOTA_EXCEEDED");
                }
                throw new Error(payload?.error?.message || `YouTube request failed with status ${res.status}`);
              }
              return payload;
            })
        );

        const responses = await Promise.all(requests);
        const mixedItems = responses
          .flatMap((response) => response?.items || [])
          .filter((item, index, allItems) => {
            const videoId = item?.id?.videoId;
            if (!videoId) return false;
            return allItems.findIndex((candidate) => candidate?.id?.videoId === videoId) === index;
          })
          .slice(0, 24);

        if (!isMounted) return;
        setVideos(mixedItems);
        if (mixedItems.length > 0) setActiveVideo(mixedItems[0]);
      } catch (error) {
        if (isMounted) {
          if (error?.message === "YOUTUBE_QUOTA_EXCEEDED") {
            setYoutubeError("YouTube quota exceeded. Please try again tomorrow.");
          } else {
            setYoutubeError("Unable to load YouTube videos right now.");
          }
          setVideos([]);
          setActiveVideo(null);
        }
        console.error("Initial feed load failed", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialFeed();

    return () => {
      isMounted = false;
    };
  }, []);

  const openStation = (station) => {
    setCurrentStation(station);
    setMiniPlayerOpen(true);
    setIsRadioPlaying(true);
  };

  const scrollCategory = (categoryKey, direction) => {
    const rowElement = categoryScrollRefs.current[categoryKey];
    if (!rowElement) return;
    rowElement.scrollBy({ left: direction * 380, behavior: "smooth" });
  };

  const playVideo = () => {
    setVideoShouldAutoplay(true);
    setIsRadioPlaying(false);
  };

  const moviePosterUrl = (path) => path ? getPosterUrl(path) : "";

  const movieRecordActivity = (type, movieId) => {
    if (!user?.uid || !movieId) return;
    fetch("http://localhost:5000/api/users/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.uid,
        type,
        movieId,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});
  };

  const searchMoviesTMDB = async (query, page = 1) => {
    if (!query.trim()) return;

    setMovieLoading(true);

    try {
      const data = await searchMovies(query, page);
      const incomingResults = Array.isArray(data?.results) ? data.results : [];
      if (page === 1) {
        setMovieResults(incomingResults);
      } else {
        setMovieResults((previous) => [...previous, ...incomingResults]);
      }

      setMovieHasMore(page < Number(data?.total_pages || 0));
      if (page === 1) {
        setMovieSelectedDetails(null);
        setMovieSelectedProviders({ results: {} });
        setMovieTrailerKey("");
        setMovieVideos([]);
      }
      setMovieHasSearched(true);
    } catch (err) {
      console.error("TMDB search failed", err);
      if (page === 1) setMovieResults([]);
      setMovieHasMore(false);
      setMovieHasSearched(true);
    } finally {
      setMovieLoading(false);
    }
  };

  const movieHandleSearchSubmit = async (event) => {
    event.preventDefault();
    setMovieSearchDebouncedQuery(movieQuery);
    await searchMoviesTMDB(movieQuery, 1);
  };

  const movieHandleSelect = async (movieInput) => {
    const movie = typeof movieInput === "object"
      ? movieInput
      : [...movieResults, ...movieTrending].find((item) => item.id === movieInput) || { id: movieInput };

    if (!movie?.id) return;

    setMovieModalMovie(movie);
    setMovieModalOpen(true);
    setMovieModalLoading(true);
    setMovieTrailerKey("");

    try {
      const [details, providers, videos] = await Promise.all([
        fetchMovieDetails(movie.id),
        fetchMovieProviders(movie.id),
        fetchMovieVideos(movie.id)
      ]);

      setMovieSelectedDetails(details);
      setMovieSelectedProviders(providers);
      setMovieVideos(Array.isArray(videos?.results) ? videos.results : []);
      movieRecordActivity("movie_view", movie.id);
    } catch (error) {
      console.error("TMDB movie details failed", error);
      setMovieSelectedProviders({ results: {} });
    } finally {
      setMovieModalLoading(false);
    }
  };

  const movieHandlePlayTrailer = () => {
    const trailer = movieVideos.find((video) => video.type === "Trailer" && video.site === "YouTube");
    if (!trailer?.key) return;
    setMovieTrailerKey(trailer.key);
    movieRecordActivity("trailer_play", movieModalMovie?.id);
  };

  const movieHandleToggleWatchlist = async () => {
    if (!user?.uid || !movieModalMovie?.id) return;

    await fetch("http://localhost:5000/api/watchlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.uid,
        movieId: movieModalMovie.id,
        title: movieModalMovie.title,
        poster: movieModalMovie.poster_path
      })
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.added) {
          setMovieWatchlistIds((previous) => [...new Set([...previous, movieModalMovie.id])]);
          setMovieWatchlistItems((previous) => {
            const exists = previous.some((item) => item.movieId === movieModalMovie.id);
            if (exists) return previous;
            return [...previous, { movieId: movieModalMovie.id, title: movieModalMovie.title, poster: movieModalMovie.poster_path }];
          });
          movieRecordActivity("movie_like", movieModalMovie.id);
          showToast("Added to Likes");
        } else {
          setMovieWatchlistIds((previous) => previous.filter((id) => id !== movieModalMovie.id));
          setMovieWatchlistItems((previous) => previous.filter((item) => item.movieId !== movieModalMovie.id));
          showToast("Removed from Watchlist");
        }

        setWatchlistPop(true);
        window.setTimeout(() => setWatchlistPop(false), 190);
      })
      .catch(() => {});
  };

  const handleMoviePageChange = (page) => {
    if (page < 1 || page > totalMoviePages) return;
    setMoviePage(page);
  };

  const renderStationCard = (station, cardWidth = 210) => (
    <button
      key={station.stationuuid}
      type="button"
      onClick={() => openStation(station)}
      style={{
        width: cardWidth,
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: "16px",
        padding: "12px",
        background: "rgba(20,24,34,0.92)",
        color: "#fff",
        textAlign: "left",
        cursor: "pointer"
      }}
    >
      <img
        src={station.favicon || fallbackRadioIcon}
        alt={station.name}
        onError={(event) => {
          event.currentTarget.src = fallbackRadioIcon;
        }}
        style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "14px", background: "#151c2a" }}
      />
      <div style={{ marginTop: "10px", fontWeight: 700, fontSize: "0.98rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {station.name}
      </div>
      <div style={{ marginTop: "4px", color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {station.tags?.split(",")?.[0] || station.language || "Live Radio"} • {station.country || "Global"}
      </div>
    </button>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        color: "#fff",
        overflowX: "hidden",
        backgroundColor: "#06070b",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "26px 26px"
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1200,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: "100%",
          gap: "16px",
          padding: "16px 26px",
          boxSizing: "border-box",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          background: isHeaderScrolled ? "rgba(5,6,10,0.94)" : "rgba(5,6,10,0.82)",
          backdropFilter: isHeaderScrolled ? "blur(14px)" : "blur(9px)",
          transition: "background 180ms ease-out, backdrop-filter 180ms ease-out"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 auto" }}>
          <button
            type="button"
            className="ui-pressable ui-focus-ring mobile-nav-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen((previous) => !previous)}
            style={{ border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", color: "#fff", borderRadius: "10px", width: "36px", height: "36px", placeItems: "center", fontSize: "1rem" }}
          >
            ☰
          </button>

          <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>LAYAVANI</div>

          <div className="primary-nav-group" style={{ display: "flex", alignItems: "center", gap: "4px", overflowX: "auto", minWidth: 0 }}>
            {primaryNavTabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setActiveTab(item)}
                className={`ui-nav-item ui-pressable ui-focus-ring ${activeTab === item ? "is-active" : ""}`}
                aria-label={`Open ${item}`}
                style={{
                  border: "none",
                  background: activeTab === item ? "#ffffff" : "transparent",
                  color: activeTab === item ? "#04060b" : "rgba(255,255,255,0.82)",
                  borderRadius: "999px",
                  padding: "9px 13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer"
                }}
              >
                {item}
              </button>
            ))}

            <div ref={moreMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                className={`ui-nav-item ui-pressable ui-focus-ring ${moreNavTabs.includes(activeTab) ? "is-active" : ""}`}
                onClick={() => setMoreMenuOpen((previous) => !previous)}
                aria-label="Open more sections"
                style={{
                  border: "none",
                  background: moreNavTabs.includes(activeTab) ? "#ffffff" : "transparent",
                  color: moreNavTabs.includes(activeTab) ? "#04060b" : "rgba(255,255,255,0.82)",
                  borderRadius: "999px",
                  padding: "9px 13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer"
                }}
              >
                More ▾
              </button>

              {moreMenuOpen ? (
                <div className="ui-dropdown-enter" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: "168px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.16)", background: "rgba(8,10,16,0.95)", backdropFilter: "blur(12px)", padding: "6px", boxShadow: "0 12px 24px rgba(0,0,0,0.34)" }}>
                  {moreNavTabs.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setActiveTab(item)}
                      className="ui-pressable ui-focus-ring"
                      style={{ width: "100%", textAlign: "left", border: "none", borderRadius: "8px", background: activeTab === item ? "rgba(255,255,255,0.16)" : "transparent", color: "#fff", padding: "9px 10px", cursor: "pointer", fontWeight: 600 }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flex: "1 1 420px", minWidth: 0 }}>
          {activeTab === "Movies" ? (
            <form onSubmit={movieHandleSearchSubmit} style={{ display: "flex", flex: "1 1 0", maxWidth: "460px", minWidth: 0 }}>
              <input
                value={movieQuery}
                onChange={(event) => setMovieQuery(event.target.value)}
                placeholder="Search movies..."
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: "14px 0 0 14px",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRight: "none",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                className="ui-pressable ui-focus-ring"
                aria-label="Search movies"
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "0 14px 14px 0",
                  background: "#ffffff",
                  color: "#000",
                  padding: "0 16px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {movieLoading ? "..." : "Search"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSearch} style={{ display: "flex", flex: "1 1 0", maxWidth: "460px", minWidth: 0 }}>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search songs and videos..."
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: "14px 0 0 14px",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRight: "none",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                className="ui-pressable ui-focus-ring"
                aria-label="Search songs and videos"
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "0 14px 14px 0",
                  background: "#ffffff",
                  color: "#000",
                  padding: "0 16px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {loading ? "..." : "Search"}
              </button>
            </form>
          )}
          <ProfileMenu user={user} userData={userData} onLogout={onLogout} onLogin={onLogin} />
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="ui-dropdown-enter mobile-nav-drawer" style={{ position: "sticky", top: 64, zIndex: 1199, margin: "0 12px", border: "1px solid rgba(255,255,255,0.16)", borderTop: "none", borderRadius: "0 0 14px 14px", background: "rgba(6,8,12,0.96)", backdropFilter: "blur(12px)", padding: "8px" }}>
          {[...primaryNavTabs, ...moreNavTabs].map((item) => (
            <button key={item} type="button" onClick={() => setActiveTab(item)} className="ui-pressable ui-focus-ring" style={{ width: "100%", textAlign: "left", border: "none", borderRadius: "10px", background: activeTab === item ? "rgba(255,255,255,0.18)" : "transparent", color: "#fff", padding: "10px 12px", cursor: "pointer", fontWeight: 600 }}>
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <main style={{ padding: "24px 26px 140px", overflowX: "hidden" }}>
        {activeTab === "Radio" ? (
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.9rem" }}>Live Radio</h2>
                <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.72)" }}>Poster-style stations with cinematic browsing.</p>
              </div>
              <button type="button" onClick={() => loadRadioStations({ reset: true })} style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: "14px", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "9px 14px", cursor: "pointer" }}>
                Refresh
              </button>
            </div>

            <form onSubmit={handleRadioSearch} style={{ display: "flex", gap: "10px", marginBottom: "16px", maxWidth: "620px" }}>
              <input value={radioSearchInput} onChange={(event) => setRadioSearchInput(event.target.value)} placeholder="Search radio stations by name..." style={{ flex: 1, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "11px 14px", outline: "none" }} />
              <button type="submit" style={{ border: "1px solid rgba(255,255,255,0.28)", borderRadius: "12px", background: "rgba(255,255,255,0.14)", color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>
                {radioSearching ? "Searching..." : "Search"}
              </button>
            </form>

            <div style={{ marginBottom: "16px", maxWidth: "660px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <select value={radioCountryFilter} onChange={(event) => setRadioCountryFilter(event.target.value)} style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "10px 12px", outline: "none" }}>
                <option value="ALL_COUNTRIES" style={{ color: "#111" }}>All Countries</option>
                {radioCountries.map((country) => <option key={country} value={country} style={{ color: "#111" }}>{country}</option>)}
              </select>
              <select value={radioLanguageFilter} onChange={(event) => setRadioLanguageFilter(event.target.value)} style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "10px 12px", outline: "none" }}>
                <option value="ALL_LANGUAGES" style={{ color: "#111" }}>All Languages</option>
                {radioLanguages.map((language) => <option key={language} value={language} style={{ color: "#111" }}>{language}</option>)}
              </select>
            </div>

            {radioError ? <p style={{ color: "#ffb1b1", margin: "0 0 14px" }}>{radioError}</p> : null}
            {!radioError && (radioLoading || radioSearching) && filteredStations.length === 0 ? <p style={{ color: "rgba(255,255,255,0.75)" }}>{radioSearching ? "Searching stations..." : "Loading stations..."}</p> : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "26px" }}>
              {filteredStations.slice(0, 12).map((station) => <div key={station.stationuuid} style={{ width: "100%" }}>{renderStationCard(station, "100%")}</div>)}
            </div>

            {radioCategories.map((category) => (
              <section key={category.key} style={{ marginBottom: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", gap: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "1.18rem" }}>{category.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button type="button" onClick={() => scrollCategory(category.key, -1)} style={{ border: "1px solid rgba(255,255,255,0.26)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "6px 10px", cursor: "pointer" }}>←</button>
                    <button type="button" onClick={() => scrollCategory(category.key, 1)} style={{ border: "1px solid rgba(255,255,255,0.26)", borderRadius: "12px", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "6px 10px", cursor: "pointer" }}>→</button>
                    <button type="button" onClick={() => loadRadioStations({ reset: false })} disabled={!radioHasMore || radioLoading} style={{ border: "none", background: "transparent", color: radioHasMore ? "#8ab4ff" : "rgba(255,255,255,0.45)", cursor: radioHasMore ? "pointer" : "not-allowed", textDecoration: "underline", fontWeight: 600 }}>
                      {radioLoading ? "Loading..." : "View More"}
                    </button>
                  </div>
                </div>

                <div ref={(node) => { categoryScrollRefs.current[category.key] = node; }} style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "210px", gap: "12px", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none" }}>
                  {category.stations.map((station) => renderStationCard(station))}
                </div>
              </section>
            ))}
          </section>
        ) : activeTab === "Movies" ? (
          <section style={{ minWidth: 0 }}>
            {movieLoading ? <div style={{ marginBottom: "16px", color: "rgba(255,255,255,0.78)" }}>Loading movies...</div> : null}

            {movieResults.length > 0 ? (
              <section>
                <h2 style={{ margin: "0 0 14px", fontSize: "1.7rem" }}>Search Results</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px" }}>
                  {movieLoading ? <MediaCardSkeleton count={12} /> : null}
                  {movieResults.map((movie) => (
                    <button key={`${movie.id}-${movie.release_date || ""}`} type="button" onClick={() => movieHandleSelect(movie)} className="ui-media-card ui-pressable ui-focus-ring" aria-label={`Open ${movie.title || "movie"} details`} style={{ border: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px", overflow: "hidden", background: "rgba(13,17,27,0.9)", color: "#fff", textAlign: "left", cursor: "pointer", padding: 0 }}>
                      <SmartImage src={movie.poster_path ? moviePosterUrl(movie.poster_path) : ""} alt={movie.title} style={{ width: "100%", aspectRatio: "2 / 3", background: "#151c2a" }} />
                      <div style={{ padding: "10px 12px" }}>
                        <div className="ui-clamp-1" style={{ fontWeight: 700, lineHeight: 1.35, letterSpacing: "0.01em" }}>{movie.title}</div>
                        <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.72)", fontSize: "0.85rem" }}>⭐ {Number(movie.vote_average || 0).toFixed(1)} • {(movie.release_date || "").slice(0, 4) || "N/A"}</div>
                      </div>
                    </button>
                  ))}
                </div>
                {movieLoading ? <p style={{ margin: "12px 0 0", color: "rgba(255,255,255,0.72)" }}>Loading movies...</p> : null}
              </section>
            ) : (
              <section>
                <h2 style={{ margin: "0 0 14px", fontSize: "1.7rem" }}>🔥 Trending Movies</h2>
                {movieHasSearched && !movieLoading ? <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.7)" }}>No movies found</p> : null}
                {movieTrendingLoading ? <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.72)" }}>Loading trending movies...</p> : null}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px" }}>
                  {movieTrendingLoading ? <MediaCardSkeleton count={12} /> : null}
                  {movieTrending.map((movie) => (
                    <button key={movie.id} type="button" onClick={() => movieHandleSelect(movie)} className="ui-media-card ui-pressable ui-focus-ring" aria-label={`Open ${movie.title || "movie"} details`} style={{ border: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px", overflow: "hidden", background: "rgba(13,17,27,0.9)", color: "#fff", textAlign: "left", cursor: "pointer", padding: 0 }}>
                      <SmartImage src={movie.poster_path ? moviePosterUrl(movie.poster_path) : ""} alt={movie.title} style={{ width: "100%", aspectRatio: "2 / 3", background: "#151c2a" }} />
                      <div style={{ padding: "10px 12px" }}>
                        <div className="ui-clamp-1" style={{ fontWeight: 700, lineHeight: 1.35, letterSpacing: "0.01em" }}>{movie.title}</div>
                        <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.72)", fontSize: "0.85rem" }}>⭐ {Number(movie.vote_average || 0).toFixed(1)} • {(movie.release_date || "").slice(0, 4) || "N/A"}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "10px",
                    margin: "40px 0",
                    flexWrap: "wrap"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleMoviePageChange(moviePage - 1)}
                    disabled={moviePage === 1}
                    style={{
                      borderRadius: "8px",
                      padding: "6px 12px",
                      border: "1px solid #444",
                      background: "transparent",
                      color: "#fff",
                      cursor: moviePage === 1 ? "not-allowed" : "pointer",
                      opacity: moviePage === 1 ? 0.5 : 1
                    }}
                  >
                    ←
                  </button>

                  {Array.from({ length: totalMoviePages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, moviePage - 3),
                      Math.min(totalMoviePages, moviePage + 2)
                    )
                    .map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => handleMoviePageChange(page)}
                        style={{
                          background: moviePage === page ? "#fff" : "transparent",
                          color: moviePage === page ? "#000" : "#fff",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          border: "1px solid #444",
                          cursor: "pointer"
                        }}
                      >
                        {page}
                      </button>
                    ))}

                  <button
                    type="button"
                    onClick={() => handleMoviePageChange(moviePage + 1)}
                    disabled={moviePage === totalMoviePages}
                    style={{
                      borderRadius: "8px",
                      padding: "6px 12px",
                      border: "1px solid #444",
                      background: "transparent",
                      color: "#fff",
                      cursor: moviePage === totalMoviePages ? "not-allowed" : "pointer",
                      opacity: moviePage === totalMoviePages ? 0.5 : 1
                    }}
                  >
                    →
                  </button>
                </div>
              </section>
            )}
          </section>
        ) : activeTab === "Watchlist" ? (
          <section style={{ minWidth: 0 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: "1.7rem" }}>My Watchlist</h2>
            {movieWatchlistItems.length === 0 ? (
              <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.72)" }}>No items in watchlist yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px" }}>
                {movieWatchlistItems.map((movie) => (
                  <button
                    key={movie.movieId}
                    type="button"
                    onClick={() => movieHandleSelect({ id: movie.movieId, title: movie.title, poster_path: movie.poster })}
                    className="ui-media-card ui-pressable ui-focus-ring"
                    aria-label={`Open ${movie.title || "watchlist movie"} details`}
                    style={{ border: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px", overflow: "hidden", background: "rgba(13,17,27,0.9)", color: "#fff", textAlign: "left", cursor: "pointer", padding: 0 }}
                  >
                    <SmartImage src={movie.poster ? moviePosterUrl(movie.poster) : ""} alt={movie.title} style={{ width: "100%", aspectRatio: "2 / 3", background: "#151c2a" }} />
                    <div style={{ padding: "10px 12px" }}>
                      <div className="ui-clamp-1" style={{ fontWeight: 700, lineHeight: 1.35, letterSpacing: "0.01em" }}>{movie.title || "Untitled"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : activeTab === "TV Shows" ? (
          <TvShowsHub />
        ) : activeTab === "Anime" ? (
          <AnimeHub />
        ) : activeTab === "Music Hub" ? (
          <MusicHub />
        ) : activeTab === "Student Pulse" ? (
          <StudentPulse />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: activeTab === "Radio" ? "minmax(0, 1fr)" : "minmax(0, 1fr) 380px", gap: "22px" }}>
            <section style={{ minWidth: 0 }}>
              {youtubeError ? (
                <p style={{ color: "#ffb1b1", margin: "0 0 14px" }}>{youtubeError}</p>
              ) : null}
              <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(14,18,28,0.92)" }}>
                {activeVideo ? (
                  <iframe
                    key={`${activeVideo.id.videoId}-${videoShouldAutoplay ? "auto" : "manual"}`}
                    width="100%"
                    style={{ aspectRatio: "16 / 9" }}
                    src={`https://www.youtube.com/embed/${activeVideo.id.videoId}?autoplay=${videoShouldAutoplay ? 1 : 0}`}
                    frameBorder="0"
                    allowFullScreen
                  />
                ) : (
                  <div style={{ aspectRatio: "16 / 9", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.66)" }}>Search for a song to start watching.</div>
                )}
              </div>

              <h1 style={{ marginTop: "18px", marginBottom: "8px", fontSize: "1.75rem" }}>{activeVideo?.snippet?.title || "Now Playing"}</h1>

              <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
                <button
                  type="button"
                  onClick={playVideo}
                  disabled={!activeVideo}
                  style={{
                    border: "none",
                    borderRadius: "14px",
                    background: "#fff",
                    color: "#000",
                    padding: "11px 22px",
                    fontWeight: 700,
                    cursor: activeVideo ? "pointer" : "not-allowed",
                    opacity: activeVideo ? 1 : 0.55
                  }}
                >
                  ▶ Play
                </button>
              </div>

              <div style={{ marginBottom: "26px" }}>
                <div style={{ marginBottom: "12px", color: "rgba(255,255,255,0.64)", fontSize: "0.84rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>Cast & Crew</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {verifiedCredits.musicDirector ? (
                    <button onClick={() => window.open(toWikiUrl(verifiedCredits.musicDirector), "_blank")} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px", background: "rgba(20,24,34,0.9)", color: "#fff", padding: "10px 12px", cursor: "pointer" }}>
                      Music Director • {verifiedCredits.musicDirector}
                    </button>
                  ) : null}
                  {verifiedCredits.singers.map((singer) => (
                    <button key={singer} onClick={() => window.open(toWikiUrl(singer), "_blank")} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px", background: "rgba(20,24,34,0.9)", color: "#fff", padding: "10px 12px", cursor: "pointer" }}>
                      Singer • {singer}
                    </button>
                  ))}
                  {verifiedCredits.movieDirector ? (
                    <button onClick={() => window.open(toWikiUrl(verifiedCredits.movieDirector), "_blank")} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px", background: "rgba(20,24,34,0.9)", color: "#fff", padding: "10px 12px", cursor: "pointer" }}>
                      Movie Director • {verifiedCredits.movieDirector}
                    </button>
                  ) : null}
                </div>
              </div>

              {wikiBio ? (
                <div style={{ background: "rgba(13,17,27,0.95)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px", display: "flex", overflow: "hidden" }}>
                  {(movieArt?.image || wikiBio.image) ? <img src={movieArt?.image || wikiBio.image} alt="Wiki" style={{ width: "220px", objectFit: "cover" }} /> : null}
                  <div style={{ padding: "18px" }}>
                    <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{wikiBio.title || cleanSearchQuery(searchTerm)}</h3>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.74)", lineHeight: 1.55 }}>{wikiBio.summary?.substring(0, 380)}...</p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                      <button onClick={() => window.open(wikiBio.url, "_blank")} style={{ border: "1px solid rgba(255,255,255,0.26)", borderRadius: "12px", background: "transparent", color: "#fff", padding: "8px 12px", cursor: "pointer" }}>Open Wikipedia</button>
                      {movieArt?.url ? <button onClick={() => window.open(movieArt.url, "_blank")} style={{ border: "1px solid rgba(255,255,255,0.26)", borderRadius: "12px", background: "transparent", color: "#fff", padding: "8px 12px", cursor: "pointer" }}>Open Movie Page</button> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {activeTab !== "Radio" && <aside style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontWeight: 700 }}>Recommended</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {videos.map((videoItem) => (
                  <button
                    key={videoItem.id.videoId}
                    type="button"
                    onClick={() => {
                      setActiveVideo(videoItem);
                      setVideoShouldAutoplay(false);
                    }}
                    className="ui-pressable ui-focus-ring"
                    aria-label={`Open ${videoItem?.snippet?.title || "video"}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: "14px",
                      background: "rgba(13,17,27,0.9)",
                      color: "#fff",
                      textAlign: "left",
                      display: "flex",
                      gap: "10px",
                      padding: "8px",
                      cursor: "pointer"
                    }}
                  >
                    <SmartImage src={videoItem.snippet.thumbnails.default.url} alt={videoItem.snippet.title} style={{ width: "122px", borderRadius: "10px", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="ui-clamp-2" style={{ fontSize: "0.83rem", fontWeight: 600, lineHeight: 1.35 }}>{videoItem.snippet.title.substring(0, 62)}...</div>
                      <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.62)", fontSize: "0.76rem" }}>{videoItem.snippet.channelTitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>}
          </div>
        )}
      </main>

      <MovieDetailsModal
        isOpen={movieModalOpen}
        onClose={() => {
          setMovieModalOpen(false);
          setMovieTrailerKey("");
          setMovieModalMovie(null);
        }}
        movie={movieModalMovie}
        movieDetails={movieSelectedDetails}
        movieProviders={movieSelectedProviders}
        trailerKey={movieTrailerKey}
        onPlayTrailer={movieHandlePlayTrailer}
        watchlisted={movieWatchlistIds.includes(movieModalMovie?.id)}
        onToggleWatchlist={movieHandleToggleWatchlist}
        watchlistPop={watchlistPop}
        onDownloadFeedback={handleDownloadFeedback}
        loading={movieModalLoading}
      />

      <GlobalRadioPlayer
        currentStation={currentStation}
        isOpen={miniPlayerOpen}
        isPlaying={isRadioPlaying}
        onTogglePlay={() => setIsRadioPlaying((previous) => !previous)}
        onClose={() => {
          setMiniPlayerOpen(false);
          setIsRadioPlaying(false);
        }}
      />

      <div className="ui-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className="ui-toast">{toast.message}</div>
        ))}
      </div>
    </div>
  );
}

export function ProfileMenu({ user, userData, onLogout, onLogin }) {
  const [isOpen, setIsOpen] = useState(false);
  const [region, setRegion] = useState("United States of America");
  const [themeMode, setThemeMode] = useState("Dark");
  const [profileUserData, setProfileUserData] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    fetch(`http://localhost:5000/api/users/${user.uid}`)
      .then((r) => r.json())
      .then(setProfileUserData)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const themeOptions = ["Light", "Dark", "System"];
  const totalMinutes =
    (profileUserData?.activityLog || [])
      .reduce((sum, d) => sum + (d.minutes || 0), 0);

  return (
    <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label="Open profile settings"
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.28)",
          overflow: "hidden",
          background: user?.photoURL ? "transparent" : "rgba(255,255,255,0.08)",
          color: "#fff",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          fontSize: "1.08rem",
          padding: 0
        }}
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt="profile"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "999px",
              objectFit: "cover"
            }}
          />
        ) : (
          "👤"
        )}
      </button>

      <div
        style={{
          position: "absolute",
          top: "calc(100% + 10px)",
          right: 0,
          width: "min(350px, calc(100vw - 24px))",
          background: "rgba(10,10,15,0.95)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "16px",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          backdropFilter: "blur(14px)",
          padding: "14px",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.96) translateY(-8px)",
          transformOrigin: "top right",
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 220ms ease, transform 220ms ease",
          zIndex: 2500,
          boxSizing: "border-box"
        }}
      >
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.66)", marginBottom: "8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Account</div>
          {user ? (
            <button
              type="button"
              onClick={onLogout}
              style={{
                width: "100%",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "10px 12px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              style={{
                width: "100%",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "10px 12px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Login
            </button>
          )}
        </div>

        {user && (
          <div style={{ marginBottom: "14px" }}>
            <div style={{
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.66)",
              marginBottom: "8px",
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}>
              Activity
            </div>

            <div style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.55)",
              marginBottom: "6px"
            }}>
              {totalMinutes} minutes listened this year
            </div>

            <ActivityHeatmap activityLog={profileUserData?.activityLog || []} />
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.66)", marginBottom: "8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Region</div>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            style={{
              width: "100%",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              padding: "10px 12px",
              outline: "none"
            }}
          >
            <option value="United States of America" style={{ color: "#111" }}>United States of America</option>
            <option value="India" style={{ color: "#111" }}>India</option>
            <option value="United Kingdom" style={{ color: "#111" }}>United Kingdom</option>
            <option value="Canada" style={{ color: "#111" }}>Canada</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.66)", marginBottom: "8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Theme</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
            {themeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setThemeMode(option)}
                style={{
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: "12px",
                  background: themeMode === option ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  padding: "9px 6px",
                  fontWeight: themeMode === option ? 700 : 600,
                  cursor: "pointer"
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityHeatmap({ activityLog = [] }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hoveredKey, setHoveredKey] = useState("");
  const safeLog = activityLog || [];

  const activityMap = useMemo(() => {
    const map = new Map();
    safeLog.forEach((entry) => {
      const key = getLocalDateKey(entry?.date);
      if (!key) return;
      map.set(key, Number(entry?.minutes) || 0);
    });
    return map;
  }, [safeLog]);

  const todayKey = getLocalDateKey();

  const heatmapDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayCells = [];

    for (let dayOffset = 364; dayOffset >= 0; dayOffset -= 1) {
      const dateObject = new Date(today);
      dateObject.setDate(today.getDate() - dayOffset);
      dateObject.setHours(0, 0, 0, 0);

      const dayKey = getLocalDateKey(dateObject);
      const minutes = activityMap.get(dayKey) || 0;
      const isActive = activityMap.has(dayKey);
      const isToday = dayKey === todayKey;

      let bg = "#111827";
      if (isActive) bg = "#16a34a";
      if (isToday && isActive) bg = "#22c55e";

      dayCells.push({
        key: dayKey,
        dateLabel: dateObject.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        }),
        minutes,
        color: bg
      });
    }

    return dayCells;
  }, [activityMap, todayKey]);

  if (!safeLog.length) {
    return (
      <div style={{
        color: "rgba(255,255,255,0.55)",
        fontSize: "0.85rem",
        padding: "10px"
      }}>
        No listening activity yet.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(10,12,18,0.75)",
        padding: "12px",
        boxSizing: "border-box",
        overflowX: "hidden",
        position: "relative"
      }}
    >
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(7, 12px)",
          gridAutoColumns: "12px",
          gap: "3px",
          width: "100%"
        }}
      >
        {heatmapDays.map((dayItem) => (
          <div
            key={dayItem.key}
            onMouseEnter={(event) => {
              setHoveredKey(dayItem.key);
              setHoveredCell({
                x: event.clientX,
                y: event.clientY,
                dateLabel: dayItem.dateLabel,
                minutes: dayItem.minutes
              });
            }}
            onMouseMove={(event) => {
              setHoveredCell((previous) => {
                if (!previous) return previous;
                return {
                  ...previous,
                  x: event.clientX,
                  y: event.clientY
                };
              });
            }}
            onMouseLeave={() => {
              setHoveredCell(null);
              setHoveredKey("");
            }}
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              background: dayItem.color,
              transform: hoveredKey === dayItem.key ? "scale(1.14)" : "scale(1)",
              boxShadow: hoveredKey === dayItem.key ? "0 0 0 1px rgba(255,255,255,0.35), 0 6px 14px rgba(0,0,0,0.35)" : "none",
              filter: hoveredKey === dayItem.key ? "brightness(1.12)" : "brightness(1)",
              transition: "transform 180ms ease, box-shadow 180ms ease, filter 180ms ease",
              cursor: "pointer"
            }}
            title={`${dayItem.dateLabel}: ${dayItem.minutes} minutes`}
          />
        ))}
      </div>

      {hoveredCell && (
        <div
          style={{
            position: "fixed",
            left: hoveredCell.x + 12,
            top: hoveredCell.y - 38,
            background: "rgba(8,10,16,0.96)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            padding: "6px 8px",
            fontSize: "0.76rem",
            color: "#fff",
            pointerEvents: "none",
            zIndex: 5000,
            boxShadow: "0 10px 22px rgba(0,0,0,0.42)",
            whiteSpace: "nowrap"
          }}
        >
          {hoveredCell.dateLabel} • {hoveredCell.minutes} min
        </div>
      )}
    </div>
  );
}

function LandingPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLocalSignIn = (event) => {
    event.preventDefault();
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "radial-gradient(circle at top, rgba(43,56,92,0.22), rgba(0,0,0,0.95) 48%)", fontFamily: "'Inter', 'Roboto', sans-serif", padding: "24px" }}>
      <div className="ui-modal-enter" style={{ width: "min(440px, 100%)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.2)", background: "linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))", backdropFilter: "blur(16px)", boxShadow: "0 24px 54px rgba(0,0,0,0.35)", padding: "22px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "2rem", letterSpacing: "0.05em" }}>LAYAVANI</h1>
        <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,0.72)" }}>Cinematic music and media streaming.</p>

        <button
          onClick={onLogin}
          className="ui-pressable ui-focus-ring"
          style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", background: "#fff", border: "none", color: "#000", fontWeight: 700, fontSize: "0.98rem", cursor: "pointer" }}
        >
          Continue with Google
        </button>

        <div style={{ margin: "14px 0", display: "flex", alignItems: "center", gap: "10px", color: "rgba(255,255,255,0.62)", fontSize: "0.85rem" }}>
          <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.2)" }} />
          <span>or continue with</span>
          <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.2)" }} />
        </div>

        <form onSubmit={handleLocalSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="ui-focus-ring"
            style={{ width: "100%", padding: "11px 12px", borderRadius: "11px", border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)", color: "#fff", marginBottom: "10px", outline: "none" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="ui-focus-ring"
            style={{ width: "100%", padding: "11px 12px", borderRadius: "11px", border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)", color: "#fff", marginBottom: "10px", outline: "none" }}
          />
          <button type="submit" className="ui-pressable ui-focus-ring" style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.26)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Sign In
          </button>
        </form>

        <p style={{ margin: "12px 0 0", fontSize: "0.86rem", color: "rgba(255,255,255,0.72)", textAlign: "center" }}>
          New to Layavani? <button type="button" className="ui-pressable ui-focus-ring" style={{ border: "none", background: "transparent", color: "#fff", textDecoration: "underline", cursor: "pointer", padding: 0 }}>Sign up</button>
        </p>
      </div>
    </div>
  );
}  

export default App;          