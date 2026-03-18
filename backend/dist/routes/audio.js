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
// List available audio files
router.get('/', async (req, res) => {
    // Get files from storage
    const { data: storageFiles, error: storageError } = await db_1.default.storage
        .from('audio')
        .list();
    if (storageError) {
        console.error('Supabase list error:', storageError);
        return res.status(500).json({ message: 'Failed to list audio files' });
    }
    // Get metadata from database
    const { data: dbFiles, error: dbError } = await db_1.default
        .from('audio_files')
        .select('*');
    if (dbError) {
        console.error('Database query error:', dbError);
        // Continue without metadata if DB query fails
    }
    // Create a map of id -> metadata
    const metadataMap = new Map((dbFiles || []).map(f => [f.id, f]));
    // Map to simple objects
    const files = storageFiles.map(file => {
        const { data: publicUrlData } = db_1.default.storage
            .from('audio')
            .getPublicUrl(file.name);
        // Get display name from database, fallback to filename
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
    // Use custom name if provided, otherwise original name
    let displayName = req.body.customName || file.originalname;
    // Ensure extension is preserved or added
    if (!displayName.toLowerCase().endsWith(`.${fileExt?.toLowerCase()}`)) {
        displayName = `${displayName}.${fileExt}`;
    }
    // Generate a safe ASCII filename for storage (timestamp-based)
    // This avoids Supabase storage key issues with Thai/special characters
    const timestamp = Date.now();
    const safeExt = fileExt?.replace(/[^a-zA-Z0-9]/g, '') || 'mp3';
    const filePath = `${timestamp}.${safeExt}`;
    // Store the display name in metadata so we can retrieve it later
    const metadata = {
        displayName: displayName
    };
    const { data, error } = await db_1.default.storage
        .from('audio')
        .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
    });
    if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: 'Failed to upload file', error: error });
    }
    // Save metadata to database
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
        // Continue even if DB insert fails - file is already uploaded
    }
    // Get public URL
    const { data: publicUrlData } = db_1.default.storage
        .from('audio')
        .getPublicUrl(filePath);
    res.status(201).json({
        id: filePath,
        name: displayName, // Return the original display name
        url: publicUrlData.publicUrl
    });
});
router.delete('/:name', async (req, res) => {
    const { name } = req.params;
    console.log(`🗑️ Deleting audio file: "${name}"`); // Debug log
    const { error } = await db_1.default.storage
        .from('audio')
        .remove([name]);
    if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({ message: 'Failed to delete file' });
    }
    // Also delete from database
    const { error: dbError } = await db_1.default
        .from('audio_files')
        .delete()
        .eq('id', name);
    if (dbError) {
        console.error('Database delete error:', dbError);
        // Continue even if DB delete fails - file is already deleted from storage
    }
    res.json({ message: 'File deleted successfully' });
});
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    // For Supabase, the ID is the path, so we can just generate the URL
    const { data } = db_1.default.storage
        .from('audio')
        .getPublicUrl(id);
    if (!data.publicUrl) {
        return res.status(404).json({ message: 'Audio not found' });
    }
    // Redirect to the public URL
    res.redirect(data.publicUrl);
});
exports.default = router;
//# sourceMappingURL=audio.js.map