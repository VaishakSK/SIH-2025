const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../../models/user');
const nodemailer = require('nodemailer');

// generate 6-digit OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtpEmail(to, otp) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'CivicConnect verification code',
        text: `Your verification code is: ${otp}. It expires in 10 minutes.`
    });
}

// start google OAuth — force account chooser
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
}));

// callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/', session: false }),
    async (req, res) => {
        try {
            const profile = req.user;
            const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
            const firstName = (profile.name && profile.name.givenName) || '';
            const lastName = (profile.name && profile.name.familyName) || '';

            if (!email) return res.redirect('/?error=google_no_email');

            let existing = await User.findOne({ email: email.toLowerCase() });
            if (existing) {
                // existing: log in
                req.session.userId = existing._id;
                req.session.username = existing.username;
                req.session.isAuthenticated = true;
                return res.redirect('/dashboard');
            }

            // new user: create temp session and send OTP
            const otp = generateOtp();
            req.session.tempGoogleUser = {
                googleId: profile.id,
                email: email.toLowerCase(),
                firstName,
                lastName,
                otp,
                otpExpiresAt: Date.now() + (10 * 60 * 1000)
            };

            await sendOtpEmail(email, otp);
            return res.redirect('/auth/verify-otp');
        } catch (err) {
            console.error('Google callback error:', err);
            return res.redirect('/?error=google_auth_failed');
        }
    }
);

// render verify page (view already present)
router.get('/verify-otp', (req, res) => {
    if (!req.session.tempGoogleUser) return res.redirect('/');
    res.render('Auth/verifyOtp', { email: req.session.tempGoogleUser.email });
});

// handle OTP post
router.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        const temp = req.session.tempGoogleUser;
        if (!temp) return res.status(400).render('Auth/verifyOtp', { error: 'No pending verification.' });

        if (Date.now() > temp.otpExpiresAt) {
            delete req.session.tempGoogleUser;
            return res.status(400).render('Auth/verifyOtp', { error: 'OTP expired. Start again.' });
        }

        if (otp !== temp.otp) return res.status(400).render('Auth/verifyOtp', { error: 'Invalid OTP.', email: temp.email });

        // create user (username from email, ensure uniqueness)
        let base = temp.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        if (!base) base = 'user';
        let username = base;
        let counter = 0;
        while (await User.findOne({ username })) {
            counter++;
            username = `${base}${counter}`;
        }

        const randomPassword = Math.random().toString(36).slice(-12); // placeholder
        const newUser = new User({
            firstName: temp.firstName || '',
            lastName: temp.lastName || '',
            username,
            password: randomPassword,
            email: temp.email,
            phoneNumber: '0000000000',
            googleId: temp.googleId,
            isVerified: true
        });

        const saved = await newUser.save();
        req.session.userId = saved._id;
        req.session.username = saved.username;
        req.session.isAuthenticated = true;
        delete req.session.tempGoogleUser;
        return res.redirect('/dashboard');
    } catch (err) {
        console.error('OTP verification error:', err);
        return res.status(500).render('Auth/verifyOtp', { error: 'Server error.' });
    }
});

module.exports = router;