import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Admin Session Store
interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
}
const activeAdminSessions = new Map<string, AdminSession>();

// Rate Limiter for Admin Login
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { message: 'Too many admin login attempts. Please try again later.' },
});

// Admin System Prompt Management
const DEFAULT_SYSTEM_PROMPT =
  'You are Flow AI, an intelligent, helpful, highly capable AI assistant. Give articulate, clear, well-structured answers using clean markdown formatting.';

let cachedSystemPrompt = DEFAULT_SYSTEM_PROMPT;

async function getSystemPrompt(): Promise<string> {
  if (getApps().length > 0) {
    try {
      const db = getDatabase();
      const snapshot = await db.ref('systemConfig/systemPrompt').get();
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (typeof val === 'string' && val.trim().length > 0) {
          cachedSystemPrompt = val;
          return val;
        }
      }
    } catch (e) {
      // Return cached in-memory fallback
    }
  }
  return cachedSystemPrompt;
}

async function setSystemPrompt(prompt: string): Promise<boolean> {
  cachedSystemPrompt = prompt;
  if (getApps().length > 0) {
    try {
      const db = getDatabase();
      await db.ref('systemConfig/systemPrompt').set(prompt);
      console.log('[Flow AI Admin] System prompt persisted to Realtime Database.');
      return true;
    } catch (e) {
      console.warn('[Flow AI Admin] Realtime Database save notice:', e);
    }
  }
  return true;
}

function verifyAdminPassword(inputPass: string): boolean {
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

function authenticateAdminSession(req: Request, res: Response, next: Function) {
  const cookieHeader = req.headers.cookie;
  let tokenFromCookie: string | undefined;
  if (cookieHeader) {
    const match = cookieHeader.split(';').find((c) => c.trim().startsWith('flow_admin_session='));
    if (match) {
      tokenFromCookie = match.split('=')[1]?.trim();
    }
  }

  const authHeader = req.headers.authorization || (req.headers['x-admin-token'] as string);
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

// Helper to clean and parse Firebase Private Key / Credentials from Environment
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
      console.warn('[Flow AI Backend] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
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
      // Not JSON, continue to normal string processing
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
  // Strip outer quotes if included when setting env var in Render / Vercel
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  // Replace escaped newlines
  key = key.replace(/\\n/g, '\n');

  return {
    projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0076726116',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: key,
  };
}

const { projectId: firebaseProjectId, clientEmail: firebaseClientEmail, privateKey: firebasePrivateKey } = parseFirebaseCredentials();
const firebaseDatabaseUrl = process.env.FIREBASE_DATABASE_URL;

if (firebaseClientEmail && firebasePrivateKey) {
  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey,
        }),
        databaseURL: firebaseDatabaseUrl,
      });
      console.log('[Flow AI Backend] Firebase Admin SDK initialized with Service Account.');
    }
  } catch (err) {
    console.warn('[Flow AI Backend] Firebase Admin Cert init warning:', err);
  }
} else {
  try {
    if (getApps().length === 0) {
      initializeApp({
        projectId: firebaseProjectId,
        databaseURL: firebaseDatabaseUrl,
      });
      console.log(`[Flow AI Backend] Firebase Admin SDK initialized for Project ID: ${firebaseProjectId}`);
    }
  } catch (err) {
    console.warn('[Flow AI Backend] Firebase Admin Project ID init warning:', err);
  }
}

// Custom Authenticated Request interface
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}

// Authentication Middleware to verify Firebase ID Token
async function authenticateFirebaseUser(req: AuthenticatedRequest, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fallback to query/body UID for preview or guest mode
    const fallbackUid = (req.query.userId as string) || (req.body?.userId as string) || 'guest';
    req.user = { uid: fallbackUid };
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    req.user = { uid: 'guest' };
    return next();
  }

  try {
    if (getApps().length > 0) {
      const decodedToken = await getAuth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
      };
      console.log(`[Flow AI Auth] Token verified for UID: ${decodedToken.uid}`);
    } else {
      req.user = { uid: 'guest' };
    }
    next();
  } catch (err: any) {
    console.warn('[Flow AI Auth] Token verification error:', err.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired authentication token' });
  }
}

// Initialize Groq SDK if GROQ_API_KEY exists
const groqApiKey = process.env.GROQ_API_KEY || '';
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let groqClient: Groq | null = null;
if (groqApiKey && !groqApiKey.includes('xxxxxxxx')) {
  try {
    groqClient = new Groq({ apiKey: groqApiKey });
    console.log(`[Flow AI Backend] Groq SDK initialized with model: ${groqModel}`);
  } catch (err) {
    console.warn('[Flow AI Backend] Could not initialize Groq SDK:', err);
  }
} else {
  console.log('[Flow AI Backend] GROQ_API_KEY not set. Operating in preview mode with simulated streaming.');
}

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allowed for Vite dev server inline assets
  })
);

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
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
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

