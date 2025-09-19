const express = require('express');
const router = express.Router();
const User = require('../../models/user');

// POST /signup - User registration route
router.post('/signup', async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            username, 
            password, 
            email, 
            phoneNumber,
            address,
            age,
            sex
        } = req.body;

        // Validate required fields
        const requiredFields = ['firstName', 'lastName', 'username', 'password', 'email', 'phoneNumber'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Additional validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { email: email },
                { username: username },
                { phoneNumber: phoneNumber }
            ]
        });

        if (existingUser) {
            let conflictField = '';
            if (existingUser.email === email) conflictField = 'email';
            else if (existingUser.username === username) conflictField = 'username';
            else if (existingUser.phoneNumber === phoneNumber) conflictField = 'phone number';
            
            return res.status(409).json({
                success: false,
                message: `User with this ${conflictField} already exists`
            });
        }

        // Create new user
        const newUser = new User({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: username.trim(),
            password: password, // Will be automatically hashed by pre-save middleware
            email: email.trim().toLowerCase(),
            phoneNumber: phoneNumber.trim(),
            address: address ? address.trim() : undefined,
            age: age ? parseInt(age) : undefined,
            sex: sex ? sex.toLowerCase() : undefined
        });

        // Save user to database
        const savedUser = await newUser.save();

        // Create session for the new user
        req.session.userId = savedUser._id;
        req.session.username = savedUser.username;
        req.session.isAuthenticated = true;

        // Return success response with user data (excluding password)
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: savedUser.getPublicProfile(),
            redirect: '/dashboard'
        });

    } catch (error) {
        console.error('Signup error:', error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationErrors
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({
                success: false,
                message: `User with this ${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error during registration'
        });
    }
});

// GET /signup - Render signup page (if using views)
router.get('/signup', (req, res) => {
    // Check if user is already logged in
    if (req.session.isAuthenticated) {
        return res.redirect('/dashboard'); // Redirect to dashboard if already logged in
    }
    
    res.render('signup', { 
        title: 'Sign Up',
        error: null 
    });
});

// POST /check-availability - Check if username/email is available
router.post('/check-availability', async (req, res) => {
    try {
        const { username, email, phoneNumber } = req.body;

        if (!username && !email && !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'At least one field (username, email, or phone number) is required'
            });
        }

        const query = {};
        if (username) query.username = username;
        if (email) query.email = email;
        if (phoneNumber) query.phoneNumber = phoneNumber;

        const existingUser = await User.findOne(query);

        res.status(200).json({
            success: true,
            available: !existingUser,
            message: existingUser ? 'Field already exists' : 'Field is available'
        });

    } catch (error) {
        console.error('Availability check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking availability'
        });
    }
});

module.exports = router;