# SIH-2025  Civic Issue Reporting, Tracking & Solving

A modern, community-first platform to report civic issues, track progress, and collaborate between citizens and administrators.

Repo: `https://github.com/VaishakSK/SIH-2025`

---

##  Key Features
- Citizen-friendly issue reporting with image uploads
- Transparent lifecycle: Open  In Progress  Resolved  Verified
- Admin triage, assignment, and resolution workflows
- Email notifications (via Nodemailer) and OAuth login (Google)
- Secure sessions with Mongo-backed store

---

##  Repository Overview
- `User/`: Citizen-facing app (Express + Handlebars)  entrypoint `User/app.js`
- `Admin/`: Admin panel  entrypoint `Admin/app.js`
- `images/`: Static assets
- `uploads/user/`: Uploaded issue media
- `.env`: Environment variables (never commit secrets)
- `package.json`: Node.js scripts and dependencies
- `requirements.txt`: Python tooling (optional)

Primary stack: Express 5, Handlebars (hbs), MongoDB (mongoose), Multer, Sharp, Passport (Google OAuth), Express-Session, Connect-Mongo, Express-Validator.

---

##  Getting Started

### Prerequisites
- Node.js 18+
- npm
- MongoDB (local or hosted)

### Clone
```bash
git clone https://github.com/VaishakSK/SIH-2025.git
cd SIH-2025
```

### Install
```bash
npm install
```

### Configure Environment
Create `.env` in the project root with values your app expects. Example:
```bash
# App
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace_with_a_strong_secret

# MongoDB
MONGODB_URI=mongodb://localhost:27017/sih2025

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Email (Nodemailer)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### Run Applications
User app:
```bash
npm run dev    # or: npm start
```
Admin app (separate terminal):
```bash
npm run admin:dev    # or: npm run admin:start
```

Default URLs:
- User portal: `http://localhost:3000`
- Admin portal: `http://localhost:3000/admin`

---

##  Project Structure
```text
SIH-2025/
 User/                  # Citizen-facing routes/views/controllers
 Admin/                 # Admin panel routes/views/controllers
 images/                # Static assets
 uploads/
   user/               # User-uploaded media
 .env                   # Environment variables (local only)
 package.json           # Scripts & Node dependencies
 requirements.txt       # Optional Python tooling
 README.md
```

---

##  Security Best Practices
- Keep `.env` out of version control
- Validate and sanitize all uploads (Multer + Sharp)
- Enforce role-based access for admin routes
- Use HTTPS and secure cookies in production

---

##  Suggested Scripts
Add as needed in `package.json`:
```json
{
  "scripts": {
    "lint": "eslint .",
    "test": "jest"
  }
}
```

---

##  Roadmap Ideas
- Geolocation and map-based reporting
- Push/email/SMS notifications for status updates
- Analytics dashboard for administrators
- Public transparency timeline of resolved cases
- PWA for offline-first mobile experience

---

##  Contributors
- @VaishakSK  VAISHAK KOLHAR
- @avinashnayak16  Avinash
- @Veerraj2713 Veerraj Chitragar

Source: [`github.com/VaishakSK/SIH-2025`](https://github.com/VaishakSK/SIH-2025)