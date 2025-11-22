"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueToken = issueToken;
exports.requireAuth = requireAuth;
exports.getUser = getUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function issueToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.JWT_SECRET, { expiresIn: Math.floor(config_1.TOKEN_TTL_MS / 1000) });
}
function requireAuth(req, res, next) {
    const bearer = req.headers.authorization?.split(' ');
    const token = req.cookies?.token || (bearer && bearer[0] === 'Bearer' ? bearer[1] : undefined);
    if (!token)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}
function getUser(req) {
    return req.user;
}
//# sourceMappingURL=auth.js.map