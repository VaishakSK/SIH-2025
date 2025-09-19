const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const Report = require('../../models/report');
const User = require('../../models/user');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

// uploads directory (served by app.js as /uploads)
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// multer for browser upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
    cb(null, base + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

// helpers
function countWords(text){ if (!text) return 0; return text.trim().split(/\s+/).filter(Boolean).length; }
function titleWordsOk(title){ const n = (title||'').trim().split(/\s+/).filter(Boolean).length; return n>=1 && n<=10; }
function descWordsOk(desc){ const n = countWords(desc||''); return n>=30 && n<=250; }

// GET choose page
router.get('/report', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/');
  return res.render('Report/chooseReport');
});

// GET upload (full-screen upload)
router.get('/report/upload', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/');
  return res.render('Report/reportUpload', {});
});

// ensure camera URL exists: render the camera page
router.get('/report/camera', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/');
  return res.render('Report/reportCamera');
});

// optional alias if other code uses /report/capture
router.get('/report/capture', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/');
  return res.render('Report/reportCamera');
});

// POST capture: receives base64 image + latitude/longitude + form fields
router.post('/report/capture', express.urlencoded({ extended: true, limit: '10mb' }), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(403).send('Not authenticated');

    const { title, department, address, locationText, description, imageBase64, latitude, longitude } = req.body;

    if (!imageBase64) return res.status(400).send('Image required');
    if (!titleWordsOk(title)) return res.status(400).send('Title must be 1–10 words');
    if (!descWordsOk(description)) return res.status(400).send('Description must be 30–250 words');
    if (!address || !address.trim()) return res.status(400).send('Address required');

    const m = imageBase64.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.*)$/);
    if (!m) return res.status(400).send('Invalid image data');

    const mime = m[1];
    const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const buffer = Buffer.from(m[3], 'base64');

    if (buffer.length > 6 * 1024 * 1024) return res.status(400).send('Image too large');

    const filename = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8) + ext;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    const relUrl = path.posix.join('/uploads', filename);

    const rpt = new Report({
      user: req.session.userId,
      title: title.trim(),
      imagePath: relUrl,
      department,
      address: address.trim(),
      locationText: locationText ? locationText.trim() : '',
      description,
      geoLocation: {
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      }
    });

    await rpt.save();
    return res.redirect('/reports');
  } catch (err) {
    console.error('Capture POST error', err);
    return res.status(500).send('Could not save report');
  }
});

// POST upload: multipart file + optional lat/lon or address
router.post('/report/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).send('Not authenticated');
    }
    if (!req.file) return res.status(400).send('Photo is required');

    const { title, department, address, locationText, description, latitude, longitude } = req.body;

    if (!titleWordsOk(title)) { fs.unlinkSync(req.file.path); return res.status(400).send('Title must be 1–10 words'); }
    if (!descWordsOk(description)) { fs.unlinkSync(req.file.path); return res.status(400).send('Description must be 30–250 words'); }
    if (!address || !address.trim()) { fs.unlinkSync(req.file.path); return res.status(400).send('Address required'); }

    const relPath = path.posix.join('/uploads', path.basename(req.file.path));
    const rpt = new Report({
      user: req.session.userId,
      title: title.trim(),
      imagePath: relPath,
      department,
      address: address.trim(),
      locationText: locationText ? locationText.trim() : '',
      description,
      geoLocation: {
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      }
    });

    await rpt.save();
    return res.redirect('/reports');
  } catch (err) {
    console.error('Upload POST error', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).send('Could not save report');
  }
});

