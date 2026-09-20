import supabase from '../db';

export async function renewChannelLease(channelId: string, token: string) {
  const { data, error } = await supabase.rpc('acquire_channel_lock', {
    p_channel_id: channelId,
    p_token: token,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    ok: result?.ok === true,
    expiresAt: (result?.expires_at ?? null) as string | null,
  };
}

export async function releaseChannelLease(channelId: string, token: string) {
  const { error } = await supabase
    .from('channels')
    .update({ lock_token: null, lock_expires_at: null })
    .eq('id', channelId)
    .eq('lock_token', token);
  if (error) throw error;
}
