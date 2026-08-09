import { githubToRaw, isSupportedMediaUrl } from './mediaUrl'

describe('githubToRaw', () => {
  test('converts github blob URL to raw URL (master branch)', () => {
    expect(githubToRaw('https://github.com/user/repo/blob/master/docs/images/demo.gif'))
      .toBe('https://raw.githubusercontent.com/user/repo/master/docs/images/demo.gif')
  })

  test('converts github blob URL to raw URL (main branch)', () => {
    expect(githubToRaw('https://github.com/user/repo/blob/main/workflow.png'))
      .toBe('https://raw.githubusercontent.com/user/repo/main/workflow.png')
  })

  test('converts nested path URL correctly', () => {
    expect(githubToRaw('https://github.com/user/repo/blob/main/docs/images/demo.gif'))
      .toBe('https://raw.githubusercontent.com/user/repo/main/docs/images/demo.gif')
  })

  test('leaves already-raw URL unchanged', () => {
    const raw = 'https://raw.githubusercontent.com/user/repo/main/demo.gif'
    expect(githubToRaw(raw)).toBe(raw)
  })

  test('leaves imgur URL unchanged', () => {
    const imgur = 'https://i.imgur.com/abc123.gif'
    expect(githubToRaw(imgur)).toBe(imgur)
  })

  test('leaves non-github URL unchanged', () => {
    const url = 'https://example.com/image.png'
    expect(githubToRaw(url)).toBe(url)
  })

  test('returns empty string unchanged', () => {
    expect(githubToRaw('')).toBe('')
  })

  test('returns null unchanged', () => {
    expect(githubToRaw(null)).toBe(null)
  })

  test('returns undefined unchanged', () => {
    expect(githubToRaw(undefined)).toBe(undefined)
  })
})

describe('isSupportedMediaUrl', () => {
  test.each(['.gif', '.png', '.jpg', '.jpeg', '.webp'])('accepts %s extension', ext => {
    expect(isSupportedMediaUrl(`https://example.com/image${ext}`)).toBe(true)
  })

  test('is case-insensitive for extensions', () => {
    expect(isSupportedMediaUrl('https://example.com/image.GIF')).toBe(true)
    expect(isSupportedMediaUrl('https://example.com/image.PNG')).toBe(true)
  })

  test('rejects unsupported extension .mp4', () => {
    expect(isSupportedMediaUrl('https://example.com/video.mp4')).toBe(false)
  })

  test('rejects unsupported extension .pdf', () => {
    expect(isSupportedMediaUrl('https://example.com/file.pdf')).toBe(false)
  })

  test('ignores query params when checking extension', () => {
    expect(isSupportedMediaUrl('https://example.com/image.png?v=123')).toBe(true)
  })

  test('returns false for empty string', () => {
    expect(isSupportedMediaUrl('')).toBe(false)
  })

  test('returns false for null', () => {
    expect(isSupportedMediaUrl(null)).toBe(false)
  })
})
