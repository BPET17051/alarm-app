"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const alarms = db_1.default.prepare('SELECT * FROM alarms ORDER BY h ASC, m ASC').all();
    res.json(alarms);
});
router.post('/', (req, res) => {
    const { h, m, label, audio_id, audio_name } = req.body;
    if (h === undefined || m === undefined) {
        return res.status(400).json({ message: 'Missing time (h, m)' });
    }
    const id = node_crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    db_1.default.prepare(`
    INSERT INTO alarms (id, h, m, label, audio_id, audio_name, notify_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(id, h, m, label || '', audio_id || null, audio_name || '', now, now);
    res.status(201).json({ id, h, m, label, audio_id, audio_name, notify_status: 'PENDING', created_at: now, updated_at: now });
});
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { h, m, label, audio_id, audio_name, notify_status } = req.body;
    const now = new Date().toISOString();
    const current = db_1.default.prepare('SELECT * FROM alarms WHERE id = ?').get(id);
    if (!current)
        return res.status(404).json({ message: 'Alarm not found' });
    const updates = [];
    const values = [];
    if (h !== undefined) {
        updates.push('h = ?');
        values.push(h);
    }
    if (m !== undefined) {
        updates.push('m = ?');
        values.push(m);
    }
    if (label !== undefined) {
        updates.push('label = ?');
        values.push(label);
    }
    if (audio_id !== undefined) {
        updates.push('audio_id = ?');
        values.push(audio_id);
    }
    if (audio_name !== undefined) {
        updates.push('audio_name = ?');
        values.push(audio_name);
    }
    if (notify_status !== undefined) {
        updates.push('notify_status = ?');
        values.push(notify_status);
    }
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);
    db_1.default.prepare(`UPDATE alarms SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updated = db_1.default.prepare('SELECT * FROM alarms WHERE id = ?').get(id);
    res.json(updated);
});
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const result = db_1.default.prepare('DELETE FROM alarms WHERE id = ?').run(id);
    if (result.changes === 0)
        return res.status(404).json({ message: 'Alarm not found' });
    res.status(204).send();
});
router.delete('/', (req, res) => {
    db_1.default.prepare('DELETE FROM alarms').run();
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=alarms.js.map