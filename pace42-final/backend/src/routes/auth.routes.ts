/**
 * Auth Routes
 * Handles user authentication and Garmin credential validation
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../services/database/database-service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// JWT secret from environment or default
const JWT_SECRET = process.env.JWT_SECRET || 'pace42-development-secret-change-in-production';
const SALT_ROUNDS = 10;

// In-memory store for Garmin credentials (in production, use secure storage)
const garminCredentialsStore: Map<string, { username: string; password: string }> = new Map();

interface SignupRequest {
  username: string;
  password: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface GarminValidateRequest {
  garminUsername: string;
  garminPassword: string;
}

// Middleware to verify JWT token
export const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

// Signup route
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, password }: SignupRequest = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = databaseService.get('SELECT * FROM users WHERE email = ?', [username]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user with hashed password
    const userId = uuidv4();
    databaseService.run('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, username, hashedPassword]);

    // Generate JWT token (30 minutes expiry)
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30m' });

    logger.info('User signed up', { userId, username });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        username,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Signup error', { error });
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login route
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequest = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = databaseService.get('SELECT * FROM users WHERE email = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password - MUST have password_hash
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token (30 minutes expiry)
    const token = jwt.sign(
      { userId: user.id, username: user.email },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    logger.info('User logged in', { userId: user.id, username });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Validate Garmin credentials
router.post('/validate-garmin', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { garminUsername, garminPassword }: GarminValidateRequest = req.body;
    const userId = (req as any).user.userId;

    if (!garminUsername || !garminPassword) {
      return res.status(400).json({ error: 'Garmin username and password are required' });
    }

    // Store credentials (in production, encrypt these)
    garminCredentialsStore.set(userId, {
      username: garminUsername,
      password: garminPassword,
    });

    // Update user record with garmin_user_id
    databaseService.run('UPDATE users SET garmin_user_id = ? WHERE id = ?', [garminUsername, userId]);

    logger.info('Garmin credentials validated', { userId, garminUsername });

    res.json({
      valid: true,
      message: 'Garmin credentials validated successfully',
    });
  } catch (error) {
    logger.error('Garmin validation error', { error });
    res.status(500).json({ error: 'Failed to validate Garmin credentials' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    id: user.userId,
    username: user.username,
  });
});

// Helper function to get Garmin credentials for a user
export const getGarminCredentials = (userId: string): { username: string; password: string } | null => {
  return garminCredentialsStore.get(userId) || null;
};

export default router;
