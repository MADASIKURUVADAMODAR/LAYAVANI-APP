import React, { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const MOODS = [
  { id: "happy", label: "Happy", emoji: "😊", color: "#FFD700" },
  { id: "sad", label: "Sad", emoji: "😢", color: "#60A5FA" },
  { id: "motivated", label: "Motivated", emoji: "💪", color: "#34D399" },
  { id: "romantic", label: "Romantic", emoji: "💕", color: "#F472B6" },
  { id: "party", label: "Party", emoji: "🔥", color: "#FB923C" },
  { id: "chill", label: "Chill", emoji: "😌", color: "#A78BFA" },
  { id: "focus", label: "Focus", emoji: "🎯", color: "#22D3EE" },
  { id: "nostalgic", label: "Nostalgic", emoji: "🌙", color: "#FBBF24" },
];

const LANGUAGES = [
  { id: "Hindi", label: "Hindi", flag: "🎬" },
  { id: "Telugu", label: "Telugu", flag: "🎭" },
  { id: "Tamil", label: "Tamil", flag: "🎪" },
  { id: "English", label: "English", flag: "🎵" },
  { id: "Punjabi", label: "Punjabi", flag: "🥁" },
  { id: "Kannada", label: "Kannada", flag: "🎶" },
];

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getTimeGreeting() {
  const tod = getTimeOfDay();
  return {
    morning: "Good Morning! ☀️",
    afternoon: "Good Afternoon! 🌤️",
    evening: "Good Evening! 🌆",
    night: "Good Night! 🌙"
  }[tod];
}

export default function AiDj({ user, recentSongs = [], onPlaySong }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("mood");
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [moodEmoji, setMoodEmoji] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasNotification, setHasNotification] = useState(true);
  const panelRef = useRef(null);

  const userName = user?.displayName?.split(" ")?.[0] || "Music Lover";
  const timeOfDay = getTimeOfDay();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (!panelRef.current?.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNotification(false);
    setStep("mood");
    setSelectedMood(null);
    setSelectedLanguages([]);
    setRecommendations(null);
    setError("");
  };

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
    setStep("language");
  };

  const toggleLanguage = (lang) => {
    setSelectedLanguages(prev =>
      prev.includes(lang.id)
        ? prev.filter(l => l !== lang.id)
        : [...prev, lang.id]
    );
  };

  const handleGetRecommendations = async () => {
    const langs = selectedLanguages.length > 0
      ? selectedLanguages
      : ["Hindi", "Telugu", "Tamil", "English"];

    setStep("loading");
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/ai-dj/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selectedMood.id,
          languages: langs,
          timeOfDay,
          recentSongs: recentSongs.slice(0, 5),
          userName
        })
      });

      if (!res.ok) throw new Error("Recommendation failed");
      const data = await res.json();

      setGreeting(data.greeting || `Hey ${userName}! Here are your ${selectedMood.label} songs!`);
      setMoodEmoji(data.moodEmoji || selectedMood.emoji);
      setRecommendations(data.recommendations || []);
      setStep("results");

      if (user?.uid) {
        fetch(`${API_BASE}/api/ai-dj/save-mood`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            mood: selectedMood.id,
            languages: langs,
            timeOfDay,
            songsRecommended: data.recommendations?.flatMap(r => r.songs) || []
          })
        }).catch(() => {});
      }

    } catch (err) {
      console.error("AI DJ error:", err);
      setError("Couldn't get recommendations. Please try again.");
      setStep("language");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayRecommended = (song) => {
    if (onPlaySong) {
      onPlaySong({
        title: song.title,
        artists: song.artist,
        id: `ai-${song.title}-${Date.now()}`,
        image: "",
        preview: "",
        duration: 0
      });
    }
    setIsOpen(false);
  };

  const handleReset = () => {
    setStep("mood");
    setSelectedMood(null);
    setSelectedLanguages([]);
    setRecommendations(null);
    setError("");
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>

      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          title="Chat with LYRA - Your AI Music Guide"
          style={{
            height: "46px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.2)",
            cursor: "pointer",
            background: "rgba(10,10,10,0.95)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center",
            gap: "8px", padding: "0 16px 0 12px",
            position: "relative",
            transition: "all 0.2s ease"
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = "rgba(30,30,30,0.98)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.7)";
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = "rgba(10,10,10,0.95)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.6)";
          }}
        >
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "grid", placeItems: "center",
            fontSize: "0.9rem", flexShrink: 0
          }}>🎧</div>
          <div style={{ textAlign: "left" }}>
            <div style={{
              fontSize: "0.72rem", fontWeight: 800,
              color: "#fff", letterSpacing: "0.06em",
              lineHeight: 1.2
            }}>LYRA</div>
            <div style={{
              fontSize: "0.6rem", color: "rgba(255,255,255,0.45)",
              lineHeight: 1.2
            }}>AI Music Guide</div>
          </div>
          {hasNotification && (
            <div style={{
              position: "absolute", top: "-4px", right: "-4px",
              width: "14px", height: "14px", borderRadius: "50%",
              background: "#fff", border: "2px solid #000",
              display: "grid", placeItems: "center",
              fontSize: "0.55rem", fontWeight: 800, color: "#000"
            }}>1</div>
          )}
        </button>
      )}

      {/* AI DJ Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            width: "340px",
            maxHeight: "88vh",
            overflowY: "auto",
            borderRadius: "20px",
            border: "1px solid rgba(29,185,84,0.25)",
            background: "rgba(6,8,14,0.98)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(29,185,84,0.1)",
            color: "#fff",
            scrollbarWidth: "none"
          }}
        >
          {/* Header */}
          <div style={{
            padding: "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, rgba(29,185,84,0.12), transparent)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "grid", placeItems: "center", fontSize: "1.2rem"
              }}>🎧</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.92rem", letterSpacing: "0.02em" }}>
                  LYRA
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)" }}>
                  Your AI Music Guide ✦
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: "none", background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)", fontSize: "0.9rem",
                cursor: "pointer", borderRadius: "8px",
                width: "28px", height: "28px",
                display: "grid", placeItems: "center"
              }}
            >✕</button>
          </div>

          <div style={{ padding: "16px" }}>

            {/* STEP 1: Mood */}
            {step === "mood" && (
              <div>
                <div style={{
                  fontSize: "0.88rem", color: "rgba(255,255,255,0.7)",
                  marginBottom: "14px", lineHeight: 1.5
                }}>
                  🎵 Hey {userName}! How are you feeling right now?
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "8px"
                }}>
                  {MOODS.map(mood => (
                    <button
                      key={mood.id}
                      onClick={() => handleMoodSelect(mood)}
                      style={{
                        border: `1px solid ${mood.color}33`,
                        borderRadius: "12px",
                        background: `${mood.color}0d`,
                        color: "#fff",
                        padding: "11px 10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        transition: "all 0.15s ease",
                        textAlign: "left"
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = `${mood.color}22`;
                        e.currentTarget.style.borderColor = `${mood.color}66`;
                        e.currentTarget.style.transform = "scale(1.02)";
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = `${mood.color}0d`;
                        e.currentTarget.style.borderColor = `${mood.color}33`;
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <span style={{ fontSize: "1.3rem" }}>{mood.emoji}</span>
                      <span style={{ color: mood.color }}>{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Language */}
            {step === "language" && selectedMood && (
              <div>
                <div style={{
                  display: "flex", alignItems: "center",
                  gap: "8px", marginBottom: "14px"
                }}>
                  <button
                    onClick={() => setStep("mood")}
                    style={{
                      border: "none", background: "transparent",
                      color: "rgba(255,255,255,0.45)", cursor: "pointer",
                      fontSize: "0.8rem", padding: 0
                    }}
                  >← Back</button>
                  <div style={{
                    background: `${selectedMood.color}15`,
                    border: `1px solid ${selectedMood.color}33`,
                    borderRadius: "999px",
                    padding: "4px 10px",
                    fontSize: "0.8rem",
                    color: selectedMood.color
                  }}>
                    {selectedMood.emoji} {selectedMood.label}
                  </div>
                </div>

                <div style={{
                  fontSize: "0.88rem", color: "rgba(255,255,255,0.7)",
                  marginBottom: "12px"
                }}>
                  Which music do you vibe with?
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "8px", marginBottom: "14px"
                }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => toggleLanguage(lang)}
                      style={{
                        border: selectedLanguages.includes(lang.id)
                          ? "1px solid #1DB954"
                          : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        background: selectedLanguages.includes(lang.id)
                          ? "rgba(29,185,84,0.15)"
                          : "rgba(255,255,255,0.04)",
                        color: "#fff",
                        padding: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: 600,
                        fontSize: "0.83rem",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                      {selectedLanguages.includes(lang.id) && (
                        <span style={{
                          marginLeft: "auto", color: "#1DB954",
                          fontSize: "0.8rem"
                        }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>

                <div style={{
                  fontSize: "0.73rem", color: "rgba(255,255,255,0.35)",
                  textAlign: "center", marginBottom: "12px"
                }}>
                  {selectedLanguages.length === 0
                    ? "Skip to get all languages"
                    : `${selectedLanguages.length} selected`}
                </div>

                {error && (
                  <div style={{
                    color: "#ffb1b1", fontSize: "0.8rem",
                    marginBottom: "10px", textAlign: "center"
                  }}>{error}</div>
                )}

                <button
                  onClick={handleGetRecommendations}
                  style={{
                    width: "100%", border: "none",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.95)",
                    color: "#000", padding: "13px",
                    fontWeight: 700, fontSize: "0.92rem",
                    cursor: "pointer"
                  }}
                >
                  🎵 Get My Songs
                </button>
              </div>
            )}

            {/* STEP 3: Loading */}
            {step === "loading" && (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <div style={{ fontSize: "2.8rem", marginBottom: "14px" }}>🎧</div>
                <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "0.95rem" }}>
                  Finding your perfect songs...
                </div>
                <div style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "0.8rem", marginBottom: "20px"
                }}>
                  Gemini AI is curating {selectedMood?.label?.toLowerCase()} songs
                  for your {timeOfDay}...
                </div>
                <div style={{
                  display: "flex", justifyContent: "center", gap: "6px"
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: "#1DB954",
                      animation: `bounce 1s ${i * 0.15}s infinite ease-in-out`
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: Results */}
            {step === "results" && recommendations && (
              <div>
                {/* AI Greeting */}
                <div style={{
                  background: "rgba(29,185,84,0.08)",
                  border: "1px solid rgba(29,185,84,0.18)",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  fontSize: "0.85rem",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.85)"
                }}>
                  {moodEmoji} {greeting}
                </div>

                {/* Songs by language */}
                {recommendations.map((rec, i) => (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "0.7rem",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginBottom: "8px", fontWeight: 700,
                      display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      {LANGUAGES.find(l => l.id === rec.language)?.flag || "🎵"}
                      {rec.language}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {rec.songs?.map((song, j) => (
                        <button
                          key={j}
                          onClick={() => handlePlayRecommended(song)}
                          style={{
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.03)",
                            color: "#fff", padding: "10px 12px",
                            textAlign: "left", cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.background = "rgba(29,185,84,0.1)";
                            e.currentTarget.style.borderColor = "rgba(29,185,84,0.35)";
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start", gap: "8px"
                          }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontWeight: 700, fontSize: "0.83rem",
                                whiteSpace: "nowrap", overflow: "hidden",
                                textOverflow: "ellipsis"
                              }}>{song.title}</div>
                              <div style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "0.73rem", marginTop: "2px"
                              }}>{song.artist}</div>
                            </div>
                            <span style={{
                              color: "#1DB954", fontSize: "0.85rem", flexShrink: 0
                            }}>▶</span>
                          </div>
                          {song.reason && (
                            <div style={{
                              marginTop: "5px", fontSize: "0.7rem",
                              color: "rgba(255,255,255,0.32)", lineHeight: 1.4
                            }}>{song.reason}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleReset}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px", background: "transparent",
                    color: "rgba(255,255,255,0.55)", padding: "10px",
                    cursor: "pointer", fontWeight: 600,
                    fontSize: "0.82rem", marginTop: "4px"
                  }}
                >
                  🔄 Try Different Mood
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-8px); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
