import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SECRET_KEY } from './config';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export default supabase;
