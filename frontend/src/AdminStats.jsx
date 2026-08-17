import { useEffect, useState } from 'react'
import { authFetch, BASE_URL } from './api'
import { Card } from './components/ui/Card'
import { Tooltip } from './components/ui/Tooltip'

// Cards that have a drill-down panel are clickable — toggles that panel
// instead of navigating anywhere, so this stays a single page.
// `tone="danger"` highlights a metric that means something is actually
// wrong (a nonzero failure count, an unhealthy status) — everything else
// stays neutral so red keeps meaning "look at this" instead of becoming
// background noise across a page full of numbers.
// `sub` renders as a hover tooltip instead of a third text line — the
// whole point of this layout is fitting six sections on one screen, and a
// three-line label/value/sub stack per card was the single biggest cost.
function StatCard({ label, value, sub, onClick, expanded, tone }) {
  const clickable = typeof onClick === 'function'
  const isDanger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`text-left px-2.5 py-2 rounded-lg border bg-white transition ${
        isDanger ? 'border-status-danger/40 border-l-[3px] border-l-status-danger' : 'border-line-subtle'
      } ${
        clickable ? 'hover:border-brand-300 cursor-pointer' : 'cursor-default'
      } ${expanded ? 'ring-2 ring-brand-400' : ''}`}
    >
      <div className="text-[10px] font-medium text-text-muted flex items-center justify-between gap-1 leading-tight">
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {sub && (
            <Tooltip label={sub} placement="top">
              <span className="cb-i text-text-subtle" style={{ width: '11px', height: '11px', fontSize: '11px' }}>
                <i className="ri-information-line" aria-hidden="true" />
              </span>
            </Tooltip>
          )}
          {clickable && <span className="text-text-subtle text-[10px]">{expanded ? '▲' : '▼'}</span>}
        </span>
      </div>
      <div className={`text-lg font-bold mt-0.5 truncate ${isDanger ? 'text-status-danger' : 'text-text-strong'}`}>{value}</div>
    </button>
  )
}

