const express = require('express');
const router = express.Router();

// GET /auth/logout
router.get('/logout', (req, res) => {
  // destroy session server-side
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Session destroy error:', err);
        // best effort: clear cookie and redirect
        res.clearCookie('connect.sid', { path: '/' });
        return res.redirect('/');
      }
      // clear session cookie on client and redirect to main page
      res.clearCookie('connect.sid', { path: '/' });
      return res.redirect('/');
    });
  } else {
    // no session - just redirect
    res.clearCookie('connect.sid', { path: '/' });
    return res.redirect('/');
  }
});

module.exports = router;