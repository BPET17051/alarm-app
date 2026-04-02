const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|aac|m4a|flac)$/i;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;
const ZERO_WIDTH_CHAR_PATTERN = /[\u200B-\u200D\uFEFF]/g;
const REPLACEMENT_CHAR_PATTERN = /\uFFFD/g;
const AUDIO_DISPLAY_NAME_MAX_LENGTH = 40;

function normalizeDisplayText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(REPLACEMENT_CHAR_PATTERN, '')
    .replace(ZERO_WIDTH_CHAR_PATTERN, '')
    .replace(CONTROL_CHAR_PATTERN, ' ');
}

export function stripAudioExtension(raw: string): string {
  return normalizeDisplayText(raw).trim().replace(AUDIO_EXTENSION_PATTERN, '');
}

export function sanitizeAudioDisplayName(raw: string | null | undefined, fallback = 'Default Alarm Sound'): string {
  const trimmed = stripAudioExtension(raw || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, AUDIO_DISPLAY_NAME_MAX_LENGTH);
}
