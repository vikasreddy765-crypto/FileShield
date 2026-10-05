require("dotenv").config();
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const CRC32 = require("crc-32");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { User, FileRecord, Verification } = require("./models");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "development-only-secret-change-me";
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 10);
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

if (JWT_SECRET === "development-only-secret-change-me") {
  console.warn("WARNING: Set JWT_SECRET in .env before production deployment.");
}

const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const allowedExtensions = new Set([".csv", ".xlsx", ".xls", ".pdf"]);
const allowedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "application/octet-stream"
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) return cb(new Error("Unsupported file type. Use CSV, XLSX, XLS or PDF."));
    if (!allowedMimeTypes.has(file.mimetype)) return cb(new Error("The uploaded file type is not allowed."));
    cb(null, true);
  }
});

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(ROOT, "public")));

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing. Create .env from .env.example.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected.");
  await ensureAdmin();
}

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  const existing = await User.findOne({ email });
  if (existing) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name: "System Administrator", email, passwordHash, role: "admin" });
  console.log(`Admin account created for ${email}`);
}

function cleanName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
}

function crc32File(filePath) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);

    stream.on("data", chunk => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const crc = CRC32.buf(buffer) >>> 0;
        resolve(crc.toString(16).toUpperCase().padStart(8, "0"));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function signUser(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}

function deleteUploadedFile(file) {
  if (file?.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path); } catch {}
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "FileShield", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2) return res.status(400).json({ error: "Enter a valid name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ error: "Password must contain at least 8 characters." });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: "lecturer" });

    res.status(201).json({
      message: "Lecturer account created.",
      token: signUser(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    res.json({
      message: "Login successful.",
      token: signUser(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch {
    res.status(500).json({ error: "Could not log in." });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.user.sub).select("_id name email role createdAt");
  if (!user) return res.status(401).json({ error: "Account not found." });
  res.json({ user });
});

app.get("/api/dashboard", auth, async (req, res) => {
  const ownerFilter = req.user.role === "admin" ? {} : { ownerId: req.user.sub };
  const [files, verifications, modified] = await Promise.all([
    FileRecord.countDocuments(ownerFilter),
    Verification.countDocuments(ownerFilter),
    Verification.countDocuments({ ...ownerFilter, result: "MODIFIED" })
  ]);
  res.json({ registeredFiles: files, verifications, modified, verified: verifications - modified });
});

app.get("/api/files", auth, async (req, res) => {
  const ownerFilter = req.user.role === "admin" ? {} : { ownerId: req.user.sub };
  const records = await FileRecord.find(ownerFilter)
    .select("_id fileName fileSize hash createdAt verificationCount lastVerifiedAt ownerId")
    .populate("ownerId", "name email")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ records });
});

app.post("/api/files/register", auth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please choose an attendance file." });
  try {
    const hash = await crc32File(req.file.path);
    const duplicate = await FileRecord.findOne({ ownerId: req.user.sub, hash });
    if (duplicate) {
      deleteUploadedFile(req.file);
      return res.status(409).json({ error: "This exact file is already registered.", record: duplicate });
    }

    const record = await FileRecord.create({
      ownerId: req.user.sub,
      fileName: cleanName(req.file.originalname),
      fileSize: req.file.size,
      hash,
      storedPath: req.file.path
    });

    res.status(201).json({ message: "Original file registered successfully.", record });
  } catch (error) {
    deleteUploadedFile(req.file);
    console.error(error);
    res.status(500).json({ error: "Could not register the file." });
  }
});

app.post("/api/files/verify", auth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please choose a file to verify." });

  try {
    const ownerFilter = req.user.role === "admin" ? {} : { ownerId: req.user.sub };
    const record = await FileRecord.findOne({ _id: req.body.recordId, ...ownerFilter });
    const currentHash = await crc32File(req.file.path);

    if (!record) {
      deleteUploadedFile(req.file);
      return res.status(404).json({ error: "Registered original not found.", currentHash });
    }

    const intact = crypto.timingSafeEqual(Buffer.from(currentHash), Buffer.from(record.hash));
    const checkedAt = new Date();

    await Verification.create({
      ownerId: record.ownerId,
      fileRecordId: record._id,
      checkedFileName: cleanName(req.file.originalname),
      originalFileName: record.fileName,
      originalHash: record.hash,
      currentHash,
      result: intact ? "VERIFIED" : "MODIFIED",
      fileSize: req.file.size,
      checkedAt
    });

    await FileRecord.updateOne(
      { _id: record._id },
      { $inc: { verificationCount: 1 }, $set: { lastVerifiedAt: checkedAt } }
    );

    deleteUploadedFile(req.file);

    res.json({
      status: intact ? "VERIFIED" : "MODIFIED",
      intact,
      originalFileName: record.fileName,
      checkedFileName: cleanName(req.file.originalname),
      originalHash: record.hash,
      currentHash,
      fileSize: req.file.size,
      checkedAt
    });
  } catch (error) {
    deleteUploadedFile(req.file);
    console.error(error);
    res.status(500).json({ error: "Could not verify the file." });
  }
});

app.get("/api/verifications", auth, async (req, res) => {
  const ownerFilter = req.user.role === "admin" ? {} : { ownerId: req.user.sub };
  const logs = await Verification.find(ownerFilter)
    .populate("ownerId", "name email")
    .sort({ checkedAt: -1 })
    .limit(300);
  res.json({ logs });
});

app.delete("/api/files/:id", auth, async (req, res) => {
  const ownerFilter = req.user.role === "admin" ? {} : { ownerId: req.user.sub };
  const record = await FileRecord.findOne({ _id: req.params.id, ...ownerFilter });
  if (!record) return res.status(404).json({ error: "File record not found." });

  await Verification.deleteMany({ fileRecordId: record._id });
  await FileRecord.deleteOne({ _id: record._id });
  if (record.storedPath && fs.existsSync(record.storedPath)) {
    try { fs.unlinkSync(record.storedPath); } catch {}
  }
  res.json({ message: "Registered record deleted." });
});

app.get("/api/admin/users", auth, adminOnly, async (_req, res) => {
  const users = await User.find().select("_id name email role createdAt").sort({ createdAt: -1 }).limit(500);
  res.json({ users });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` });
  }
  res.status(400).json({ error: err.message || "Request failed." });
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

connectDatabase()
  .then(() => app.listen(PORT, () => console.log(`FileShield running at http://localhost:${PORT}`)))
  .catch(error => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });