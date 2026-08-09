const SUPPORTED_EXTENSIONS = ['.gif', '.png', '.jpg', '.jpeg', '.webp']

export function githubToRaw(url) {
  if (!url) return url
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
  }
  return url
}

export function isSupportedMediaUrl(url) {
  if (!url) return false
  const lower = url.toLowerCase().split('?')[0]
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext))
}
