# 🏛️ SIH-2025: Smart Civic Solutions

> **Transform your city, one issue at a time!** 🚀

A cutting-edge, community-driven platform that bridges the gap between citizens and city administrators. Report civic issues, track progress in real-time, and watch your city transform! ✨

[![GitHub stars](https://img.shields.io/github/stars/VaishakSK/SIH-2025?style=social)](https://github.com/VaishakSK/SIH-2025)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0+-green.svg)](https://mongodb.com/)

---

## 🌟 What Makes Us Special?

### 🎯 **For Citizens**
- 📱 **Super Easy Reporting**: Snap, describe, submit - done! 
- 🔍 **Real-time Tracking**: Watch your issues move through the pipeline
- 📧 **Smart Notifications**: Get updates via email when status changes
- 🔐 **Secure Login**: Google OAuth for hassle-free access

### 🛠️ **For Administrators** 
- 📊 **Powerful Dashboard**: Manage, assign, and track all issues
- 🎨 **Visual Workflow**: Drag-and-drop issue management
- 📈 **Analytics & Insights**: Data-driven decision making
- 👥 **Team Collaboration**: Assign issues to departments

---

## 🏗️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| 🖥️ **Backend** | Express.js 5 | Lightning-fast API |
| 🎨 **Frontend** | Handlebars | Dynamic, SEO-friendly views |
| 🗄️ **Database** | MongoDB | Scalable document storage |
| 🔐 **Auth** | Passport.js + Google OAuth | Secure authentication |
| 📧 **Email** | Nodemailer | Smart notifications |
| 📁 **Uploads** | Multer + Sharp | Image processing & optimization |
| 🎭 **Sessions** | Express-Session + Connect-Mongo | Persistent user sessions |

---

## 🚀 Quick Start Guide

### 📋 Prerequisites
- 🟢 Node.js 18+ 
- 📦 npm (comes with Node.js)
- 🍃 MongoDB (local or cloud)

### 1️⃣ **Clone & Install**
```bash
# Clone the repository
git clone https://github.com/VaishakSK/SIH-2025.git
cd SIH-2025

# Install dependencies
npm install
```

### 2️⃣ **Environment Setup**
Create a `.env` file in the project root:

```bash
# 🚀 App Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_super_secret_session_key_here

# 🗄️ Database
MONGODB_URI=mongodb://localhost:27017/sih2025

# 🔐 Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# 📧 Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 3️⃣ **Launch Applications**

**Citizen Portal** (Terminal 1):
```bash
npm run dev    # Development mode with auto-reload
# OR
npm start      # Production mode
```

**Admin Portal** (Terminal 2):
```bash
npm run admin:dev    # Development mode
# OR  
npm run admin:start  # Production mode
```

### 4️⃣ **Access Your Apps**
- 🌐 **Citizen Portal**: http://localhost:3000
- 🛠️ **Admin Portal**: http://localhost:3000/admin

---

## 📁 Project Architecture

```
SIH-2025/
├── 🏠 User/                    # Citizen-facing application
│   ├── app.js                 # Main server file
│   ├── routes/                # API endpoints
│   ├── views/                 # Handlebars templates
│   └── public/                # Static assets
├── 🛠️ Admin/                   # Administrative dashboard
│   ├── app.js                 # Admin server
│   ├── routes/                # Admin API routes
│   └── views/                 # Admin templates
├── 📸 images/                  # Static images & assets
├── 📁 uploads/
│   └── user/                  # User-uploaded media
├── ⚙️ .env                    # Environment variables
├── 📦 package.json            # Dependencies & scripts
└── 📄 README.md              # This file!
```

---

## 🔒 Security & Best Practices

- 🔐 **Environment Security**: Never commit `.env` files
- 🛡️ **Input Validation**: All uploads validated with Multer + Sharp
- 🚪 **Access Control**: Role-based permissions for admin routes
- 🔒 **Session Security**: Secure, HTTP-only cookies
- 🌐 **HTTPS Ready**: Production-ready security headers

---

## 🧪 Development Scripts

```json
{
  "scripts": {
    "start": "node User/app.js",
    "dev": "nodemon User/app.js",
    "admin:start": "node Admin/app.js", 
    "admin:dev": "nodemon Admin/app.js",
    "lint": "eslint .",
    "test": "jest"
  }
}
```

---

## 🗺️ Future Roadmap

### 🎯 **Phase 1: Enhanced UX**
- 📍 **Geolocation Integration**: Map-based issue reporting
- 📱 **Mobile PWA**: Offline-first mobile experience
- 🔔 **Push Notifications**: Real-time status updates

### 📊 **Phase 2: Analytics & Intelligence**
- 📈 **Admin Analytics**: Comprehensive reporting dashboard
- 🤖 **AI-Powered Triage**: Smart issue categorization
- 📊 **Public Transparency**: Open data portal

### 🌐 **Phase 3: Scale & Integrate**
- 🏙️ **Multi-City Support**: Scale to multiple municipalities
- 🔗 **API Ecosystem**: Third-party integrations
- 🌍 **Internationalization**: Multi-language support

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. 🍴 **Fork** the repository
2. 🌿 **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. 💾 **Commit** your changes: `git commit -m 'Add amazing feature'`
4. 📤 **Push** to the branch: `git push origin feature/amazing-feature`
5. 🔄 **Open** a Pull Request

### 📝 **Code Style**
- Use meaningful commit messages
- Follow existing code patterns
- Add comments for complex logic
- Test your changes thoroughly

---

## 👥 Meet the Team

| Developer | Role | GitHub |
|-----------|------|--------|
| 🧑‍💻 **VAISHAK KOLHAR** | Lead Developer | [@VaishakSK](https://github.com/VaishakSK) |
| 👨‍💻 **Avinash** | Backend Developer | [@avinashnayak16](https://github.com/avinashnayak16) |
| 👨‍💻 **Veerraj Chitragar** | System Design/Developer | [@Veerraj2713](https://github.com/Veerraj2713) |

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 SIH-2025 Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 Support & Contact

- 🐛 **Found a bug?** [Open an issue](https://github.com/VaishakSK/SIH-2025/issues)
- 💡 **Have an idea?** [Start a discussion](https://github.com/VaishakSK/SIH-2025/discussions)
- 📧 **Need help?** Contact us at [civicsensesupport@example.com]

---

<div align="center">

### 🌟 **Star this repo if you found it helpful!** ⭐

**Made with ❤️ by the SIH-2025 Team**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VaishakSK/SIH-2025)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/)

</div>