// Rate limiter for chat endpoints
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 chat requests per minute
  message: { message: 'Too many chat requests. Please slow down.' },
});

// In-Memory Database Store for Preview / Fallback
interface DbConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DbMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

const mockConversations: Map<string, DbConversation> = new Map();
const mockMessages: Map<string, DbMessage[]> = new Map();

// Helper to auto-generate conversation title
function generateTitleFromMessage(userMsg: string): string {
  const clean = userMsg.trim().replace(/^["'\s]+|["'\s]+$/g, '');
  if (clean.length <= 30) return clean.charAt(0).toUpperCase() + clean.slice(1);
  return clean.slice(0, 30).trim() + '...';
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// 1. Health Check
const handleHealthCheck = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

// ============================================================================
// ADMIN API ENDPOINTS
// ============================================================================

// Admin Login
app.post('/api/admin/login', adminLoginLimiter, (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || !verifyAdminPassword(password)) {
    console.warn('[Flow AI Admin] Failed admin login attempt.');
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  activeAdminSessions.set(token, { token, createdAt: Date.now(), expiresAt });

  console.log('[Flow AI Admin] Admin authenticated successfully.');

  // Set HttpOnly Cookie
  res.cookie('flow_admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({ success: true, token });
});

// Admin Session Verification
app.get('/api/admin/session', authenticateAdminSession, (req: Request, res: Response) => {
  return res.json({ authenticated: true });
});

// Admin Logout
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.split(';').find((c) => c.trim().startsWith('flow_admin_session='));
    if (match) {
      const token = match.split('=')[1]?.trim();
      if (token) activeAdminSessions.delete(token);
    }
  }
  const authHeader = req.headers.authorization || (req.headers['x-admin-token'] as string);
  if (typeof authHeader === 'string') {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) activeAdminSessions.delete(token);
  }

  res.clearCookie('flow_admin_session');
  return res.json({ success: true });
});

// Get System Prompt (Admin Only)
app.get('/api/admin/system-prompt', authenticateAdminSession, async (req: Request, res: Response) => {
  const prompt = await getSystemPrompt();
  return res.json({ systemPrompt: prompt });
});

// Update System Prompt (Admin Only)
app.put('/api/admin/system-prompt', authenticateAdminSession, async (req: Request, res: Response) => {
  const { systemPrompt } = req.body;
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
    return res.status(400).json({ message: 'System prompt content cannot be empty.' });
  }

  await setSystemPrompt(systemPrompt.trim());
  return res.json({ success: true, systemPrompt: cachedSystemPrompt });
});

// Get System Status (Admin Only)
app.get('/api/admin/system-status', authenticateAdminSession, async (req: Request, res: Response) => {
  const prompt = await getSystemPrompt();
  return res.json({
    aiEngine: groqClient ? 'Online (Groq)' : 'Active (Preview Stream Engine)',
    systemPromptLength: prompt.length,
    databaseConnected: getApps().length > 0,
    activeAdminSessionsCount: activeAdminSessions.size,
    timestamp: new Date().toISOString(),
  });
});

// 2. Get Conversations
app.get('/api/conversations', authenticateFirebaseUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid || (req.query.userId as string) || 'guest';
  const userConvs = Array.from(mockConversations.values())
    .filter((c) => c.user_id === userId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  res.json(userConvs);
});