function SectionHeader({ icon, children }) {
  return (
    <h2 className="text-xs font-bold text-text-strong mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
      <span className="cb-i text-brand-600"><i className={icon} aria-hidden="true" /></span>
      {children}
    </h2>
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
    return <div className="px-3 py-2 text-xs text-text-subtle rounded-lg border border-line-subtle bg-white">No health sample yet.</div>
  }
  return (
    <div className="rounded-lg border border-line-subtle bg-white divide-y divide-line-subtle">
      {Object.entries(checks).map(([name, c]) => (
        <div key={name} className="px-3 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-medium text-text-body">{DEP_LABELS[name] || name}</span>
          </div>
          <div className="text-text-subtle">
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
    return <div className="px-3 py-2 text-xs text-text-subtle rounded-lg border border-line-subtle bg-white">No request samples yet.</div>
  }
  return (
    <div className="rounded-lg border border-line-subtle bg-white divide-y divide-line-subtle overflow-x-auto max-h-40 overflow-y-auto">
      <div className="px-3 py-1 text-[10px] font-semibold text-text-subtle flex gap-3 min-w-[320px] sticky top-0 bg-white">
        <span className="flex-1">Route</span>
        <span className="w-12 text-right">p50</span>
        <span className="w-12 text-right">p95</span>
        <span className="w-12 text-right">p99</span>
        <span className="w-10 text-right">n</span>
      </div>
      {rows.map(([route, s]) => (
        <div key={route} className="px-3 py-1 text-xs flex gap-3 min-w-[320px]">
          <span className="flex-1 font-mono text-text-body truncate">{route}</span>
          <span className="w-12 text-right text-text-muted">{fmtMs(s.p50)}</span>
          <span className="w-12 text-right text-text-muted">{fmtMs(s.p95)}</span>
          <span className="w-12 text-right text-text-muted">{fmtMs(s.p99)}</span>
          <span className="w-10 text-right text-text-subtle">{s.count}</span>
        </div>
      ))}
    </div>
  )
}

function DeepAnalysisFailurePanel({ failures }) {
  if (failures.length === 0) {
    return <div className="px-3 py-2 text-xs text-text-subtle rounded-lg border border-line-subtle bg-white">No deep-analysis failures.</div>
  }
  return (
    <div className="rounded-lg border border-line-subtle bg-white divide-y divide-line-subtle max-h-40 overflow-y-auto">
      {failures.map(f => (
        <div key={f.id} className="px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-text-body">{f.repositoryName}</span>
            <span className="text-text-subtle">{new Date(f.createdAt).toLocaleString()}</span>
          </div>
          {f.phaseErrors ? (
            <div className="mt-1 space-y-1">
              {Object.entries(f.phaseErrors).map(([phase, detail]) => (
                <div key={phase}>
                  <span className="font-mono text-text-muted">{phase}</span>
                  {detail.code && <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-mono">{detail.code}</span>}
                  {detail.retryable && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">retryable</span>}
                  <div className="text-red-700 mt-0.5">{detail.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-subtle mt-1">No phase-level error detail recorded.</div>
          )}
        </div>
      ))}
    </div>
  )
}

function QueueFailurePanel({ failures }) {
  if (failures.length === 0) {
    return <div className="px-3 py-2 text-xs text-text-subtle rounded-lg border border-line-subtle bg-white">No queue job failures.</div>
  }
  return (
    <div className="rounded-lg border border-line-subtle bg-white divide-y divide-line-subtle max-h-40 overflow-y-auto">
      {failures.map(job => (
        <div key={job.id} className="px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-text-body">{job.name}</span>
            <span className="text-text-subtle">{job.finishedOn ? new Date(job.finishedOn).toLocaleString() : 'unknown time'}</span>
          </div>
          <div className="text-red-700 mt-1">{job.failedReason || 'No failure reason recorded.'}</div>
          {job.data && (
            <div className="text-text-subtle mt-1 font-mono truncate">{JSON.stringify(job.data)}</div>
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
//
// Laid out as a fixed 3x2 grid of section cards (not a scrolling stack)
// per Kes's explicit "I want to see everything in one screen" — every
// section fits in a bounded card so the base view never needs scrolling;
// an expanded drill-down panel can still push its own card taller, which
// is an accepted tradeoff for an actively-requested detail view.
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

  // 24h-scoped, not all-time — an old failure that's since cleared
  // shouldn't leave the banner red forever. heavyTaskQueue.failed is
  // already a 24h count in practice (see routes/admin.js's comment on it).
  // deepAnalyses.totalTokensUsed is a regression check, not a usage metric
  // — the pipeline is deterministic and should always be 0, so a nonzero
  // value means an LLM call snuck into code that isn't supposed to make
  // any, which is a real "something's wrong" signal in its own right.
  const hasProblems = stats && (
    stats.systemHealth.status !== 'healthy' ||
    stats.contentGeneration.failedCallsLast24h > 0 ||
    (stats.heavyTaskQueue.failed ?? 0) > 0 ||
    stats.deepAnalyses.failedLast24h > 0 ||
    stats.deepAnalyses.totalTokensUsed > 0
  )

  return (
    <div className="h-screen bg-surface-subtle p-3 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2 bg-white border border-line-subtle rounded-2xl shadow-sm mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold shadow-md">R</div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-text-strong">Admin</span>{' '}
            <span className="text-brand-600">Stats</span>
          </h1>
          {stats && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
              hasProblems ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              <span className="cb-i" style={{ width: '12px', height: '12px', fontSize: '12px' }}>
                <i className={hasProblems ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'} aria-hidden="true" />
              </span>
              {hasProblems ? 'Attention needed' : 'All systems normal'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="px-3 py-1.5 rounded-full border border-line-subtle bg-white hover:bg-surface-subtle transition font-semibold text-xs">Refresh</button>
          <a href="/" className="text-xs font-medium text-text-muted hover:text-brand-600 transition">← Back</a>
        </div>
      </div>

      {loading && <div className="text-sm text-text-muted">Loading…</div>}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {stats && (
        <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-3">

          <Card className="p-3 overflow-y-auto">
            <SectionHeader icon="ri-dashboard-line">Overview</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Portfolios" value={stats.portfolios.total} />
              <StatCard label="Repositories" value={sumCounts(stats.repositories.byProvider)}
                sub={stats.repositories.byProvider.map(r => `${r.provider}: ${r.count}`).join(', ') || 'none'} />
              <StatCard label="Users" value={sumCounts(stats.users.byRole)}
                sub={stats.users.byRole.map(r => `${r.role}: ${r.count}`).join(', ') || 'none'} />
              {/* Only rendered when nonzero — this should always be 0 (the
                  deep-analysis pipeline is deterministic, no LLM calls), so
                  it's a regression alert, not a metric worth a permanent
                  card slot. See the hasProblems comment above. */}
              {stats.deepAnalyses.totalTokensUsed > 0 && (
                <StatCard label="Deep-analysis tokens" value={stats.deepAnalyses.totalTokensUsed.toLocaleString()}
                  sub="expected 0 — pipeline is deterministic, this means an LLM call regressed in"
                  tone="danger" />
              )}
            </div>
          </Card>

          <Card className="p-3 overflow-y-auto">
            <SectionHeader icon="ri-robot-line">Content generation (OpenAI)</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Tokens used" value={stats.contentGeneration.totalTokensUsed.toLocaleString()}
                sub={stats.contentGeneration.byCallType.map(t => `${t.callType}: ${t.tokens.toLocaleString()}`).join(', ') || 'none'} />
              <StatCard label="Calls" value={stats.contentGeneration.totalCalls} />
              <StatCard label="Failed (24h)" value={stats.contentGeneration.failedCallsLast24h}
                sub={`${stats.contentGeneration.failedCalls} all-time`}
                tone={stats.contentGeneration.failedCallsLast24h > 0 ? 'danger' : undefined} />
            </div>
          </Card>

          <Card className="p-3 overflow-y-auto">
            <SectionHeader icon="ri-heart-pulse-line">System health</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Status" value={stats.systemHealth.status || '—'}
                tone={stats.systemHealth.status !== 'healthy' ? 'danger' : undefined}
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
          </Card>

          <Card className="p-3 overflow-y-auto">
            <SectionHeader icon="ri-timer-flash-line">Latency</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
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
          </Card>

          <Card className="p-3 overflow-y-auto">
            <SectionHeader icon="ri-stack-line">Heavy-task queue (live)</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Waiting" value={stats.heavyTaskQueue.waiting ?? 0} />
              <StatCard label="Active" value={stats.heavyTaskQueue.active ?? 0} />
              <StatCard label="Completed" value={stats.heavyTaskQueue.completed ?? 0} />
              <StatCard label="Failed (24h)" value={stats.heavyTaskQueue.failed ?? 0}
                sub="BullMQ purges failed jobs after 24h — this is already a 24h count, not all-time"
                tone={(stats.heavyTaskQueue.failed ?? 0) > 0 ? 'danger' : undefined}
                onClick={() => togglePanel('queueFailures')} expanded={expandedPanel === 'queueFailures'} />
              <StatCard label="Delayed" value={stats.heavyTaskQueue.delayed ?? 0} />
            </div>
            {expandedPanel === 'queueFailures' && (
              <div className="mt-2">
                <QueueFailurePanel failures={stats.heavyTaskQueue.recentFailures || []} />
              </div>
            )}
          </Card>

          <Card className="p-3 overflow-y-auto">
            <SectionHeader icon="ri-radar-line">Deep analysis</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Completed" value={countFor(stats.deepAnalyses.byStatus, 'completed')} />
              <StatCard label="Running" value={countFor(stats.deepAnalyses.byStatus, 'running')} />
              <StatCard label="Queued" value={countFor(stats.deepAnalyses.byStatus, 'queued')} />
              <StatCard label="Failed (24h)" value={stats.deepAnalyses.failedLast24h}
                sub={`${countFor(stats.deepAnalyses.byStatus, 'failed')} all-time`}
                tone={stats.deepAnalyses.failedLast24h > 0 ? 'danger' : undefined}
                onClick={() => togglePanel('deepAnalysisFailures')} expanded={expandedPanel === 'deepAnalysisFailures'} />
            </div>
            {expandedPanel === 'deepAnalysisFailures' && (
              <div className="mt-2">
                <DeepAnalysisFailurePanel failures={stats.deepAnalyses.recentFailures} />
              </div>
            )}
            {stats.notes?.length > 0 && (
              <Tooltip label={stats.notes.join(' · ')} placement="top" className="mt-1.5">
                <span className="text-[10px] text-text-subtle flex items-center gap-1 cursor-help">
                  <i className="ri-information-line" aria-hidden="true" /> implementation notes
                </span>
              </Tooltip>
            )}
          </Card>

        </div>
      )}

      {stats && (
        <div className="text-[10px] text-text-subtle mt-1.5 flex-shrink-0">Last updated {new Date(stats.generatedAt).toLocaleString()}</div>
      )}
    </div>
  )
}

export default AdminStats