// --- NEW: receive upload + location only, save temp in session and redirect to review ---
router.post('/report/upload-temp', upload.single('photo'), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).send('Not authenticated');
    }

    if (!req.file) return res.status(400).send('Photo is required');

    // if previous temp exists, remove its file to avoid orphans
    try {
      if (req.session.tempReport && req.session.tempReport.filename) {
        const old = path.join(uploadsDir, req.session.tempReport.filename);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
    } catch (e) { /* ignore */ }

    const { latitude, longitude, address, locationText } = req.body;
    const filename = path.basename(req.file.path);
    const relPath = path.posix.join('/uploads', filename);

    // store minimal draft in session
    req.session.tempReport = {
      filename,
      imagePath: relPath,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      address: address ? String(address) : '',
      locationText: locationText ? String(locationText) : ''
    };

    return res.redirect('/report/review');
  } catch (err) {
    console.error('upload-temp error', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).send('Could not process upload');
  }
});

// --- NEW: receive camera capture + location only, save temp in session and redirect to review ---
router.post('/report/capture-temp', express.urlencoded({ extended: true, limit: '10mb' }), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(403).send('Not authenticated');
    }

    // if previous temp exists, remove its file to avoid orphans
    try {
      if (req.session.tempReport && req.session.tempReport.filename) {
        const old = path.join(uploadsDir, req.session.tempReport.filename);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
    } catch (e) { /* ignore */ }

    const { imageBase64, latitude, longitude, address, locationText } = req.body;

    if (!imageBase64) return res.status(400).send('Image is required');

    const m = imageBase64.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.*)$/);
    if (!m) return res.status(400).send('Invalid image data');

    const mime = m[1];
    const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const buffer = Buffer.from(m[3], 'base64');

    if (buffer.length > 6 * 1024 * 1024) return res.status(400).send('Image too large');

    const filename = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8) + ext;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    const relPath = path.posix.join('/uploads', filename);

    // store minimal draft in session
    req.session.tempReport = {
      filename,
      imagePath: relPath,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      address: address ? String(address) : '',
      locationText: locationText ? String(locationText) : ''
    };

    return res.redirect('/report/review');
  } catch (err) {
    console.error('capture-temp error', err);
    return res.status(500).send('Could not process capture');
  }
});

// GET review page — show image and fields to add title/department/description
router.get('/report/review', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/');
  const draft = req.session.tempReport;
  if (!draft || !draft.imagePath) return res.redirect('/report/upload');

  // provide draft values to template
  return res.render('Report/reportReview', {
    draft
  });
});

// POST complete — create actual Report from session draft + posted metadata
router.post('/report/upload-complete', express.urlencoded({ extended: true, limit: '10mb' }), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(403).send('Not authenticated');
    const draft = req.session.tempReport;
    if (!draft || !draft.imagePath) return res.redirect('/report/upload');

    const { title, department, description, address: postedAddress } = req.body;

    // server-side validation
    function countWords(text){ if(!text) return 0; return text.trim().split(/\s+/).filter(Boolean).length; }
    const titleWords = (title||'').trim().split(/\s+/).filter(Boolean).length;
    if (titleWords < 1 || titleWords > 10) return res.status(400).send('Title must be 1–10 words');

    const dCount = countWords(description || '');
    if (dCount < 30 || dCount > 250) return res.status(400).send('Description must be 30–250 words');

    const finalAddress = (postedAddress && postedAddress.trim()) ? postedAddress.trim() : (draft.address || '');
    if (!finalAddress) return res.status(400).send('Address required');

    const rpt = new Report({
      user: req.session.userId,
      title: title.trim(),
      imagePath: draft.imagePath,
      department: department || 'others',
      address: finalAddress,
      locationText: draft.locationText || finalAddress,
      description: description,
      geoLocation: {
        latitude: draft.latitude !== undefined ? draft.latitude : null,
        longitude: draft.longitude !== undefined ? draft.longitude : null
      }
    });

    await rpt.save();

    // clear draft from session
    delete req.session.tempReport;

    // redirect to report view page so user can edit further if needed
    return res.redirect(`/reports/${rpt._id}`);
  } catch (err) {
    console.error('upload-complete error', err);
    return res.status(500).send('Could not create report');
  }
});


