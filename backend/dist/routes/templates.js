"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const templateSchema = zod_1.z.object({
    course: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        time: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
        label: zod_1.z.string().optional(),
        audioId: zod_1.z.string().optional()
    }))
        .nonempty('Must include at least one schedule item')
});
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const { course } = req.query;
    const stmt = course
        ? db_1.default.prepare('SELECT * FROM templates WHERE course = ? ORDER BY updated_at DESC')
        : db_1.default.prepare('SELECT * FROM templates ORDER BY updated_at DESC');
    const rows = (course ? stmt.all(course) : stmt.all());
    const templates = rows.map(row => ({
        id: row.id,
        course: row.course,
        name: row.name,
        description: row.description,
        items: JSON.parse(row.items_json),
        audioRefs: row.audio_refs_json ? JSON.parse(row.audio_refs_json) : [],
        updatedAt: row.updated_at
    }));
    res.json({ templates });
});
router.get('/:id', (req, res) => {
    const row = db_1.default.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!row)
        return res.status(404).json({ message: 'Template not found' });
    res.json({
        id: row.id,
        course: row.course,
        name: row.name,
        description: row.description,
        items: JSON.parse(row.items_json),
        audioRefs: row.audio_refs_json ? JSON.parse(row.audio_refs_json) : [],
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
    });
});
router.post('/', auth_1.requireAuth, (req, res) => {
    const result = templateSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ message: 'Invalid payload', issues: result.error.flatten() });
    }
    const id = node_crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    const user = (0, auth_1.getUser)(req);
    db_1.default.prepare(`INSERT INTO templates (id, course, name, description, items_json, audio_refs_json, created_at, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, result.data.course, result.data.name, result.data.description || null, JSON.stringify(result.data.items), JSON.stringify(result.data.items.map(it => it.audioId).filter(Boolean)), now, now, user?.username || null);
    res.status(201).json({ id });
});
router.put('/:id', auth_1.requireAuth, (req, res) => {
    const result = templateSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ message: 'Invalid payload', issues: result.error.flatten() });
    }
    const existing = db_1.default.prepare('SELECT id FROM templates WHERE id = ?').get(req.params.id);
    if (!existing)
        return res.status(404).json({ message: 'Template not found' });
    const now = new Date().toISOString();
    const user = (0, auth_1.getUser)(req);
    db_1.default.prepare(`UPDATE templates SET course=?, name=?, description=?, items_json=?, audio_refs_json=?, updated_at=?, updated_by=? WHERE id=?`).run(result.data.course, result.data.name, result.data.description || null, JSON.stringify(result.data.items), JSON.stringify(result.data.items.map(it => it.audioId).filter(Boolean)), now, user?.username || null, req.params.id);
    res.json({ id: req.params.id });
});
router.delete('/:id', auth_1.requireAuth, (req, res) => {
    const info = db_1.default.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
    if (info.changes === 0)
        return res.status(404).json({ message: 'Template not found' });
    res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=templates.js.map