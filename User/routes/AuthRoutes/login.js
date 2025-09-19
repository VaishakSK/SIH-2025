const express = require('express');
const router = express.Router();
const User = require('../../models/user');

// POST /login - User login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Find user by username or email
        const user = await User.findByEmailOrUsername(username);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Compare password using the bcrypt method
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Create session for authenticated user
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.isAuthenticated = true;

        // Return success response with user data (excluding password)
        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: user.getPublicProfile(),
            redirect: '/dashboard'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
});

// GET /login - Render login page (if using views)
router.get('/login', (req, res) => {
    // Check if user is already logged in
    if (req.session.isAuthenticated) {
        return res.redirect('/dashboard'); // Redirect to dashboard if already logged in
    }
    
    res.render('Auth/mainpage', { 
        title: 'Login',
        error: null 
    });
});

// POST /logout - User logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error during logout'
            });
        }
        
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    });
});

// GET /logout - Logout and redirect
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/login?error=logout_failed');
        }
        
        res.clearCookie('connect.sid');
        res.redirect('/login?message=logged_out');
    });
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    } else {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
};

// GET /dashboard - Dashboard page (protected route)
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/auth/login');
        }
        
        res.render('dashboard', { 
            title: 'Dashboard - CivicConnect',
            username: user.username,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/auth/login');
    }
});

// GET /profile - Get current user profile (protected route)
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile'
        });
    }
});

module.exports = router;
