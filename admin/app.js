require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const hbs = require('hbs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');

const User = require('../User/models/user');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images from the uploads folder in admin under /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve images from the images folder under /images
app.use('/images', express.static(path.join(__dirname, '../images')));

// Root -> render admin home without changing the URL
app.get('/', (req, res) => res.render('home'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    store: process.env.MONGO_URI
        ? MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'admin_sessions' })
        : undefined,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(passport.initialize());

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.ADMIN_GOOGLE_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL)) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Prefer explicit admin callback if provided, else derive from user callback
        callbackURL: process.env.ADMIN_GOOGLE_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL.replace('/auth/google/callback', '/admin/auth/google/callback')
    }, (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }));
    console.log('Admin Google OAuth callback URL:', process.env.ADMIN_GOOGLE_CALLBACK_URL || (process.env.GOOGLE_CALLBACK_URL && process.env.GOOGLE_CALLBACK_URL.replace('/auth/google/callback', '/admin/auth/google/callback')));
} else {
    console.warn('Google OAuth env vars are not fully set. Admin app will run without Google strategy.');
}

app.set('view engine', 'hbs');
// Ensure views is an array with a single valid path (avoids undefined entry)
app.set('views', [ path.join(__dirname, 'views') ]);

hbs.registerHelper('eq', function(a, b) { return a === b; });
hbs.registerHelper('formatDate', function(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});
hbs.registerHelper('imageSrc', function(imagePath, imageUrl, photo) {
    try {
        const candidate = String(imagePath || imageUrl || photo || '');
        if (!candidate) return '';
        if (candidate.startsWith('http://') || candidate.startsWith('https://') || candidate.startsWith('data:')) return candidate;
        if (candidate.startsWith('/uploads/')) return candidate;
        if (candidate.startsWith('uploads/')) return '/' + candidate;
        const trimmed = candidate.replace(/^\/+/, '');
        return '/uploads/' + trimmed;
    } catch (_) { return ''; }
});

function isGoogleStrategyEnabled() {
    try { return !!passport._strategy('google'); } catch (_) { return false; }
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) return res.redirect('/admin/login');
    User.findById(req.session.userId).then(user => {
        if (user && user.isAdmin) return next();
        return res.redirect('/');
    }).catch(() => res.redirect('/'));
}

// public admin home
app.get('/admin/home', (req, res) => {
    res.render('home', {});
});

