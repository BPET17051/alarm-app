import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { APP_PORT, AUDIO_DIR, CORS_ORIGIN } from './config';
import './db'; // ensure migrations run
import authRouter from './routes/auth';
import templateRouter from './routes/templates';
import audioRouter from './routes/audio';
import alarmsRouter from './routes/alarms';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow localhost and local network IPs
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('http://192.168.')) return callback(null, true);
    // Allow ngrok domains
    if (origin.endsWith('.ngrok-free.app')) return callback(null, true);

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/audio/static', express.static(path.resolve(AUDIO_DIR)));

app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/templates', templateRouter);
app.use('/api/audio', audioRouter);
app.use('/api/alarms', alarmsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(APP_PORT, () => {
  console.log(`API listening on http://localhost:${APP_PORT}`);
});

