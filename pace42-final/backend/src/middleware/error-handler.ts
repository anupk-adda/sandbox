import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';
  const requestId = (req as any).requestId;

  // Log error
  logger.error('Error occurred', {
    statusCode,
    code,
    message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    requestId,
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      statusCode,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

export class ApiError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new ApiError(`Not found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

// Made with Bob