// admin dashboard
app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const Report = require('../User/models/report');
        const usersCount = await User.countDocuments({});
        const reportsCount = await Report.countDocuments({});
        const openCount = await Report.countDocuments({ status: 'open' });
        const resolvedCount = await Report.countDocuments({ status: 'resolved' });
        // recentReports now shown on /admin/reports
        const recentUsers = (await User.find({}).sort({ createdAt: -1 }).limit(6).lean())
            .map(u => ({ ...u, createdAt: new Date(u.createdAt).toLocaleDateString() }));
        // Build 12-week incident trend
        let trendLabels = [];
        let trendData = [];
        try {
            const now = new Date();
            const start = new Date(now);
            start.setDate(start.getDate() - 7 * 11); // 12 weeks window
            const pipeline = [
                { $match: { createdAt: { $gte: start } } },
                { $group: {
                    _id: { $isoWeek: '$createdAt' },
                    year: { $first: { $isoWeekYear: '$createdAt' } },
                    count: { $sum: 1 }
                }},
                { $sort: { year: 1, _id: 1 } }
            ];
            const agg = await Report.aggregate(pipeline);
            // Map to last 12 week labels
            const weeks = [];
            const temp = new Date(start);
            for (let i = 0; i < 12; i++) {
                const weekIndex = i + 1;
                weeks.push({ label: `W${weekIndex}`, isoWeek: null });
            }
            trendLabels = weeks.map(w => w.label);
            // fallback simple mapping if isoWeek numbers not used
            trendData = Array(12).fill(0);
            agg.slice(-12).forEach((row, idx) => {
                const pos = 12 - agg.slice(-12).length + idx;
                if (pos >= 0 && pos < 12) trendData[pos] = row.count;
            });
        } catch (_) {
            trendLabels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
            trendData = [28, 32, 30, 38, 35, 40, 44, 43, 39, 42, 47, 50];
        }

        // SLA compliance from report statuses
        let slaCompliant = 92, slaBreach = 8;
        try {
            const total = await Report.countDocuments({});
            const resolved = await Report.countDocuments({ status: 'resolved' });
            const open = await Report.countDocuments({ status: { $in: ['open', 'in_progress'] } });
            if (total > 0) {
                slaCompliant = Math.round((resolved / total) * 100);
                slaBreach = 100 - slaCompliant;
            }
        } catch (_) {
            // keep defaults
        }

        // Status distribution (for bar chart)
        let statusLabels = ['open', 'in_progress', 'resolved'];
        let statusData = [];
        try {
            const statusAgg = await Report.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            const map = Object.fromEntries(statusAgg.map(r => [String(r._id || ''), r.count]));
            statusData = [map.open || 0, map.in_progress || 0, map.resolved || 0];
        } catch (_) {
            statusData = [18, 11, 27];
        }

        // Category mix (temporary if model lacks "category")
        const categoryLabels = ['Roads', 'Water', 'Electricity', 'Sanitation'];
        const categoryData = [35, 22, 18, 15];

        const feed = [
            { title: 'Escalation: Streetlight outage', time: '5m ago', meta: 'Ward 12', type: 'Escalation' },
            { title: 'SLA breach: Pothole repair', time: '18m ago', meta: '2 days overdue', type: 'SLA' },
            { title: 'Assignment: Water leakage crew', time: '42m ago', meta: 'Ticket #45712', type: 'Assignment' }
        ];
        res.render('dashboard', {
            title: 'Admin Dashboard',
            isAdmin: true,
            username: req.session.username || 'Admin',
            usersCount,
            reportsCount,
            openCount,
            resolvedCount,
            recentReports: [],
            recentUsers,
            feed,
            trendLabels: JSON.stringify(trendLabels),
            trendData: JSON.stringify(trendData),
            slaCompliant,
            slaBreach,
            statusLabels: JSON.stringify(statusLabels),
            statusData: JSON.stringify(statusData),
            categoryLabels: JSON.stringify(categoryLabels),
            categoryData: JSON.stringify(categoryData)
        });
    } catch (_) {
        res.render('dashboard', {
            title: 'Admin Dashboard',
            isAdmin: true,
            username: req.session.username || 'Admin',
            usersCount: 0,
            reportsCount: 0,
            openCount: 0,
            resolvedCount: 0,
            recentReports: [],
            recentUsers: [],
            feed: [],
            trendLabels: JSON.stringify(Array.from({ length: 12 }, (_, i) => `W${i + 1}`)),
            trendData: JSON.stringify([28,32,30,38,35,40,44,43,39,42,47,50]),
            slaCompliant: 92,
            slaBreach: 8,
            statusLabels: JSON.stringify(['open','in_progress','resolved']),
            statusData: JSON.stringify([18,11,27]),
            categoryLabels: JSON.stringify(['Roads','Water','Electricity','Sanitation']),
            categoryData: JSON.stringify([35,22,18,15])
        });
    }
});

