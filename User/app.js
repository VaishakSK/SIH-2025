require('dotenv').config();
const express = require("express");
const mongoose = require('mongoose');
const hbs = require('hbs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
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

const app = express();

// Middlewar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true, // Creates a session for every visitor, which is needed for the security check.
    store: process.env.MONGO_URI
        ? MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions'
        })
        : undefined,
    cookie: {
        // Session expires after 1 week.
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

// Initialize passport (no passport.session() required for our short flow)
app.use(passport.initialize());

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
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Helper function to check if two values are equal
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

// Use routes
app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/auth', signupRoutes);
app.use('/auth', googleRoutes); // new
app.use('/auth', logoutRoutes); // added
app.use('/', dashboardRoutes);

// Add redirect so /login works
app.get('/login', (req, res) => {
    return res.redirect('/auth/login');
});

// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
