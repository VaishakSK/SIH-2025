const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const Report = require('../../models/report');
const Contribution = require('../../models/contribution');
const User = require('../../models/user');

// Configure multer for multiple file uploads - using common uploads directory
const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'user', 'contributions');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, base + ext);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// GET contribute page with filtering and search
router.get('/contribute', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/');
    }

    const { 
      department, 
      location, 
      search, 
      status = 'open',
      severity = 'all',
      sort = 'newest',
      page = 1 
    } = req.query;

    const limit = 12;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    
    if (department && department !== 'all') {
      query.department = new RegExp(department, 'i');
    }
    
    if (location && location.trim()) {
      query.$or = [
        { address: new RegExp(location, 'i') },
        { locationText: new RegExp(location, 'i') }
      ];
    }
    
    if (search && search.trim()) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { department: searchRegex }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    // Add severity filter
    if (severity && severity !== 'all') {
      switch (severity) {
        case 'high':
          query.severityScore = { $gte: 8 };
          break;
        case 'medium-high':
          query.severityScore = { $gte: 6, $lt: 8 };
          break;
        case 'medium':
          query.severityScore = { $gte: 4, $lt: 6 };
          break;
        case 'low':
          query.severityScore = { $lt: 4 };
          break;
      }
    }

    // Build sort
    let sortQuery = {};
    switch (sort) {
      case 'oldest':
        sortQuery = { createdAt: 1 };
        break;
      case 'department':
        sortQuery = { department: 1 };
        break;
      case 'location':
        sortQuery = { address: 1 };
        break;
      case 'severity':
        sortQuery = { severityScore: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    // Get reports with pagination
    const reports = await Report.find(query)
      .populate('user', 'firstName username')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalReports = await Report.countDocuments(query);
    const totalPages = Math.ceil(totalReports / limit);

    // Get unique departments for filter
    const departments = await Report.distinct('department');

    // Format reports
    const formattedReports = reports.map(report => ({
      ...report,
      createdAtFormatted: new Date(report.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      reporter: report.user ? (report.user.firstName || report.user.username) : 'Anonymous'
    }));

    res.render('Contribute/contribute', {
      reports: formattedReports,
      departments,
      filters: {
        department: department || 'all',
        location: location || '',
        search: search || '',
        status: status || 'all',
        severity: severity || 'all',
        sort: sort || 'newest'
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? parseInt(page) + 1 : null,
        prevPage: page > 1 ? parseInt(page) - 1 : null
      }
    });

  } catch (error) {
    console.error('Contribute page error:', error);
    res.status(500).send('Error loading contribute page');
  }
});

// GET single report for contribution
router.get('/contribute/:reportId', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/');
    }

    const report = await Report.findById(req.params.reportId)
      .populate('user', 'firstName username')
      .lean();

    if (!report) {
      return res.status(404).send('Report not found');
    }

    // Get existing contributions for this report
    const contributions = await Contribution.find({ report: req.params.reportId })
      .populate('contributor', 'firstName username')
      .sort({ createdAt: -1 })
      .lean();

    res.render('Contribute/contributeToReport', {
      report: {
        ...report,
        createdAtFormatted: new Date(report.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        reporter: report.user ? (report.user.firstName || report.user.username) : 'Anonymous'
      },
      contributions: contributions.map(contrib => ({
        ...contrib,
        createdAtFormatted: new Date(contrib.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        contributor: contrib.contributor ? (contrib.contributor.firstName || contrib.contributor.username) : 'Anonymous'
      }))
    });

  } catch (error) {
    console.error('Contribute to report error:', error);
    res.status(500).send('Error loading report');
  }
});

// POST submit contribution
router.post('/contribute/:reportId', upload.array('images', 5), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(403).send('Not authenticated');
    }

    const { title, description } = req.body;
    const reportId = req.params.reportId;

    // Validate input
    if (!title || !title.trim()) {
      return res.status(400).send('Title is required');
    }
    if (!description || !description.trim()) {
      return res.status(400).send('Description is required');
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('At least one image is required');
    }

    // Check if report exists
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).send('Report not found');
    }

    // Create image paths
    const imagePaths = req.files.map(file => 
      path.posix.join('/uploads/contributions', path.basename(file.path))
    );

    // Create contribution
    const contribution = new Contribution({
      report: reportId,
      contributor: req.session.userId,
      title: title.trim(),
      description: description.trim(),
      images: imagePaths
    });

    await contribution.save();

    res.redirect(`/contribute/${reportId}?success=true`);

  } catch (error) {
    console.error('Submit contribution error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).send('Error submitting contribution');
  }
});

// POST vote on contribution
router.post('/contribute/:contributionId/vote', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(403).json({ success: false, message: 'Not authenticated' });
    }

    const { vote } = req.body; // 'up' or 'down'
    const contributionId = req.params.contributionId;

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ success: false, message: 'Invalid vote' });
    }

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found' });
    }

    // Update vote counts
    if (vote === 'up') {
      contribution.upvotes += 1;
    } else {
      contribution.downvotes += 1;
    }

    await contribution.save();

    res.json({
      success: true,
      upvotes: contribution.upvotes,
      downvotes: contribution.downvotes
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ success: false, message: 'Error processing vote' });
  }
});

module.exports = router;
