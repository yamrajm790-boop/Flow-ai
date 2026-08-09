import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Firebase Admin SDK
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0076726116';
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (firebaseClientEmail && firebasePrivateKey) {
  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey,
        }),
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

const frontendUrl = process.env.FRONTEND_URL || '*';
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

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
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    groqConfigured: Boolean(groqClient),
    firebaseConfigured: Boolean(getApps().length > 0),
    model: 'Flow AI', // Friendly label, NEVER expose internal model ID
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

  if (updatedTitle) {
    res.write(`data: ${JSON.stringify({ title: updatedTitle })}\n\n`);
  }

  let fullAiResponse = '';

  try {
    if (groqClient) {
      // Stream directly from Groq API
      const groqMessages = existingMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const stream = await groqClient.chat.completions.create({
        model: groqModel,
        messages: [
          {
            role: 'system',
            content:
              'You are Flow AI, an intelligent, helpful, highly capable AI assistant. Give articulate, clear, well-structured answers using clean markdown formatting.',
          },
          ...groqMessages,
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
    console.error('[Flow AI Backend] Groq API Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Error generating AI response' })}\n\n`);
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
