const express = require('express');
const router = express.Router();
const User = require('../../models/user');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// configure multer storage for avatars
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    const unique = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, unique + ext);
  }
});
const fileFilter = (req, file, cb) => {
  if (/^image\//.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image uploads are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

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
router.post('/settings/profile', upload.single('avatar'), async (req, res) => {
    if (!req.session.userId) {
        return res.status(403).send('Not authenticated');
    }
    try {
        const { firstName, lastName, username, email, phoneNumber, address, age, sex } = req.body;
        const user = await User.findById(req.session.userId);

        // Add more validation here as needed
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.username = username || user.username;
        user.email = email || user.email;
        user.phoneNumber = phoneNumber || user.phoneNumber;
        user.address = address ?? user.address;
        user.age = typeof age !== 'undefined' && age !== '' ? age : user.age;
        user.sex = sex || user.sex;

        // if avatar uploaded, set public URL
        if (req.file) {
            const publicUrl = '/uploads/' + req.file.filename;
            user.avatarUrl = publicUrl;
        }

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
