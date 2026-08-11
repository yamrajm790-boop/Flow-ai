const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');
const admin = require('firebase-admin');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Admin Session Store
const activeAdminSessions = new Map();

// Rate Limiter for Admin Login
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many admin login attempts. Please try again later.' },
});

// Admin System Prompt Management
const SYSTEM_PROMPT_PATH = 'systemConfig/systemPrompt';
const DEFAULT_SYSTEM_PROMPT =
  'You are Flow AI, an intelligent, helpful, highly capable AI assistant. Give articulate, clear, well-structured answers using clean markdown formatting.';

let cachedSystemPrompt = DEFAULT_SYSTEM_PROMPT;

async function getSystemPrompt() {
  if (admin.apps.length > 0) {
    try {
      const db = admin.database();
      const snapshot = await db.ref(SYSTEM_PROMPT_PATH).get();
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (typeof val === 'string' && val.trim().length > 0) {
          cachedSystemPrompt = val.trim();
          return cachedSystemPrompt;
        }
      }
    } catch (e) {
      console.warn('[AI] Error fetching system prompt from Firebase RTDB:', e.message || e);
    }
  }
  return cachedSystemPrompt;
}

async function setSystemPrompt(prompt) {
  const cleanPrompt = prompt.trim();
  cachedSystemPrompt = cleanPrompt;
  if (admin.apps.length > 0) {
    try {
      const db = admin.database();
      await db.ref(SYSTEM_PROMPT_PATH).set(cleanPrompt);
      console.log(`[Flow AI Admin] System prompt persisted to Realtime Database at path: ${SYSTEM_PROMPT_PATH}`);
      return true;
    } catch (e) {
      console.warn('[Flow AI Admin] Realtime Database save notice:', e.message || e);
    }
  }
  return true;
}

function verifyAdminPassword(inputPass) {
  const envPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (!inputPass || typeof inputPass !== 'string') return false;

  try {
    const a = Buffer.from(inputPass);
    const b = Buffer.from(envPass);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function authenticateAdminSession(req, res, next) {
  const cookieHeader = req.headers.cookie;
  let tokenFromCookie;
  if (cookieHeader) {
    const match = cookieHeader.split(';').find((c) => c.trim().startsWith('flow_admin_session='));
    if (match) {
      tokenFromCookie = match.split('=')[1]?.trim();
    }
  }

  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const token =
    tokenFromCookie ||
    (typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined);

  if (!token || !activeAdminSessions.has(token)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const session = activeAdminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeAdminSessions.delete(token || '');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
}

// ============================================================================
// 1. FIREBASE ADMIN INITIALIZATION
// ============================================================================
function parseFirebaseCredentials() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_CONFIG;
  if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return {
        projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0076726116',
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key ? parsed.private_key.replace(/\\n/g, '\n') : undefined,
      };
    } catch (e) {
      console.warn('[Flow AI Backend] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  let rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (rawPrivateKey && rawPrivateKey.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawPrivateKey);
      return {
        projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0076726116',
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key ? parsed.private_key.replace(/\\n/g, '\n') : undefined,
      };
    } catch (e) {
      // Not JSON, fall back to string parsing
    }
  }

  if (!rawPrivateKey) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0076726116',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: undefined,
    };
  }

  let key = rawPrivateKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\n/g, '\n');

  return {
    projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0076726116',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: key,
  };
}

const { projectId: firebaseProjectId, clientEmail: firebaseClientEmail, privateKey: firebasePrivateKey } = parseFirebaseCredentials();

let defaultDbUrl = `https://${firebaseProjectId}-default-rtdb.firebaseio.com`;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.databaseURL) {
      defaultDbUrl = parsed.databaseURL;
    }
  }
} catch {
  // Ignore fallback error
}

const firebaseDatabaseUrl =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.VITE_FIREBASE_DATABASE_URL ||
  defaultDbUrl;

if (admin.apps.length === 0) {
  try {
    if (firebaseClientEmail && firebasePrivateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey,
        }),
        databaseURL: firebaseDatabaseUrl,
      });
      console.log('[Flow AI Backend] Firebase Admin SDK initialized with Service Account.');
    } else {
      admin.initializeApp({
        projectId: firebaseProjectId,
        databaseURL: firebaseDatabaseUrl,
      });
      console.log(`[Flow AI Backend] Firebase Admin SDK initialized for Project ID: ${firebaseProjectId}`);
    }
  } catch (err) {
    console.warn('[Flow AI Backend] Firebase Admin initialization notice:', err.message);
  }
}

// ============================================================================
// 2. AUTHENTICATION MIDDLEWARE
// ============================================================================
async function authenticateFirebaseUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const fallbackUid = (req.query.userId) || (req.body && req.body.userId) || 'guest';
    req.user = { uid: fallbackUid };
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    req.user = { uid: 'guest' };
    return next();
  }

  try {
    if (admin.apps.length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
      };
      console.log(`[Flow AI Auth] Verified token for UID: ${decodedToken.uid}`);
    } else {
      req.user = { uid: 'guest' };
    }
    next();
  } catch (err) {
    console.warn('[Flow AI Auth] Token verification error:', err.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired authentication token' });
  }
}

