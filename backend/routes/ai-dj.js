const express = require("express");
const router = express.Router();

router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// POST /api/ai-dj/recommend
router.post("/recommend", async (req, res) => {
  try {
    const { mood, languages, timeOfDay, recentSongs, userName } = req.body;
    if (!mood) return res.status(400).json({ error: "mood required" });

    const timeContext = {
      morning: "energetic and fresh start songs",
      afternoon: "upbeat and productive songs",
      evening: "relaxing and soulful songs",
      night: "deep emotional and calm songs"
    }[timeOfDay] || "feel-good songs";

    const recentContext = recentSongs?.length > 0
      ? `User recently listened to: ${recentSongs.slice(0, 5).map(s => `"${s.title}" by ${s.artists}`).join(", ")}.`
      : "";

    const selectedLanguages = languages?.length > 0
      ? languages
      : ["Hindi", "Telugu", "Tamil", "English"];

    const prompt = `You are LAYAVANI DJ, a friendly AI music companion for an Indian music streaming app.

User name: ${userName || "Music Lover"}
Mood: ${mood}
Time of day: ${timeOfDay} (suggest ${timeContext})
${recentContext}

Recommend exactly 3 songs for EACH of these languages: ${selectedLanguages.join(", ")}.

Rules:
- Songs must perfectly match the ${mood} mood
- Include mix of classic and recent songs (2020-2025)
- For each song include: title, artist, reason why it matches mood
- Keep greeting friendly and personalized based on mood and time
- You know Indian music very well - Bollywood, Tollywood, Kollywood etc

Respond in this EXACT JSON format only, no markdown, no extra text:
{
  "greeting": "personalized greeting based on mood and time in 2 sentences",
  "moodEmoji": "single emoji for mood",
  "recommendations": [
    {
      "language": "Hindi",
      "songs": [
        {
          "title": "exact song name",
          "artist": "exact artist name",
          "reason": "why this fits the mood in one sentence",
          "searchQuery": "song name artist name"
        }
      ]
    }
  ]
}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are LAYAVANI DJ, a friendly AI music companion for an Indian music streaming app. You know Indian music very well including Bollywood, Tollywood, Kollywood, Sandalwood and international music. Always respond with valid JSON only, no markdown, no extra text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API error: ${errText}`);
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content || "";

    if (!rawText) throw new Error("Empty response from Groq");

    // Parse JSON from Gemini response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid Gemini response format");

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("AI DJ recommendations generated successfully");
    res.json(parsed);

  } catch (err) {
    console.error("AI DJ error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai-dj/save-mood
router.post("/save-mood", async (req, res) => {
  try {
    const { userId, mood, languages, timeOfDay, songsRecommended } = req.body;
    if (!userId || !mood) return res.status(400).json({ ok: false });

    const User = require("../models/User");
    await User.findOneAndUpdate(
      { userId },
      {
        $push: {
          moodHistory: {
            mood,
            languages,
            timeOfDay,
            songsRecommended,
            timestamp: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Save mood error:", err.message);
    res.json({ ok: false, error: err.message });
  }
});

module.exports = router;
