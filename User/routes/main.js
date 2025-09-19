const express = require('express');
const router = express.Router();

// GET / - Main page route
router.get('/', (req, res) => {
    res.render('Auth/mainpage', { 
        title: 'CivicConnect - Crowdsourced Civic Issue Reporting',
        error: null 
    });
});

module.exports = router;
