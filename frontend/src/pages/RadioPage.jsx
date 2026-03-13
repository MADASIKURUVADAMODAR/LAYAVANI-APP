import React , { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  searchStations,
  searchStationsByName,
  searchByCountry,
  searchByLanguage,
  getCountries,
  getLanguages,
} from "../services/radioService";

const PAGE_SIZE = 100;

const getFlagFromCode = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const first = countryCode.toUpperCase().codePointAt(0);
  const second = countryCode.toUpperCase().codePointAt(1);
  if (!first || !second) return "🌐";
  return String.fromCodePoint(first + 127397) + String.fromCodePoint(second + 127397);
};

export default function RadioPage({ stations, onStationsChange, currentIndex, onSelectIndex }) {
  const [countries, setCountries] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [countryCode, setCountryCode] = useState("ALL");
  const [language, setLanguage] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchName, setSearchName] = useState("");
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchName(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Load countries + languages from radioService (has failover!)
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [countryList, languageList] = await Promise.all([
          getCountries(),
          getLanguages(),
        ]);
        if (!active) return;
        setCountries(countryList);
        setLanguages(languageList);
      } catch {
        if (!active) return;
        setCountries([]);
        setLanguages([]);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const loadStations = useCallback(
    async ({ reset }) => {
      if (isLoading) return;

      const activeRequestId = requestIdRef.current + 1;
      requestIdRef.current = activeRequestId;
      setIsLoading(true);
      setErrorMessage("");

      const nextOffset = reset ? 0 : offset;

      try {
        let incoming = [];

        if (searchName) {
          incoming = await searchStationsByName(searchName, { limit: PAGE_SIZE });
        } else if (countryCode !== "ALL") {
          incoming = await searchByCountry(countryCode, { limit: PAGE_SIZE });
        } else if (language !== "ALL") {
          incoming = await searchByLanguage(language, { limit: PAGE_SIZE });
        } else {
          incoming = await searchStations({ offset: nextOffset, limit: PAGE_SIZE });
        }

        if (requestIdRef.current !== activeRequestId) return;

        onStationsChange((prev) => {
          if (reset) return incoming;
          const existing = new Set(prev.map((s) => s.stationuuid));
          return [...prev, ...incoming.filter((s) => !existing.has(s.stationuuid))];
        });

        setOffset(nextOffset + PAGE_SIZE);
        setHasMore(incoming.length === PAGE_SIZE);
      } catch (err) {
        if (requestIdRef.current !== activeRequestId) return;
        setErrorMessage("Unable to load stations. Please try again.");
        if (reset) onStationsChange([]);
      } finally {
        if (requestIdRef.current === activeRequestId) setIsLoading(false);
      }
    },
    [countryCode, isLoading, language, offset, onStationsChange, searchName]
  );

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    onSelectIndex(-1);
    loadStations({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, language, searchName]);

  const selectedUuid = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= stations.length) return "";
    return stations[currentIndex]?.stationuuid || "";
  }, [stations, currentIndex]);

  return (
    <main className="radio-page">
      <header className="radio-header">
        <div>
          <h1 className="radio-title-main">Live Radio</h1>
          <p className="radio-subtitle">
            Poster-style stations with cinematic browsing.
          </p>
        </div>

        <button
          type="button"
          className="radio-refresh-btn"
          onClick={() => loadStations({ reset: true })}
        >
          Refresh
        </button>
      </header>

      <section className="radio-filters">
        <div className="radio-search-section">
          <div className="radio-search-row">
            <input
              id="name-search"
              className="radio-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by station name"
            />
            <button type="button" className="radio-search-button">Search</button>
          </div>

          <div className="radio-filter-row">
            <select
              id="country-select"
              className="radio-dropdown"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              <option value="ALL">All Countries</option>
              {countries.map((c) => (
                <option key={c.iso_3166_1} value={c.iso_3166_1.toUpperCase()}>
                  {c.name} ({c.stationcount})
                </option>
              ))}
            </select>

            <select
              id="language-select"
              className="radio-dropdown"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ALL">All Languages</option>
              {languages.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({l.stationcount})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="station-results">
        {errorMessage ? <p className="radio-status error">{errorMessage}</p> : null}
        {!errorMessage && isLoading && stations.length === 0 ? (
          <p className="radio-status">Loading stations...</p>
        ) : null}
        {!isLoading && !errorMessage && stations.length === 0 ? (
          <p className="radio-status">No stations found.</p>
        ) : null}

        <div className="radio-grid">
          {stations.map((station, index) => {
            const isActive = selectedUuid === station.stationuuid;

            return (
              <div
                key={station.stationuuid}
                className={`radio-card ${isActive ? "radio-card-active" : ""}`}
                onClick={() => onSelectIndex(index)}
              >
                <div className="radio-card-image">
                  <img
                    src={
                      station.favicon ||
                      "https://cdn-icons-png.flaticon.com/512/727/727245.png"
                    }
                    alt={station.name}
                    loading="lazy"
                  />
                </div>

                <div className="radio-card-info">
                  <h3 className="radio-title">{station.name}</h3>

                  <p className="radio-meta">
                    {getFlagFromCode(station.countrycode)} {station.country || "Unknown"} • {station.language || "Unknown language"}
                  </p>

                  <span className="radio-tags">
                    {station.tags || "No tags"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="radio-pagination">
          {hasMore && (
            <button
              type="button"
              className="radio-load-more"
              onClick={() => loadStations({ reset:false })}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Load More Stations"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}