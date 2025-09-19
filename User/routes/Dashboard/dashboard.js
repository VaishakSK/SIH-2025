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
    let reportsCount = 0, openCount = 0, inProgressCount = 0, resolvedCount = 0, recentReports = [], recentPublic = [];
    try {
      const Report = require('../../models/report');
      reportsCount = await Report.countDocuments({ user: user._id });
      openCount = await Report.countDocuments({ user: user._id, status: 'open' });
      inProgressCount = await Report.countDocuments({ user: user._id, status: 'in_progress' });
      resolvedCount = await Report.countDocuments({ user: user._id, status: 'resolved' });
      recentReports = await Report.find({ user: user._id }).sort({ createdAt: -1 }).limit(8).lean();
      recentReports = recentReports.map(r => ({ ...r, createdAt: new Date(r.createdAt).toLocaleString() }));

      // latest 5 public civic issues (all users)
      recentPublic = await Report.find({}).sort({ createdAt: -1 }).limit(5).populate('user', 'firstName username').lean();
      recentPublic = recentPublic.map(r => ({
        _id: r._id,
        title: r.title,
        department: r.department,
        status: r.status,
        address: r.address,
        locationText: r.locationText,
        createdAt: new Date(r.createdAt).toLocaleString(),
        reporter: r.user ? (r.user.firstName || r.user.username || 'User') : 'User'
      }));
    } catch (e) {
      // no report model or query failed -> keep zeros
    }

    return res.render('dashboard', {
      username: user.username,
      firstName: user.firstName || user.username,
      email: user.email,
      googleId: user.googleId || null,
      avatarUrl: user.avatarUrl || '',
      reportsCount,
      openCount,
      inProgressCount,
      resolvedCount,
      recentReports,
      recentPublic
    });
  } catch (err) {
    console.error('Dashboard render error:', err);
    return res.redirect('/');
  }
});

module.exports = router;
