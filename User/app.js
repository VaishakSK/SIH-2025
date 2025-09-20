require('dotenv').config();
const express = require("express");
const mongoose = require('mongoose');
const hbs = require('hbs');
const path = require('path');
const User = require('./models/user'); // <-- ADD this line
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');
const bodyParser = require('body-parser');
// add passport and google strategy
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;


// Import routes
const mainRoutes = require('./routes/main');
const authRoutes = require('./routes/AuthRoutes/login');
const signupRoutes = require('./routes/AuthRoutes/signup');
const googleRoutes = require('./routes/AuthRoutes/google'); // new
const logoutRoutes = require('./routes/AuthRoutes/logout'); // added
const dashboardRoutes = require('./routes/Dashboard/dashboard');
const settingsRoutes = require('./routes/Settings/settings');
const contributeRoutes = require('./routes/Contribute/contribute');

const app = express();

// Middlewar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static("public"));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: true, // Changed to true to refresh session on each request
    saveUninitialized: false, // Changed to false for better security
    rolling: true, // Reset expiration on each request
    store: process.env.MONGO_URI
        ? MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions',
            touchAfter: 24 * 3600, // lazy session update
            ttl: 7 * 24 * 60 * 60 // 7 days
        })
        : undefined,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: false, // Set to true in production with HTTPS
        httpOnly: true, // Prevent XSS attacks
        sameSite: 'lax' // CSRF protection
    },
    name: 'user.sid' // Unique session name for user
}));

// Initialize passport (no passport.session() required for our short flow)
app.use(passport.initialize());

// Session refresh middleware - prevents premature logout
app.use((req, res, next) => {
    if (req.session && req.session.userId) {
        // Refresh the session on each request to prevent timeout
        req.session.touch();
    }
    next();
});

// configure Google strategy (only if env vars are present)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    }, (accessToken, refreshToken, profile, done) => {
        // Pass the profile to the route via req.user
        return done(null, profile);
    }));
} else {
    console.warn('Google OAuth env vars are not fully set. Skipping Google strategy initialization.');
}

// Set view engine to handlebars
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// register partials directory for header/footer
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// expose site name and load full current user into res.locals
app.use(async (req, res, next) => {
  try {
    res.locals.siteName = 'CivicConnect';
    res.locals.currentUser = null;
    res.locals.currentYear = new Date().getFullYear(); // provide year for footer
    res.locals.userStats = {
      reportsCount: 0,
      contributionsCount: 0,
      memberSince: 'N/A'
    };

    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('firstName lastName email username googleId avatarUrl createdAt').lean();
      if (user) {
        res.locals.currentUser = {
          id: user._id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          username: user.username || '',
          googleId: user.googleId || null,
          avatarUrl: user.avatarUrl || ''
        };

        // Calculate user stats for footer
        try {
          const Report = require('./models/report');
          const Contribution = require('./models/contribution');
          
          const reportsCount = await Report.countDocuments({ user: user._id });
          const contributionsCount = await Contribution.countDocuments({ user: user._id });
          const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
          
          res.locals.userStats = {
            reportsCount,
            contributionsCount,
            memberSince
          };
        } catch (statsErr) {
          // If models don't exist or query fails, keep default stats
          console.log('Could not load user stats:', statsErr.message);
        }
      }
    }
    return next();
  } catch (err) {
    console.error('Failed to populate currentUser for views:', err);
    res.locals.currentUser = null;
    res.locals.currentYear = new Date().getFullYear();
    res.locals.userStats = {
      reportsCount: 0,
      contributionsCount: 0,
      memberSince: 'N/A'
    };
    return next();
  }
});

// Session check endpoint
app.get('/session-check', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ valid: false, message: 'No session' });
    }
    
    User.findById(req.session.userId).then(user => {
        if (user) {
            req.session.touch(); // Refresh session
            return res.json({ valid: true, message: 'Session valid' });
        }
        return res.status(403).json({ valid: false, message: 'User not found' });
    }).catch(() => {
        return res.status(500).json({ valid: false, message: 'Database error' });
    });
});

// Use routes
app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/auth', signupRoutes);
app.use('/auth', googleRoutes); // new
app.use('/auth', logoutRoutes); // added
app.use('/', dashboardRoutes);
app.use('/', settingsRoutes);
app.use('/', contributeRoutes);

// Add redirect so /login works
app.get('/login', (req, res) => {
    return res.redirect('/auth/login');
});

// serve uploaded files from common uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

//helper functions
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});
// mount report route
const reportRoutes = require('./routes/Report/report');
app.use('/', reportRoutes);

// Configure MongoDB connection
const mongoURI = process.env.MONGO_URI;
const serverPort = process.env.PORT || 3000;

if (!mongoURI) {
    console.warn('MONGO_URI is not set. Using in-memory session store and skipping DB connection.');
    app.listen(serverPort, () => {
        console.log(`Server running (no DB): http://localhost:${serverPort}`);
    });
} else {
    const isSrv = mongoURI.startsWith('mongodb+srv://');
    const mongooseOptions = {
        // modern parser + topology
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Use TLS only for Atlas (mongodb+srv)
        tls: isSrv,
        // short server selection to fail fast during debug
        serverSelectionTimeoutMS: 10000,
        // Uncomment for temporary debugging only (not for production):
        // tlsAllowInvalidCertificates: true,
    };

    mongoose.connect(mongoURI, mongooseOptions)
        .then(() => {
            console.log('MongoDB connected successfully');
            console.log(`Connected to: ${mongoURI}`);
            app.listen(serverPort, () => {
                console.log(`Server running: http://localhost:${serverPort}`);
            });
        })
        .catch(err => {
            console.error('Could not connect to MongoDB. Please check your connection string, IP whitelist and TLS settings.\n', err);
            process.exit(1);
        });
}

const db = mongoose.connection;

// MongoDB connection event handler for errors after initial connection
db.on('error', (err) => {
    console.error('MongoDB runtime error:', err);
});
