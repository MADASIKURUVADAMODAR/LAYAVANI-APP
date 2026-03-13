require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const axios = require("axios");
const radioRouter = require("./routes/radio");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const MONGODB_URI = process.env.MONGODB_URI;

/* ========================
   MIDDLEWARE
======================== */

app.use(helmet());
app.use(compression());
app.use(morgan("combined"));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/radio", radioRouter);
const musicRouter = require("./routes/music");
app.use("/api/music", musicRouter);
const aiDjRouter = require("./routes/ai-dj");
app.use("/api/ai-dj", aiDjRouter);

/* ========================
   RADIO SERVER POOL
======================== */

const RADIO_SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
  "https://fr1.api.radio-browser.info",
];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

async function fetchFromRadioBrowser(path) {
  const servers = shuffle(RADIO_SERVERS);

  for (const base of servers) {
    try {
      const res = await axios.get(`${base}${path}`, {
        timeout: 8000,
        headers: {
          "User-Agent": "layavani-radio-backend",
        },
      });

      return res.data;
    } catch (err) {
      continue;
    }
  }

  throw new Error("All radio servers failed");
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeToDay(date) {
  const d = new Date(date);
  return new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

const getLocalDateKey = (input) => {
  const d = new Date(input);

  const local = new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayDiffLocal = (laterDate, earlierDate) => {
  const later = normalizeToDay(new Date(laterDate)).getTime();
  const earlier = normalizeToDay(new Date(earlierDate)).getTime();
  return Math.round((later - earlier) / MS_PER_DAY);
};

/* ========================
   FAVORITES MODEL
======================== */

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    videoId: { type: String, required: true },
    video: { type: Object, required: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ userId: 1, videoId: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);

/* ========================
   WATCHLIST MODEL
======================== */

const watchlistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    movieId: { type: Number, required: true },
    title: { type: String, required: true },
    poster: { type: String, default: "" },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

watchlistSchema.index({ userId: 1, movieId: 1 }, { unique: true });

const Watchlist = mongoose.model("Watchlist", watchlistSchema);

/* ========================
   HEALTH CHECKS
======================== */

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "LayaVani API" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "LayaVani API" });
});

/* ========================
   USER SYNC (🔥 IMPORTANT)
======================== */

app.post("/api/users/sync", async (req, res) => {
  try {
    const { userId, name, email, photoURL } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const user = await User.findOneAndUpdate(
      { userId },
      {
        userId,
        name,
        email,
        photoURL,
        lastLogin: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, user });
  } catch (err) {
    console.error("User sync failed", err);
    res.status(500).json({ error: "User sync failed" });
  }
});

