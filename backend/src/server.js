import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'pace42-secret-key-change-in-production';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:5001';

// Ensure data directory exists
await fs.mkdir(DATA_DIR, { recursive: true });

// Simple hash function
function hashPassword(password) {
  return createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// Simple JWT implementation
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// User database
async function getUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// Agent service client
async function callAgentService(endpoint, method = 'GET', body = null) {
  try {
    const url = `${AGENT_SERVICE_URL}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Agent service error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Agent service call failed: ${error.message}`);
    throw error;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Request handler
const server = http.createServer(async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  // Health check
  if (pathname === '/health' && req.method === 'GET') {
    // Check agent service health
    let agentHealthy = false;
    try {
      const agentHealth = await callAgentService('/health');
      agentHealthy = agentHealth.status === 'ok';
    } catch (e) {
      console.error('Agent service not available:', e.message);
    }
    
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'pace42-backend',
      version: '1.0.0',
      agentService: agentHealthy ? 'healthy' : 'unavailable',
      chatService: agentHealthy ? 'healthy' : 'unavailable'
    }));
    return;
  }

  // Parse body for POST requests
  let body = {};
  if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {}
  }

  // Get auth token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = token ? verifyToken(token) : null;

  // Auth Routes
  if (pathname === '/api/v1/auth/signup' && req.method === 'POST') {
    const { username, password } = body;
    if (!username || !password) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Username and password required' }));
      return;
    }
    if (password.length < 6) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Password must be 6+ characters' }));
      return;
    }
    const users = await getUsers();
    if (users[username]) {
      res.writeHead(409);
      res.end(JSON.stringify({ error: 'Username already exists' }));
      return;
    }
    const userId = randomBytes(16).toString('hex');
    users[username] = {
      id: userId,
      username,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
      garminConnected: false
    };
    await saveUsers(users);
    const jwt = createToken({ userId, username });
    res.writeHead(201);
    res.end(JSON.stringify({ success: true, token: jwt, user: { id: userId, username } }));
    return;
  }

  if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
    const { username, password } = body;
    if (!username || !password) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Username and password required' }));
      return;
    }
    const users = await getUsers();
    const userData = users[username];
    if (!userData || !verifyPassword(password, userData.password)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid username or password' }));
      return;
    }
    const jwt = createToken({ userId: userData.id, username });
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      token: jwt,
      user: { id: userData.id, username },
      garminConnected: userData.garminConnected
    }));
    return;
  }

  if (pathname === '/api/v1/auth/validate-garmin' && req.method === 'POST') {
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const { garminUsername, garminPassword } = body;
    if (!garminUsername || !garminPassword) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Garmin credentials required' }));
      return;
    }
    
    // Store Garmin credentials (in production, validate with Garmin MCP)
    const users = await getUsers();
    if (users[user.username]) {
      users[user.username].garminUsername = garminUsername;
      users[user.username].garminPassword = hashPassword(garminPassword);
      users[user.username].garminConnected = true;
      await saveUsers(users);
    }
    res.writeHead(200);
    res.end(JSON.stringify({ valid: true, message: 'Garmin account connected successfully' }));
    return;
  }

  // Chat Routes
  if (pathname === '/api/v1/chat/health' && req.method === 'GET') {
    try {
      const agentHealth = await callAgentService('/health');
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', service: 'chat', agent: agentHealth }));
    } catch (error) {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'error', error: 'Agent service unavailable' }));
    }
    return;
  }

  if (pathname === '/api/v1/chat' && req.method === 'POST') {
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const { message, location } = body;
    
    try {
      // Step 1: Classify intent
      const intentResult = await callAgentService('/classify-intent', 'POST', { message });
      const intent = intentResult;
      
      console.log(`Intent classified: ${intent.type} (confidence: ${intent.confidence})`);
      
      // Step 2: Route to appropriate agent based on intent
      let agentResponse;
      
      if (intent.type === 'weather') {
        // Weather query - need location
        if (!location || location.latitude === undefined || location.longitude === undefined) {
          res.writeHead(200);
          res.end(JSON.stringify({
            response: 'Please enable location access so I can check running conditions in your area.',
            sessionId: 'session-' + Date.now(),
            intent: 'weather',
            requiresGarminData: false,
            agent: 'Weather Agent',
            confidence: intent.confidence
          }));
          return;
        }
        
        agentResponse = await callAgentService('/running-conditions', 'POST', { 
          latitude: location.latitude, 
          longitude: location.longitude 
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          response: agentResponse.analysis,
          sessionId: 'session-' + Date.now(),
          intent: 'weather',
          requiresGarminData: false,
          agent: agentResponse.agent,
          confidence: intent.confidence,
          weather: agentResponse.weather
        }));
        return;
      }
      
      if (intent.type === 'last_run') {
        agentResponse = await callAgentService('/analyze-latest-run', 'POST');
        res.writeHead(200);
        res.end(JSON.stringify({
          response: agentResponse.analysis,
          sessionId: 'session-' + Date.now(),
          intent: 'last_run',
          requiresGarminData: true,
          agent: agentResponse.agent,
          confidence: intent.confidence,
          charts: agentResponse.charts
        }));
        return;
      }
      
      if (intent.type === 'fitness_trend') {
        agentResponse = await callAgentService('/analyze-fitness-trends?num_runs=8', 'POST');
        res.writeHead(200);
        res.end(JSON.stringify({
          response: agentResponse.analysis,
          sessionId: 'session-' + Date.now(),
          intent: 'fitness_trend',
          requiresGarminData: true,
          agent: agentResponse.agent,
          confidence: intent.confidence,
          charts: agentResponse.charts
        }));
        return;
      }
      
      if (intent.type === 'training_plan') {
        res.writeHead(200);
        res.end(JSON.stringify({
          response: 'I can help you create a training plan! Tell me your goal distance (5K, 10K, Half Marathon, or Marathon) and target race date.',
          sessionId: 'session-' + Date.now(),
          intent: 'training_plan',
          requiresGarminData: false,
          agent: 'Plan Coach',
          confidence: intent.confidence
        }));
        return;
      }
      
      // Default: General coach Q&A
      agentResponse = await callAgentService('/ask-coach', 'POST', { message });
      res.writeHead(200);
      res.end(JSON.stringify({
        response: agentResponse.analysis,
        sessionId: 'session-' + Date.now(),
        intent: 'general',
        requiresGarminData: false,
        agent: agentResponse.agent,
        confidence: intent.confidence
      }));
      
    } catch (error) {
      console.error('Chat error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        error: 'Failed to process request',
        detail: error.message 
      }));
    }
    return;
  }

  // Training Plans
  if (pathname === '/api/v1/training-plans/active' && req.method === 'GET') {
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'empty',
      plan: null,
      prompts: [
        { id: '1', label: 'Create training plan', action: 'create_plan', priority: 1 },
        { id: '2', label: 'Connect Garmin', action: 'connect_garmin', priority: 2 }
      ]
    }));
    return;
  }

  // Fetch runs endpoint
  if (pathname === '/api/v1/chat/fetch-runs' && req.method === 'POST') {
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ charts: [] }));
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', path: pathname }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏃 pace42 Backend API - Production');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  URL:           http://localhost:${PORT}`);
  console.log(`  Health:        http://localhost:${PORT}/health`);
  console.log(`  Agent Service: ${AGENT_SERVICE_URL}`);
  console.log(`  Data:          ${DATA_DIR}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
