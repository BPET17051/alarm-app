const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|aac|m4a|flac)$/i;
const AUDIO_DISPLAY_NAME_MAX_LENGTH = 40;

export function stripAudioExtension(raw: string): string {
  return raw.trim().replace(AUDIO_EXTENSION_PATTERN, '');
}

export function sanitizeAudioDisplayName(raw: string | null | undefined, fallback = 'Default Alarm Sound'): string {
  const trimmed = stripAudioExtension(raw || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, AUDIO_DISPLAY_NAME_MAX_LENGTH);
}
