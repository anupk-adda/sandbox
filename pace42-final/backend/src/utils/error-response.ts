import type { Request, Response } from 'express';

export const sendError = (
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, any>
) => {
  return res.status(status).json({
    error: message,
    code,
    requestId: (req as any).requestId,
    ...(extra || {}),
  });
};
