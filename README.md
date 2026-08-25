# 💰 TeamFund — Smart Team Contribution & Event Tracker

A modern, responsive, mobile-first web application designed for teams, clubs, and communities to manage recurring monthly contributions, track event budgets and expenses, visualize financial health with rich interactive charts, and get automated financial pulse reports powered by Google Gemini AI.

---

## ✨ Features

- 📊 **Interactive Dashboard**: Real-time snapshot of monthly collections, total vault balance, target completion rates, and outstanding member dues.
- 📅 **12-Month Contribution Tracker**: High-visibility yearly grid matrix to view and record member contributions month-by-month with instant click-to-pay or clear toggles.
- 🎉 **Event Budget & Ledger**: Create team events, allocate budgets, record event-specific income and expenses, and track net event balances.
- 👥 **Member Directory**: Manage member contacts, job titles, addresses, active/inactive statuses, and review individual contribution histories.
- 📈 **Visual Analytics & Reports**: Deep financial analytics powered by Recharts (monthly growth, revenue trends, contribution distributions, and KPI cards).
- 🤖 **Gemini AI Financial Assistant**: Automated monthly financial health pulse checks, drafted team reminder/celebration announcements, and creative spending suggestions.
- 💾 **Hybrid Offline-First & Cloud Sync**: Operates seamlessly offline with browser `localStorage`, with optional real-time cloud synchronization via Firebase Realtime Database.
- 📥 **Data Import / Export**: One-click full CSV reports, automated JSON database backups, and CSV/JSON data restore.
- 📱 **PWA & Mobile-First**: Built with Material Design 3 tokens and full responsive mobile navigation.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Material Design 3 Color System
- **Icons**: Lucide React
- **Data Visualizations**: Recharts
- **Date Utilities**: Date-fns
- **AI Integration**: Google GenAI SDK (`@google/genai` / Gemini 3 Flash Preview)
- **Database & Sync**: Firebase Realtime Database + LocalStorage (Offline-First)

---

## 🚀 Step-by-Step Setup Guide

### 1. Prerequisites
Make sure you have **Node.js** (v18.0.0 or higher) and **npm** installed on your system.
Verify by running:
```bash
node -v
npm -v
```

---

### 2. Install Dependencies
In your terminal, navigate to the project directory and install all required packages:
```bash
npm install
```

---

### 3. Configure Environment Variables
1. Copy the provided `.env.example` file to create `.env.local`:
   ```bash
   # On Windows (PowerShell):
   Copy-Item .env.example .env.local

   # On macOS / Linux:
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your **Google Gemini API Key**:
   ```env
   # Get your free key at: https://aistudio.google.com/app/apikey
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. *(Optional)* If you want real-time multi-device cloud synchronization via Firebase, fill in your Firebase configuration in `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=teamfund-b6c6a.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://teamfund-b6c6a-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=teamfund-b6c6a
   VITE_FIREBASE_STORAGE_BUCKET=teamfund-b6c6a.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
   > 💡 **Note**: If you leave Firebase keys empty, TeamFund will automatically run in **Offline Mode** and save all your data locally in your browser's `localStorage`.

---

### 4. Run Development Server
Start the local Vite development server:
```bash
npm run dev
```

Once started, open your browser and navigate to:
```
http://localhost:3000
```

---

### 5. Build for Production
To create an optimized production build:
```bash
npm run build
```

To preview the production build locally:
```bash
npm run preview
```

---

## 📂 Project Structure

```
TeamFund/
├── components/           # UI Views and Components
│   ├── AIInsights.tsx    # Gemini AI Financial Assistant view
│   ├── Dashboard.tsx     # Main dashboard with charts and quick-actions
│   ├── Events.tsx        # Event budget & transaction management
│   ├── History.tsx       # Date-grouped chronological payment ledger
│   ├── Members.tsx       # Team member management and profile drawer
│   ├── Report.tsx        # Financial analytics and data export view
│   ├── Settings.tsx      # Target/currency settings, CSV/JSON import/export
│   └── Tracker.tsx       # 12-month contribution grid matrix
├── services/
│   ├── firebaseConfig.ts # Firebase Realtime Database initialization
│   ├── geminiService.ts  # Google GenAI API client & prompts
│   └── storageService.ts # LocalStorage & Firebase sync engine, CSV parser
├── types.ts              # TypeScript interfaces and state models
├── App.tsx               # Root component, routing, and navigation layout
├── index.html            # Entry HTML with Material Design 3 theme tokens
├── index.tsx             # React DOM entry point & Service Worker registration
├── vite.config.ts        # Vite build & environment configuration
├── .env.example          # Environment variables template
├── package.json          # Project dependencies and npm scripts
└── tsconfig.json         # TypeScript configuration
```

---

## 📜 Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the local development server at `http://localhost:3000` |
| `npm run build` | Compiles and builds production-ready bundle in `/dist` |
| `npm run preview`| Previews the production build locally |

---

## 🔒 Security & Privacy
- Sensitive keys (`.env`, `.env.local`) are ignored in Git via `.gitignore`.
- All financial numbers and calculations are handled client-side and safely synchronized with your own Firebase database or local device storage.
