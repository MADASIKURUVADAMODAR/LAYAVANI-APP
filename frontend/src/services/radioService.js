const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const normalizeStations = (data) => {
  if (!Array.isArray(data)) return [];
  return data.filter((station) => station?.stationuuid && station?.url_resolved);
};

export async function searchStations({ offset = 0, limit = 100 } = {}) {
  try {
    const response = await fetch(`${API_BASE}/api/radio/stations?offset=${offset}&limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    return normalizeStations(data);
  } catch {
    return [];
  }
}

export async function searchStationsByName(name, { limit = 50 } = {}) {
  try {
    const trimmed = String(name || "").trim();
    if (!trimmed) return [];

    const response = await fetch(`${API_BASE}/api/radio/search?name=${encodeURIComponent(trimmed)}&limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    return normalizeStations(data);
  } catch {
    return [];
  }
}

export async function searchByCountry(countryCode, { limit = 100 } = {}) {
  try {
    if (!countryCode) return [];
    const response = await fetch(`${API_BASE}/api/radio/country/${countryCode}?limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    return normalizeStations(data);
  } catch {
    return [];
  }
}

export async function searchByLanguage(language, { limit = 100 } = {}) {
  try {
    if (!language) return [];
    const response = await fetch(`${API_BASE}/api/radio/language/${encodeURIComponent(language)}?limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    return normalizeStations(data);
  } catch {
    return [];
  }
}

export async function getCountries() {
  try {
    const response = await fetch(`${API_BASE}/api/radio/countries`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getLanguages() {
  try {
    const response = await fetch(`${API_BASE}/api/radio/languages`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}