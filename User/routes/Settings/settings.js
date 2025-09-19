const express = require('express');
const router = express.Router();
const User = require('../../models/user');
const bcrypt = require('bcrypt');

// GET settings page
router.get('/settings', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.session.userId).lean();
        res.render('settings', { currentUser: user });
    } catch (error) {
        res.status(500).send('Error fetching user data.');
    }
});

// POST to update profile
router.post('/settings/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.status(403).send('Not authenticated');
    }
    try {
        const { firstName, lastName, username, email, phoneNumber, address, age, sex } = req.body;
        const user = await User.findById(req.session.userId);

        // Add more validation here as needed
        user.firstName = firstName;
        user.lastName = lastName;
        user.username = username;
        user.email = email;
        user.phoneNumber = phoneNumber;
        user.address = address;
        user.age = age;
        user.sex = sex;

        await user.save();
        res.redirect('/settings');
    } catch (error) {
        // Handle errors, e.g., duplicate username/email
        res.status(500).send('Error updating profile: ' + error.message);
    }
});

// POST to change password
router.post('/settings/password', async (req, res) => {
    if (!req.session.userId) {
        return res.status(403).send('Not authenticated');
    }
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) {
            return res.status(400).send('New passwords do not match.');
        }

        const user = await User.findById(req.session.userId);
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(400).send('Incorrect current password.');
        }

        user.password = newPassword; // The pre-save hook will hash it
        await user.save();

        res.redirect('/settings');
    } catch (error) {
        res.status(500).send('Error changing password: ' + error.message);
    }
});

module.exports = router;
