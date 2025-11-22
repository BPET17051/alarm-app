import { Router } from 'express';
import supabase from '../db';

const router = Router();

router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('alarms')
        .select('*')
        .order('h', { ascending: true })
        .order('m', { ascending: true })
        .order('s', { ascending: true });

    if (error) return res.status(500).json({ message: error.message });

    const mapped = data.map(a => ({
        ...a,
        s: a.s || 0,
        audioId: a.audio_id,
        audioName: a.audio_name,
        audio_id: undefined,
        audio_name: undefined
    }));
    res.json(mapped);
});

router.post('/', async (req, res) => {
    const { h, m, s, label, audioId, audioName } = req.body;

    if (h === undefined || m === undefined) {
        return res.status(400).json({ message: 'Missing time (h, m)' });
    }

    const sec = s || 0;
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('alarms')
        .insert({
            h, m, s: sec,
            label: label || '',
            audio_id: audioId || null,
            audio_name: audioName || '',
            notify_status: 'PENDING',
            created_at: now,
            updated_at: now
        })
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });

    res.status(201).json({
        ...data,
        s: data.s || 0,
        audioId: data.audio_id,
        audioName: data.audio_name,
        audio_id: undefined,
        audio_name: undefined
    });
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { h, m, s, label, audioId, audioName, notify_status } = req.body;
    const now = new Date().toISOString();

    const updates: any = { updated_at: now };
    if (h !== undefined) updates.h = h;
    if (m !== undefined) updates.m = m;
    if (s !== undefined) updates.s = s;
    if (label !== undefined) updates.label = label;
    if (audioId !== undefined) updates.audio_id = audioId;
    if (audioName !== undefined) updates.audio_name = audioName;
    if (notify_status !== undefined) updates.notify_status = notify_status;

    const { data, error } = await supabase
        .from('alarms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });

    res.json({
        ...data,
        s: data.s || 0,
        audioId: data.audio_id,
        audioName: data.audio_name,
        audio_id: undefined,
        audio_name: undefined
    });
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('alarms').delete().eq('id', id);
    if (error) return res.status(500).json({ message: error.message });
    res.status(204).send();
});

router.delete('/', async (req, res) => {
    const { error } = await supabase.from('alarms').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (error) return res.status(500).json({ message: error.message });
    res.status(204).send();
});

export default router;
