require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const archiver = require('archiver');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// ===== MONGODB CONNECT =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected ✔️"))
  .catch(e => console.error("MongoDB Error ❌", e));

// ===== SCHEMA =====
const TextSchema = new mongoose.Schema({
  text: { type: String, required: true },
  rawId: { type: String, required: true, index: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 1200 }
});

const TextData = mongoose.model("TextData", TextSchema);

// ===== RAW ID GENERATOR (Duplicate free) =====
async function generateUniqueRawId() {
  let id, exists;
  do {
    id = Math.random().toString(36).substring(2, 8);
    exists = await TextData.findOne({ rawId: id });
  } while (exists);
  return id;
}

// ===== GitHub RAW =====
async function getRawFromGitHub(filePath) {
  const token = process.env.GITHUB_TOKEN;
  const username = "Jinpachi76";
  const repo = "Share";

  try {
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;
    const res = await axios.get(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3.raw"
      }
    });
    return res.data;  
  } catch (e) {
    console.error("GitHub Fetch Error:", e.message);
    return null;
  }
}

// =================== API ===================

// CREATE text
app.post("/api/text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "টেক্সট লেখা আবশ্যক" });

    const rawId = await generateUniqueRawId();
    const newText = await TextData.create({ text, rawId });

    res.status(201).json({
      rawId,
      link: `${req.protocol}://${req.get("host")}/link/${rawId}`
    });

  } catch (e) {
    res.status(500).json({ message: "Server Error", error: e.message });
  }
});

// GET text
app.get("/api/text/:id", async (req, res) => {
  try {
    const txt = await TextData.findOne({ rawId: req.params.id });
    if (!txt) return res.status(404).json({ message: "Text পাওয়া যায়নি" });

    res.json(txt);
  } catch (e) {
    res.status(500).json({ message: "Server Error", error: e.message });
  }
});

// UPDATE text
app.put("/api/text/:id", async (req, res) => {
  try {
    const updated = await TextData.findOneAndUpdate(
      { rawId: req.params.id },
      { text: req.body.text },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Text পাওয়া যায়নি" });

    res.json({ message: "Updated", updated });
  } catch (e) {
    res.status(500).json({ message: "Server Error", error: e.message });
  }
});

// DELETE text
app.delete("/api/text/:id", async (req, res) => {
  try {
    const deleted = await TextData.findOneAndDelete({ rawId: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Text পাওয়া যায়নি" });

    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server Error", error: e.message });
  }
});

// DOWNLOAD ZIP
app.get("/api/download/:id", async (req, res) => {
  try {
    const txt = await TextData.findOne({ rawId: req.params.id });
    if (!txt) return res.status(404).json({ message: "Text পাওয়া যায়নি" });

    const fileName = `text-${req.params.id}.txt`;
    const tempDir = path.join(__dirname, "temp");

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const txtPath = path.join(tempDir, fileName);
    fs.writeFileSync(txtPath, txt.text);

    const zipName = `text-${req.params.id}.zip`;
    const zipPath = path.join(tempDir, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      res.download(zipPath, zipName, () => {
        fs.unlinkSync(txtPath);
        fs.unlinkSync(zipPath);
      });
    });

    archive.pipe(output);
    archive.file(txtPath, { name: fileName });
    archive.finalize();

  } catch (e) {
    res.status(500).json({ message: "Zip Error", error: e.message });
  }
});

// RAW from GitHub
app.get("/api/raw/:filePath", async (req, res) => {
  const content = await getRawFromGitHub(req.params.filePath);
  if (!content) return res.status(404).json({ message: "GitHub file পাওয়া যায়নি" });

  res.type("text/plain").send(content);
});

// FRONTEND
app.get(["/", "/link/:id"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// START SERVER
app.listen(PORT, () => console.log(`Server Running on PORT ${PORT} 🔥`));
