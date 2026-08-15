import { useEffect, useState } from 'react'

// Specific, actionable copy per failure reason — a bare "Authentication
// failed" doesn't tell a rejected user whether to try again, wait, or stop.
const ERROR_MESSAGES = {
  no_colaberry_account: "We couldn't find a Colaberry account matching your GitHub email. Repo2Reputation is only available to Colaberry students and staff — sign in with the GitHub account that has your Colaberry email verified on it, or contact Colaberry if you believe this is a mistake.",
  colaberry_check_failed: "We couldn't verify your Colaberry account just now — our verification system is temporarily unavailable. Please try again in a few minutes.",
  access_denied: 'Sign-in was cancelled.',
  token_exchange_failed: 'GitHub sign-in failed. Please try again.',
  server_error: 'Something went wrong during sign-in. Please try again.',
}

// Read once, outside the effect — parsing the URL is a pure read, not a side
// effect, so it belongs in the lazy useState initializer, not in useEffect.
function readCallbackParams() {
  const params = new URLSearchParams(window.location.search)
  return { token: params.get('token'), error: params.get('error') }
}

function AuthCallback({ onLogin }) {
  const [{ token, error }] = useState(readCallbackParams)
  const failed = Boolean(error || !token)
  const message = failed ? (ERROR_MESSAGES[error] || 'Authentication failed.') : 'Completing sign-in…'

  useEffect(() => {
    if (failed) {
      // Give the user time to actually read a specific rejection reason
      // instead of silently bouncing them back in 2.5s.
      const timer = setTimeout(() => { window.location.replace('/') }, 8000)
      return () => clearTimeout(timer)
    }
    localStorage.setItem('token', decodeURIComponent(token))
    window.history.replaceState({}, '', '/')
    onLogin(decodeURIComponent(token))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token/error read once at mount by design
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f9fafb',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        {failed ? (
          <div style={{
            width: 44, height: 44, borderRadius: '50%', backgroundColor: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 20,
          }}>⚠️</div>
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid #e5e7eb', borderTopColor: '#6366f1',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
        )}
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0, lineHeight: 1.5 }}>{message}</p>
        {failed && (
          <button
            onClick={() => window.location.replace('/')}
            style={{
              marginTop: 20, fontSize: 13, color: '#6366f1', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
