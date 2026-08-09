# Flow AI — Production AI Chatbot Application

Flow AI is a high-performance, dark-themed AI chatbot web application inspired by modern minimalist AI workspace interfaces. It features server-side Groq acceleration, Supabase PostgreSQL persistence with Realtime synchronization, Google OAuth, and a mobile-first responsive layout.

---

## Architecture Overview

```
Frontend (Vercel)
   ↓
Render Backend API (Node.js + Express + TypeScript)
   ↓
Groq API (Llama-3.3-70b-versatile)
   ↓
Supabase (PostgreSQL + Auth + Realtime)
```

- **Security Constraint**: The Groq API key and backend model credentials are stored **ONLY on the backend server** (as Render environment variables) and are **NEVER exposed to the browser/frontend**.
- **User Privacy**: Supabase Row Level Security (RLS) policies enforce strict per-user data isolation. Users can access only their own profile, conversations, and messages.

---

## 🛠️ Project Structure

```
flow-ai/
├── src/
│   ├── components/
│   │   ├── FlowLogo.tsx         # White geometric geometric logo
│   │   ├── Header.tsx           # Compact navigation bar ("Free plan • Upgrade")
│   │   ├── Sidebar.tsx          # Collapsible conversations drawer & search
│   │   ├── EmptyChatState.tsx   # "Good Morning, {Name}" centered welcome state
│   │   ├── ChatMessage.tsx      # User card & AI response with action toolbar
│   │   ├── ChatComposer.tsx     # Large dark rounded bottom input bar
│   │   ├── AuthModal.tsx        # Minimal Google Login & Guest access
│   │   ├── SettingsModal.tsx    # User settings & system health status
│   │   └── UpgradeModal.tsx     # Flow AI Pro subscription modal
│   ├── lib/
│   │   ├── api.ts               # Frontend REST & SSE streaming API client
│   │   ├── storage.ts           # Local guest fallback persistence
│   │   └── supabase.ts          # Supabase Auth & Realtime client
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── App.tsx                  # Root application controller
│   └── main.tsx                 # React DOM entry point
├── supabase/
│   └── migrations/
│       └── 01_schema.sql        # Supabase SQL schema, RLS policies & Realtime setup
├── server.ts                    # Full-stack Express backend server
├── package.json
└── README.md
```

---

## 🚀 Environment Variables Setup

### Frontend (.env or Vercel Environment Variables)
```env
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."
VITE_API_BASE_URL="https://your-render-backend.onrender.com"
```

### Backend (.env or Render Environment Variables)
```env
GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GROQ_MODEL="llama-3.3-70b-versatile"
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
FRONTEND_URL="https://your-vercel-app.vercel.app"
PORT=3000
```

---

## 🗄️ Database Setup (Supabase)

1. Go to your [Supabase Dashboard](https://database.supabase.com) and navigate to the **SQL Editor**.
2. Run the full contents of `supabase/migrations/01_schema.sql`.
3. This creates the required tables (`profiles`, `conversations`, `messages`, `user_preferences`), indexes, Row Level Security (RLS) policies, and enables **Supabase Realtime**.

---

## 🔑 Google OAuth Setup

1. In the Google Cloud Console, navigate to **APIs & Services** > **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set Authorized JavaScript Origins:
   - `https://your-supabase-project.supabase.co`
   - `https://your-vercel-app.vercel.app`
4. Set Authorized Redirect URI:
   - `https://your-supabase-project.supabase.co/auth/v1/callback`
5. Copy your **Client ID** and **Client Secret** into your Supabase Dashboard under **Authentication** > **Providers** > **Google**.

---

## 📦 Local Development

To run Flow AI locally:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## ⚡ Vercel & Render Deployment Instructions

### Deploy Frontend to Vercel
1. Push your repository to GitHub.
2. Import the repository into **Vercel**.
3. Add the frontend environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`).
4. Build command: `npm run build`
5. Output directory: `dist`

### Deploy Backend to Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your GitHub repository.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Add backend environment variables (`GROQ_API_KEY`, `GROQ_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`).

---

## 📄 License

Apache-2.0
