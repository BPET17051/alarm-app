import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import supabase from '../db';
import { renewChannelLease } from '../services/channelLease';

export interface ChannelRequest extends Request {
  channelId: string;
  channelToken: string;
  leaseExpiresAt: string | null;
}

const uuidSchema = z.string().uuid();
const tokenSchema = z.string().min(8).max(128);

export function requireChannelLease(paramName: 'channelId' | 'id' = 'channelId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const channelId = uuidSchema.safeParse(req.params[paramName]);
    if (!channelId.success) return res.status(400).json({ message: 'Invalid channel id' });

    const token = tokenSchema.safeParse(req.header('x-channel-token'));
    if (!token.success) return res.status(400).json({ message: 'Missing X-Channel-Token header' });

    const lease = await renewChannelLease(channelId.data, token.data);
    if (!lease.ok) {
      const { data } = await supabase.from('channels').select('id').eq('id', channelId.data).maybeSingle();
      if (!data) return res.status(404).json({ message: 'Channel not found' });
      return res.status(409).json({ message: 'Channel is in use by another session' });
    }

    const channelReq = req as ChannelRequest;
    channelReq.channelId = channelId.data;
    channelReq.channelToken = token.data;
    channelReq.leaseExpiresAt = lease.expiresAt;
    next();
  };
}
