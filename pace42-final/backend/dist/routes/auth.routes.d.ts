/**
 * Auth Routes
 * Handles user authentication and Garmin credential validation
 */
import { Request, Response } from 'express';
declare const router: import("express-serve-static-core").Router;
export declare const authenticateToken: (req: Request, res: Response, next: Function) => Response<any, Record<string, any>> | undefined;
export declare const getGarminCredentials: (userId: string) => {
    username: string;
    password: string;
} | null;
export default router;
//# sourceMappingURL=auth.routes.d.ts.map