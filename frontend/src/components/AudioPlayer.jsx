import { useEffect, useMemo, useRef, useState } from "react";

const getDisplayText = (value, fallback) => {
  if (!value) return fallback;
  return String(value).trim() || fallback;
};

export default function AudioPlayer({ stations, currentIndex, onChangeIndex }) {
  const audioRef = useRef(null);
  const failedIndicesRef = useRef(new Set());

  const [isPlaying, setIsPlaying] = useState(false);

  const currentStation = useMemo(() => {
    if (!Array.isArray(stations)) return null;
    if (currentIndex < 0 || currentIndex >= stations.length) return null;
    return stations[currentIndex] || null;
  }, [stations, currentIndex]);

  useEffect(() => {
    failedIndicesRef.current.clear();
  }, [stations]);

  const playNextStation = (fromIndex = currentIndex) => {
    if (!Array.isArray(stations) || stations.length === 0) return;

    const maxAttempts = stations.length;
    let attempts = 0;
    let candidate = fromIndex + 1;

    while (attempts < maxAttempts) {
      if (candidate >= stations.length) {
        candidate = 0;
      }

      if (!failedIndicesRef.current.has(candidate) && stations[candidate]?.url_resolved) {
        onChangeIndex(candidate);
        return;
      }

      candidate += 1;
      attempts += 1;
    }
  };

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (!currentStation?.url_resolved) {
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
      setIsPlaying(false);
      return;
    }

    audioElement.src = currentStation.url_resolved;
    audioElement
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setIsPlaying(false);
        if (currentIndex >= 0) {
          failedIndicesRef.current.add(currentIndex);
        }
        playNextStation(currentIndex);
      });
  }, [currentStation, currentIndex, onChangeIndex, stations]);

  const handleError = () => {
    if (currentIndex >= 0) {
      failedIndicesRef.current.add(currentIndex);
    }
    playNextStation(currentIndex);
  };

  const stationName = getDisplayText(currentStation?.name, "No station selected");
  const stationCountry = getDisplayText(currentStation?.country, "Unknown country");
  const stationLanguage = getDisplayText(currentStation?.language, "Unknown language");

  return (
    <div className="global-player">
      <div className="global-player-info">
        <strong className="global-player-title">{stationName}</strong>
        <span className="global-player-meta">{stationCountry}</span>
        <span className="global-player-meta">{stationLanguage}</span>
      </div>

      <audio
        ref={audioRef}
        controls
        onError={handleError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <span className="global-player-status">{isPlaying ? "Live" : "Idle"}</span>
    </div>
  );
}
