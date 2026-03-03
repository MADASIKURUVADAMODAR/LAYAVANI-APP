import React, { useEffect, useMemo, useRef, useState } from "react";

const fallbackIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='20' fill='%23151c2a'/%3E%3Cpath d='M30 62a18 18 0 1 1 36 0' stroke='%23ffffff' stroke-width='6' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='48' cy='62' r='6' fill='%23ffffff'/%3E%3C/svg%3E";

export default function GlobalRadioPlayer({
  currentStation,
  isOpen,
  isPlaying,
  onTogglePlay,
  onClose
}) {
  const audioRef = useRef(null);
  const [audioError, setAudioError] = useState("");
  const [isBuffering, setIsBuffering] = useState(false);

  const streamUrl = useMemo(
    () => currentStation?.url_resolved || currentStation?.url || "",
    [currentStation]
  );

  // create audio once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.crossOrigin = "anonymous";

    audio.addEventListener("waiting", () => setIsBuffering(true));
    audio.addEventListener("playing", () => setIsBuffering(false));
    audio.addEventListener("error", () => {
      setAudioError("Stream failed. Try another station.");
      setIsBuffering(false);
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // when station changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setAudioError("");

    if (!streamUrl) {
      audio.pause();
      audio.src = "";
      return;
    }

    audio.src = streamUrl;

    if (isPlaying) {
      audio
        .play()
        .then(() => setIsBuffering(false))
        .catch(() => {
          setAudioError("Click play to start stream.");
        });
    }
  }, [streamUrl]);

  // play/pause toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        setAudioError("User interaction required.");
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  if (!currentStation || !isOpen) return null;

  const bitrate =
    Number(currentStation?.bitrate) > 0
      ? `${currentStation.bitrate}kbps`
      : "Unknown";

  return (
    <div
      style={{
        position: "fixed",
        right: "18px",
        bottom: "18px",
        width: "min(360px, calc(100vw - 24px))",
        zIndex: 3000,
        background: "rgba(9,11,18,0.95)",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: "16px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.52)",
        padding: "12px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src={currentStation?.favicon || fallbackIcon}
          onError={(e) => (e.currentTarget.src = fallbackIcon)}
          alt={currentStation?.name || "Station"}
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "12px",
            objectFit: "cover",
            background: "#151c2a"
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              color: "#fff",
              fontSize: "0.95rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {currentStation?.name || "Live Radio"}
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "0.78rem",
              marginTop: "2px"
            }}
          >
            MP3 • {bitrate}
          </div>

          {isBuffering && (
            <div style={{ color: "#8ab4ff", fontSize: "0.72rem" }}>
              Buffering…
            </div>
          )}

          {audioError && (
            <div style={{ color: "#f2a9a9", fontSize: "0.74rem" }}>
              {audioError}
            </div>
          )}
        </div>

        <button
          onClick={onTogglePlay}
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            cursor: "pointer"
          }}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.25)",
            background: "transparent",
            color: "#fff",
            fontSize: "1.1rem",
            cursor: "pointer"
          }}
        >
          
        </button>
      </div>
    </div>
  );
}