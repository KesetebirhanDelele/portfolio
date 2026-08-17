import { useEffect, useState } from 'react'
import { authFetch, BASE_URL } from './api'

// Cards that have a drill-down panel are clickable — toggles that panel
// instead of navigating anywhere, so this stays a single page.
function StatCard({ label, value, sub, onClick, expanded }) {
  const clickable = typeof onClick === 'function'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`text-left px-4 py-3 rounded-xl border bg-white shadow-sm transition ${
        clickable ? 'border-line-subtle hover:border-brand-300 hover:shadow cursor-pointer' : 'border-line-subtle cursor-default'
      } ${expanded ? 'ring-2 ring-brand-400' : ''}`}
    >
      <div className="text-xs font-medium text-text-muted flex items-center justify-between">
        {label}
        {clickable && <span className="text-text-subtle">{expanded ? '▲' : '▼'}</span>}
      </div>
      <div className="text-2xl font-bold text-text-strong mt-1">{value}</div>
      {sub && <div className="text-xs text-text-subtle mt-1">{sub}</div>}
    </button>
  )
}

function countFor(rows, key) {
  return rows?.find(r => r.status === key || r.provider === key || r.role === key)?.count ?? 0
}

function sumCounts(rows) {
  return (rows || []).reduce((total, r) => total + Number(r.count || 0), 0)
}

function fmtPct(v) {
  return v === null || v === undefined ? '—' : `${v.toFixed(1)}%`
}

function fmtMs(v) {
  return v === null || v === undefined ? '—' : `${v}ms`
}

const DEP_LABELS = { postgres: 'Postgres', redis: 'Redis', colaberryMssql: 'Colaberry SQL', openai: 'OpenAI' }

function HealthChecksPanel({ checks }) {
  if (!checks) {
    return <div className="px-4 py-3 text-sm text-text-subtle rounded-xl border border-line-subtle bg-white">No health sample yet.</div>
  }
  return (
    <div className="rounded-xl border border-line-subtle bg-white shadow-sm divide-y divide-line-subtle">
      {Object.entries(checks).map(([name, c]) => (
        <div key={name} className="px-4 py-3 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${c.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-medium text-text-body">{DEP_LABELS[name] || name}</span>
          </div>
          <div className="text-xs text-text-subtle">
            {c.status === 'up' ? `${c.latencyMs}ms` : (c.error || 'down')}
          </div>
        </div>
      ))}
    </div>
  )
}

function LatencyPanel({ latency }) {
  const rows = Object.entries(latency?.byRouteGroup || {}).sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
  if (rows.length === 0) {
    return <div className="px-4 py-3 text-sm text-text-subtle rounded-xl border border-line-subtle bg-white">No request samples yet.</div>
  }
  return (
    <div className="rounded-xl border border-line-subtle bg-white shadow-sm divide-y divide-line-subtle overflow-x-auto">
      <div className="px-4 py-2 text-xs font-semibold text-text-subtle flex gap-4 min-w-[420px]">
        <span className="flex-1">Route</span>
        <span className="w-16 text-right">p50</span>
        <span className="w-16 text-right">p95</span>
        <span className="w-16 text-right">p99</span>
        <span className="w-16 text-right">n</span>
      </div>
      {rows.map(([route, s]) => (
        <div key={route} className="px-4 py-2 text-sm flex gap-4 min-w-[420px]">
          <span className="flex-1 font-mono text-text-body truncate">{route}</span>
          <span className="w-16 text-right text-text-muted">{fmtMs(s.p50)}</span>
          <span className="w-16 text-right text-text-muted">{fmtMs(s.p95)}</span>
          <span className="w-16 text-right text-text-muted">{fmtMs(s.p99)}</span>
          <span className="w-16 text-right text-text-subtle">{s.count}</span>
        </div>
      ))}
    </div>
  )
}