// 3. Create Conversation
app.post('/api/conversations', authenticateFirebaseUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid || req.body.userId || 'guest';
  const { title } = req.body;
  const newConv: DbConversation = {
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

// 4. Get Conversation Messages
app.get('/api/conversations/:id/messages', authenticateFirebaseUser, (req: AuthenticatedRequest, res: Response) => {
  const conversationId = req.params.id;
  const msgs = mockMessages.get(conversationId) || [];
  res.json(msgs);
});

// 5. Update Conversation Title
app.patch('/api/conversations/:id', authenticateFirebaseUser, (req: AuthenticatedRequest, res: Response) => {
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

// 6. Delete Conversation
app.delete('/api/conversations/:id', authenticateFirebaseUser, (req: AuthenticatedRequest, res: Response) => {
  const conversationId = req.params.id;
  mockConversations.delete(conversationId);
  mockMessages.delete(conversationId);
  res.json({ success: true, message: 'Conversation deleted' });
});

// 7. Main Chat Completion Endpoint (SSE Streaming)
app.post('/api/chat', chatLimiter, authenticateFirebaseUser, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid || req.body.userId || 'guest';
  const { conversationId, message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'Message content is required' });
  }

  // Ensure conversation exists
  let conv = mockConversations.get(conversationId);
  let isNewConv = false;
  if (!conv) {
    isNewConv = true;
    conv = {
      id: conversationId || 'conv-' + Date.now(),
      user_id: userId,
      title: generateTitleFromMessage(message),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockConversations.set(conv.id, conv);
  }

  // Save User Message
  const userMsg: DbMessage = {
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

  // Auto-update conversation title if it's the first user message
  let updatedTitle: string | undefined;
  if (existingMsgs.filter((m) => m.role === 'user').length === 1) {
    updatedTitle = generateTitleFromMessage(message);
    conv.title = updatedTitle;
  }
  conv.updated_at = new Date().toISOString();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  if (updatedTitle) {
    res.write(`data: ${JSON.stringify({ title: updatedTitle })}\n\n`);
  }

  let fullAiResponse = '';

  try {
    const activePrompt = await getSystemPrompt();

    if (groqClient) {
      // Stream directly from Groq API with server-enforced system prompt
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
      // High-quality simulated intelligent response generator when GROQ_API_KEY is not set yet
      const intelligentReply = generateSimulatedAiResponse(message);
      const tokens = intelligentReply.match(/[\s\S]{1,3}/g) || [intelligentReply];

      for (const token of tokens) {
        fullAiResponse += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
        await new Promise((r) => setTimeout(r, 18));
      }
    }

    // Save final AI Message
    const aiMsg: DbMessage = {
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
  } catch (error: any) {
    console.error('[Flow AI Backend] AI Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong. Please try again.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// Helper for simulated response when Groq key is pending setup
function generateSimulatedAiResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('marketing') || p.includes('campaign')) {
    return `Here is a high-impact multi-channel marketing campaign strategy:

1. **Core Message & Slogan**:
   - *"Work Smarter, Not Longer"*
   - Focus on reclaiming personal time, reducing burnout, and optimizing daily focus.

2. **Target Channels**:
   - **LinkedIn**: Professional productivity breakdowns & thought leadership posts.
   - **Instagram Reels & TikTok**: 30-second workflow hacks & app UI feature highlights.
   - **YouTube Shorts**: Quick tutorial shorts targeting remote knowledge workers.
   - **Email Onboarding**: High-retention drip series featuring daily focus tips.

3. **Key Performance Metrics**:
   - CAC (Customer Acquisition Cost)
   - Trial-to-Paid Conversion Rate
   - Weekly Active User Retention (D7 / D30)`;
  }

  if (p.includes('code') || p.includes('typescript') || p.includes('react')) {
    return `Here is a clean, production-ready TypeScript pattern:

\`\`\`typescript
interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useFlowState<T>(initialValue: T | null = null) {
  const [state, setState] = React.useState<DataState<T>>({
    data: initialValue,
    loading: false,
    error: null,
  });

  return { state, setState };
}
\`\`\`

### Key Highlights:
- **Type Safety**: Enforces clean type inference across component state boundaries.
- **Error Guarding**: Wraps asynchronous state mutations predictably.`;
  }

  return `I recommend a structured approach to address **"${prompt}"**:

1. **Strategic Foundation**:
   - Define primary goals and key success criteria.
   - Align core stakeholders and resource allocations.

2. **Execution Steps**:
   - **Phase 1**: Initial setup & architecture validation.
   - **Phase 2**: Iterative implementation with fast user feedback loops.
   - **Phase 3**: Scaling, performance optimization, and monitoring.

How would you like to proceed with the next step?`;
}

// 8. Regenerate Endpoint
app.post('/api/chat/regenerate', chatLimiter, async (req: Request, res: Response) => {
  const { conversationId } = req.body;
  const msgs = mockMessages.get(conversationId);

  if (!msgs || msgs.length === 0) {
    return res.status(400).json({ message: 'No messages found to regenerate' });
  }

  // Remove last assistant message if present
  if (msgs[msgs.length - 1].role === 'assistant') {
    msgs.pop();
  }

  const lastUserMsg = msgs.filter((m) => m.role === 'user').pop();
  if (!lastUserMsg) {
    return res.status(400).json({ message: 'No user message to regenerate response for' });
  }

  // Re-run chat endpoint logic
  req.body.message = lastUserMsg.content;
  return app._router.handle(req, res, () => {});
});

// ============================================================================
// SERVER INITIALIZATION & VITE MIDDLEWARE
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Flow AI] Full-stack server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