// Admin reports page (moved from dashboard)
app.get('/admin/reports', requireAdmin, async (req, res) => {
    try {
        const Report = require('../User/models/report');
        const recentReports = (await Report.find({})
                .sort({ createdAt: -1 })
                .limit(20)
                .populate('user', 'firstName lastName')
                .lean())
            .map(r => ({ ...r, createdAt: new Date(r.createdAt).toLocaleString(), isSample: false }));
        
        // Add temporary sample data for demonstration
        const sampleReports = [
            {
                reportId: 'R001',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'John' },
                status: 'open',
                locationText: 'Main Street, Downtown',
                title: 'Pothole Repair',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R002',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'Sarah' },
                status: 'in_progress',
                locationText: 'Oak Avenue, West Side',
                title: 'Streetlight Outage',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R003',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'Mike' },
                status: 'resolved',
                locationText: 'Park Road, East End',
                title: 'Water Leakage',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R004',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'Emma' },
                status: 'open',
                locationText: 'Central Plaza',
                title: 'Garbage Collection',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R005',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'David' },
                status: 'in_progress',
                locationText: 'Riverside Drive',
                title: 'Traffic Signal',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R006',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'Lisa' },
                status: 'resolved',
                locationText: 'Hillside Avenue',
                title: 'Sewer Blockage',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R007',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'Tom' },
                status: 'open',
                locationText: 'University Street',
                title: 'Sidewalk Damage',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R008',
                imagePath: 'mfqexeip-68s649.jpg',
                user: { firstName: 'Anna' },
                status: 'in_progress',
                locationText: 'Market Square',
                title: 'Public Wi-Fi Issue',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R009',
                imagePath: null, // No image - will use fallback
                user: { firstName: 'Alex' },
                status: 'open',
                locationText: 'Garden District',
                title: 'Tree Trimming',
                createdAt: new Date().toLocaleString()
            },
            {
                reportId: 'R010',
                imagePath: null, // No image - will use fallback
                user: { firstName: 'Maria' },
                status: 'resolved',
                locationText: 'Business District',
                title: 'Signage Repair',
                createdAt: new Date().toLocaleString()
            }
        ];
        
        // Combine real reports with sample data
        const allReports = [
            ...recentReports,
            ...sampleReports.map(r => ({ ...r, isSample: true }))
        ];
        res.render('reports', { recentReports: allReports });
    } catch (e) {
        console.error('Admin reports error:', e);
        res.render('reports', { recentReports: [] });
    }
});

// Admin users page
app.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = (await User.find({}).sort({ createdAt: -1 }).limit(50).lean())
            .map(u => ({ ...u, createdAt: new Date(u.createdAt).toLocaleDateString() }));
        res.render('users', { users });
    } catch (e) {
        console.error('Admin users error:', e);
        res.render('users', { users: [] });
    }
});

// Toggle admin role
app.post('/admin/users/:id/toggle-admin', requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const user = await User.findById(id);
        if (!user) return res.redirect('/admin/users');
        user.isAdmin = !user.isAdmin;
        await user.save();
        res.redirect('/admin/users');
    } catch (e) {
        console.error('Toggle admin error:', e);
        res.redirect('/admin/users');
    }
});

// Settings (basic server-side persistence in memory for demo)
const ADMIN_SETTINGS = {
    orgName: 'CivicSense Dept',
    orgEmail: 'support@civicsense.local',
    primaryColor: '#06b6d4',
    accentColor: '#0ea5a4',
    smtpHost: '',
    smtpUser: '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    sessionTimeout: '60'
};

app.get('/admin/settings', requireAdmin, (req, res) => {
    res.render('settings', { adminSettings: ADMIN_SETTINGS });
});

app.post('/admin/settings', requireAdmin, (req, res) => {
    try {
        const payload = ['orgName','orgEmail','primaryColor','accentColor','smtpHost','smtpUser','googleClientId','sessionTimeout'];
        for (const key of payload) {
            if (typeof req.body[key] !== 'undefined') ADMIN_SETTINGS[key] = req.body[key];
        }
    } catch (e) {
        console.error('Save settings error:', e);
    }
    res.redirect('/admin/settings');
});

app.get('/admin/login', (req, res) => {
    res.render('login', { title: 'Admin Login' });
});

// Admin local login handling (reuses user model + isAdmin check)
app.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).render('login', { title: 'Admin Login', error: 'Username and password required' });
        const user = await User.findByEmailOrUsername(username);
        if (!user || !user.isAdmin) return res.status(401).render('login', { title: 'Admin Login', error: 'Invalid credentials' });
        const ok = await user.comparePassword(password);
        if (!ok) return res.status(401).render('login', { title: 'Admin Login', error: 'Invalid credentials' });
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.isAuthenticated = true;
        return res.redirect('/admin');
    } catch (e) {
        console.error('Admin login error:', e);
        return res.status(500).render('login', { title: 'Admin Login', error: 'Server error' });
    }
});

