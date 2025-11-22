import { Request, Response, NextFunction } from 'express';
export type AuthPayload = {
    userId: number;
    username: string;
    role: string;
};
export declare function issueToken(payload: AuthPayload): string;
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function getUser(req: Request): AuthPayload | undefined;
//# sourceMappingURL=auth.d.ts.map