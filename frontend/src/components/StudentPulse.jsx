import React, { useEffect, useMemo, useRef, useState } from "react";

const CAMPUS_STREAM_URL = "https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one";

const tickerItems = [
  "New Hackathon announced at RVCE • AI City Sprint registrations open",
  "PES University Tech-Fest starts in 3 days • Student volunteers onboarding live",
  "MSRIT Innovation Cell opens midnight prototype challenge",
  "BMSCE Entrepreneurship Club launches startup mentorship week"
];

const opportunities = [
  {
    id: "hack-1",
    title: "Hackathon Blitz",
    subtitle: "48-hour Product Build Challenge",
    accent: "#ff8a00",
    glow: "rgba(255,138,0,0.45)",
    peers: 42,
    targetDate: "2026-03-10T18:30:00+05:30",
    type: "hackathon"
  },
  {
    id: "exam-1",
    title: "Exam Prep Command",
    subtitle: "Major exam timeline and revision checkpoints",
    accent: "#00d27f",
    glow: "rgba(0,210,127,0.4)",
    peers: 58,
    targetDate: "2026-03-20T09:00:00+05:30",
    type: "exam"
  },
  {
    id: "club-1",
    title: "Club Activity Pulse",
    subtitle: "Design, robotics, and coding clubs this weekend",
    accent: "#a45bff",
    glow: "rgba(164,91,255,0.42)",
    peers: 37,
    targetDate: "2026-03-08T11:00:00+05:30",
    type: "club"
  }
];

function formatCountdown(targetDate) {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const dd = String(days).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  return `${dd}d : ${hh}h : ${mm}m`;
}

function useCountdown(targetDate) {
  const [label, setLabel] = useState(() => formatCountdown(targetDate));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLabel(formatCountdown(targetDate));
    }, 1000 * 30);

    return () => clearInterval(intervalId);
  }, [targetDate]);

  return label;
}