// Admin logout
app.get('/admin/logout', (req, res) => {
    try {
        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                return res.redirect('/admin/login?message=logged_out');
            });
        } else {
            return res.redirect('/admin/login');
        }
    } catch (_) {
        return res.redirect('/admin/login');
    }
});


app.get('/admin/auth/google', (req, res, next) => {
    if (!isGoogleStrategyEnabled()) return res.redirect('/admin/login?error=google_disabled');
    return passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

app.get('/admin/auth/google/callback', (req, res, next) => {
    if (!isGoogleStrategyEnabled()) return res.redirect('/admin/login?error=google_disabled');
    return passport.authenticate('google', { failureRedirect: '/admin/login', session: false })(req, res, next);
}, async (req, res) => {
    try {
        const profile = req.user;
        const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
        if (!email) return res.redirect('/admin/login?error=no_email');
        const user = await User.findOne({ email: email.toLowerCase(), isAdmin: true });
        if (!user) return res.redirect('/admin/login?error=not_admin');
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.isAuthenticated = true;
        return res.redirect('/admin');
    } catch (e) {
        console.error('Admin google callback error:', e);
        return res.redirect('/admin/login?error=server');
    }
});

// Dev-only: promote a user to admin using a token (set ADMIN_PROMOTE_TOKEN in .env)
if (process.env.ADMIN_PROMOTE_TOKEN) {
    app.get('/admin/dev/promote', async (req, res) => {
        try {
            const { email, token } = req.query;
            if (!email || !token) return res.status(400).send('email and token are required');
            if (token !== process.env.ADMIN_PROMOTE_TOKEN) return res.status(403).send('invalid token');
            const updated = await User.findOneAndUpdate(
                { email: String(email).toLowerCase() },
                { $set: { isAdmin: true } },
                { new: true }
            );
            if (!updated) return res.status(404).send('user not found');
            return res.send(`Promoted ${updated.email} to admin.`);
        } catch (e) {
            console.error('Promote error:', e);
            return res.status(500).send('server error');
        }
    });

    // Create a default admin user: username=hello, password=123456
    app.get('/admin/dev/create-hello', async (req, res) => {
        try {
            const { token } = req.query;
            if (!token) return res.status(400).send('token is required');
            if (token !== process.env.ADMIN_PROMOTE_TOKEN) return res.status(403).send('invalid token');

            const username = 'hello';
            const email = 'hello@local.test';
            const existing = await User.findOne({ $or: [{ username }, { email }] });
            if (existing) {
                existing.password = '123456';
                existing.isAdmin = true;
                if (!existing.phoneNumber) existing.phoneNumber = String(Math.floor(1000000000 + Math.random() * 900000000));
                if (!existing.firstName) existing.firstName = 'Hello';
                if (!existing.lastName) existing.lastName = 'Admin';
                await existing.save();
                return res.send('Updated existing user to admin with username=hello and password=123456');
            }

            // Create new
            const UserModel = User; // alias
            const newUser = new UserModel({
                firstName: 'Hello',
                lastName: 'Admin',
                username: 'hello',
                password: '123456',
                email: email,
                phoneNumber: String(Math.floor(1000000000 + Math.random() * 900000000)),
                isAdmin: true,
                isVerified: true
            });
            await newUser.save();
            return res.send('Created admin user: username=hello, password=123456');
        } catch (e) {
            console.error('Create hello error:', e);
            return res.status(500).send('server error');
        }
    });
}

// Fallback 404 -> admin home (must be last)
app.use((req, res) => res.redirect('/admin/home'));

// optional: local Mongo connection
const mongoURI = process.env.MONGO_URI;
const port = process.env.ADMIN_PORT || process.env.PORT || 3001;

if (!mongoURI) {
    console.warn('MONGO_URI not set. Admin app running without DB connection.');
    app.listen(port, () => console.log(`Admin server running: http://localhost:${port}`));
} else {
    const isSrv = mongoURI.startsWith('mongodb+srv://');
    mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true, tls: isSrv, serverSelectionTimeoutMS: 10000 })
        .then(() => app.listen(port, () => console.log(`Admin server running: http://localhost:${port}`)))
        .catch(err => { console.error('Admin DB connect error:', err); process.exit(1); });
}

module.exports = app;


