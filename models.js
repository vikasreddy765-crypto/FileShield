const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["lecturer", "admin"], default: "lecturer" },
  createdAt: { type: Date, default: Date.now }
});

const fileRecordSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  fileName: { type: String, required: true, maxlength: 180 },
  fileSize: { type: Number, required: true },
  hash: { type: String, required: true, index: true },
  storedPath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  verificationCount: { type: Number, default: 0 },
  lastVerifiedAt: Date
});

const verificationSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  fileRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "FileRecord", required: true },
  checkedFileName: { type: String, required: true },
  originalFileName: { type: String, required: true },
  originalHash: { type: String, required: true },
  currentHash: { type: String, required: true },
  result: { type: String, enum: ["VERIFIED", "MODIFIED"], required: true },
  fileSize: Number,
  checkedAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const FileRecord = mongoose.model("FileRecord", fileRecordSchema);
const Verification = mongoose.model("Verification", verificationSchema);

module.exports = { User, FileRecord, Verification };