function useWaveBars(isPlaying, analyserRef) {
  const [bars, setBars] = useState(() => Array.from({ length: 28 }, () => 8));

  useEffect(() => {
    if (!isPlaying || !analyserRef.current) {
      setBars(Array.from({ length: 28 }, () => 8));
      return undefined;
    }

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const render = () => {
      analyser.getByteFrequencyData(data);
      const next = Array.from({ length: 28 }, (_, index) => {
        const dataIndex = Math.min(data.length - 1, index * 3);
        const value = data[dataIndex] || 0;
        return Math.max(8, Math.round((value / 255) * 48));
      });
      setBars(next);
      rafId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, analyserRef]);

  return bars;
}

function OpportunityCard({ item }) {
  const countdown = useCountdown(item.targetDate);

  return (
    <article
      style={{
        border: `1px solid ${item.accent}`,
        borderRadius: "18px",
        background: "rgba(10,14,24,0.88)",
        boxShadow: `0 0 26px ${item.glow}`,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minHeight: "220px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {item.type === "hackathon" ? (
        <button
          type="button"
          aria-label="Sponsor Mentor Connect"
          title="Sponsor / Mentor Connect"
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            border: "1px solid rgba(255,255,255,0.24)",
            background: "rgba(255,255,255,0.08)",
            color: "#e9edf8",
            borderRadius: "10px",
            width: "32px",
            height: "32px",
            cursor: "pointer"
          }}
        >
          🤝
        </button>
      ) : null}

      <div style={{ fontWeight: 800, fontSize: "1.02rem", letterSpacing: "0.01em", paddingRight: item.type === "hackathon" ? "36px" : 0 }}>{item.title}</div>
      <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.9rem", lineHeight: 1.4 }}>{item.subtitle}</div>

      <div style={{ marginTop: "4px", border: `1px solid ${item.accent}`, borderRadius: "12px", padding: "8px 10px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700 }}>
        {countdown}
      </div>

      <div style={{ color: "#ffcf8d", fontWeight: 700 }}>🔥 {item.peers} students interested</div>

      <button
        type="button"
        style={{
          marginTop: "auto",
          border: "none",
          borderRadius: "12px",
          padding: "10px 14px",
          color: "#0a0f1b",
          fontWeight: 800,
          cursor: "pointer",
          background: "linear-gradient(90deg, #ffd780 0%, #ffa24b 55%, #ff6f91 100%)",
          boxShadow: "0 0 18px rgba(255,170,88,0.65)"
        }}
      >
        Register Now
      </button>
    </article>
  );
}

function StudentPulse() {
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const bars = useWaveBars(isPlaying, analyserRef);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const setupAudioGraph = async () => {
    if (!audioRef.current) return;
    if (analyserRef.current) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.88;

    const sourceNode = context.createMediaElementSource(audioRef.current);
    sourceNode.connect(analyser);
    analyser.connect(context.destination);

    audioContextRef.current = context;
    analyserRef.current = analyser;
    sourceNodeRef.current = sourceNode;
  };

  const togglePlayer = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await setupAudioGraph();
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const tickerText = useMemo(() => `${tickerItems.join("   ✦   ")}   ✦   ${tickerItems.join("   ✦   ")}`, []);

  return (
    <section className="student-pulse" style={{ minWidth: 0, position: "relative", paddingBottom: "84px" }}>
      <style>
        {`@keyframes pulse-glow { 0% { opacity: 0.8; } 50% { opacity: 1; } 100% { opacity: 0.8; } }
          @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}
      </style>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: "20px",
          background: "linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03))",
          backdropFilter: "blur(10px)",
          padding: "18px",
          marginBottom: "16px",
          boxShadow: "0 12px 30px rgba(0,0,0,0.36)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.85rem", letterSpacing: "0.03em" }}>Campus Pulse</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255,98,98,0.72)", borderRadius: "999px", padding: "5px 11px", background: "rgba(255,90,90,0.16)", color: "#ffd0d0", fontWeight: 800, animation: "pulse-glow 1.4s ease-in-out infinite" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: "#ff5b5b", boxShadow: "0 0 10px rgba(255,91,91,0.8)" }} />
            LIVE
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: "18px",
          background: "rgba(11,15,25,0.92)",
          padding: "16px",
          marginBottom: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>Campus FM</div>
            <div style={{ marginTop: "3px", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>Live student radio, updates, and event highlights</div>
          </div>
          <button
            type="button"
            onClick={togglePlayer}
            style={{
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: "12px",
              background: isPlaying ? "rgba(255,255,255,0.12)" : "#ffffff",
              color: isPlaying ? "#fff" : "#070b14",
              padding: "10px 16px",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <div style={{ marginTop: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", padding: "10px", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "end", gap: "4px", height: "72px" }}>
          {bars.map((height, index) => (
            <span
              key={`${index}-${height}`}
              style={{
                width: "calc((100% - 108px) / 28)",
                minWidth: "6px",
                height: `${height}px`,
                borderRadius: "8px",
                background: "linear-gradient(180deg, #67f5ff 0%, #8f7bff 55%, #ff7fc5 100%)",
                boxShadow: "0 0 8px rgba(136,124,255,0.45)",
                transition: "height 120ms linear"
              }}
            />
          ))}
        </div>

        <audio ref={audioRef} src={CAMPUS_STREAM_URL} preload="none" onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />
      </div>

      <div style={{ marginBottom: "10px", fontSize: "0.83rem", color: "rgba(255,255,255,0.62)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
        Opportunity Engine
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
        {opportunities.map((item) => (
          <OpportunityCard key={item.id} item={item} />
        ))}
      </div>

      <div
        className="ticker-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          borderTop: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(8,11,18,0.94)",
          height: "42px",
          overflow: "hidden",
          zIndex: 2000
        }}
      >
        <div
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            minWidth: "200%",
            paddingTop: "10px",
            color: "rgba(222,231,255,0.95)",
            fontSize: "0.86rem",
            letterSpacing: "0.02em",
            animation: "ticker-scroll 28s linear infinite"
          }}
        >
          {tickerText}
        </div>
      </div>
    </section>
  );
}

export default StudentPulse;
