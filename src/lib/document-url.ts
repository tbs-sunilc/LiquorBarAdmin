const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://192.168.1.231:5000';
const LOCAL_KEY_PREFIX = 'local://';
const USER_DOCUMENTS_PREFIX = 'User Documents/';

export function getDocumentUrl(url?: string | null): string {
  if (!url) return '';

  let normalizedUrl = url.replace(/\\/g, '/').trim();
  if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
    return normalizedUrl;
  }

  if (normalizedUrl.startsWith('/api/v1/documents/local/')) {
    return `${API_BASE_URL}${normalizedUrl}`;
  }

  if (normalizedUrl.startsWith(LOCAL_KEY_PREFIX)) {
    normalizedUrl = normalizedUrl.slice(LOCAL_KEY_PREFIX.length);
  }

  normalizedUrl = normalizedUrl.replace(/^\/+/, '');

  if (normalizedUrl.startsWith(USER_DOCUMENTS_PREFIX)) {
    normalizedUrl = normalizedUrl.slice(USER_DOCUMENTS_PREFIX.length);
  }

  const encodedPath = normalizedUrl
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');

  return `${API_BASE_URL}/api/v1/documents/local/${encodedPath}`;
}