function DeepAnalysisFailurePanel({ failures }) {
  if (failures.length === 0) {
    return <div className="px-4 py-3 text-sm text-text-subtle rounded-xl border border-line-subtle bg-white">No deep-analysis failures.</div>
  }
  return (
    <div className="rounded-xl border border-line-subtle bg-white shadow-sm divide-y divide-line-subtle">
      {failures.map(f => (
        <div key={f.id} className="px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-text-body">{f.repositoryName}</span>
            <span className="text-text-subtle text-xs">{new Date(f.createdAt).toLocaleString()}</span>
          </div>
          {f.phaseErrors ? (
            <div className="mt-2 space-y-1">
              {Object.entries(f.phaseErrors).map(([phase, detail]) => (
                <div key={phase} className="text-xs">
                  <span className="font-mono text-text-muted">{phase}</span>
                  {detail.code && <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-mono">{detail.code}</span>}
                  {detail.retryable && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">retryable</span>}
                  <div className="text-red-700 mt-0.5">{detail.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-subtle text-xs mt-1">No phase-level error detail recorded.</div>
          )}
        </div>
      ))}
    </div>
  )
}

function QueueFailurePanel({ failures }) {
  if (failures.length === 0) {
    return <div className="px-4 py-3 text-sm text-text-subtle rounded-xl border border-line-subtle bg-white">No queue job failures.</div>
  }
  return (
    <div className="rounded-xl border border-line-subtle bg-white shadow-sm divide-y divide-line-subtle">
      {failures.map(job => (
        <div key={job.id} className="px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-text-body">{job.name}</span>
            <span className="text-text-subtle text-xs">{job.finishedOn ? new Date(job.finishedOn).toLocaleString() : 'unknown time'}</span>
          </div>
          <div className="text-red-700 text-xs mt-1">{job.failedReason || 'No failure reason recorded.'}</div>
          {job.data && (
            <div className="text-text-subtle text-xs mt-1 font-mono truncate">{JSON.stringify(job.data)}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// Single admin-only stats page (Tier 3 observability) — reads
// GET /api/admin/stats, which is real counts already in Postgres/Redis,
// not a separate analytics store. Deliberately plain: this exists to
// answer "is anything broken, how much is this being used" at the
// current scale, not to be a BI dashboard.
function AdminStats({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedPanel, setExpandedPanel] = useState(null) // 'deepAnalysisFailures' | 'queueFailures' | 'healthChecks' | 'latency' | null

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const res = await authFetch(`${BASE_URL}/api/admin/stats`, {}, onLogout)
    if (!res) return
    if (res.status === 403) {
      setError('Admin access required for this account.')
      setLoading(false)
      return
    }
    if (!res.ok) {
      setError('Failed to load stats.')
      setLoading(false)
      return
    }
    const json = await res.json()
    setStats(json.data)
    setLoading(false)
  }

  function togglePanel(name) {
    setExpandedPanel(current => (current === name ? null : name))
  }

  return (
    <div className="min-h-screen bg-surface-subtle p-4">
      <div className="flex items-center justify-between px-6 py-3 bg-white border border-line-subtle rounded-3xl shadow-sm mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-md">R</div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-text-strong">Admin</span>{' '}
            <span className="text-brand-600">Stats</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="px-4 py-2 rounded-full border border-line-subtle bg-white hover:bg-surface-subtle transition font-semibold text-sm">Refresh</button>
          <a href="/" className="text-sm font-medium text-text-muted hover:text-brand-600 transition">← Back</a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {loading && <div className="text-sm text-text-muted">Loading…</div>}

        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {stats && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Portfolios" value={stats.portfolios.total} />
                <StatCard label="Repositories" value={sumCounts(stats.repositories.byProvider)}
                  sub={stats.repositories.byProvider.map(r => `${r.provider}: ${r.count}`).join(', ') || 'none'} />
                <StatCard label="Users" value={sumCounts(stats.users.byRole)}
                  sub={stats.users.byRole.map(r => `${r.role}: ${r.count}`).join(', ') || 'none'} />
                <StatCard label="Deep-analysis tokens used" value={stats.deepAnalyses.totalTokensUsed.toLocaleString()}
                  sub="expected 0 — pipeline is deterministic" />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">Content generation (OpenAI)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Tokens used" value={stats.contentGeneration.totalTokensUsed.toLocaleString()}
                  sub={stats.contentGeneration.byCallType.map(t => `${t.callType}: ${t.tokens.toLocaleString()}`).join(', ') || 'none'} />
                <StatCard label="Calls" value={stats.contentGeneration.totalCalls} />
                <StatCard label="Failed calls" value={stats.contentGeneration.failedCalls} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">System health</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Status" value={stats.systemHealth.status || '—'}
                  onClick={() => togglePanel('healthChecks')} expanded={expandedPanel === 'healthChecks'} />
                <StatCard label="Uptime (1h)" value={fmtPct(stats.systemHealth.uptimePercent1h)} />
                <StatCard label="Uptime (24h)" value={fmtPct(stats.systemHealth.uptimePercent24h)} />
                <StatCard label="Checked" value={stats.systemHealth.checkedAt ? new Date(stats.systemHealth.checkedAt).toLocaleTimeString() : '—'}
                  sub="self-reported, resets on restart" />
              </div>
              {expandedPanel === 'healthChecks' && (
                <div className="mt-2">
                  <HealthChecksPanel checks={stats.systemHealth.checks} />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">Latency</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="p50" value={fmtMs(stats.latency.overall.p50)} />
                <StatCard label="p95" value={fmtMs(stats.latency.overall.p95)} />
                <StatCard label="p99" value={fmtMs(stats.latency.overall.p99)} />
                <StatCard label="Samples" value={stats.latency.overall.count}
                  onClick={() => togglePanel('latency')} expanded={expandedPanel === 'latency'} />
              </div>
              {expandedPanel === 'latency' && (
                <div className="mt-2">
                  <LatencyPanel latency={stats.latency} />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">Heavy-task queue (live)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Waiting" value={stats.heavyTaskQueue.waiting ?? 0} />
                <StatCard label="Active" value={stats.heavyTaskQueue.active ?? 0} />
                <StatCard label="Completed" value={stats.heavyTaskQueue.completed ?? 0} />
                <StatCard label="Failed" value={stats.heavyTaskQueue.failed ?? 0}
                  onClick={() => togglePanel('queueFailures')} expanded={expandedPanel === 'queueFailures'} />
                <StatCard label="Delayed" value={stats.heavyTaskQueue.delayed ?? 0} />
              </div>
              {expandedPanel === 'queueFailures' && (
                <div className="mt-2">
                  <QueueFailurePanel failures={stats.heavyTaskQueue.recentFailures || []} />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">Deep analysis</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Completed" value={countFor(stats.deepAnalyses.byStatus, 'completed')} />
                <StatCard label="Running" value={countFor(stats.deepAnalyses.byStatus, 'running')} />
                <StatCard label="Queued" value={countFor(stats.deepAnalyses.byStatus, 'queued')} />
                <StatCard label="Failed" value={countFor(stats.deepAnalyses.byStatus, 'failed')}
                  onClick={() => togglePanel('deepAnalysisFailures')} expanded={expandedPanel === 'deepAnalysisFailures'} />
              </div>
              {expandedPanel === 'deepAnalysisFailures' && (
                <div className="mt-2">
                  <DeepAnalysisFailurePanel failures={stats.deepAnalyses.recentFailures} />
                </div>
              )}
            </div>

            {stats.notes?.length > 0 && (
              <div className="text-xs text-text-subtle">
                {stats.notes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}

            <div className="text-xs text-text-subtle">Last updated {new Date(stats.generatedAt).toLocaleString()}</div>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminStats
