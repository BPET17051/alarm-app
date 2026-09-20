import { Router } from 'express';
import supabase from '../db';
import type { ChannelRequest } from '../middleware/channelLease';
import { getCurrentBangkokDayBounds } from '../utils/dayKey';

const router = Router({ mergeParams: true });

function mapAlarm(a: any) {
    const { audio_id, audio_name, channel_id: _channelId, ...rest } = a;
    return {
        ...rest,
        s: a.s || 0,
        audioId: audio_id,
        audioDisplayName: audio_name,
    };
}

router.get('/', async (req, res) => {
    const { channelId } = req as unknown as ChannelRequest;
    const { startIso, endIso } = getCurrentBangkokDayBounds();

    const { data, error } = await supabase
        .from('alarms')
        .select('*')
        .eq('channel_id', channelId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('h', { ascending: true })
        .order('m', { ascending: true })
        .order('s', { ascending: true });

    if (error) return res.status(500).json({ message: error.message });

    res.json(data.map(mapAlarm));
});

router.post('/', async (req, res) => {
    const { channelId } = req as unknown as ChannelRequest;
    const { h, m, s, audioId, audioDisplayName } = req.body;

    if (h === undefined || m === undefined) {
        return res.status(400).json({ message: 'Missing time (h, m)' });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('alarms')
        .insert({
            channel_id: channelId,
            h, m, s: s || 0,
            audio_id: audioId || null,
            audio_name: audioDisplayName || '',
            notify_status: 'PENDING',
            created_at: now,
            updated_at: now
        })
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });

    res.status(201).json(mapAlarm(data));
});

router.put('/:id', async (req, res) => {
    const { channelId } = req as unknown as ChannelRequest;
    const { id } = req.params;
    const { h, m, s, audioId, audioDisplayName, notify_status } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (h !== undefined) updates.h = h;
    if (m !== undefined) updates.m = m;
    if (s !== undefined) updates.s = s;
    if (audioId !== undefined) updates.audio_id = audioId;
    if (audioDisplayName !== undefined) updates.audio_name = audioDisplayName;
    if (notify_status !== undefined) updates.notify_status = notify_status;

    const { data, error } = await supabase
        .from('alarms')
        .update(updates)
        .eq('id', id)
        .eq('channel_id', channelId)
        .select()
        .maybeSingle();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(404).json({ message: 'Alarm not found' });

    res.json(mapAlarm(data));
});

router.delete('/:id', async (req, res) => {
    const { channelId } = req as unknown as ChannelRequest;
    const { id } = req.params;
    const { data, error } = await supabase
        .from('alarms')
        .delete()
        .eq('id', id)
        .eq('channel_id', channelId)
        .select('id');
    if (error) return res.status(500).json({ message: error.message });
    if (!data || data.length === 0) return res.status(404).json({ message: 'Alarm not found' });
    res.status(204).send();
});

// Clears every alarm in the channel (not just today's), so a channel can always be emptied and then deleted.
router.delete('/', async (req, res) => {
    const { channelId } = req as unknown as ChannelRequest;
    const { error } = await supabase.from('alarms').delete().eq('channel_id', channelId);
    if (error) return res.status(500).json({ message: error.message });
    res.status(204).send();
});

export default router;
