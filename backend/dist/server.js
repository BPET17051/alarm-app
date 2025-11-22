"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("./config");
require("./db"); // ensure migrations run
const auth_1 = __importDefault(require("./routes/auth"));
const templates_1 = __importDefault(require("./routes/templates"));
const audio_1 = __importDefault(require("./routes/audio"));
const alarms_1 = __importDefault(require("./routes/alarms"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: config_1.CORS_ORIGIN.split(',').map(o => o.trim()), credentials: true }));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
app.use('/audio/static', express_1.default.static(node_path_1.default.resolve(config_1.AUDIO_DIR)));
app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
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