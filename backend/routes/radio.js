const express = require("express");
const axios = require("axios");
const RadioCache = require("../models/RadioCache");

const router = express.Router();

const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://fr1.api.radio-browser.info",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_24_HOURS = DAY_MS;
const CACHE_7_DAYS = 7 * DAY_MS;

router.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  next();
});

const normalizeStations = (stations) => {
  if (!Array.isArray(stations)) return [];
  return stations.filter((station) => station?.stationuuid && station?.url_resolved);
};

const fetchFromMirrors = async (path) => {
  try {
    for (const base of MIRRORS) {
      try {
        const response = await axios.get(`${base}${path}`, {
          timeout: 10000,
          headers: {
            "User-Agent": "layavani-radio-backend",
            Accept: "application/json",
          },
        });
        return response.data;
      } catch (error) {
        console.error(`Mirror failed: ${base}${path}`, error);
        continue;
      }
    }

    throw new Error("All radio-browser mirrors failed");
  } catch (error) {
    console.error("fetchFromMirrors error:", error);
    throw error;
  }
};

const getCachedData = async (type, durationMs) => {
  const cached = await RadioCache.findOne({ type }).lean();
  if (!cached?.cachedAt || !Array.isArray(cached.data)) return null;

  const ageMs = Date.now() - new Date(cached.cachedAt).getTime();
  if (ageMs > durationMs) return null;

  console.log(`Serving ${type} from MongoDB cache`);
  return cached.data;
};

const saveCacheData = async (type, data) => {
  await RadioCache.findOneAndUpdate(
    { type },
    {
      type,
      data,
      cachedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

router.get("/stations", async (req, res) => {
  console.log("HIT:", req.path, req.query);
  const offset = Number(req.query.offset || 0);
  const limit = Number(req.query.limit || 100);
  const cacheType = "topstations";

  try {
    let stations = await getCachedData(cacheType, CACHE_24_HOURS);

    if (!stations) {
      console.log(`Fetching fresh ${cacheType} from radio-browser`);
      const fresh = await fetchFromMirrors(`/json/stations/topclick/100?hidebroken=true`);
      stations = normalizeStations(fresh);
      await saveCacheData(cacheType, stations);
    }

    return res.json(stations.slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0)));
  } catch (error) {
    console.error("Stations route failed:", error);
    try {
      const staleCache = await RadioCache.findOne({ type: cacheType }).lean();
      if (Array.isArray(staleCache?.data) && staleCache.data.length > 0) {
        console.log(`Serving stale ${cacheType} cache due to fetch failure`);
        return res.json(staleCache.data.slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0)));
      }
    } catch (cacheError) {
      console.error("Stale cache read failed:", cacheError);
    }
    return res.json([]);
  }
});

router.get("/search", async (req, res) => {
  console.log("HIT:", req.path, req.query);
  const name = String(req.query.name || "").trim();
  const limit = Number(req.query.limit || 50);

  if (!name) {
    return res.json([]);
  }

  try {
    const data = await fetchFromMirrors(
      `/json/stations/search?name=${encodeURIComponent(name)}&hidebroken=true&order=clickcount&reverse=true&limit=${Math.max(limit, 1)}`
    );
    return res.json(normalizeStations(data));
  } catch (error) {
    return res.status(500).json([]);
  }
});

router.get("/country/:code", async (req, res) => {
  console.log("HIT:", req.path, req.query);
  const code = String(req.params.code || "").trim().toLowerCase();
  const limit = Number(req.query.limit || 100);

  if (!code) {
    return res.json([]);
  }

  const cacheType = `country_${code}`;

  try {
    let stations = await getCachedData(cacheType, CACHE_24_HOURS);

    if (!stations) {
      console.log(`Fetching fresh ${cacheType} from radio-browser`);
      const data = await fetchFromMirrors(
        `/json/stations/bycountrycodeexact/${encodeURIComponent(code)}?hidebroken=true&order=clickcount&reverse=true&limit=${Math.max(limit, 1)}`
      );
      stations = normalizeStations(data);
      await saveCacheData(cacheType, stations);
    }

    return res.json(stations.slice(0, Math.max(limit, 0)));
  } catch (error) {
    return res.status(500).json([]);
  }
});

router.get("/language/:lang", async (req, res) => {
  console.log("HIT:", req.path, req.query);
  const lang = String(req.params.lang || "").trim();
  const limit = Number(req.query.limit || 100);

  if (!lang) {
    return res.json([]);
  }

  const cacheType = `language_${lang.toLowerCase()}`;

  try {
    let stations = await getCachedData(cacheType, CACHE_24_HOURS);

    if (!stations) {
      console.log(`Fetching fresh ${cacheType} from radio-browser`);
      const data = await fetchFromMirrors(
        `/json/stations/bylanguage/${encodeURIComponent(lang)}?hidebroken=true&order=clickcount&reverse=true&limit=${Math.max(limit, 1)}`
      );
      stations = normalizeStations(data);
      await saveCacheData(cacheType, stations);
    }

    return res.json(stations.slice(0, Math.max(limit, 0)));
  } catch (error) {
    return res.status(500).json([]);
  }
});

router.get("/countries", async (_req, res) => {
  console.log("HIT:", _req.path, _req.query);
  const cacheType = "countries";

  try {
    let countries = await getCachedData(cacheType, CACHE_7_DAYS);

    if (!countries) {
      console.log(`Fetching fresh ${cacheType} from radio-browser`);
      const data = await fetchFromMirrors(`/json/countries?order=name&hidebroken=true`);
      countries = Array.isArray(data)
        ? data
          .filter((entry) => entry?.iso_3166_1 && entry?.name && Number(entry?.stationcount || 0) > 0)
          .map((entry) => ({
            iso_3166_1: entry.iso_3166_1,
            name: entry.name,
            stationcount: Number(entry.stationcount || 0),
          }))
        : [];
      await saveCacheData(cacheType, countries);
    }

    return res.json(countries);
  } catch (error) {
    return res.status(500).json([]);
  }
});

router.get("/languages", async (_req, res) => {
  console.log("HIT:", _req.path, _req.query);
  const cacheType = "languages";

  try {
    let languages = await getCachedData(cacheType, CACHE_7_DAYS);

    if (!languages) {
      console.log(`Fetching fresh ${cacheType} from radio-browser`);
      const data = await fetchFromMirrors(`/json/languages?order=name&hidebroken=true`);
      languages = Array.isArray(data)
        ? data
          .filter((entry) => entry?.name && Number(entry?.stationcount || 0) > 0)
          .map((entry) => ({
            name: entry.name,
            stationcount: Number(entry.stationcount || 0),
          }))
        : [];
      await saveCacheData(cacheType, languages);
    }

    return res.json(languages);
  } catch (error) {
    return res.status(500).json([]);
  }
});

router.use((err, req, res, _next) => {
  console.error("Radio route error:", err);
  res.status(500).json({ error: err.message });
});

module.exports = router;
