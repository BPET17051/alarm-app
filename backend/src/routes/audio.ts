import { Router } from 'express';
import multer from 'multer';
import supabase from '../db';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// List available audio files
router.get('/', async (req, res) => {
  const { data, error } = await supabase.storage
    .from('audio')
    .list();

  if (error) {
    console.error('Supabase list error:', error);
    return res.status(500).json({ message: 'Failed to list audio files' });
  }

  // Map to simple objects
  const files = data.map(file => {
    const { data: publicUrlData } = supabase.storage
      .from('audio')
      .getPublicUrl(file.name);

    return {
      id: file.name,
      name: decodeURIComponent(file.name), // Decode for display
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
  let rawName = req.body.customName || file.originalname;
  // Ensure extension is preserved or added
  if (!rawName.toLowerCase().endsWith(`.${fileExt?.toLowerCase()}`)) {
    rawName = `${rawName}.${fileExt}`;
  }

  // Sanitize filename to avoid issues, allowing Thai characters (\u0E00-\u0E7F)
  const sanitized = rawName.replace(/[^a-zA-Z0-9.\-_\u0E00-\u0E7F]/g, '_');
  // Encode to ensure storage key validity (Supabase/S3 issue with Thai chars)
  const filePath = encodeURIComponent(sanitized);

  const { data, error } = await supabase.storage
    .from('audio')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    console.error('Supabase upload error:', error);
    return res.status(500).json({ message: 'Failed to upload file', error: error });
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('audio')
    .getPublicUrl(filePath);

  res.status(201).json({
    id: filePath,
    name: decodeURIComponent(filePath), // Return decoded for display
    url: publicUrlData.publicUrl
  });
});

router.delete('/:name', async (req, res) => {
  const { name } = req.params;
  console.log(`🗑️ Deleting audio file: "${name}"`); // Debug log

  const { error } = await supabase.storage
    .from('audio')
    .remove([name]);

  if (error) {
    console.error('Supabase delete error:', error);
    return res.status(500).json({ message: 'Failed to delete file' });
  }

  res.json({ message: 'File deleted successfully' });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  // For Supabase, the ID is the path, so we can just generate the URL
  const { data } = supabase.storage
    .from('audio')
    .getPublicUrl(id);

  if (!data.publicUrl) {
    return res.status(404).json({ message: 'Audio not found' });
  }

  // Redirect to the public URL
  res.redirect(data.publicUrl);
});

export default router;
