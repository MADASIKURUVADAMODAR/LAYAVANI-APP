const mongoose = require("mongoose");

const radioCacheSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true },
    data: { type: Array, default: [] },
    cachedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model("RadioCache", radioCacheSchema);
