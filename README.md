# 🎼 Tonaly Progressive Web App (PWA)

A modern, high-performance, offline-ready Progressive Web Application for interactive music theory study and piano key mapping, rewritten and expanded from the original [R Shiny Tonaly App](https://github.com/laresbernardo/tonalyshiny) into React, TypeScript, Tailwind CSS, and Firebase.

---

## 🛠 Tech Stack

* **Frontend Framework:** React 19 + Vite + TypeScript
* **Backend & Database:** Firebase (Authentication, Firestore, Hosting)
* **Offline PWA Engine:** `vite-plugin-pwa` + Service Worker with runtime Google Fonts caching
* **Styling System:** Tailwind CSS v4 + Custom Glassmorphism styles
* **Icons:** Lucide React

---

## 📂 Modular Architecture

The codebase follows a strict **Separation of Concerns (SoC)** model:

```
tonaly/
├── public/                     # Static icons & assets
├── src/
│   ├── components/             # Reusable UI & layouts
│   ├── services/               # Firebase Authentication & Firestore connection
│   ├── store/                  # Zustand modular state management
│   ├── hooks/                  # React hooks (synthesizer, offline triggers)
│   ├── lib/                    # Decoupled domain math & calculations
│   │   └── music-theory/       # Pure TypeScript music theory engine
│   ├── pages/                  # Application pages (Dashboard, Tool)
│   └── types/                  # Common types
└── vite.config.ts              # Build, Tailwind v4 & PWA service worker configurations
```

---

## 🚀 Getting Started (Local Testing)

### 1. Clone the repository and install dependencies:
```bash
npm install
```

### 2. Environment Configuration:
Copy the configuration sample:
```bash
cp .env.example .env.local
```
Fill out `.env.local` with your active Firebase credentials from the console. If not populated, the application will seamlessly fall back to **Local Mock Mode** so the visual tool and mock user indicator remain fully active for developer preview!

### 3. Start the development server:
```bash
npm run dev
```
Open your browser at **[http://localhost:5173/](http://localhost:5173/)** to preview the app!

### 4. Create a production build with PWA capabilities:
```bash
npm run build
```

---

## 🌩 Deployment to Firebase Hosting

1. Install the CLI globally if needed:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and associate with your project:
   ```bash
   firebase login
   firebase use default
   ```
3. Deploy Hosting to `tonaly.bervos.org`:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
