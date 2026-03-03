const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w780";
const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";

const getApiKey = () => import.meta.env.VITE_TMDB_KEY;

export const fetchTrendingMovies = async ({ page = 1, timeWindow = "week" } = {}) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.error("TMDB API key is missing.");
    return [];
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/trending/movie/${timeWindow}?api_key=${apiKey}&page=${page}`);

    if (!response.ok) {
      throw new Error(`TMDB request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch trending movies:", error);
    return { results: [], page: 1, total_pages: 1 };
  }
};

export const getPosterUrl = (path) => {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

export const searchMovies = async (query, page = 1) => {
  const trimmedQuery = (query || "").trim();
  if (!trimmedQuery) return { results: [], page: 1, total_pages: 1 };

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("TMDB API key is missing.");
    return { results: [], page: 1, total_pages: 1 };
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(trimmedQuery)}&page=${page}`);

    if (!response.ok) {
      throw new Error(`TMDB search failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to search movies:", error);
    return { results: [], page: 1, total_pages: 1 };
  }
};

export const fetchMovieDetails = async (movieId) => {
  if (!movieId) return null;

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("TMDB API key is missing.");
    return null;
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`TMDB movie details failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch movie details:", error);
    return null;
  }
};

export const fetchMovieVideos = async (movieId) => {
  if (!movieId) return { results: [] };

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("TMDB API key is missing.");
    return { results: [] };
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`TMDB movie videos failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch movie videos:", error);
    return { results: [] };
  }
};

export const fetchMovieProviders = async (movieId) => {
  if (!movieId) return { results: {} };

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("TMDB API key is missing.");
    return { results: {} };
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}/watch/providers?api_key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`TMDB movie providers failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch movie providers:", error);
    return { results: {} };
  }
};

export const getBackdropUrl = (path) => {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  return `${TMDB_BACKDROP_BASE_URL}${path}`;
};
