import { useEffect, useState } from 'react'

function AuthCallback({ onLogin }) {
  const [message, setMessage] = useState('Completing sign-in…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    const error  = params.get('error')

    if (error || !token) {
      setMessage('Authentication failed. Redirecting…')
      setTimeout(() => { window.location.replace('/') }, 2500)
      return
    }

    localStorage.setItem('token', decodeURIComponent(token))
    window.history.replaceState({}, '', '/')
    onLogin(decodeURIComponent(token))
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f9fafb',
    }}>
      <div style={{ textAlign: 'center' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: '3px solid #e5e7eb', borderTopColor: '#6366f1',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default AuthCallback