// GET my reports page
router.get('/reports', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.redirect('/');
    const reports = await Report.find({ user: req.session.userId }).sort({ createdAt: -1 }).lean();
    // Add a formatted date for display
    reports.forEach(r => {
      r.createdAtFormatted = new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    });
    return res.render('Report/myReports', { reports });
  } catch (err) {
    console.error('Error fetching reports:', err);
    return res.status(500).send('Error fetching reports');
  }
});

// GET view single report page — public visibility
router.get('/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('user', 'firstName lastName email username').lean();
    if (!report) return res.status(404).send('Report not found');

    report.createdAtFormatted = new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    report.updatedAtFormatted = new Date(report.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    report.updatedAgo = dayjs(report.updatedAt).fromNow();

    return res.render('Report/viewReport', { report });
  } catch (err) {
    console.error('Error fetching report:', err);
    return res.status(500).send('Error fetching report');
  }
});

// Track status route (JSON)
router.get('/reports/:id/status', async (req, res) => {
  try {
    const rpt = await Report.findById(req.params.id).select('status updatedAt createdAt').lean();
    if (!rpt) return res.status(404).json({ success: false, message: 'Report not found' });
    return res.json({
      success: true,
      status: rpt.status,
      createdAt: rpt.createdAt,
      updatedAt: rpt.updatedAt,
      createdAtFormatted: new Date(rpt.createdAt).toLocaleString(),
      updatedAtFormatted: new Date(rpt.updatedAt).toLocaleString(),
      updatedAgo: dayjs(rpt.updatedAt).fromNow()
    });
  } catch (err) {
    console.error('Status route error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching status' });
  }
});

// GET edit report page
router.get('/reports/:id/edit', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.redirect('/');
    const report = await Report.findOne({ _id: req.params.id, user: req.session.userId }).lean();
    if (!report) return res.status(404).send('Report not found or you do not have permission to edit it.');
    if (report.status !== 'open') return res.status(403).send('This report cannot be edited as it is not in "open" status.');
    
    report.createdAt = new Date(report.createdAt).toISOString(); // Format for potential use in template
    
    return res.render('Report/editReport', { report });
  } catch (err) {
    console.error('Error fetching report for edit:', err);
    return res.status(500).send('Error fetching report');
  }
});

// POST edit report
router.post('/reports/:id/edit', upload.single('photo'), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(403).send('Not authenticated');
    
    const report = await Report.findOne({ _id: req.params.id, user: req.session.userId });
    if (!report) return res.status(404).send('Report not found or you do not have permission to edit it.');
    if (report.status !== 'open') return res.status(403).send('This report cannot be edited as it is not in "open" status.');

    const { title, department, address, locationText, description } = req.body;

    // Validation
    if (!titleWordsOk(title)) return res.status(400).send('Title must be 1–10 words');
    if (!descWordsOk(description)) return res.status(400).send('Description must be 30–250 words');
    if (!address || !address.trim()) return res.status(400).send('Address required');

    report.title = title.trim();
    report.department = department;
    report.address = address.trim();
    report.locationText = locationText ? locationText.trim() : '';
    report.description = description.trim();

    // Handle file upload
    if (req.file) {
      // Delete old image
      if (report.imagePath) {
        const oldImagePath = path.join(uploadsDir, path.basename(report.imagePath));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      report.imagePath = path.posix.join('/uploads', req.file.filename);
    }

    await report.save();
    return res.redirect(`/reports/${report._id}`);

  } catch (err) {
    console.error('Error updating report:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); // cleanup uploaded file on error
    return res.status(500).send('Error updating report');
  }
});

// POST delete report
router.post('/reports/:id/delete', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(403).send('Not authenticated');
    
    const report = await Report.findOne({ _id: req.params.id, user: req.session.userId });
    if (!report) return res.status(404).send('Report not found or you do not have permission to delete it.');

    // Delete image file
    if (report.imagePath) {
      const imagePath = path.join(uploadsDir, path.basename(report.imagePath));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Report.deleteOne({ _id: req.params.id });

    return res.redirect('/reports');
  } catch (err) {
    console.error('Error deleting report:', err);
    return res.status(500).send('Error deleting report');
  }
});

module.exports = router;