import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, TOKEN_TTL_MS } from '../config';

export type AuthPayload = {
  userId: number;
  username: string;
  role: string;
};

export function issueToken(payload: AuthPayload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: Math.floor(TOKEN_TTL_MS / 1000) });
}

export function requireAuth(req: Request, res: Response, next: NextFunction){
  const bearer = req.headers.authorization?.split(' ');
  const token = req.cookies?.token || (bearer && bearer[0]==='Bearer' ? bearer[1] : undefined);
  if(!token) return res.status(401).json({ message: 'Unauthorized' });
  try{
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = decoded;
    next();
  }catch(err){
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function getUser(req: Request): AuthPayload | undefined{
  return (req as any).user;
}
