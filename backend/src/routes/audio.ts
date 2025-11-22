import { Router } from 'express';
import multer from 'multer';
import supabase from '../db';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const file = req.file;
  const fileExt = file.originalname.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from('audio')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('Supabase upload error:', error);
    return res.status(500).json({ message: 'Failed to upload file' });
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('audio')
    .getPublicUrl(filePath);

  res.status(201).json({
    id: filePath, // We use the path as the ID
    url: publicUrlData.publicUrl
  });
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
