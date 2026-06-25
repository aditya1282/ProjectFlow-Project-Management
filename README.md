<p align="center">
  <img src="https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Vanilla%20JS-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/CSS3-Glassmorphism-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License" />
</p>

<h1 align="center">🚀 ProjectFlow — SDLC Command Center</h1>

<p align="center">
  <strong>A modern, real-time project management dashboard built for tracking software development lifecycle (SDLC) stages, tasks, and team collaboration. Powered by client-side Firebase Integration with a smart offline mock fallback.</strong>
</p>

<br />

<p align="center">
  <img src="./screenshots/dashboard.png" alt="ProjectFlow Dashboard" width="800" />
</p>

---

## ✨ Features

### 🎯 Core Dashboard
- **Real-time Metrics** — Track total projects, average progress, at-risk items, and upcoming deadlines at a glance.
- **Interactive Project Cards** — Search, filter, and select projects with smooth animations.
- **Details Panel** — View project goals, team members, progress status, and timeline health.

### 🔄 Real-time Firestore Sync
- **Live Updates** — Uses Firebase Firestore real-time listeners (`onSnapshot`) to push changes instantly to all connected users.
- **Optimistic UI Engine** — Modals close and actions reflect instantly in the viewport, while database writes sync in the background for a premium user experience.

### 🔄 SDLC Lifecycle Tracking
- **7-Stage Pipeline** — Planning → Requirements → Design → Development → Testing → Deployment → Maintenance.
- **Stage Advancement** — Transition projects through stages with a single click.

### ✅ Kanban Task Board
- **Three-Column Board** — Backlog, In Progress, and Done.
- **Quick Status Shifting** — Instantly move tasks between columns with inline controls.
- **Automatic Activity Log** — Action events (like moves, creation, or edits) are logged in real-time.

### 🔐 Authentication System
- **Firebase Auth** — Built-in email/password registration and sign-in.
- **Google OAuth** — Quick one-click sign-in via Google accounts.
- **Session Persistence** — "Remember me" options with secure persistent state.

### 🛡️ Hybrid Offline Mock Fallback
- **No Setup Required** — If no Firebase credentials are configured, the application automatically boots into a complete mock dashboard mode utilizing `localStorage` persistence, keeping the app 100% functional offline.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, Vanilla CSS3 (Glassmorphism, Flexbox, Gradients), ES6+ JavaScript |
| **Authentication** | Firebase Authentication (Email/Password + Google Sign-In Popup) |
| **Database** | Firebase Cloud Firestore (Real-time collections sync) |
| **Hosting Server** | Express.js static file server (for local hosting) |
| **Avatars** | [DiceBear API](https://dicebear.com/) initials generation |

---

## 📦 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** installed on your machine.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/aditya1282/project-management-frontend.git

# 2. Navigate to the project directory
cd project-management-frontend

# 3. Install dependencies
npm install

# 4. Start the local server
npm start
```

The app will be running locally at **http://localhost:3000** 🎉

---

## ⚙️ Firebase Configuration

To configure the live database and authentication services:

1. Open **`firebase-config.js`** in your project editor.
2. Replace the `firebaseConfig` object properties with your Firebase Web App configuration keys:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Enable **Email/Password** and **Google** providers in the **Firebase Console > Build > Authentication > Sign-in method** page.
4. Ensure your hosting domains (e.g. `localhost`, `127.0.0.1` or production hostnames) are added under **Authentication > Settings > Authorized domains**.

---

## 📂 Project Structure

```
project-management-frontend/
├── index.html           # Main HTML dashboard frame and login cards
├── styles.css           # Styling declarations — glassmorphism, animations, toast alerts
├── app.js               # Main app logic — view routing, event bindings, optimistic rendering
├── firebase-config.js   # Firebase initialization with offline fallback simulator classes
├── server.js            # Express server hosting static web resources locally
├── package.json         # Scripts and package manifests
├── .gitignore           # Git exclusions
└── screenshots/         # README preview images
```

---

## 🚀 Deployment

Since ProjectFlow is a serverless static web application, you can deploy it to any static or server host:

* **Firebase Hosting** — Deploy directly to the Firebase Content Delivery Network (run `firebase init hosting` & `firebase deploy`).
* **Vercel / Netlify / GitHub Pages** — Connect this repository and deploy as a static site.
* **Railway / Render** — Connect this repository; the `server.js` file is configured to host static files on Railway out of the box.

---

## 📄 License

This project is licensed under the **ISC License**.

---

<p align="center">
  <strong>Built with ❤️ by Aditya Sharma</strong>
  <br />
  <sub>If you found this project useful, consider giving it a ⭐</sub>
</p>
