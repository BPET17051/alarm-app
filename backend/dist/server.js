"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("./config");
require("./db"); // ensure migrations run
const auth_1 = __importDefault(require("./routes/auth"));
const templates_1 = __importDefault(require("./routes/templates"));
const audio_1 = __importDefault(require("./routes/audio"));
const alarms_1 = __importDefault(require("./routes/alarms"));
const app = (0, express_1.default)();
// Enable gzip compression for all responses
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // Allow localhost and local network IPs
        if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('http://192.168.'))
            return callback(null, true);
        // Allow ngrok domains
        if (origin.endsWith('.ngrok-free.app'))
            return callback(null, true);
        // Allow configured CORS_ORIGIN
        if (config_1.CORS_ORIGIN) {
            const allowed = config_1.CORS_ORIGIN.split(',').map(s => s.trim());
            console.log('CORS Check:', { origin, allowed, env: config_1.CORS_ORIGIN }); // DEBUG LOG
            if (allowed.includes('*') || allowed.includes(origin))
                return callback(null, true);
        }
        console.log('CORS Blocked:', origin); // DEBUG LOG
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
// Serve audio files with cache headers for better performance
app.use('/audio/static', express_1.default.static(node_path_1.default.resolve(config_1.AUDIO_DIR), {
    maxAge: '7d',
    etag: true,
    lastModified: true,
}));
app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/api/time', (_req, res) => {
    res.json({ iso: new Date().toISOString() });
});
app.use('/api/auth', auth_1.default);
app.use('/api/templates', templates_1.default);
app.use('/api/audio', audio_1.default);
app.use('/api/alarms', alarms_1.default);
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
});
app.listen(config_1.APP_PORT, () => {
    console.log(`API listening on http://localhost:${config_1.APP_PORT}`);
});
//# sourceMappingURL=server.js.map