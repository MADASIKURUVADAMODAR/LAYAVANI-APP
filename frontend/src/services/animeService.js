const JIKAN_BASE_URL = "https://api.jikan.moe/v4";

const safeArray = (value) => (Array.isArray(value) ? value : []);

export const fetchAnimeList = async ({ page = 1 } = {}) => {
  try {
    const response = await fetch(`${JIKAN_BASE_URL}/anime?page=${page}&order_by=score&sort=desc`);
    if (!response.ok) throw new Error(`Anime list failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return { data: [], pagination: { current_page: 1, has_next_page: false } };
  }
};

export const searchAnime = async (query, page = 1) => {
  const trimmed = (query || "").trim();
  if (!trimmed) return { data: [], pagination: { current_page: 1, has_next_page: false } };

  try {
    const response = await fetch(`${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(trimmed)}&page=${page}&order_by=score&sort=desc`);
    if (!response.ok) throw new Error(`Anime search failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return { data: [], pagination: { current_page: 1, has_next_page: false } };
  }
};

export const fetchAnimeDetails = async (malId) => {
  if (!malId) return null;
  try {
    const response = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/full`);
    if (!response.ok) throw new Error(`Anime details failed with status ${response.status}`);
    const payload = await response.json();
    return payload?.data || null;
  } catch (error) {
    return null;
  }
};

export const fetchAnimeSeasonEpisodes = async (malId, seasonNumber = 1) => {
  if (!malId) return { seasonNumber: Number(seasonNumber) || 1, episodes: [] };

  const normalizedSeason = Math.max(1, Number(seasonNumber) || 1);
  if (normalizedSeason !== 1) {
    return { seasonNumber: normalizedSeason, episodes: [] };
  }

  try {
    let page = 1;
    let hasNextPage = true;
    const episodes = [];

    while (hasNextPage && page <= 6) {
      const response = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/episodes?page=${page}`);
      if (!response.ok) throw new Error(`Anime episodes failed with status ${response.status}`);

      const payload = await response.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];

      items.forEach((episode) => {
        const episodeNumber = episodes.length + 1;
        episodes.push({
          episodeNumber,
          name: episode?.title || `Episode ${episodeNumber}`,
          overview: episode?.synopsis || "",
          still_path: episode?.images?.jpg?.image_url || episode?.images?.webp?.image_url || "",
          runtime: Number(episode?.duration) || null
        });
      });

      hasNextPage = Boolean(payload?.pagination?.has_next_page);
      page += 1;
    }

    return {
      seasonNumber: 1,
      episodes
    };
  } catch (error) {
    return { seasonNumber: normalizedSeason, episodes: [] };
  }
};

export const getAnimePosterUrl = (anime) => {
  return anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || "";
};

export const getAnimeBackdropUrl = (anime) => {
  return anime?.trailer?.images?.maximum_image_url || anime?.trailer?.images?.large_image_url || anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || "";
};

export const getAnimeGenres = (anime) => safeArray(anime?.genres).map((genre) => genre?.name).filter(Boolean);

export const getAnimeStudios = (anime) => safeArray(anime?.studios).map((studio) => studio?.name).filter(Boolean);
