const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const Report = require('../../models/report');
const User = require('../../models/user');

// ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
    cb(null, base + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed (jpg, png, webp)'), ok);
  }
});

// GET form
router.get('/report', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/');
  // optionally load user to prefill address/name
  const user = await User.findById(req.session.userId).lean();
  return res.render('Report/report', { email: user && user.email, username: user && user.username });
});

// POST create report
router.post('/report', upload.single('photo'), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      // clean uploaded file if present
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).send('Not authenticated');
    }

    if (!req.file) return res.status(400).send('Photo is required');

    const { department, address, locationText, description, title } = req.body;

    // server-side title validation (1-10 words)
    const titleWords = (title || '').trim().split(/\s+/).filter(Boolean);
    if (titleWords.length < 1 || titleWords.length > 10) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).send('Title must be 1–10 words');
    }

    // build relative path for serving
    const relPath = path.join('/uploads', path.basename(req.file.path));

    const newReport = new Report({
      user: req.session.userId,
      title: title.trim(),
      imagePath: relPath,
      department,
      address,
      locationText,
      description
    });

    await newReport.save();
    return res.redirect('/reports');
  } catch (err) {
    console.error('Create report error:', err);
    // remove file on error
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    // show basic error
    return res.status(400).send(err.message || 'Could not create report');
  }
});

// GET /reports - list current user's reports
router.get('/reports', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.redirect('/');
    const reports = await Report.find({ user: req.session.userId }).sort({ createdAt: -1 }).lean();
    const list = reports.map(r => ({
      ...r,
      createdAtFormatted: new Date(r.createdAt).toLocaleString()
    }));
    return res.render('Report/myReports', { reports: list });
  } catch (err) {
    console.error('List reports error:', err);
    return res.redirect('/dashboard');
  }
});

// Optional: view single report
router.get('/reports/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.redirect('/');
    const r = await Report.findOne({ _id: req.params.id, user: req.session.userId }).lean();
    if (!r) return res.redirect('/reports');
    r.createdAtFormatted = new Date(r.createdAt).toLocaleString();
    return res.render('Report/viewReport', { report: r });
  } catch (err) {
    console.error('View report error:', err);
    return res.redirect('/reports');
  }
});

module.exports = router;