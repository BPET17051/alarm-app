"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'username and password are required' });
    }
    const user = db_1.default.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user)
        return res.status(401).json({ message: 'Invalid credentials' });
    const ok = bcryptjs_1.default.compareSync(password, user.password_hash);
    if (!ok)
        return res.status(401).json({ message: 'Invalid credentials' });
    const token = (0, auth_1.issueToken)({ userId: user.id, username: user.username, role: user.role });
    res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: config_1.TOKEN_TTL_MS });
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});
router.get('/me', auth_1.requireAuth, (req, res) => {
    res.json({ user: (0, auth_1.getUser)(req) });
});
exports.default = router;
//# sourceMappingURL=auth.js.map