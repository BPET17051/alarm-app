"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = __importDefault(require("../db"));
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, config_1.AUDIO_DIR),
    filename: (_req, file, cb) => {
        const id = node_crypto_1.default.randomUUID();
        const ext = node_path_1.default.extname(file.originalname || '');
        cb(null, `${id}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/'))
            cb(null, true);
        else
            cb(new Error('Only audio files are allowed'));
    }
});
const router = (0, express_1.Router)();
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file)
        return res.status(400).json({ message: 'Missing audio file' });
    const id = node_path_1.default.parse(req.file.filename).name;
    const user = (0, auth_1.getUser)(req);
    db_1.default.prepare(`INSERT INTO audio_files (id, file_name, mime, size, stored_path, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.file.originalname, req.file.mimetype, req.file.size, req.file.path, new Date().toISOString(), user?.username || null);
    res.status(201).json({ id, url: `/audio/${id}` });
});
router.get('/:id', (req, res) => {
    const row = db_1.default.prepare('SELECT * FROM audio_files WHERE id = ?').get(req.params.id);
    if (!row)
        return res.status(404).json({ message: 'Audio not found' });
    if (!node_fs_1.default.existsSync(row.stored_path))
        return res.status(410).json({ message: 'Audio missing on disk' });
    res.setHeader('Content-Type', row.mime);
    const stream = node_fs_1.default.createReadStream(row.stored_path);
    stream.pipe(res);
});
exports.default = router;
//# sourceMappingURL=audio.js.map