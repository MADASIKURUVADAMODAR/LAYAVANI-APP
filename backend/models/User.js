const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    photoURL: String,

    lastActiveDate: Date,
    lastStreakUpdateDate: Date,
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalActiveDays: { type: Number, default: 0 },

    totalListeningMinutes: { type: Number, default: 0 },

    activityLog: [
      {
        date: { type: Date, required: true },
        minutes: { type: Number, default: 0 },
      },
    ],

    likedSongs: [
      {
        title: String,
        artists: String,
        image: String,
        preview: String,
        duration: Number,
        album: String,
        genre: String,
        likedAt: { type: Date, default: Date.now },
      },
    ],

    downloadedSongs: [
      {
        title: String,
        artists: String,
        image: String,
        preview: String,
        duration: Number,
        album: String,
        genre: String,
        savedAt: { type: Date, default: Date.now },
      },
    ],

    movieEvents: [
      {
        type: { type: String },
        movieId: { type: Number },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    lastLogin: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
