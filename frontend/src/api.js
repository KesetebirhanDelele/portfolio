// Empty string in production: nginx reverse-proxies /api/* to the backend on
// the same origin (see deployment.md), so a relative path works regardless
// of whether this is served from an IP or a domain — no rebuild needed if
// that changes. Dev keeps talking directly to the local backend on :5000.
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

export function authFetch(url, options = {}, onUnauthorized) {
  const token = localStorage.getItem('token')

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  }

  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      if (onUnauthorized) onUnauthorized('Session expired. Please log in again.')
      return null
    }
    return res
  })
}
