import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from './config/config-loader.js';
import { databaseService } from './services/database/database-service.js';
import { vaultService } from './services/vault/vault-service.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';

// Import routes
import chatRoutes from './routes/chat.routes.js';
import trainingPlanRoutes from './routes/training-plan.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import authRoutes, { authenticateToken } from './routes/auth.routes.js';

class Server {
  private app: Express;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: config.api.cors.origins,
      credentials: config.api.cors.credentials,
    }));

    // Request correlation ID + timing
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = randomUUID();
      (req as any).requestId = requestId;
      res.setHeader('X-Request-Id', requestId);
      const start = Date.now();

      res.on('finish', () => {
        logger.info('Request completed', {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          userId: (req as any).user?.userId,
        });
      });

      next();
    });

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.api.rateLimit.windowMs,
      max: config.api.rateLimit.maxRequests,
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMITED',
          requestId: (req as any).requestId,
        });
      },
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: (req as any).requestId,
      });
      next();
    });
  }

  private setupRoutes(): void {
    const baseUrl = config.api.baseUrl;

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'running-coach-backend',
        version: '1.0.0',
      });
    });

    // API info
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Running Coach API',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          api: baseUrl,
        },
      });
    });

    // API routes
    logger.info('Registering chat routes', { path: `${baseUrl}/chat` });
    
    // Debug: Test direct route registration
    this.app.post(`${baseUrl}/chat-direct`, (req: Request, res: Response) => {
      logger.info('Direct route hit!');
      res.json({ message: 'Direct route works', body: req.body });
    });
    
    this.app.use(`${baseUrl}/chat`, authenticateToken, chatRoutes);
    logger.info('Chat routes registered successfully');
    this.app.use(`${baseUrl}/auth`, authRoutes);
    this.app.use(`${baseUrl}/subscription`, subscriptionRoutes);
    // this.app.use(`${baseUrl}/activities`, activityRoutes);
    // this.app.use(`${baseUrl}/analysis`, analysisRoutes);
    this.app.use(`${baseUrl}/training-plans`, trainingPlanRoutes);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      logger.info('404 handler reached', { path: req.path, method: req.method });
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    try {
      // Initialize Vault (if configured)
      if (vaultService.isConfigured()) {
        logger.info('Authenticating with Vault...');
        const vaultReady = await vaultService.authenticate();
        if (vaultReady) {
          logger.info('Vault authentication successful');
        } else {
          logger.warn('Vault authentication failed, using fallback mode');
        }
      } else {
        logger.warn('Vault not configured, using fallback mode');
      }

      // Connect to database
      logger.info('Connecting to database...');
      await databaseService.connect(config.database.path);
      logger.info('Database connected successfully');

      // Start server
      const port = config.api.port;
      const host = config.api.host;

      this.app.listen(port, host, () => {
        logger.info(`Server started successfully`, {
          host,
          port,
          environment: config.app.environment,
          url: `http://${host}:${port}`,
        });
        
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🏃 Running Coach Backend API`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  URL:         http://${host}:${port}`);
        console.log(`  Health:      http://${host}:${port}/health`);
        console.log(`  Environment: ${config.app.environment}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

// Start server
const server = new Server();
server.start();

// Made with Bob
