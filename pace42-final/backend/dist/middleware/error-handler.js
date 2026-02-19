import { logger } from '../utils/logger.js';
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    // Log error
    logger.error('Error occurred', {
        statusCode,
        message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });
    // Send error response
    res.status(statusCode).json({
        error: {
            message,
            statusCode,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
};
export class ApiError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
export const notFound = (req, res, next) => {
    const error = new ApiError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};
// Made with Bob
//# sourceMappingURL=error-handler.js.map