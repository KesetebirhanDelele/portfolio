import { useEffect, useState } from 'react'
import { authFetch, BASE_URL } from './api'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Badge } from './components/ui/Badge'
import { Avatar } from './components/ui/Avatar'

const ERROR_MESSAGES = {
  already_connected:    'This GitHub account is already connected to your profile.',
  account_taken:        'This GitHub account is already linked to another user.',
  invalid_state:        'Session expired. Please try again.',
  server_error:         'Something went wrong. Please try again.',
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function Settings({ onLogout }) {
  const [accounts, setAccounts]           = useState([])
  const [installations, setInstallations] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [successMsg, setSuccessMsg]       = useState(null)
  const [disconnecting, setDisconnecting] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errCode = params.get('error')
    if (errCode) {
      setError(ERROR_MESSAGES[errCode] || 'An error occurred.')
      window.history.replaceState({}, '', '/settings')
    }
    loadAccounts()
    loadInstallations()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    const res = await authFetch(`${BASE_URL}/api/github-accounts`, {}, onLogout)
    if (!res) return
    const json = await res.json()
    setAccounts(json.data || [])
    setLoading(false)
  }

  async function loadInstallations() {
    const res = await authFetch(`${BASE_URL}/api/github-app/installations`, {}, onLogout)
    if (!res) return
    const json = await res.json()
    if (json.success) setInstallations(json.data || [])
  }

  function handleInstall() {
    const token = localStorage.getItem('token')
    window.location.href = `${BASE_URL}/api/github-app/install?token=${encodeURIComponent(token)}`
  }

  async function handleDisconnect(id) {
    if (!window.confirm('Disconnect this GitHub account? Repositories imported from it will remain.')) return
    setDisconnecting(id)
    setError(null)
    const res = await authFetch(`${BASE_URL}/api/github-accounts/${id}`, { method: 'DELETE' }, onLogout)
    if (!res) { setDisconnecting(null); return }
    if (res.ok) {
      setAccounts(prev => prev.filter(a => a.id !== id))
      setSuccessMsg('GitHub account disconnected.')
    } else {
      const json = await res.json()
      setError(json.error || 'Failed to disconnect account.')
    }
    setDisconnecting(null)
  }

  async function handleRemoveInstallation(id) {
    if (!window.confirm('Remove this GitHub App installation from your account?')) return
    const res = await authFetch(`${BASE_URL}/api/github-app/installations/${id}`, { method: 'DELETE' }, onLogout)
    if (!res) return
    if (res.ok) {
      setInstallations(prev => prev.filter(i => i.id !== id))
      setSuccessMsg('GitHub App installation removed.')
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle p-4">

      {/* NAVBAR */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border border-line-subtle rounded-3xl shadow-sm mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-md">R</div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-text-strong">Repo2</span>
            <span className="text-brand-600">Reputation</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-medium text-text-muted hover:text-brand-600 transition">← Back to repos</a>
          <Button variant="outline" size="sm" onClick={onLogout}>Logout</Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">

        {/* Banners */}
        {successMsg && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-medium">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-600 text-lg leading-none ml-4">×</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-4">×</button>
          </div>
        )}

        {/* ── Login account ────────────────────────────────────────── */}
        <Card padded>
          <h2 className="text-base font-bold text-text-strong mb-1">Login Account</h2>
          <p className="text-xs text-text-muted mb-4">The GitHub account you signed in with.</p>

          {loading ? (
            <p className="text-text-subtle text-sm py-2">Loading…</p>
          ) : accounts.filter(a => a.is_primary).map(account => (
            <div key={account.id} className="flex items-center gap-3 p-4 rounded-xl border border-line-subtle bg-surface-subtle">
              <Avatar src={account.avatar_url} name={account.github_username} size="sm" />
              <div>
                <p className="font-semibold text-text-strong text-sm">@{account.github_username}</p>
                {account.github_email && <p className="text-xs text-text-subtle">{account.github_email}</p>}
              </div>
              <Badge tone="red" className="ml-2">Primary</Badge>
            </div>
          ))}
        </Card>

        {/* ── GitHub App installations ─────────────────────────────── */}
        <Card padded>
          <h2 className="text-base font-bold text-text-strong mb-1">Additional GitHub Accounts</h2>
          <p className="text-xs text-text-muted mb-5">
            Install the GitHub App on any account (personal or org) to access its repos — public and private — without OAuth session conflicts.
          </p>

          {/* Existing installations */}
          {installations.length > 0 && (
            <div className="space-y-3 mb-5">
              {installations.map(inst => (
                <div key={inst.id} className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50">
                  <div className="flex items-center gap-3">
                    {inst.account_avatar_url
                      ? <img src={inst.account_avatar_url} alt={inst.account_login} className="w-9 h-9 rounded-full flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">{inst.account_login[0].toUpperCase()}</div>
                    }
                    <div>
                      <p className="font-semibold text-text-strong text-sm">@{inst.account_login}</p>
                      <p className="text-xs text-green-600 font-medium">GitHub App · Public + Private repos</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveInstallation(inst.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Install button */}
          <button
            onClick={handleInstall}
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold transition"
          >
            <GithubIcon />
            Install GitHub App on Another Account
          </button>
          <p className="mt-3 text-xs text-text-subtle">
            You'll be taken to GitHub to choose which account and which repositories to grant access to.
            Works for personal accounts and organizations.
          </p>
        </Card>

      </div>
    </div>
  )
}

export default Settings
