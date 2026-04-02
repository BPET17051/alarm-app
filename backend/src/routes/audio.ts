import { Router } from 'express';
import multer from 'multer';
import supabase from '../db';
import { sanitizeAudioDisplayName, stripAudioExtension } from '../utils/audio';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (_req, res) => {
  const { data: storageFiles, error: storageError } = await supabase.storage
    .from('audio')
    .list();

  if (storageError) {
    console.error('Supabase list error:', storageError);
    return res.status(500).json({ message: 'Failed to list audio files' });
  }

  const { data: dbFiles, error: dbError } = await supabase
    .from('audio_files')
    .select('*');

  if (dbError) {
    console.error('Database query error:', dbError);
  }

  const metadataMap = new Map((dbFiles || []).map(f => [f.id, f]));

  const files = storageFiles.map(file => {
    const { data: publicUrlData } = supabase.storage
      .from('audio')
      .getPublicUrl(file.name);

    const metadata = metadataMap.get(file.name);
    const displayName = sanitizeAudioDisplayName(metadata?.display_name || metadata?.original_name || file.name);

    return {
      id: file.name,
      displayName,
      fileName: metadata?.original_name || file.name,
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
  const displayName = sanitizeAudioDisplayName(req.body.displayName || stripAudioExtension(file.originalname));

  const timestamp = Date.now();
  const safeExt = fileExt?.replace(/[^a-zA-Z0-9]/g, '') || 'mp3';
  const filePath = `${timestamp}.${safeExt}`;

  const { error } = await supabase.storage
    .from('audio')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    console.error('Supabase upload error:', error);
    return res.status(500).json({ message: 'Failed to upload file', error });
  }

  const { error: dbError } = await supabase
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

  const { data: publicUrlData } = supabase.storage
    .from('audio')
    .getPublicUrl(filePath);

  res.status(201).json({
    id: filePath,
    displayName,
    fileName: file.originalname,
    url: publicUrlData.publicUrl
  });
});

router.delete('/:name', async (req, res) => {
  const { name } = req.params;
  console.log(`Deleting audio file: "${name}"`);

  const { error } = await supabase.storage
    .from('audio')
    .remove([name]);

  if (error) {
    console.error('Supabase delete error:', error);
    return res.status(500).json({ message: 'Failed to delete file' });
  }

  const { error: alarmsError } = await supabase
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

  const { error: dbError } = await supabase
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
  const { data } = supabase.storage
    .from('audio')
    .getPublicUrl(id);

  if (!data.publicUrl) {
    return res.status(404).json({ message: 'Audio not found' });
  }

  res.redirect(data.publicUrl);
});

export default router;
