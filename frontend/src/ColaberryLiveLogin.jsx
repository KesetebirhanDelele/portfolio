import { useEffect, useRef, useState } from 'react'
import RFB from '@novnc/novnc'
import { authFetch, BASE_URL } from './api'

// Embedded live-browser panel: the user logs into their Colaberry account
// inline, in a real browser running server-side in an isolated container —
// nothing to install, no separate window. See PROGRESS.md M48/M49 for why
// this exists instead of a local helper script or browser extension.
//
// Step-by-step status + elapsed timer added after live testing showed the
// container can genuinely take 20-60s to boot under host load, and a silent
// black box during that wait reads as "broken" rather than "working". See
// PROGRESS.md M54.
const STEPS = [
  { key: 'starting',   label: 'Starting a secure, isolated browser session' },
  { key: 'connecting', label: 'Connecting to the live browser' },
  { key: 'connected',  label: 'Log in to Colaberry below' },
  { key: 'completing', label: 'Saving your session' },
]
const STEP_ORDER = STEPS.map(s => s.key)

function ColaberryLiveLogin({ onComplete, onCancel }) {
  const canvasContainerRef = useRef(null)
  const rfbRef = useRef(null)
  const sessionRef = useRef(null)
  const finishingRef = useRef(false)
  const [status, setStatus] = useState('starting') // starting | connecting | connected | completing | error
  const [error, setError] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (status === 'error' || status === 'completing') return
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => {
    let cancelled = false
    setElapsedSec(0)

    async function start() {
      try {
        const res = await authFetch(`${BASE_URL}/api/colaberry-login/start`, { method: 'POST' })
        const body = res ? await res.json() : null
        if (!body?.success) throw new Error(body?.error?.message || 'Failed to start session.')
        if (cancelled) return

        sessionRef.current = body.data
        setStatus('connecting')

        // BASE_URL is '' in production (same-origin API calls via nginx's
        // proxy — see docker-compose.yml's VITE_API_BASE_URL build arg), so
        // deriving protocol/host from it produced a malformed ws:// URL with
        // no host — invisible until the page was actually served over HTTPS,
        // at which point browsers block it outright as mixed content. Fall
        // back to the page's own origin, same as any same-origin app would.
        const wsProtocol = (BASE_URL ? BASE_URL.startsWith('https') : window.location.protocol === 'https:') ? 'wss' : 'ws'
        const wsHost = BASE_URL ? BASE_URL.replace(/^https?:\/\//, '') : window.location.host
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
  }, [retryTick])

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

  function handleRetry() {
    sessionRef.current = null
    finishingRef.current = false
    setError('')
    setStatus('starting')
    setRetryTick(t => t + 1)
  }

  const currentStepIdx = STEP_ORDER.indexOf(status)

  return (
    <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Connect your Colaberry account</h3>

          {/* Step-by-step status — always visible so the user knows exactly
              what's happening and what to do next, not just a spinner. */}
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {STEPS.map((step, idx) => {
              const isDone = status !== 'error' && idx < currentStepIdx
              const isCurrent = status !== 'error' && idx === currentStepIdx
              return (
                <li key={step.key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className={
                      'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ' +
                      (isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500')
                    }
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span className={isCurrent ? 'font-semibold text-indigo-700' : isDone ? 'text-emerald-700' : 'text-gray-400'}>
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ol>

          <p className="text-sm text-gray-500 mt-2">
            {status === 'connected'
              ? "Log in below exactly as you normally would. Once you're in, click \"I'm logged in\"."
              : status === 'starting' || status === 'connecting'
              ? `This can take up to a minute the first time — ${elapsedSec}s elapsed…`
              : null}
          </p>
        </div>

        <div className="bg-black flex items-center justify-center relative" style={{ minHeight: 480 }}>
          {(status === 'starting' || status === 'connecting') && (
            <p className="text-gray-400 text-sm">
              {status === 'starting' ? 'Starting your secure browser session…' : 'Connecting to the live browser…'}
            </p>
          )}
          {status === 'error' && (
            <div className="text-center px-6">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                Try Again
              </button>
            </div>
          )}
          {/* Stays in real layout (never display:none) even before connecting —
              noVNC measures this container's size once, when the RFB object is
              constructed (while status is still 'connecting'), and never
              re-measures afterward. A display:none container at that moment
              means noVNC creates its canvas at 0x0 permanently; toggling
              display to 'block' later doesn't trigger a resize. visibility
              keeps real dimensions available from the start; absolute
              positioning keeps it from disturbing the status text's layout
              while hidden. */}
          <div
            ref={canvasContainerRef}
            className="w-full h-full absolute inset-0"
            style={{ visibility: status === 'connected' || status === 'completing' ? 'visible' : 'hidden' }}
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
