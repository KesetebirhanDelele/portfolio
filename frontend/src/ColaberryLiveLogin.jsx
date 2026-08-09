import { useEffect, useRef, useState } from 'react'
import RFB from '@novnc/novnc'
import { authFetch, BASE_URL } from './api'

// Embedded live-browser panel: the user logs into their Colaberry account
// inline, in a real browser running server-side in an isolated container —
// nothing to install, no separate window. See PROGRESS.md M48/M49 for why
// this exists instead of a local helper script or browser extension.
function ColaberryLiveLogin({ onComplete, onCancel }) {
  const canvasContainerRef = useRef(null)
  const rfbRef = useRef(null)
  const sessionRef = useRef(null)
  const finishingRef = useRef(false)
  const [status, setStatus] = useState('starting') // starting | connecting | connected | completing | error
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const res = await authFetch(`${BASE_URL}/api/colaberry-login/start`, { method: 'POST' })
        const body = res ? await res.json() : null
        if (!body?.success) throw new Error(body?.error?.message || 'Failed to start session.')
        if (cancelled) return

        sessionRef.current = body.data
        setStatus('connecting')

        const wsProtocol = BASE_URL.startsWith('https') ? 'wss' : 'ws'
        const wsHost = BASE_URL.replace(/^https?:\/\//, '')
        const streamUrl = `${wsProtocol}://${wsHost}/api/colaberry-login/${body.data.sessionId}/stream?token=${encodeURIComponent(body.data.token)}`

        const rfb = new RFB(canvasContainerRef.current, streamUrl)
        rfb.scaleViewport = true
        rfb.addEventListener('connect', () => !cancelled && setStatus('connected'))
        rfb.addEventListener('disconnect', () => {
          if (cancelled || finishingRef.current) return
          setStatus('error')
          setError('Connection to the live browser was lost. Try again.')
        })
        rfbRef.current = rfb
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err.message)
        }
      }
    }

    start()

    return () => {
      cancelled = true
      rfbRef.current?.disconnect()
      if (sessionRef.current && !finishingRef.current) {
        authFetch(`${BASE_URL}/api/colaberry-login/${sessionRef.current.sessionId}/cancel`, { method: 'POST' }).catch(() => {})
      }
    }
  }, [])

  async function handleImLoggedIn() {
    if (!sessionRef.current) return
    finishingRef.current = true
    setStatus('completing')
    try {
      const res = await authFetch(
        `${BASE_URL}/api/colaberry-login/${sessionRef.current.sessionId}/complete`,
        { method: 'POST' }
      )
      const body = res ? await res.json() : null
      if (!body?.success) throw new Error(body?.error?.message || 'Failed to save your session.')
      rfbRef.current?.disconnect()
      onComplete?.()
    } catch (err) {
      finishingRef.current = false
      setStatus('error')
      setError(err.message)
    }
  }

  async function handleCancel() {
    finishingRef.current = true
    rfbRef.current?.disconnect()
    if (sessionRef.current) {
      await authFetch(`${BASE_URL}/api/colaberry-login/${sessionRef.current.sessionId}/cancel`, { method: 'POST' }).catch(() => {})
    }
    onCancel?.()
  }

  return (
    <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Connect your Colaberry account</h3>
          <p className="text-sm text-gray-500 mt-1">
            {status === 'connected'
              ? "Log in below exactly as you normally would. Once you're in, click \"I'm logged in\"."
              : 'Setting up a secure, isolated browser session…'}
          </p>
        </div>

        <div className="bg-black flex items-center justify-center" style={{ minHeight: 480 }}>
          {status !== 'connected' && status !== 'completing' && status !== 'error' && (
            <p className="text-gray-400 text-sm">Connecting…</p>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-sm px-6 text-center">{error}</p>
          )}
          <div
            ref={canvasContainerRef}
            className="w-full"
            style={{ display: status === 'connected' || status === 'completing' ? 'block' : 'none' }}
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleImLoggedIn}
            disabled={status !== 'connected'}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {status === 'completing' ? 'Saving session…' : "I'm logged in — Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ColaberryLiveLogin
