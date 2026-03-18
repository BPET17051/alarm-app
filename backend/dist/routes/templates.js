"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// GET /api/templates - List all templates
router.get('/', async (req, res) => {
    const { data, error } = await db_1.default
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });
    if (error)
        return res.status(500).json({ message: error.message });
    const templates = data.map(t => ({
        name: t.name,
        items: t.items_json
    }));
    res.json({ templates });
});
// POST /api/templates - Create a template
router.post('/', async (req, res) => {
    const { name, items } = req.body;
    if (!name || !items) {
        return res.status(400).json({ message: 'Missing name or items' });
    }
    // Check if template with same name exists (simple deduplication)
    const { data: existing } = await db_1.default
        .from('templates')
        .select('id')
        .eq('name', name)
        .single();
    if (existing) {
        // Update existing
        const { error } = await db_1.default
            .from('templates')
            .update({
            items_json: items,
            created_at: new Date().toISOString() // Touch timestamp
        })
            .eq('id', existing.id);
        if (error)
            return res.status(500).json({ message: error.message });
    }
    else {
        // Insert new
        const { error } = await db_1.default
            .from('templates')
            .insert({
            name,
            items_json: items
        });
        if (error)
            return res.status(500).json({ message: error.message });
    }
    res.status(201).json({ ok: true });
});
// DELETE /api/templates/:name - Delete a template
router.delete('/:name', async (req, res) => {
    const { name } = req.params;
    const { error } = await db_1.default
        .from('templates')
        .delete()
        .eq('name', name);
    if (error)
        return res.status(500).json({ message: error.message });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=templates.js.map