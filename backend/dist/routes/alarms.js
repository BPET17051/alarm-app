"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const dayKey_1 = require("../utils/dayKey");
const router = (0, express_1.Router)();
function mapAlarm(a) {
    return {
        ...a,
        s: a.s || 0,
        audioId: a.audio_id,
        audioName: a.audio_name,
        audio_id: undefined,
        audio_name: undefined
    };
}
async function cleanupStaleAlarms(startIso, endIso) {
    const [{ error: deleteOldError }, { error: deleteFutureError }] = await Promise.all([
        db_1.default.from('alarms').delete().lt('created_at', startIso),
        db_1.default.from('alarms').delete().gte('created_at', endIso)
    ]);
    if (deleteOldError || deleteFutureError) {
        throw new Error(deleteOldError?.message || deleteFutureError?.message);
    }
}
router.get('/', async (req, res) => {
    const { startIso, endIso } = (0, dayKey_1.getCurrentBangkokDayBounds)();
    try {
        await cleanupStaleAlarms(startIso, endIso);
    }
    catch (error) {
        return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to clean alarms' });
    }
    const { data, error } = await db_1.default
        .from('alarms')
        .select('*')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('h', { ascending: true })
        .order('m', { ascending: true })
        .order('s', { ascending: true });
    if (error)
        return res.status(500).json({ message: error.message });
    res.json(data.map(mapAlarm));
});
router.post('/', async (req, res) => {
    const { h, m, s, audioId, audioName } = req.body;
    if (h === undefined || m === undefined) {
        return res.status(400).json({ message: 'Missing time (h, m)' });
    }
    const sec = s || 0;
    const now = new Date().toISOString();
    const { data, error } = await db_1.default
        .from('alarms')
        .insert({
        h, m, s: sec,
        audio_id: audioId || null,
        audio_name: audioName || '',
        notify_status: 'PENDING',
        created_at: now,
        updated_at: now
    })
        .select()
        .single();
    if (error)
        return res.status(500).json({ message: error.message });
    res.status(201).json(mapAlarm(data));
});
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { h, m, s, audioId, audioName, notify_status } = req.body;
    const now = new Date().toISOString();
    const updates = { updated_at: now };
    if (h !== undefined)
        updates.h = h;
    if (m !== undefined)
        updates.m = m;
    if (s !== undefined)
        updates.s = s;
    if (audioId !== undefined)
        updates.audio_id = audioId;
    if (audioName !== undefined)
        updates.audio_name = audioName;
    if (notify_status !== undefined)
        updates.notify_status = notify_status;
    const { data, error } = await db_1.default
        .from('alarms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error)
        return res.status(500).json({ message: error.message });
    res.json(mapAlarm(data));
});
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await db_1.default.from('alarms').delete().eq('id', id);
    if (error)
        return res.status(500).json({ message: error.message });
    res.status(204).send();
});
router.delete('/', async (req, res) => {
    const { startIso, endIso } = (0, dayKey_1.getCurrentBangkokDayBounds)();
    const { error } = await db_1.default.from('alarms').delete().gte('created_at', startIso).lt('created_at', endIso);
    if (error)
        return res.status(500).json({ message: error.message });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=alarms.js.map