// ============================================================================
// 3. GROQ CLIENT INITIALIZATION
// ============================================================================
const groqApiKey = process.env.GROQ_API_KEY || '';
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let groqClient = null;
if (groqApiKey && !groqApiKey.includes('xxxxxxxx')) {
  try {
    groqClient = new Groq({ apiKey: groqApiKey });
    console.log(`[Flow AI Backend] Groq SDK initialized with model: ${groqModel}`);
  } catch (err) {
    console.warn('[Flow AI Backend] Could not initialize Groq SDK:', err.message);
  }
} else {
  console.log('[Flow AI Backend] GROQ_API_KEY not set or placeholder. Operating with fallback response generator.');
}

// ============================================================================
// 4. SECURITY & CORS MIDDLEWARE
// ============================================================================
app.use(helmet());

const allowedOrigins = [
  'https://flowaii.duckdns.org',
  'http://localhost:3000',
  'http://localhost:5173',
];

if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
  const envOrigins = process.env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/+$/, ''));
  envOrigins.forEach((o) => {
    if (o && !allowedOrigins.includes(o)) {
      allowedOrigins.push(o);
    }
  });
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(cleanOrigin) || process.env.FRONTEND_URL === '*') {
        return callback(null, true);
      }

      if (cleanOrigin.endsWith('.duckdns.org') || cleanOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'Accept'],
    optionsSuccessStatus: 200,
  })
);

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { message: 'Too many chat requests. Please slow down.' },
});

// ============================================================================
// 5. IN-MEMORY STORE FOR BACKEND FALLBACK
// ============================================================================
const mockConversations = new Map();
const mockMessages = new Map();

