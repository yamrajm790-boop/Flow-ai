# Flow AI — Production Workspace & Google Authentication Guide

Flow AI is a high-performance AI workspace built with React, Tailwind CSS, Express, Groq API, and production-ready **Firebase Authentication with Google Sign-In** and **Firebase Realtime Database**.

---

## 🏗 Architecture Overview

```
User
  │
  ▼
Flow AI Frontend (Vercel / Vite SPA)
  │
  ├──► Firebase Google Authentication (signInWithPopup / signInWithRedirect fallback)
  │
  ├──► Firebase Realtime Database (`users/{UID}/profile`, `users/{UID}/conversations`)
  │
  ▼
Express Backend (Render / Cloud Run)
  │
  ├──► Verify Firebase ID Token (`Authorization: Bearer <ID_TOKEN>`) via Firebase Admin SDK
  │
  └──► Stream AI Responses from Groq API (`llama-3.3-70b-versatile`)
```

---

## 🛠 1. Firebase Console Setup

### A. Enable Google Authentication
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (**gen-lang-client-0076726116**).
3. In the left navigation, click **Build** → **Authentication**.
4. Click **Get Started** (if not already enabled) and go to the **Sign-in method** tab.
5. Select **Google**, click **Enable**, set your support email, and click **Save**.

### B. Add Authorized Domains
1. In the Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**.
2. Click **Add domain**.
3. Add the following domains:
   - `localhost`
   - Your Vercel deployment domain (e.g., `flow-ai.vercel.app`)
   - Your custom domain (if applicable)

---

## 🗄 2. Firebase Realtime Database Setup & Security Rules

1. In the Firebase Console, navigate to **Build** → **Realtime Database**.
2. Click **Create Database** and choose your preferred location (e.g. `asia-southeast1`).
3. Select **Start in locked mode**.
4. Go to the **Rules** tab and paste the contents of `firebase-database.rules.json`:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "profile": {
          ".validate": "newData.hasChildren(['uid', 'email'])"
        },
        "conversations": {
          "$conversationId": {
            ".validate": "newData.hasChildren(['id', 'title'])",
            "messages": {
              "$messageId": {
                ".validate": "newData.hasChildren(['id', 'role', 'content'])"
              }
            }
          }
        }
      }
    }
  }
}
```

5. Click **Publish**.

---

## 🔑 3. Environment Variables

### Frontend Environment Variables (Vercel / Local `.env`)

| Variable | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL |
| `VITE_API_BASE_URL` | Backend Express API URL |

### Backend Environment Variables (Render / Production)

| Variable | Description |
| :--- | :--- |
| `GROQ_API_KEY` | Groq API Key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Service Account Email |
| `FIREBASE_PRIVATE_KEY` | Firebase Service Account Private Key |
| `FRONTEND_URL` | Allowed CORS Origin URL |

---

## 📱 Mobile Browser Google Login Support

Flow AI detects mobile user agents automatically:
- Desktop browsers utilize `signInWithPopup()`.
- Mobile browsers automatically fall back to `signInWithRedirect()` and handle redirect results seamlessly with `getRedirectResult()`.

---

## ✅ Verified Test Checklist

- [x] Clean Home Screen (No suggestion cards, no box around logo)
- [x] Firebase Google Authentication with popup and mobile redirect fallback
- [x] User Profile synced in Realtime Database (`users/{UID}/profile`)
- [x] User Conversations synced in Realtime Database (`users/{UID}/conversations`)
- [x] Realtime Database security rules preventing unauthorized access
- [x] Express backend verifies Firebase ID Tokens (`Bearer <token>`)
- [x] Groq API keys remain completely secret on backend server
