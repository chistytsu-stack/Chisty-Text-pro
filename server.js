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

const MONGODB_URI = process.env.MONGODB_URI;

// ===== MONGODB CONNECTION =====
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB সফলভাবে কানেক্ট হয়েছে');
}).catch(err => {
  console.error('MongoDB কানেকশন এরর:', err);
});

// ===== SCHEMA এবং MODEL =====
const TextSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 20 * 60 }, // ২০ মিনিট পর এক্সপায়ার
  rawId: { type: String, unique: true, required: true }
});

const TextData = mongoose.model('TextData', TextSchema);

// ===== HELPER: RANDOM RAW ID =====
const generateRawId = () => Math.random().toString(36).substring(2, 8);

// ===== GITHUB RAW FILE FETCH =====
async function getRawFromGitHub(filePath) {
  const token = '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'; // আপনার প্যাট টোকেন
  const username = 'Jinpachi76'; // আপনার গিথাব ইউজারনেম
  const repo = 'Share'; // আপনার রেপোজিটরি নাম
  const url = https://api.github.com/repos/${username}/${repo}/contents/${filePath};

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: token ${token},
        Accept: 'application/vnd.github.v3.raw'
      }
    });
    return response.data; // raw content
  } catch (err) {
    console.error('GitHub ফাইল ফেচ এরর:', err.message);
    return null;
  }
}

// ===== API ENDPOINTS =====

// ১. টেক্সট নেওয়া
app.get('/api/text/:id', async (req, res) => {
  try {
    const textItem = await TextData.findOne({ rawId: req.params.id });
    if (!textItem) return res.status(404).json({ message: 'Text পাওয়া যায়নি বা এক্সপায়ার হয়েছে' });
    res.json(textItem);
  } catch (error) {
    res.status(500).json({ message: 'সার্ভার এরর', error: error.message });
  }
});

// ২. নতুন টেক্সট তৈরি
app.post('/api/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'টেক্সট লেখা আবশ্যক' });

    const newText = new TextData({ text, rawId: generateRawId() });
    await newText.save();

    res.status(201).json({
      rawId: newText.rawId,
      link: ${req.protocol}://${req.get('host')}/link/${newText.rawId}
    });
  } catch (error) {
    res.status(500).json({ message: 'সার্ভার এরর', error: error.message });
  }
});

// ৩. টেক্সট আপডেট
app.put('/api/text/:id', async (req, res) => {
  try {
    const { text } = req.body;
    const updatedText = await TextData.findOneAndUpdate(
      { rawId: req.params.id },
      { text },
      { new: true }
    );
    if (!updatedText) return res.status(404).json({ message: 'Text পাওয়া যায়নি বা এক্সপায়ার হয়েছে' });
    res.json({ message: 'Text সফলভাবে আপডেট হয়েছে', updatedText });
  } catch (error) {
    res.status(500).json({ message: 'সার্ভার এরর', error: error.message });
  }
});

// ৪. টেক্সট ডিলিট
app.delete('/api/text/:id', async (req, res) => {
  try {
    const deletedText = await TextData.findOneAndDelete({ rawId: req.params.id });
    if (!deletedText) return res.status(404).json({ message: 'Text পাওয়া যায়নি বা এক্সপায়ার হয়েছে' });
    res.json({ message: 'Text সফলভাবে ডিলিট হয়েছে' });
  } catch (error) {
    res.status(500).json({ message: 'সার্ভার এরর', error: error.message });
  }
});

// ৫. ডাউনলোড (zip ফাইল)
app.get('/api/download/:id', async (req, res) => {
  try {
    const textItem = await TextData.findOne({ rawId: req.params.id });
    if (!textItem) return res.status(404).json({ message: 'Text পাওয়া যায়নি বা এক্সপায়ার হয়েছে' });

    const fileName = muzan-text-${req.params.id}.txt;
    const filePath = path.join(__dirname, 'temp', fileName);
    if (!fs.existsSync(path.join(__dirname, 'temp'))) fs.mkdirSync(path.join(__dirname, 'temp'));
    fs.writeFileSync(filePath, textItem.text);

    const zipFileName = muzan-text-${req.params.id}.zip;
    const zipFilePath = path.join(__dirname, 'temp', zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', function() {
      res.download(zipFilePath, zipFileName, (err) => {
        if (err) console.error('ডাউনলোড এরর:', err);
        fs.unlinkSync(filePath);
        fs.unlinkSync(zipFilePath);
      });
    });

    archive.on('error', function(err) { throw err; });
    archive.pipe(output);
    archive.file(filePath, { name: fileName });
    archive.finalize();

  } catch (error) {
    res.status(500).json({ message: 'সার্ভার এরর', error: error.message });
  }
});

// ৬. GitHub Raw API (FIXED)
app.get('/api/raw/:filePath', async (req, res) => {
  try {
    const filePath = req.params.filePath;
    const content = await getRawFromGitHub(filePath);
    if (!content) return res.status(404).json({ message: 'GitHub ফাইল পাওয়া যায়নি' });

    // এখানে force করে plain text পাঠানো হবে
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ===== NEW BOT INTEGRATION API =====
app.post('/api/bot/text', async (req, res) => {
  try {
    const { uidOrFile } = req.body;
    if (!uidOrFile) return res.status(400).json({ message: 'UID বা ফাইল নাম দরকার' });

    let textContent = '';

    // যদি GitHub file হয়
    if (uidOrFile.includes('.')) {
      const content = await getRawFromGitHub(uidOrFile);
      if (!content) return res.status(404).json({ message: 'GitHub ফাইল পাওয়া যায়নি' });
      textContent = content;
    } else {
      // যদি UID হয়, dummy example (বা database থেকে fetch করা যায়)
      textContent = This is the text content for UID: ${uidOrFile};
    }

    // Create new text entry in DB
    const newText = new TextData({ text: textContent, rawId: generateRawId() });
    await newText.save();

    // Return the link so bot can use
    res.json({
      message: 'Text successfully added',
      link: ${req.protocol}://${req.get('host')}/link/${newText.rawId},
      rawId: newText.rawId
    });
  } catch (err) {
    console.error('Bot integration error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ===== FRONT-END ROUTING =====
app.get(['/', '/link/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== SERVER START =====
app.listen(PORT, () => {
  console.log(Server চলতে শুরু করেছে PORT ${PORT} এ);
});
