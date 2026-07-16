import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

    if (!token) {
        res.status(401).json({ error: "Access token required" });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: string;
            email: string;
        };
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
};

export const optionalAuthToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) { next(); return; }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
        req.user = decoded;
    } catch { /* invalid token — treat as anonymous */ }
    next();
};