function generateTitleFromMessage(userMsg) {
  const clean = userMsg.trim().replace(/^["'\s]+|["'\s]+$/g, '');
  if (clean.length <= 30) return clean.charAt(0).toUpperCase() + clean.slice(1);
  return clean.slice(0, 30).trim() + '...';
}

// ============================================================================
// 6. HEALTH ENDPOINTS
// ============================================================================
const handleHealthCheck = (req, res) => {
  res.json({
    status: 'ok',
    groqConfigured: Boolean(groqClient),
    firebaseConfigured: Boolean(admin.apps.length > 0),
    model: 'Flow AI',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// ============================================================================
// 7. CONVERSATION ROUTES
// ============================================================================
app.get('/api/conversations', authenticateFirebaseUser, (req, res) => {
  const userId = req.user?.uid || req.query.userId || 'guest';
  const userConvs = Array.from(mockConversations.values())
    .filter((c) => c.user_id === userId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  res.json(userConvs);
});

app.post('/api/conversations', authenticateFirebaseUser, (req, res) => {
  const userId = req.user?.uid || req.body.userId || 'guest';
  const { title } = req.body;
  const newConv = {
    id: 'conv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    user_id: userId,
    title: title || 'New Chat',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockConversations.set(newConv.id, newConv);
  mockMessages.set(newConv.id, []);

  res.status(201).json(newConv);
});

app.get('/api/conversations/:id/messages', authenticateFirebaseUser, (req, res) => {
  const conversationId = req.params.id;
  const msgs = mockMessages.get(conversationId) || [];
  res.json(msgs);
});

app.patch('/api/conversations/:id', authenticateFirebaseUser, (req, res) => {
  const conversationId = req.params.id;
  const { title } = req.body;

  const conv = mockConversations.get(conversationId);
  if (!conv) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  conv.title = title || conv.title;
  conv.updated_at = new Date().toISOString();
  mockConversations.set(conversationId, conv);

  res.json(conv);
});

app.delete('/api/conversations/:id', authenticateFirebaseUser, (req, res) => {
  const conversationId = req.params.id;
  mockConversations.delete(conversationId);
  mockMessages.delete(conversationId);
  res.json({ success: true, message: 'Conversation deleted' });
});

// ============================================================================
// 8. CHAT STREAMING ENDPOINT (POST /api/chat)
// ============================================================================
app.post('/api/chat', chatLimiter, authenticateFirebaseUser, async (req, res) => {
  const userId = req.user?.uid || req.body.userId || 'guest';
  const { conversationId, message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'Message content is required' });
  }

  let conv = mockConversations.get(conversationId);
  if (!conv) {
    conv = {
      id: conversationId || 'conv-' + Date.now(),
      user_id: userId,
      title: generateTitleFromMessage(message),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockConversations.set(conv.id, conv);
  }

  const userMsg = {
    id: 'msg-' + Date.now() + '-u',
    conversation_id: conv.id,
    user_id: userId,
    role: 'user',
    content: message,
    created_at: new Date().toISOString(),
  };

  const existingMsgs = mockMessages.get(conv.id) || [];
  existingMsgs.push(userMsg);
  mockMessages.set(conv.id, existingMsgs);

  let updatedTitle;
  if (existingMsgs.filter((m) => m.role === 'user').length === 1) {
    updatedTitle = generateTitleFromMessage(message);
    conv.title = updatedTitle;
  }
  conv.updated_at = new Date().toISOString();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  if (updatedTitle) {
    res.write(`data: ${JSON.stringify({ title: updatedTitle })}\n\n`);
  }

  let fullAiResponse = '';

  try {
    const activePrompt = await getSystemPrompt();

    console.log(`[AI] Firebase system prompt loaded: ${Boolean(activePrompt)}`);
    console.log(`[AI] System prompt length: ${activePrompt ? activePrompt.length : 0}`);
    console.log(`[AI] AI request prepared with system instructions: true`);

    if (groqClient) {
      const filteredHistory = existingMsgs
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const stream = await groqClient.chat.completions.create({
        model: groqModel,
        messages: [
          {
            role: 'system',
            content: activePrompt,
          },
          ...filteredHistory,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullAiResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else {
      const intelligentReply = generateSimulatedResponse(message);
      const tokens = intelligentReply.match(/[\s\S]{1,3}/g) || [intelligentReply];

      for (const token of tokens) {
        fullAiResponse += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
        await new Promise((r) => setTimeout(r, 18));
      }
    }

    const aiMsg = {
      id: 'msg-' + Date.now() + '-a',
      conversation_id: conv.id,
      user_id: userId,
      role: 'assistant',
      content: fullAiResponse,
      created_at: new Date().toISOString(),
    };
    existingMsgs.push(aiMsg);
    mockMessages.set(conv.id, existingMsgs);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Flow AI Backend] Groq Stream Error:', error.message);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Error generating AI response' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

function generateSimulatedResponse(prompt) {
  return `I recommend a structured approach to address **"${prompt}"**:

1. **Strategic Execution**:
   - Establish baseline requirements and system constraints.
   - Deploy scalable components with clear API boundaries.

2. **Continuous Monitoring**:
   - Verify health checks and error telemetry continuously.

How would you like to proceed?`;
}

// ============================================================================
// 9. ADMIN PANEL ENDPOINTS
// ============================================================================
app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body || {};

  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }

  const sessionToken = 'admin-sess-' + crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;

  activeAdminSessions.set(sessionToken, { token: sessionToken, createdAt: Date.now(), expiresAt });

  res.cookie('flow_admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ success: true, token: sessionToken, message: 'Admin authenticated successfully' });
});

app.get('/api/admin/session', (req, res) => {
  const cookieHeader = req.headers.cookie;
  let tokenFromCookie;
  if (cookieHeader) {
    const match = cookieHeader.split(';').find((c) => c.trim().startsWith('flow_admin_session='));
    if (match) {
      tokenFromCookie = match.split('=')[1]?.trim();
    }
  }

  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const token =
    tokenFromCookie ||
    (typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined);

  if (!token || !activeAdminSessions.has(token)) {
    return res.status(401).json({ authenticated: false });
  }

  const session = activeAdminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeAdminSessions.delete(token || '');
    return res.status(401).json({ authenticated: false });
  }

  res.json({ authenticated: true, expiresAt: session.expiresAt });
});

app.post('/api/admin/logout', (req, res) => {
  const cookieHeader = req.headers.cookie;
  let tokenFromCookie;
  if (cookieHeader) {
    const match = cookieHeader.split(';').find((c) => c.trim().startsWith('flow_admin_session='));
    if (match) {
      tokenFromCookie = match.split('=')[1]?.trim();
    }
  }

  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const token =
    tokenFromCookie ||
    (typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined);

  if (token) {
    activeAdminSessions.delete(token);
  }

  res.clearCookie('flow_admin_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/admin/system-prompt', authenticateAdminSession, async (req, res) => {
  try {
    const prompt = await getSystemPrompt();
    res.json({ systemPrompt: prompt });
  } catch {
    res.status(500).json({ message: 'Failed to retrieve system prompt' });
  }
});

app.put('/api/admin/system-prompt', authenticateAdminSession, async (req, res) => {
  const { systemPrompt } = req.body || {};
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return res.status(400).json({ message: 'System prompt must be a non-empty string' });
  }

  try {
    await setSystemPrompt(systemPrompt);
    res.json({ success: true, message: 'System prompt updated successfully', systemPrompt });
  } catch {
    res.status(500).json({ message: 'Failed to update system prompt' });
  }
});

app.get('/api/admin/system-status', authenticateAdminSession, async (req, res) => {
  try {
    const currentPrompt = await getSystemPrompt();
    res.json({
      aiEngine: groqClient ? 'Groq Llama-3.3-70b Online' : 'Simulated AI Pipeline',
      systemPromptLength: currentPrompt.length,
      databaseConnected: admin.apps.length > 0,
      activeAdminSessionsCount: activeAdminSessions.size,
    });
  } catch {
    res.status(500).json({ message: 'Failed to retrieve system status' });
  }
});

// ============================================================================
// 10. START SERVER
// ============================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Flow AI Backend] Server running on port ${PORT}`);
});
