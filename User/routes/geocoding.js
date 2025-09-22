const express = require('express');
const axios = require('axios');
const router = express.Router();

// Proxy route for reverse geocoding to avoid CORS issues
router.get('/reverse', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                format: 'jsonv2',
                lat: lat,
                lon: lon,
                addressdetails: 1
            },
            headers: {
                'User-Agent': 'CivicConnect/1.0'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ error: 'Failed to fetch location data' });
    }
});

module.exports = router;
