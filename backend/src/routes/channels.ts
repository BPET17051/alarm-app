import { Router } from 'express';
import { z } from 'zod';
import supabase from '../db';
import { requireChannelLease, type ChannelRequest } from '../middleware/channelLease';
import { releaseChannelLease } from '../services/channelLease';
import { getCurrentBangkokDayBounds } from '../utils/dayKey';

const router = Router();

const nameSchema = z.object({ name: z.string().trim().min(1).max(60) });
const uuidSchema = z.string().uuid();
const tokenSchema = z.string().min(8).max(128);

function toChannel(row: { id: string; name: string; lock_expires_at: string | null }) {
  const locked = row.lock_expires_at !== null && new Date(row.lock_expires_at).getTime() > Date.now();
  return { id: row.id, name: row.name, locked, expiresAt: locked ? row.lock_expires_at : null };
}

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('channels')
    .select('id,name,lock_expires_at')
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data.map(toChannel));
});

router.post('/', async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Channel name must be 1-60 characters' });

  const { data, error } = await supabase
    .from('channels')
    .insert({ name: parsed.data.name })
    .select('id,name,lock_expires_at')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A channel with this name already exists' });
    return res.status(500).json({ message: error.message });
  }
  res.status(201).json(toChannel(data));
});

router.post('/:id/lock', requireChannelLease('id'), (req, res) => {
  res.json({ expiresAt: (req as ChannelRequest).leaseExpiresAt });
});

router.post('/:id/unlock', async (req, res) => {
  const id = uuidSchema.safeParse(req.params.id);
  const token = tokenSchema.safeParse(req.header('x-channel-token'));
  if (!id.success || !token.success) return res.status(400).json({ message: 'Invalid channel id or token' });
  await releaseChannelLease(id.data, token.data);
  res.status(204).send();
});

router.patch('/:id', requireChannelLease('id'), async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Channel name must be 1-60 characters' });

  const { data, error } = await supabase
    .from('channels')
    .update({ name: parsed.data.name })
    .eq('id', (req as ChannelRequest).channelId)
    .select('id,name,lock_expires_at')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A channel with this name already exists' });
    return res.status(500).json({ message: error.message });
  }
  res.json(toChannel(data));
});

router.delete('/:id', requireChannelLease('id'), async (req, res) => {
  const { channelId, channelToken } = req as ChannelRequest;
  // Old alarms are hidden by the daily list but still hold a foreign key to this channel.
  const { startIso } = getCurrentBangkokDayBounds();
  const { error: cleanupError } = await supabase
    .from('alarms')
    .delete()
    .eq('channel_id', channelId)
    .lt('created_at', startIso);

  if (cleanupError) {
    await releaseChannelLease(channelId, channelToken);
    return res.status(500).json({ message: cleanupError.message });
  }

  const { error } = await supabase.from('channels').delete().eq('id', channelId);

  if (error) {
    await releaseChannelLease(channelId, channelToken);
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Clear this channel\'s alarms before deleting it' });
    }
    return res.status(500).json({ message: error.message });
  }
  res.status(204).send();
});

export default router;
