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
    resave: false,
    saveUninitialized: true, // Creates a session for every visitor, which is needed for the security check.
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        // Session expires after 1 week.
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

// Initialize passport (no passport.session() required for our short flow)
app.use(passport.initialize());

// configure Google strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    // Pass the profile to the route via req.user
    return done(null, profile);
}));

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

    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('firstName lastName email username googleId avatarUrl').lean();
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
      }
    }
    return next();
  } catch (err) {
    console.error('Failed to populate currentUser for views:', err);
    res.locals.currentUser = null;
    res.locals.currentYear = new Date().getFullYear();
    return next();
  }
});

// Use routes
app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/auth', signupRoutes);
app.use('/auth', googleRoutes); // new
app.use('/auth', logoutRoutes); // added
app.use('/', dashboardRoutes);
app.use('/', settingsRoutes);

// Add redirect so /login works
app.get('/login', (req, res) => {
    return res.redirect('/auth/login');
});

// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//helper functions
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});
// mount report route
const reportRoutes = require('./routes/Report/report');
app.use('/', reportRoutes);

// Configure MongoDB connection
const mongoURI = process.env.MONGO_URI;
const serverPort = process.env.PORT;

const mongooseOptions = {
    // modern parser + topology
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Atlas uses TLS — be explicit
    tls: true,
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

const db = mongoose.connection;

// MongoDB connection event handler for errors after initial connection
db.on('error', (err) => {
    console.error('MongoDB runtime error:', err);
});
