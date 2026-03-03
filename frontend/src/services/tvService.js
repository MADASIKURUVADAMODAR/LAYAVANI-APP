const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w780";
const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";

const getApiKey = () => import.meta.env.VITE_TMDB_KEY;

export const fetchTrendingTvShows = async ({ page = 1, timeWindow = "week" } = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) return { results: [], page: 1, total_pages: 1 };

  try {
    const response = await fetch(`${TMDB_BASE_URL}/trending/tv/${timeWindow}?api_key=${apiKey}&page=${page}`);
    if (!response.ok) throw new Error(`TMDB TV trending failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return { results: [], page: 1, total_pages: 1 };
  }
};

export const searchTvShows = async (query, page = 1) => {
  const trimmed = (query || "").trim();
  if (!trimmed) return { results: [], page: 1, total_pages: 1 };

  const apiKey = getApiKey();
  if (!apiKey) return { results: [], page: 1, total_pages: 1 };

  try {
    const response = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(trimmed)}&page=${page}`);
    if (!response.ok) throw new Error(`TMDB TV search failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return { results: [], page: 1, total_pages: 1 };
  }
};

export const fetchTvDetails = async (tvId) => {
  if (!tvId) return null;
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}?api_key=${apiKey}`);
    if (!response.ok) throw new Error(`TMDB TV details failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return null;
  }
};

export const fetchTvVideos = async (tvId) => {
  if (!tvId) return { results: [] };
  const apiKey = getApiKey();
  if (!apiKey) return { results: [] };

  try {
    const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/videos?api_key=${apiKey}`);
    if (!response.ok) throw new Error(`TMDB TV videos failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return { results: [] };
  }
};

export const fetchTvSeasonEpisodes = async (tvId, seasonNumber = 1) => {
  if (!tvId) return { seasonNumber: Number(seasonNumber) || 1, episodes: [] };
  const apiKey = getApiKey();
  if (!apiKey) return { seasonNumber: Number(seasonNumber) || 1, episodes: [] };

  const normalizedSeason = Math.max(1, Number(seasonNumber) || 1);

  try {
    const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/season/${normalizedSeason}?api_key=${apiKey}`);
    if (!response.ok) throw new Error(`TMDB TV season failed with status ${response.status}`);
    const payload = await response.json();

    const episodes = Array.isArray(payload?.episodes)
      ? payload.episodes.map((episode) => ({
        episodeNumber: Number(episode?.episode_number) || 0,
        name: episode?.name || `Episode ${episode?.episode_number || ""}`.trim(),
        overview: episode?.overview || "",
        still_path: episode?.still_path || "",
        runtime: Number(episode?.runtime) || null
      }))
      : [];

    return {
      seasonNumber: Number(payload?.season_number) || normalizedSeason,
      episodes
    };
  } catch (error) {
    return { seasonNumber: normalizedSeason, episodes: [] };
  }
};

export const getTvPosterUrl = (path) => {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

export const getTvBackdropUrl = (path) => {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  return `${TMDB_BACKDROP_BASE_URL}${path}`;
};