app.get("/api/users/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId }).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

/* ========================
   USER ACTIVITY (🔥 STREAK)
======================== */

app.post("/api/users/activity", async (req, res) => {
  const { userId, type, movieId, timestamp, localDate } = req.body;

  if (type) {
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const allowedTypes = new Set(["movie_like", "movie_view", "trailer_play"]);
    if (!allowedTypes.has(type)) {
      return res.status(400).json({ error: "invalid activity type" });
    }

    try {
      await User.updateOne(
        { userId },
        {
          $setOnInsert: {
            userId,
            activityLog: [],
            totalListeningMinutes: 0,
            totalActiveDays: 0,
            currentStreak: 0,
            longestStreak: 0,
            movieEvents: [],
          },
          $push: {
            movieEvents: {
              type,
              movieId: Number(movieId) || 0,
              timestamp: timestamp ? new Date(timestamp) : new Date(),
            },
          },
          $set: {
            lastLogin: new Date(),
          },
        },
        { upsert: true }
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error("Movie activity update failed", err);
      return res.status(500).json({ error: "Movie activity update failed" });
    }
  }

  const numericMinutes = Number(req.body.minutes);

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  if (!Number.isFinite(numericMinutes)) {
    return res.status(400).json({ error: "minutes must be a number" });
  }

  if (numericMinutes <= 0) {
    return res.status(400).json({ error: "minutes must be > 0" });
  }

  const minutes = numericMinutes;

  try {
    const now = new Date();
    const fallbackActivityDate = timestamp ? new Date(timestamp) : new Date(Date.now());
    const activityDate = localDate ? new Date(localDate) : fallbackActivityDate;
    const today = normalizeToDay(activityDate);
    const todayKey = getLocalDateKey(today);

    await User.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          activityLog: [],
          totalListeningMinutes: 0,
          totalActiveDays: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
      },
      { upsert: true }
    );

    const startOfDay = normalizeToDay(today);
    const endOfDay = new Date(startOfDay.getTime() + MS_PER_DAY);

    const bumpToday = await User.updateOne(
      {
        userId,
        "activityLog.date": {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      },
      {
        $inc: {
          "activityLog.$.minutes": minutes,
          totalListeningMinutes: minutes,
        },
        $set: {
          lastLogin: now,
          updatedAt: now,
        },
      }
    );

    if (bumpToday.modifiedCount === 0) {
      let attempts = 0;

      while (attempts < 3) {
        attempts += 1;

        const user = await User.findOne({ userId }).lean();
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const alreadyHasToday = (user.activityLog || []).some(
          (entry) => getLocalDateKey(entry.date) === todayKey
        );

        if (alreadyHasToday) {
          await User.updateOne(
            { userId, "activityLog.date": today },
            {
              $inc: {
                "activityLog.$.minutes": minutes,
                totalListeningMinutes: minutes,
              },
              $set: {
                lastLogin: now,
                updatedAt: now,
              },
            }
          );
          break;
        }

        const lastActiveDate = user.lastActiveDate ? normalizeToDay(new Date(user.lastActiveDate)) : null;
        const diffDays = lastActiveDate ? getDayDiffLocal(today, lastActiveDate) : null;

        let nextCurrentStreak = user.currentStreak || 0;
        let activeDayIncrement = 0;
        let nextLastActiveDate = user.lastActiveDate || null;

        if (!lastActiveDate) {
          nextCurrentStreak = 1;
          activeDayIncrement = 1;
          nextLastActiveDate = today;
        } else if (diffDays === 1) {
          nextCurrentStreak = (user.currentStreak || 0) + 1;
          activeDayIncrement = 1;
          nextLastActiveDate = today;
        } else if (diffDays > 1) {
          nextCurrentStreak = 1;
          activeDayIncrement = 1;
          nextLastActiveDate = today;
        }

        const nextLongestStreak = Math.max(user.longestStreak || 0, nextCurrentStreak || 0);

        const casFilter = {
          _id: user._id,
          userId,
          "activityLog.date": { $ne: today },
          lastActiveDate: user.lastActiveDate || null,
        };

        const casUpdate = {
          $push: { activityLog: { date: today, minutes } },
          $inc: {
            totalListeningMinutes: minutes,
            totalActiveDays: activeDayIncrement,
          },
          $set: {
            currentStreak: nextCurrentStreak,
            longestStreak: nextLongestStreak,
            lastLogin: now,
            updatedAt: now,
            ...(activeDayIncrement > 0
              ? {
                  lastActiveDate: nextLastActiveDate,
                  lastStreakUpdateDate: today,
                }
              : {}),
          },
        };

        const casResult = await User.updateOne(casFilter, casUpdate);
        if (casResult.modifiedCount > 0) {
          break;
        }
      }
    }

    const latest = await User.findOne({ userId }).lean();

    console.log("✅ Activity updated:", {
      userId,
      today: todayKey,
    });

    return res.json({
      ok: true,
      streak: latest?.currentStreak || 0,
      longestStreak: latest?.longestStreak || 0,
      totalActiveDays: latest?.totalActiveDays || 0,
      totalListeningMinutes: latest?.totalListeningMinutes || 0,
      lastActiveDate: latest?.lastActiveDate || null,
    });
  } catch (err) {
    console.error("Activity update failed", err);
    return res.status(500).json({ error: "Activity update failed" });
  }
});

/* ========================
   FAVORITES ROUTES
======================== */

app.get("/api/favorites", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const favorites = await Favorite.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      favorites: favorites.map((entry) => entry.video),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

app.post("/api/favorites", async (req, res) => {
  const { userId, video } = req.body;

  if (!userId || !video?.id?.videoId) {
    return res
      .status(400)
      .json({ error: "userId and valid video payload are required" });
  }

  try {
    const saved = await Favorite.findOneAndUpdate(
      { userId, videoId: video.id.videoId },
      { userId, videoId: video.id.videoId, video },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(201).json({ favorite: saved.video });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save favorite" });
  }
});

app.delete("/api/favorites/:videoId", async (req, res) => {
  const { userId } = req.query;
  const { videoId } = req.params;

  if (!userId || !videoId) {
    return res
      .status(400)
      .json({ error: "userId and videoId are required" });
  }

  try {
    await Favorite.deleteOne({ userId, videoId });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to remove favorite" });
  }
});

/* ========================
   WATCHLIST ROUTES
======================== */

app.post("/api/watchlist/toggle", async (req, res) => {
  const { userId, movieId, title, poster } = req.body;

  if (!userId || !movieId || !title) {
    return res.status(400).json({ error: "userId, movieId and title are required" });
  }

  try {
    const existing = await Watchlist.findOne({ userId, movieId }).lean();

    if (existing) {
      await Watchlist.deleteOne({ userId, movieId });
      return res.json({ ok: true, added: false });
    }

    const created = await Watchlist.create({
      userId,
      movieId,
      title,
      poster: poster || "",
      addedAt: new Date(),
    });

    return res.json({ ok: true, added: true, item: created });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle watchlist" });
  }
});

app.get("/api/watchlist/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const items = await Watchlist.find({ userId }).sort({ addedAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

/* ========================
   RADIO ROUTES
======================== */

app.get("/api/radio/top", async (req, res) => {
  try {
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 100);

    const data = await fetchFromRadioBrowser(
      `/json/stations/topclick/${limit}?offset=${offset}`
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

app.get("/api/radio/search", async (req, res) => {
  try {
    const name = req.query.name || "";

    const data = await fetchFromRadioBrowser(
      `/json/stations/search?name=${encodeURIComponent(name)}&limit=50`
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

app.get("/api/radio/country/:code", async (req, res) => {
  try {
    const code = req.params.code;

    const data = await fetchFromRadioBrowser(
      `/json/stations/bycountrycodeexact/${code}`
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Country fetch failed" });
  }
});

app.get("/api/radio/language/:lang", async (req, res) => {
  try {
    const lang = req.params.lang;

    const data = await fetchFromRadioBrowser(
      `/json/stations/bylanguageexact/${encodeURIComponent(lang)}`
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Language fetch failed" });
  }
});

/* ========================
   START SERVER
======================== */

const start = async () => {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 LayaVani backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start backend:", error);
    process.exit(1);
  }
};

start();
