const express = require('express');
const router = express.Router();
const User = require('../../models/user');

// GET / - Main page route
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.session && req.session.userId;
    if (!userId) return res.redirect('/');

    // fetch fresh user from DB so googleId and all fields are accurate
    const user = await User.findById(userId).lean();
    if (!user) {
      req.session.destroy && req.session.destroy(() => {});
      return res.redirect('/');
    }

    // Safe stats placeholders; attempt to load Report model if present
    let reportsCount = 0, openCount = 0, inProgressCount = 0, resolvedCount = 0, recentReports = [];
    try {
      const Report = require('../../models/report');
      reportsCount = await Report.countDocuments({ user: user._id });
      openCount = await Report.countDocuments({ user: user._id, status: 'open' });
      inProgressCount = await Report.countDocuments({ user: user._id, status: 'in_progress' });
      resolvedCount = await Report.countDocuments({ user: user._id, status: 'resolved' });
      recentReports = await Report.find({ user: user._id }).sort({ createdAt: -1 }).limit(8).lean();
      recentReports = recentReports.map(r => ({ ...r, createdAt: new Date(r.createdAt).toLocaleString() }));
    } catch (e) {
      // no report model or query failed -> keep zeros
    }

    return res.render('dashboard', {
      username: user.username,
      firstName: user.firstName || user.username,
      email: user.email,
      isAdmin: !!user.isAdmin,
      googleId: user.googleId || null,
      reportsCount,
      openCount,
      inProgressCount,
      resolvedCount,
      recentReports
    });
  } catch (err) {
    console.error('Dashboard render error:', err);
    return res.redirect('/');
  }
});

module.exports = router;
