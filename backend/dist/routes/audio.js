"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.get('/', async (_req, res) => {
    const { data: storageFiles, error: storageError } = await db_1.default.storage
        .from('audio')
        .list();
    if (storageError) {
        console.error('Supabase list error:', storageError);
        return res.status(500).json({ message: 'Failed to list audio files' });
    }
    const { data: dbFiles, error: dbError } = await db_1.default
        .from('audio_files')
        .select('*');
    if (dbError) {
        console.error('Database query error:', dbError);
    }
    const metadataMap = new Map((dbFiles || []).map(f => [f.id, f]));
    const files = storageFiles.map(file => {
        const { data: publicUrlData } = db_1.default.storage
            .from('audio')
            .getPublicUrl(file.name);
        const metadata = metadataMap.get(file.name);
        const displayName = metadata?.display_name || file.name;
        return {
            id: file.name,
            name: displayName,
            url: publicUrlData.publicUrl,
            size: file.metadata?.size,
            created_at: file.created_at
        };
    });
    res.json(files);
});
router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    let displayName = req.body.customName || file.originalname;
    if (!displayName.toLowerCase().endsWith(`.${fileExt?.toLowerCase()}`)) {
        displayName = `${displayName}.${fileExt}`;
    }
    const timestamp = Date.now();
    const safeExt = fileExt?.replace(/[^a-zA-Z0-9]/g, '') || 'mp3';
    const filePath = `${timestamp}.${safeExt}`;
    const { error } = await db_1.default.storage
        .from('audio')
        .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
    });
    if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: 'Failed to upload file', error });
    }
    const { error: dbError } = await db_1.default
        .from('audio_files')
        .upsert({
        id: filePath,
        display_name: displayName,
        original_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype
    });
    if (dbError) {
        console.error('Database insert error:', dbError);
    }
    const { data: publicUrlData } = db_1.default.storage
        .from('audio')
        .getPublicUrl(filePath);
    res.status(201).json({
        id: filePath,
        name: displayName,
        url: publicUrlData.publicUrl
    });
});
router.delete('/:name', async (req, res) => {
    const { name } = req.params;
    console.log(`Deleting audio file: "${name}"`);
    const { error } = await db_1.default.storage
        .from('audio')
        .remove([name]);
    if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({ message: 'Failed to delete file' });
    }
    const { error: alarmsError } = await db_1.default
        .from('alarms')
        .update({
        audio_id: null,
        audio_name: '',
        updated_at: new Date().toISOString()
    })
        .eq('audio_id', name);
    if (alarmsError) {
        console.error('Alarm cleanup error:', alarmsError);
    }
    const { error: dbError } = await db_1.default
        .from('audio_files')
        .delete()
        .eq('id', name);
    if (dbError) {
        console.error('Database delete error:', dbError);
    }
    res.json({
        message: 'File deleted successfully',
        cleanedAlarmReferences: !alarmsError
    });
});
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const { data } = db_1.default.storage
        .from('audio')
        .getPublicUrl(id);
    if (!data.publicUrl) {
        return res.status(404).json({ message: 'Audio not found' });
    }
    res.redirect(data.publicUrl);
});
exports.default = router;
//# sourceMappingURL=audio.js.map