import { Router } from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../db';
import { issueToken, requireAuth, getUser } from '../middleware/auth';
import { TOKEN_TTL_MS } from '../config';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  // Supabase query
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = issueToken({ userId: user.id, username: user.username, role: user.role });
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: TOKEN_TTL_MS });
  return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: getUser(req) });
});

export default router;
