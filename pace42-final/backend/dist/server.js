import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/config-loader.js';
import { databaseService } from './services/database/database-service.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
// Import routes
import chatRoutes from './routes/chat.routes.js';
import trainingPlanRoutes from './routes/training-plan.routes.js';
import authRoutes from './routes/auth.routes.js';
// import activityRoutes from './routes/activity.routes';
// import analysisRoutes from './routes/analysis.routes';
// import trainingPlanRoutes from './routes/training-plan.routes';
class Server {
    app;
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        // Security
        this.app.use(helmet());
        // CORS
        this.app.use(cors({
            origin: config.api.cors.origins,
            credentials: config.api.cors.credentials,
        }));
        // Rate limiting
        const limiter = rateLimit({
            windowMs: config.api.rateLimit.windowMs,
            max: config.api.rateLimit.maxRequests,
            message: 'Too many requests from this IP, please try again later.',
        });
        this.app.use(limiter);
        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            logger.info('Incoming request', {
                method: req.method,
                path: req.path,
                ip: req.ip,
            });
            next();
        });
    }
    setupRoutes() {
        const baseUrl = config.api.baseUrl;
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: 'running-coach-backend',
                version: '1.0.0',
            });
        });
        // API info
        this.app.get('/', (req, res) => {
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
        this.app.post(`${baseUrl}/chat-direct`, (req, res) => {
            logger.info('Direct route hit!');
            res.json({ message: 'Direct route works', body: req.body });
        });
        this.app.use(`${baseUrl}/chat`, chatRoutes);
        logger.info('Chat routes registered successfully');
        this.app.use(`${baseUrl}/auth`, authRoutes);
        // this.app.use(`${baseUrl}/activities`, activityRoutes);
        // this.app.use(`${baseUrl}/analysis`, analysisRoutes);
        this.app.use(`${baseUrl}/training-plans`, trainingPlanRoutes);
        // 404 handler
        this.app.use((req, res) => {
            logger.info('404 handler reached', { path: req.path, method: req.method });
            res.status(404).json({
                error: 'Not found',
                path: req.path,
            });
        });
    }
    setupErrorHandling() {
        this.app.use(errorHandler);
    }
    async start() {
        try {
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
        }
        catch (error) {
            logger.error('Failed to start server', { error });
            process.exit(1);
        }
    }
}
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
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
//# sourceMappingURL=server.js.map