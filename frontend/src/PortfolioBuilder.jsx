import { useState, useEffect, useRef, useMemo } from 'react'
import { authFetch, BASE_URL } from './api'
import { githubToRaw, isSupportedMediaUrl } from './utils/mediaUrl'
import { PortfolioBuilderSkeleton } from './Skeleton'

const POLL_MS = 3000

const TECH_CATEGORY_COLORS = {
  Frontend: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  Backend:  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  Database: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  DevOps:   { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  Mobile:   { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
  AI:       { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  Testing:  { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  Other:    { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
}

function techChipStyle(category) {
  return TECH_CATEGORY_COLORS[category] || TECH_CATEGORY_COLORS.Other
}

function SectionCard({ title, children }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '18px 20px', marginBottom: '14px', backgroundColor: 'white' }}>
      <p style={{ margin: '0 0 12px', fontWeight: 'bold', fontSize: '14px', color: '#111827' }}>{title}</p>
      {children}
    </div>
  )
}

// ─── Collapsible editor section ──────────────────────────────────────────────
function EditorSection({ number, title, description, defaultOpen = true, children, id }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} style={{
      marginBottom: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '13px 16px',
          background: open ? '#fafafe' : 'white',
          border: 'none',
          borderBottom: open ? '1px solid #eeeefc' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: '#4f46e5', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: '700',
        }}>
          {number}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#111827' }}>{title}</p>
          {description && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af', lineHeight: 1.3 }}>{description}</p>
          )}
        </div>
        <span style={{
          color: '#9ca3af', fontSize: '11px', flexShrink: 0,
          display: 'inline-block',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
        }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '16px 18px 18px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Years-of-experience helpers (LinkedIn / profile data only) ───────────────
function parseExpDate(str) {
  if (!str || typeof str !== 'string') return null
  str = str.trim()
  if (/present|current|now/i.test(str)) return null
  if (/^\d{4}$/.test(str)) return new Date(parseInt(str), 0, 1)
  const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 }
  const m = str.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const mo = months[m[1].toLowerCase().slice(0, 3)]
    if (mo !== undefined) return new Date(parseInt(m[2]), mo, 1)
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function getYearsExperience(linkedin, profile) {
  const experiences = [
    ...(linkedin?.experience || []),
    ...(profile?.experience  || []),
  ]
  if (experiences.length === 0) return null
  let earliest = null
  for (const exp of experiences) {
    const d = parseExpDate(exp.startDate || exp.start_date || exp.startYear || '')
    if (d && (!earliest || d < earliest)) earliest = d
  }
  if (!earliest) return null
  const years = Math.floor((Date.now() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (years < 1) return null
  return years === 1 ? '1+ Year' : `${years}+ Years`
}

// ─── Live portfolio mini-preview ─────────────────────────────────────────────
const PREV_GRADS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#fa709a,#fee140)',
]
const PREV_CATS = {
  Frontend: { bg: '#ede9fe', color: '#5b21b6' },
  Backend:  { bg: '#dbeafe', color: '#1e40af' },
  Database: { bg: '#fef3c7', color: '#92400e' },
  DevOps:   { bg: '#dcfce7', color: '#166534' },
  AI:       { bg: '#f3e8ff', color: '#6b21a8' },
  Other:    { bg: '#f3f4f6', color: '#374151' },
}

function MiniPreview({ headline, narrative, topSkills, projects, repos, analysisMap, profile, engineeringStrengths, linkedin }) {
  const displayName = profile?.fullName || 'Your Portfolio'
  const displayHeadline = profile?.headline || headline
  const initials = displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  const aiRepoCount = repos.filter(r =>
    (analysisMap[r.id]?.technologies || []).some(t =>
      ['OpenAI', 'LangChain', 'Anthropic', 'LlamaIndex'].includes(t.name)
    )
  ).length
  const yearsExp = getYearsExperience(linkedin, profile)

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Identity header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
          {/* Avatar or photo */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: '800', fontSize: '18px',
            boxShadow: '0 4px 12px rgba(67,97,238,0.28)',
            overflow: 'hidden',
          }}>
            {profile?.photoUrl
              ? <img src={profile.photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
              {displayName}
            </h2>
            {displayHeadline && (
              <p style={{ margin: '0 0 5px', fontSize: '11px', color: '#4361ee', fontWeight: '600', lineHeight: 1.4 }}>
                {displayHeadline}
              </p>
            )}
            {/* Contact chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {profile?.location && <span style={{ fontSize: '10px', color: '#64748b' }}>📍 {profile.location}</span>}
              {profile?.email    && <span style={{ fontSize: '10px', color: '#64748b' }}>📧 {profile.email}</span>}
              {profile?.githubUrl && <span style={{ fontSize: '10px', color: '#4361ee', fontWeight: '600' }}>🔗 GitHub</span>}
              {profile?.linkedinUrl && <span style={{ fontSize: '10px', color: '#4361ee', fontWeight: '600' }}>🔗 LinkedIn</span>}
            </div>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {[
            yearsExp
              ? { value: yearsExp,      label: 'Years Experience',     icon: '📅' }
              : aiRepoCount > 0
                ? { value: aiRepoCount, label: 'AI Engineering',        icon: '🤖' }
                : { value: '✓',         label: 'Professional Portfolio', icon: '💼' },
            { value: `${topSkills.length}+`, label: 'Core Technologies', icon: '⚙️' },
            { value: projects.length,        label: 'Featured Projects',  icon: '🚀' },
            ...(yearsExp && aiRepoCount > 0 ? [{ value: aiRepoCount, label: 'AI Systems Built', icon: '🤖' }] : []),
          ].map((s, i, arr) => (
            <div key={i} style={{
              flex: 1, padding: '8px 6px', textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>
              <div style={{ fontSize: '11px', marginBottom: '2px' }}>{s.icon}</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* About Me */}
      {narrative && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 7px', fontSize: '10px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            About Me
          </h3>
          <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.65,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {narrative}
          </p>
        </div>
      )}

      {/* Engineering Strengths */}
      {engineeringStrengths?.length > 0 && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 9px', fontSize: '10px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            Engineering Strengths
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {engineeringStrengths.slice(0, 6).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#166534' }}>
                <span style={{ fontWeight: '700', flexShrink: 0 }}>✓</span>{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Technologies */}
      {topSkills.length > 0 && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 9px', fontSize: '10px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            Core Technologies
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {topSkills.slice(0, 10).map((sk, i) => {
              const c = PREV_CATS[sk.category] || PREV_CATS.Other
              return (
                <span key={i} style={{
                  padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '600',
                  backgroundColor: c.bg, color: c.color,
                }}>{sk.name}</span>
              )
            })}
          </div>
        </div>
      )}

      {/* Featured Projects */}
      {projects.length > 0 && (
        <div style={{ padding: '14px 20px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            Featured Projects
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {projects.slice(0, 4).map((p, i) => {
              const repo     = repos.find(r => r.name === p.repoName)
              const analysis = repo ? analysisMap[repo.id] : null
              const techs    = (analysis?.technologies || []).slice(0, 2).map(t => t.name)
              return (
                <div key={i} style={{ padding: '10px 11px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
                      background: PREV_GRADS[i % PREV_GRADS.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', color: 'rgba(255,255,255,0.9)', fontWeight: '700',
                    }}>
                      {(p.repoName || '?')[0]}
                    </div>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.repoName}
                    </p>
                  </div>
                  {p.oneLiner && (
                    <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#64748b', lineHeight: 1.4,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {p.oneLiner}
                    </p>
                  )}
                  {techs.length > 0 && (
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                      {techs.map((t, j) => (
                        <span key={j} style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '8px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#334155' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Reads a File, center-crops and resizes it to maxSize × maxSize, returns base64 JPEG.
function resizeImageToBase64(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = e => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width  = maxSize
        canvas.height = maxSize
        const ctx  = canvas.getContext('2d')
        const side = Math.min(img.width, img.height)
        const sx   = (img.width  - side) / 2
        const sy   = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function MediaInput({ repoName, value, onChange }) {
  const [imgError, setImgError] = useState(false)
  const wasConverted = value && value.includes('raw.githubusercontent.com')
  const isValid = isSupportedMediaUrl(value)

  return (
    <div>
      <p style={{ margin: '0 0 5px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>{repoName}</p>
      <input
        type="url"
        placeholder="Paste GitHub Image/GIF URL"
        value={value}
        onChange={e => {
          setImgError(false)
          onChange(githubToRaw(e.target.value.trim()))
        }}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', color: '#374151', outline: 'none', boxSizing: 'border-box' }}
      />
      {wasConverted && (
        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#16a34a', fontWeight: '500' }}>
          ✓ Auto-converted to raw URL
        </p>
      )}
      {value && !isValid && (
        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#dc2626' }}>
          Unsupported file type. Use .gif, .png, .jpg, .jpeg, or .webp
        </p>
      )}
      {value && isValid && !imgError && (
        <img
          src={value}
          alt="preview"
          onError={() => setImgError(true)}
          style={{ marginTop: '8px', maxWidth: '100%', maxHeight: '120px', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'block', objectFit: 'contain' }}
        />
      )}
      {value && isValid && imgError && (
        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#f59e0b' }}>
          ⚠️ Could not load preview. Check the URL is publicly accessible.
        </p>
      )}
    </div>
  )
}

function PortfolioBuilder({ onLogout, onGoToBrowse, onRepoDeleted, autoStart = false }) {
  // Data loading
  const [importedRepos, setImportedRepos] = useState([])
  const [analysisMap, setAnalysisMap]     = useState({})
  const [repoStatusMap, setRepoStatusMap] = useState({})
  const [loading, setLoading]             = useState(true)
  const [loadError, setLoadError]         = useState(null)
  const [cancelling, setCancelling]       = useState(false)
  const [restarting, setRestarting]       = useState(null) // repoId being restarted
  const [deletingRepo, setDeletingRepo]   = useState(null) // repoId confirm dialog
  const [deleting, setDeleting]           = useState(null) // repoId being deleted
  const [elapsedSec, setElapsedSec]       = useState(0)
  const elapsedRef        = useRef(null)
  const scrollContainerRef = useRef(null)

  const EDITOR_NAV = [
    { id: 'pb-section-1', label: 'LinkedIn' },
    { id: 'pb-section-2', label: 'Profile' },
    { id: 'pb-section-3', label: 'Headline' },
    { id: 'pb-section-4', label: 'Summary' },
    { id: 'pb-section-5', label: 'Skills' },
    { id: 'pb-section-6', label: 'Projects' },
    { id: 'pb-section-7', label: 'Media' },
  ]

  function scrollToSection(sectionId) {
    const container = scrollContainerRef.current
    const section   = document.getElementById(sectionId)
    if (!container || !section) return
    const containerRect = container.getBoundingClientRect()
    const sectionRect   = section.getBoundingClientRect()
    container.scrollTo({ top: container.scrollTop + sectionRect.top - containerRect.top - 8, behavior: 'smooth' })
  }

  // Step 1 — form
  const [title, setTitle]       = useState('')
  const [selected, setSelected] = useState(new Set())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Step 2 — portfolio + narrative generation
  const [portfolio, setPortfolio]           = useState(null)
  const [generating, setGenerating]         = useState(false)
  const [narrativeStatus, setNarrativeStatus] = useState(null)
  const [narrativeData, setNarrativeData]   = useState(null)
  const [generateError, setGenerateError]   = useState(null)
  const pollRef = useRef(null)

  // Step 3 — media (GIF URLs)
  const [repoMedia, setRepoMedia]       = useState({})
  const [savingMedia, setSavingMedia]   = useState(false)
  const [mediaSaved, setMediaSaved]     = useState(false)

  // Step 3 — narrative editing
  const [editedHeadline,  setEditedHeadline]  = useState('')
  const [editedNarrative, setEditedNarrative] = useState('')
  const [editedProjects,  setEditedProjects]  = useState([])

  // Fill empty oneLiner from first sentence of AI description so the card always shows something
  function seedOneLiner(p) {
    if (p.oneLiner) return p
    if (!p.description) return p
    const first = p.description.replace(/\n+/g, ' ').split(/\.\s+/)[0]
    return { ...p, oneLiner: first.length > 200 ? first.slice(0, 197) + '…' : first }
  }
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Step 3 — profile
  const [profile, setProfile] = useState({
    fullName: '', headline: '', photoUrl: '', location: '',
    email: '', githubUrl: '', linkedinUrl: '', website: '',
  })

  // Step 3 — LinkedIn PDF import
  const [linkedinUploading, setLinkedinUploading] = useState(false)
  const [linkedinData,      setLinkedinData]      = useState(null)
  const [linkedinError,     setLinkedinError]     = useState(null)

  // Step 3 — project descriptions
  const [generatingDescs, setGeneratingDescs] = useState(false)
  const [descsGenerated,  setDescsGenerated]  = useState(false)
  const [descsError,      setDescsError]      = useState(null)
  const [showAllSkills,   setShowAllSkills]   = useState(false)

  // Step 4 — publish
  const [publishing, setPublishing] = useState(false)
  const [publicUrl, setPublicUrl]   = useState(null)
  const [publishError, setPublishError] = useState(null)
  const [copied, setCopied]         = useState(false)

  // Auto-start: tracks whether we've already kicked off auto-generation
  const autoStartedRef = useRef(false)

  useEffect(() => {
    loadRepos()
  }, [])

  // Stop polling when component unmounts
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Auto-trigger analysis for repos with no analysis record (status: 'pending')
  // Runs once after initial load — covers public repos where queueDeepAnalysis silently failed
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (loading) return
    if (autoTriggeredRef.current) return
    autoTriggeredRef.current = true
    const pending = importedRepos.filter(r => repoStatusMap[r.id]?.status === 'pending')
    if (pending.length === 0) return
    pending.forEach(repo => {
      authFetch(`${BASE_URL}/api/deep-analysis/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId: repo.id }),
      }, onLogout).catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, importedRepos, repoStatusMap])

  // Auto-refresh every 5s while any repo analysis is still in progress
  const analysisInProgress = importedRepos.some(r =>
    ['queued', 'running', 'pending'].includes(repoStatusMap[r.id]?.status)
  )
  useEffect(() => {
    if (!analysisInProgress) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
      setElapsedSec(0)
      return
    }
    if (!elapsedRef.current) {
      setElapsedSec(0)
      elapsedRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    }
    const poll = setInterval(loadRepos, 5000)
    return () => clearInterval(poll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisInProgress])

  async function handleCancelAnalysis() {
    setCancelling(true)
    await authFetch(`${BASE_URL}/api/deep-analysis/cancel-pending`, { method: 'POST' }, onLogout)
    await loadRepos()
    setCancelling(false)
  }

  async function handleRestartRepo(repositoryId) {
    setRestarting(repositoryId)
    await authFetch(`${BASE_URL}/api/deep-analysis/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositoryId }),
    }, onLogout)
    await loadRepos()
    setRestarting(null)
  }

  async function handleDeleteRepo(repoId) {
    setDeleting(repoId)
    const res = await authFetch(`${BASE_URL}/api/repos/${repoId}`, { method: 'DELETE' }, onLogout)
    setDeletingRepo(null)
    setDeleting(null)
    if (res?.ok && onRepoDeleted) {
      const json = await res.json()
      onRepoDeleted(repoId, json.deleted?.full_name)
    }
    await loadRepos()
  }

  async function handleRestartAll() {
    setCancelling(true)
    const stopped = importedRepos.filter(r => ['failed', 'cancelled'].includes(repoStatusMap[r.id]?.status))
    await Promise.all(stopped.map(r =>
      authFetch(`${BASE_URL}/api/deep-analysis/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId: r.id }),
      }, onLogout)
    ))
    await loadRepos()
    setCancelling(false)
  }

  // Seed editable fields whenever AI narrative data arrives (generation or regeneration)
  useEffect(() => {
    if (narrativeData) {
      setEditedHeadline(narrativeData.headline || '')
      setEditedNarrative(narrativeData.narrative || '')
      // If narrative has no projects, seed from the portfolio's analyzed repos
      const projects = narrativeData.projects?.length > 0
        ? narrativeData.projects.map(seedOneLiner)
        : (narrativeData.repos || []).map(r => ({ repoName: r.name, oneLiner: r.analysis?.whatItDoes || r.description || '' }))
      setEditedProjects(projects)
      setSaved(false)
    }
  }, [narrativeData])

  // Seed profile from existing portfolio data when narrative completes
  useEffect(() => {
    if (portfolio?.profile && Object.keys(portfolio.profile).length > 0) {
      setProfile(p => ({ ...p, ...portfolio.profile }))
    }
  }, [portfolio])

  // Auto-start: when autoStart=true, wait until repos load then auto-create + generate
  useEffect(() => {
    if (!autoStart) return
    if (loading) return
    if (autoStartedRef.current) return
    if (portfolio) return                      // already has a portfolio
    if (narrativeStatus === 'completed') return // narrative already done
    if (importedRepos.length === 0) return     // no repos yet

    autoStartedRef.current = true

    const completedRepos = importedRepos.filter(r =>
      ['completed', 'partial'].includes(repoStatusMap[r.id]?.status)
    )
    const reposToUse = completedRepos.length > 0 ? completedRepos : importedRepos
    const ids = reposToUse.map(r => r.id)

    // Auto-select all repos and set a default title
    setSelected(new Set(ids))
    setTitle('My Portfolio')

    // Small delay so state settles before we fire the create request
    setTimeout(async () => {
      setCreating(true)
      setCreateError(null)
      const res = await authFetch(`${BASE_URL}/api/portfolios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My Portfolio', repositoryIds: ids }),
      }, onLogout)
      if (!res) { setCreating(false); return }
      const json = await res.json()
      setCreating(false)
      if (json.success) {
        setPortfolio(json.data)
      } else {
        setCreateError(json.error?.message || 'Auto-setup failed. Please try manually.')
      }
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, loading, importedRepos, repoStatusMap, portfolio, narrativeStatus])

  // Auto-start step 2: generate narrative once portfolio is created by auto-start
  useEffect(() => {
    if (!autoStart) return
    if (!portfolio) return
    if (generating || narrativeStatus === 'completed') return
    if (narrativeData) return
    if (!autoStartedRef.current) return
    handleGenerateNarrative()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, portfolio, generating, narrativeStatus, narrativeData])

  // Merge AI skills + LinkedIn-only skills (deduped) — used in both preview and save
  const mergedSkills = useMemo(() => {
    const aiSkills   = narrativeData?.top_skills || []
    const aiNames    = new Set(aiSkills.map(s => s.name.toLowerCase()))
    const liOnly     = (linkedinData?.skills || [])
      .filter(s => !aiNames.has(s.toLowerCase()))
      .map(s => ({ name: s, category: 'Other', confidence: null, source: 'linkedin' }))
    return [...aiSkills, ...liOnly]
  }, [narrativeData, linkedinData])

  async function loadRepos() {
    setLoadError(null)
    const res = await authFetch(`${BASE_URL}/api/repos/imported`, {}, onLogout)
    if (!res) { setLoading(false); return }
    if (!res.ok) {
      setLoadError(`API error ${res.status} — check backend logs`)
      setLoading(false)
      return
    }
    const json = await res.json()
    if (!json.success) {
      setLoadError(json.error?.message || 'Failed to load repositories')
      setLoading(false)
      return
    }
    const repos = json.data || []
    setImportedRepos(repos)

    const newAnalysisMap = {}
    const newStatusMap   = {}
    await Promise.all(repos.map(async repo => {
      const dRes = await authFetch(`${BASE_URL}/api/deep-analysis/${repo.id}/latest`, {}, onLogout)
      if (!dRes) return
      const dJson = await dRes.json()
      if (dJson?.success) {
        const d = dJson.data
        newStatusMap[repo.id] = { status: d.status }
        if (['completed', 'partial'].includes(d.status)) {
          newAnalysisMap[repo.id] = {
            status:          d.status,
            confidenceScore: d.confidenceScore,
            technologies:    d.codeIntelligence?.technologies?.map(t => ({ name: t, category: 'Other', confidence: 1 })) || [],
            summary:         d.intelligence?.executiveSummary?.overview || null,
            highlights: {
              purpose:   d.intelligence?.portfolioNarrative?.hookSentence || null,
              strengths: d.inference?.strengths?.[0] || null,
              use_cases: null,
            },
          }
        }
      } else {
        newStatusMap[repo.id] = { status: 'pending' }
      }
    }))
    setAnalysisMap(newAnalysisMap)
    setRepoStatusMap(newStatusMap)

    setLoading(false)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size === 0 || creating) return
    setCreating(true)
    setCreateError(null)
    const portfolioTitle = title.trim() || 'My Portfolio'

    const res = await authFetch(`${BASE_URL}/api/portfolios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: portfolioTitle, repositoryIds: [...selected] }),
    }, onLogout)

    if (!res) { setCreating(false); return }

    const json = await res.json()
    setCreating(false)

    if (json.success) {
      setPortfolio(json.data)
      // Auto-start narrative generation — no manual button click needed
      handleGenerateNarrative(json.data)
    } else {
      setCreateError(json.error?.message || 'Failed to create portfolio.')
    }
  }

  async function handleGenerateNarrative(portfolioOverride = null) {
    const p = portfolioOverride || portfolio
    if (!p || generating) return
    setGenerating(true)
    setGenerateError(null)

    let res
    try {
      res = await authFetch(
        `${BASE_URL}/api/portfolios/${p.portfolioId}/generate-narrative`,
        { method: 'POST' },
        onLogout
      )
    } catch (err) {
      setGenerateError('Network error — is the backend running?')
      setGenerating(false)
      return
    }

    if (!res) { setGenerating(false); return }

    const json = await res.json()
    if (!json.success) {
      setGenerateError(json.error?.message || 'Failed to start narrative generation.')
      setGenerating(false)
      return
    }

    setNarrativeStatus('generating')

    // Poll until complete
    pollRef.current = setInterval(async () => {
      const pRes = await authFetch(`${BASE_URL}/api/portfolios/${p.portfolioId}`, {}, onLogout)
      if (!pRes) return
      const pJson = await pRes.json()
      if (!pJson.success) return

      const status = pJson.data.narrativeStatus
      setNarrativeStatus(status)

      if (status === 'completed') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setGenerating(false)
        // Attach repos so the useEffect fallback can seed editedProjects
        setNarrativeData({ ...pJson.data.narrative, repos: pJson.data.repos })
        // Seed profile and linkedin from any previously saved data
        if (pJson.data.profile && Object.keys(pJson.data.profile).length > 0) {
          setProfile(prev => ({ ...prev, ...pJson.data.profile }))
        }
        if (pJson.data.linkedin) {
          setLinkedinData(pJson.data.linkedin)
        }
      } else if (status === 'failed') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setGenerating(false)
        setGenerateError('Narrative generation failed. Please try again.')
      }
    }, POLL_MS)
  }

  async function handleSaveNarrative() {
    if (!portfolio || saving) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    let res
    try {
      res = await authFetch(
        `${BASE_URL}/api/portfolios/${portfolio.portfolioId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline:  editedHeadline,
            narrative: editedNarrative,
            projects:  editedProjects,
            profile,
          }),
        },
        onLogout
      )
    } catch {
      setSaving(false)
      setSaveError('Network error — is the backend running?')
      return
    }

    setSaving(false)
    if (!res) {
      // authFetch returns null on 401 and calls onLogout — nothing more to do
      return
    }
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      let msg = `Failed to save (HTTP ${res.status}).`
      try {
        const json = await res.json()
        if (json.error?.message) msg = json.error.message
      } catch {}
      setSaveError(msg)
    }
  }

  async function handleRegenerateNarrative() {
    if (!window.confirm('Regenerate will replace your current narrative with fresh AI content. Any unsaved edits will be lost. Continue?')) return
    // Reset to pre-generation state — polling will re-populate edit fields when done
    setNarrativeData(null)
    setNarrativeStatus(null)
    setSaved(false)
    setSaveError(null)
    await handleGenerateNarrative()
  }

  async function handlePublish() {
    if (!portfolio || publishing) return
    setPublishing(true)
    setPublishError(null)

    // Save profile + narrative before publishing so all fields appear in the public link
    try {
      await authFetch(
        `${BASE_URL}/api/portfolios/${portfolio.portfolioId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline:   editedHeadline,
            narrative:  editedNarrative,
            projects:   editedProjects,
            profile,
            top_skills: mergedSkills,
          }),
        },
        onLogout
      )
    } catch {
      setPublishing(false)
      setPublishError('Failed to save profile before publishing. Please try again.')
      return
    }

    const res = await authFetch(
      `${BASE_URL}/api/portfolios/${portfolio.portfolioId}/publish`,
      { method: 'PATCH' },
      onLogout
    )

    if (!res) { setPublishing(false); return }

    const json = await res.json()
    setPublishing(false)

    if (json.success) {
      setPublicUrl(json.data.publicUrl)
    } else {
      setPublishError(json.error?.message || 'Failed to publish portfolio.')
    }
  }

  async function handleSaveMedia() {
    if (!portfolio || savingMedia) return
    setSavingMedia(true)
    setMediaSaved(false)
    const res = await authFetch(
      `${BASE_URL}/api/portfolios/${portfolio.portfolioId}/media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoMedia }),
      },
      onLogout
    )
    setSavingMedia(false)
    if (res?.ok) setMediaSaved(true)
  }

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await resizeImageToBase64(file)
      setProfile(p => ({ ...p, photoUrl: base64 }))
    } catch {
      // ignore — file picker stays in place
    }
    e.target.value = ''
  }

  async function handleLinkedinUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLinkedinUploading(true)
    setLinkedinError(null)

    const formData = new FormData()
    formData.append('pdf', file)

    // Use the portfolio-attached endpoint if portfolio exists, otherwise the preview endpoint
    const url = portfolio?.portfolioId
      ? `${BASE_URL}/api/portfolios/${portfolio.portfolioId}/linkedin-pdf`
      : `${BASE_URL}/api/portfolios/extract-linkedin`

    let res
    try {
      res = await authFetch(url, { method: 'POST', body: formData }, onLogout)
    } catch {
      setLinkedinError('Network error — is the backend running?')
      setLinkedinUploading(false)
      return
    }

    setLinkedinUploading(false)
    e.target.value = ''

    if (!res) return
    const json = await res.json()
    if (json.success) {
      setLinkedinData(json.data)
      // Auto-fill all extractable profile fields (only if currently empty)
      setProfile(p => ({
        ...p,
        fullName:    p.fullName    || json.data.name      || '',
        headline:    p.headline    || json.data.headline  || '',
        location:    p.location    || json.data.location  || '',
        email:       p.email       || json.data.email     || '',
        linkedinUrl: p.linkedinUrl || json.data.linkedinUrl || '',
      }))
    } else {
      setLinkedinError(json.error?.message || 'Failed to process PDF.')
    }
  }

  async function handleEditPortfolio() {
    if (!portfolio?.portfolioId) return
    // Reload saved portfolio data so the editor has up-to-date profile + narrative
    const res = await authFetch(`${BASE_URL}/api/portfolios/${portfolio.portfolioId}`, {}, onLogout)
    if (!res) return
    const json = await res.json()
    if (!json.success) return

    const saved = json.data
    if (saved.narrative) {
      setNarrativeData(saved.narrative)
      setEditedHeadline(saved.narrative.headline || '')
      setEditedNarrative(saved.narrative.narrative || '')
      // Seed projects from narrative; fall back to portfolio repos if narrative has none
      const projects = saved.narrative.projects?.length > 0
        ? saved.narrative.projects.map(seedOneLiner)
        : (saved.repos || []).map(r => ({ repoName: r.name, oneLiner: r.analysis?.whatItDoes || r.description || '' }))
      setEditedProjects(projects)
    }
    if (saved.profile && Object.keys(saved.profile).length > 0) {
      setProfile(p => ({ ...p, ...saved.profile }))
    }
    if (saved.repoMedia) {
      // Only restore entries that are valid media URLs — skips any accidentally saved text
      const clean = Object.fromEntries(
        Object.entries(saved.repoMedia).filter(([, v]) => isSupportedMediaUrl(v?.gifUrl))
      )
      setRepoMedia(clean)
    }
    setPortfolio(prev => ({ ...prev, status: saved.status, visibility: saved.visibility }))
    setNarrativeStatus('completed')
    setPublicUrl(null)   // return to Step 3 editor
  }

  async function handleExcludeRepo(repoId) {
    if (!portfolio?.portfolioId) return
    const currentIds = portfolio.repositoryIds || []
    const newIds = currentIds.filter(id => id !== repoId)
    if (newIds.length === 0) return // must keep at least 1

    const res = await authFetch(
      `${BASE_URL}/api/portfolios/${portfolio.portfolioId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository_ids: newIds }),
      },
      onLogout
    )
    if (!res) return
    const json = await res.json()
    if (json.success) {
      setPortfolio(prev => ({ ...prev, repositoryIds: newIds }))
    }
  }

  async function handleGenerateDescriptions() {
    if (!portfolio?.portfolioId || generatingDescs) return
    setGeneratingDescs(true)
    setDescsError(null)
    setDescsGenerated(false)
    try {
      const res = await authFetch(
        `${BASE_URL}/api/portfolios/${portfolio.portfolioId}/generate-project-descriptions`,
        { method: 'POST' },
        onLogout
      )
      if (!res) return
      const json = await res.json()
      if (json.success) {
        setEditedProjects(json.data.projects.map(seedOneLiner))
        setDescsGenerated(true)
      } else {
        setDescsError(json.error?.message || 'Failed to generate descriptions.')
      }
    } catch (err) {
      setDescsError('Network error. Please try again.')
    } finally {
      setGeneratingDescs(false)
    }
  }

  const analyzedRepos = importedRepos
    .filter(r => ['completed', 'partial'].includes(analysisMap[r.id]?.status))
    .sort((a, b) => (analysisMap[b.id]?.confidenceScore ?? 0) - (analysisMap[a.id]?.confidenceScore ?? 0))

  // ── Step 4: Published ──────────────────────────────────────────────────────
  if (publicUrl) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '8px 0' }}>
        <div style={{ padding: '20px 24px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '16px', color: '#166534' }}>✓ Portfolio is live!</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>Your portfolio is now public and shareable.</p>
        </div>

        <SectionCard title="Public URL">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              readOnly
              value={publicUrl}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', color: '#374151', backgroundColor: '#f9fafb' }}
            />
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                backgroundColor: copied ? '#dcfce7' : '#4f46e5', color: copied ? '#166534' : 'white', transition: 'all 0.15s',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <button
            onClick={handleEditPortfolio}
            style={{
              padding: '10px 18px', borderRadius: '9px',
              border: '1px solid #c4b5fd', backgroundColor: '#faf5ff',
              color: '#7c3aed', fontWeight: '600', fontSize: '13px',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            ← Edit Profile &amp; Re-publish
          </button>
          <button
            onClick={() => { setPortfolio(null); setNarrativeData(null); setNarrativeStatus(null); setPublicUrl(null); setTitle(''); setSelected(new Set()); setProfile({ fullName: '', headline: '', photoUrl: '', location: '', email: '', githubUrl: '', linkedinUrl: '', website: '' }) }}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '13px', padding: 0, textAlign: 'left' }}
          >
            + Build another portfolio
          </button>
        </div>
      </div>
    )
  }

  // ── Step 3: Narrative preview + publish ────────────────────────────────────
  if (narrativeStatus === 'completed' && narrativeData) {
    const selectedRepos  = [...selected].map(id => importedRepos.find(r => r.id === id)).filter(Boolean)
    const liveUrl        = portfolio?.slug ? `${window.location.origin}/portfolio/${portfolio.slug}` : null
    const isPublished    = !!publicUrl || portfolio?.visibility === 'public'

    return (
      <div style={{
        display: 'flex', width: '100%',
        height: 'calc(100vh - 160px)',
        minHeight: '720px',
        border: '1px solid #e5e7eb', borderRadius: '12px',
        overflow: 'hidden',
      }}>

        {/* ── Left Editor Panel ─────────────────────────────────────── */}
        <div style={{
          width: '520px', flexShrink: 0,
          backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Panel banner */}
          <div style={{
            padding: '11px 18px', borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            <span style={{ color: '#16a34a', fontSize: '10px' }}>●</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#166534' }}>
              Narrative ready — review, edit and publish your portfolio
            </span>
          </div>

          {/* Section jump nav */}
          <div style={{
            display: 'flex', overflowX: 'auto', flexShrink: 0,
            borderBottom: '1px solid #e5e7eb', backgroundColor: '#fafafa',
            padding: '0 8px',
            scrollbarWidth: 'none',
          }}>
            {EDITOR_NAV.map((s, i) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '8px 10px', flexShrink: 0,
                  background: 'none', border: 'none', borderBottom: '2px solid transparent',
                  fontSize: '11px', fontWeight: '600', color: '#6b7280',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.borderBottomColor = '#4f46e5' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderBottomColor = 'transparent' }}
              >
                <span style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: '#ede9fe', color: '#4f46e5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: '800',
                }}>{i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Scrollable edit sections */}
          <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px' }}>

            {/* LinkedIn PDF Import — shown first so it auto-fills the profile below */}
            <EditorSection id="pb-section-1" number="1" title="Import from LinkedIn PDF" description="Auto-fills name, headline, location, email, skills, experience & education" defaultOpen={!linkedinData}>

              {!linkedinData ? (
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
                    Go to your <strong>LinkedIn profile page</strong> → click <strong>More…</strong> (below your photo) → <strong>Save to PDF</strong>.
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
                    Do not use Settings → Data Privacy export — that gives a ZIP file, not a PDF.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    id="linkedin-pdf-upload"
                    style={{ display: 'none' }}
                    onChange={handleLinkedinUpload}
                    disabled={linkedinUploading}
                  />
                  <label
                    htmlFor="linkedin-pdf-upload"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      padding: '9px 18px', borderRadius: '8px',
                      border: '1px solid #0a66c2', backgroundColor: linkedinUploading ? '#f1f5f9' : '#e8f0fd',
                      color: '#0a66c2', fontSize: '13px', fontWeight: '700',
                      cursor: linkedinUploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {linkedinUploading ? '⏳ Extracting…' : '🔗 Upload LinkedIn PDF'}
                  </label>
                  {linkedinError && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#dc2626' }}>{linkedinError}</p>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>
                      ✓ LinkedIn profile imported — fields auto-filled below
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        id="linkedin-pdf-reupload"
                        style={{ display: 'none' }}
                        onChange={handleLinkedinUpload}
                        disabled={linkedinUploading}
                      />
                      <label
                        htmlFor="linkedin-pdf-reupload"
                        style={{ fontSize: '11px', color: '#0a66c2', cursor: 'pointer', fontWeight: '600' }}
                      >
                        {linkedinUploading ? '⏳…' : '🔄 Re-upload'}
                      </label>
                      <button
                        onClick={() => setLinkedinData(null)}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {linkedinData.name && (
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#dcfce7', color: '#166534' }}>
                        👤 {linkedinData.name}
                      </span>
                    )}
                    {linkedinData.experience?.length > 0 && (
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        {linkedinData.experience.length} Experience {linkedinData.experience.length === 1 ? 'entry' : 'entries'}
                      </span>
                    )}
                    {linkedinData.education?.length > 0 && (
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fef3c7', color: '#92400e' }}>
                        {linkedinData.education.length} Education {linkedinData.education.length === 1 ? 'entry' : 'entries'}
                      </span>
                    )}
                    {linkedinData.skills?.length > 0 && (
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
                        {linkedinData.skills.length} Skills
                      </span>
                    )}
                  </div>
                  {linkedinData.experience?.slice(0, 3).map((exp, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '6px' }}>
                      <p style={{ margin: '0 0 1px', fontSize: '12px', fontWeight: '700', color: '#111827' }}>{exp.role}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{exp.company} · {exp.startDate} – {exp.endDate}</p>
                    </div>
                  ))}
                  {(linkedinData.experience?.length ?? 0) > 3 && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                      +{linkedinData.experience.length - 3} more entries visible on public portfolio
                    </p>
                  )}
                </div>
              )}
            </EditorSection>

            {/* 0. Personal Profile — auto-filled by LinkedIn above */}
            <EditorSection id="pb-section-2" number="2" title="Personal Profile" description="Your identity — shown at the top of your public portfolio">

              {/* Profile photo upload */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
                  Profile Photo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Avatar preview */}
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '2px solid #e5e7eb',
                  }}>
                    {profile.photoUrl
                      ? <img src={profile.photoUrl} alt="profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'white', fontSize: '20px', fontWeight: '800' }}>
                          {(profile.fullName || '?')[0].toUpperCase()}
                        </span>
                    }
                  </div>
                  {/* Controls */}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      id="profile-photo-upload"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                    />
                    <label
                      htmlFor="profile-photo-upload"
                      style={{
                        display: 'inline-block', padding: '7px 14px', borderRadius: '8px',
                        border: '1px solid #d1d5db', backgroundColor: 'white',
                        color: '#374151', fontSize: '12px', fontWeight: '600',
                        cursor: 'pointer', marginRight: '8px',
                      }}
                    >
                      {profile.photoUrl ? '🔄 Change Photo' : '📁 Upload Photo'}
                    </label>
                    {profile.photoUrl && (
                      <button
                        onClick={() => setProfile(p => ({ ...p, photoUrl: '' }))}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                      >
                        Remove
                      </button>
                    )}
                    <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#9ca3af' }}>
                      JPG, PNG or GIF · Auto-resized to 200 × 200 px
                    </p>
                  </div>
                </div>
              </div>

              {/* Text fields */}
              {[
                { key: 'fullName',    label: 'Full Name',             placeholder: 'Jane Smith',                              type: 'text'  },
                { key: 'headline',    label: 'Professional Headline', placeholder: 'AI & Full-Stack Developer',               type: 'text'  },
                { key: 'location',   label: 'Location',              placeholder: 'Toronto, Canada',                         type: 'text'  },
                { key: 'email',      label: 'Email',                 placeholder: 'jane@email.com',                          type: 'email' },
                { key: 'githubUrl',  label: 'GitHub URL',            placeholder: 'https://github.com/username',             type: 'url'   },
                { key: 'linkedinUrl',label: 'LinkedIn URL',           placeholder: 'https://linkedin.com/in/username',        type: 'url'   },
                { key: 'website',    label: 'Personal Website',      placeholder: 'https://yoursite.com (optional)',          type: 'url'   },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>{label}</label>
                  <input
                    type={type}
                    value={profile[key] || ''}
                    onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      width: '100%', padding: '9px 12px',
                      border: '1px solid #e5e7eb', borderRadius: '8px',
                      fontSize: '13px', color: '#111827', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </EditorSection>

            {/* 3. Headline */}
            <EditorSection id="pb-section-3" number="3" title="Headline" description="Your professional headline used in the AI-generated narrative">
              <input
                type="text"
                value={editedHeadline}
                onChange={e => setEditedHeadline(e.target.value)}
                maxLength={80}
                placeholder="e.g. Full-Stack Developer · React · Node.js"
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #e5e7eb', borderRadius: '10px',
                  fontSize: '14px', color: '#111827', outline: 'none', boxSizing: 'border-box',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#c7c7c7', marginTop: '4px' }}>
                {editedHeadline.length} / 80
              </div>
            </EditorSection>

            {/* 2. Professional Summary */}
            <EditorSection id="pb-section-4" number="4" title="Professional Summary" description="Tell recruiters who you are and what you bring to the table">
              <textarea
                value={editedNarrative}
                onChange={e => setEditedNarrative(e.target.value)}
                maxLength={1000}
                style={{
                  width: '100%', padding: '14px 16px',
                  border: '1px solid #e5e7eb', borderRadius: '10px',
                  fontSize: '13px', color: '#374151', lineHeight: '1.75', outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                  minHeight: '200px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#c7c7c7', marginTop: '4px' }}>
                {editedNarrative.length} / 1000
              </div>
            </EditorSection>

            {/* 3. Top Skills — AI repos + LinkedIn merged */}
            {mergedSkills.length > 0 && (() => {
              const SKILL_LIMIT = 15
              const visibleSkills = showAllSkills ? mergedSkills : mergedSkills.slice(0, SKILL_LIMIT)
              const hiddenCount   = mergedSkills.length - SKILL_LIMIT
              return (
                <EditorSection id="pb-section-5" number="5" title="Top Skills" description="AI-extracted from repos + skills imported from LinkedIn PDF">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {visibleSkills.map((skill, i) => {
                      const isLinkedIn = skill.source === 'linkedin'
                      const s = isLinkedIn
                        ? { bg: '#e8f3ff', color: '#0a66c2', border: '#bfdbfe' }
                        : techChipStyle(skill.category)
                      return (
                        <span key={i} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                          backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
                        }}>
                          {skill.name}
                          {isLinkedIn
                            ? <span style={{ fontSize: '9px', fontWeight: '700', backgroundColor: '#0a66c2', color: '#fff', padding: '1px 4px', borderRadius: '3px', opacity: 0.8 }}>in</span>
                            : <span style={{ opacity: 0.5, fontSize: '10px', fontWeight: '500' }}>{Math.round((skill.confidence || 0) * 100)}%</span>
                          }
                        </span>
                      )
                    })}
                  </div>

                  {/* Show all / Show less toggle */}
                  {mergedSkills.length > SKILL_LIMIT && (
                    <button
                      onClick={() => setShowAllSkills(v => !v)}
                      style={{
                        marginTop: '10px', background: 'none', border: 'none',
                        fontSize: '11px', fontWeight: '600', color: '#4f46e5',
                        cursor: 'pointer', padding: '2px 0',
                      }}
                    >
                      {showAllSkills ? `Show less ↑` : `Show all ${mergedSkills.length} skills ↓`}
                    </button>
                  )}

                  {mergedSkills.filter(s => s.source === 'linkedin').length > 0 && (
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                      {mergedSkills.filter(s => s.source === 'linkedin').length} skill{mergedSkills.filter(s => s.source === 'linkedin').length !== 1 ? 's' : ''} from LinkedIn
                      · <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', backgroundColor: '#0a66c2', color: '#fff', padding: '1px 4px', borderRadius: '3px' }}>in</span>
                          <span> = LinkedIn source</span>
                        </span>
                    </p>
                  )}
                </EditorSection>
              )
            })()}

            {/* 4. Project Summaries */}
            <EditorSection id="pb-section-6" number="6" title="Project Summaries" description="Edit the one-liner shown on each project card. Generate AI descriptions for detailed project breakdowns.">
                <div style={{ marginBottom: '14px' }}>
                  <button
                    onClick={handleGenerateDescriptions}
                    disabled={generatingDescs}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: generatingDescs ? '#a5b4fc' : '#4361ee',
                      color: '#fff', border: 'none', borderRadius: '8px',
                      fontSize: '12px', fontWeight: '600',
                      cursor: generatingDescs ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generatingDescs ? 'Generating…' : 'Generate AI Descriptions'}
                  </button>
                  {descsGenerated && (
                    <span style={{ marginLeft: '10px', fontSize: '11px', color: '#166534', fontWeight: '600' }}>
                      ✓ Descriptions saved
                    </span>
                  )}
                  {descsError && (
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#dc2626' }}>{descsError}</p>
                  )}
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 }}>
                    Uses deep analysis to write 2–4 paragraph descriptions. Visitors see them when they click a project.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {editedProjects.map((p, i) => (
                    <div key={i}>
                      <p style={{ margin: '0 0 7px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>{p.repoName}</p>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Card summary
                      </label>
                      <textarea
                        value={p.oneLiner || ''}
                        onChange={e => {
                          const next = [...editedProjects]
                          next[i] = { ...next[i], oneLiner: e.target.value }
                          setEditedProjects(next)
                        }}
                        maxLength={300}
                        style={{
                          width: '100%', padding: '12px 14px',
                          border: '1px solid #e5e7eb', borderRadius: '10px',
                          fontSize: '12px', color: '#374151', outline: 'none',
                          boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6',
                          minHeight: '60px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      />
                      <div style={{ textAlign: 'right', fontSize: '10px', color: '#c7c7c7', marginTop: '3px' }}>
                        {(p.oneLiner || '').length} / 300
                      </div>
                      {p.description && (
                        <div style={{ marginTop: '10px' }}>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            AI description (shown when visitor clicks project)
                          </label>
                          <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                            fontSize: '11px', color: '#374151', lineHeight: '1.7',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {p.description}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </EditorSection>

            {/* 5. Project Media */}
            <EditorSection id="pb-section-7" number="7" title="Project Media" description="Paste a GitHub file URL — auto-converted to a displayable media URL" defaultOpen={false}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>
                Paste a GitHub file URL. Repo2Reputation will automatically convert it into a displayable media URL.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[...selected].map(repoId => {
                  const repo = importedRepos.find(r => r.id === repoId)
                  if (!repo) return null
                  return (
                    <MediaInput
                      key={repoId}
                      repoName={repo.name}
                      value={repoMedia[repoId]?.gifUrl || ''}
                      onChange={converted => setRepoMedia(prev => ({ ...prev, [repoId]: { gifUrl: converted } }))}
                    />
                  )
                })}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                ⚠️ Keep media files under 10 MB for best performance. Large files load slowly for recruiters.
              </p>
              <button
                onClick={handleSaveMedia}
                disabled={savingMedia}
                style={{
                  marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none',
                  backgroundColor: mediaSaved ? '#dcfce7' : '#f3f4f6',
                  color: mediaSaved ? '#166534' : '#6b7280',
                  fontWeight: '600', fontSize: '12px', cursor: savingMedia ? 'not-allowed' : 'pointer',
                }}
              >
                {savingMedia ? 'Saving…' : mediaSaved ? '✓ Media Saved' : 'Save Media'}
              </button>
            </EditorSection>

          </div>

          {/* Bottom action bar */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '14px 20px', backgroundColor: '#fff', flexShrink: 0 }}>
            {saveError && <p style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>{saveError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginBottom: saved ? '6px' : '0' }}>
              <button
                onClick={handleRegenerateNarrative}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '10px 14px', borderRadius: '9px',
                  border: '1px solid #e5e7eb', backgroundColor: 'white',
                  color: '#6b7280', fontWeight: '600', fontSize: '12px', cursor: 'pointer',
                  transition: 'background-color 0.15s', whiteSpace: 'nowrap',
                }}
              >
                ↺ Regenerate
              </button>
              <button
                onClick={handleSaveNarrative}
                disabled={saving}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '10px 14px', borderRadius: '9px', border: 'none',
                  backgroundColor: saved ? '#16a34a' : saving ? '#a5b4fc' : '#4f46e5',
                  color: 'white', fontWeight: '700', fontSize: '13px',
                  cursor: saving ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s',
                }}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : '✓ Save Changes'}
              </button>
            </div>
            {saved && (
              <p style={{ margin: 0, fontSize: '10px', color: '#16a34a', textAlign: 'center' }}>
                All changes saved
              </p>
            )}
          </div>
        </div>

        {/* ── Right Preview Panel ───────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', minWidth: 0 }}>
          {/* Preview header */}
          <div style={{
            padding: '11px 18px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>
              Portfolio Preview
              <span style={{ fontWeight: '400', color: '#9ca3af', fontSize: '12px', marginLeft: '5px' }}>(Public View)</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Device toggle — decorative */}
              <div style={{ display: 'flex', gap: '1px', padding: '3px', backgroundColor: '#f3f4f6', borderRadius: '7px' }}>
                {['🖥', '📱'].map((ic, i) => (
                  <span key={i} style={{
                    padding: '3px 8px', borderRadius: '5px', fontSize: '12px', cursor: 'default',
                    backgroundColor: i === 0 ? 'white' : 'transparent',
                    boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
                  }}>{ic}</span>
                ))}
              </div>
              {publishError && <span style={{ fontSize: '11px', color: '#dc2626', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{publishError}</span>}

              {/* View Live button */}
              {liveUrl && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px', borderRadius: '7px', textDecoration: 'none',
                    border: `1px solid ${isPublished ? '#16a34a' : '#d1d5db'}`,
                    backgroundColor: isPublished ? '#f0fdf4' : '#f9fafb',
                    color: isPublished ? '#16a34a' : '#9ca3af',
                    fontWeight: '600', fontSize: '12px',
                    pointerEvents: isPublished ? 'auto' : 'none',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  title={isPublished ? 'Open your live public portfolio' : 'Publish first to view live page'}
                >
                  {isPublished ? '🌐 View Live →' : '🔒 Not published'}
                </a>
              )}

              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '7px 14px', borderRadius: '7px', border: 'none',
                  backgroundColor: publishing ? '#a5b4fc' : '#4f46e5',
                  color: 'white', fontWeight: '600', fontSize: '12px',
                  cursor: publishing ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s',
                }}
              >
                {publishing ? 'Publishing…' : isPublished ? '↗ Re-publish' : '↗ Publish Portfolio'}
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <MiniPreview
              headline={editedHeadline}
              narrative={editedNarrative}
              topSkills={mergedSkills}
              projects={editedProjects}
              repos={selectedRepos}
              analysisMap={analysisMap}
              profile={profile}
              engineeringStrengths={narrativeData.engineering_strengths || []}
              linkedin={linkedinData}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Portfolio created — generate narrative ─────────────────────────
  if (portfolio) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '8px 0' }}>
        {!autoStart && (
          <div style={{ padding: '10px 16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', color: '#166534', fontWeight: 'bold' }}>
            ✓ Portfolio "{portfolio.title}" created
          </div>
        )}

        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', backgroundColor: 'white', textAlign: 'center' }}>
          {narrativeStatus === 'generating' ? (
            <>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
              <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '15px', color: '#111827' }}>
                {autoStart ? 'Building your portfolio…' : 'Generating narrative…'}
              </p>
              <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>
                {autoStart ? 'AI is writing your professional summary. This takes about 20–30 seconds.' : 'This takes about 10–20 seconds. Hang tight.'}
              </p>

              {/* LinkedIn prompt — shown during auto-start generation only */}
              {autoStart && (
                <div style={{ marginTop: '28px', padding: '20px', backgroundColor: '#f8faff', border: '1px solid #c7d7f7', borderRadius: '10px', textAlign: 'left' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    While you wait — add LinkedIn (optional)
                  </p>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>
                    Upload your LinkedIn PDF export to merge your work experience and skills into the portfolio.
                  </p>
                  {linkedinData ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                      ✓ LinkedIn added — {linkedinData.skills?.length || 0} skills imported
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        id="linkedin-pdf-onboarding"
                        style={{ display: 'none' }}
                        onChange={handleLinkedinUpload}
                        disabled={linkedinUploading}
                      />
                      <label
                        htmlFor="linkedin-pdf-onboarding"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '7px',
                          padding: '9px 18px', borderRadius: '8px',
                          border: '1px solid #0a66c2',
                          backgroundColor: linkedinUploading ? '#f1f5f9' : '#e8f0fd',
                          color: '#0a66c2', fontSize: '13px', fontWeight: '700',
                          cursor: linkedinUploading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {linkedinUploading ? '⏳ Extracting…' : '🔗 Upload LinkedIn PDF'}
                      </label>
                      {linkedinError && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#dc2626' }}>{linkedinError}</p>
                      )}
                      <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                        Export from LinkedIn → Me → Settings → Data Privacy → Get a copy of your data
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
              <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '15px', color: '#111827' }}>Ready to generate your narrative</p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280' }}>
                Our AI will write a recruiter-facing professional summary based on your {portfolio.repositoryIds?.length || selected.size} selected {portfolio.repositoryIds?.length === 1 ? 'repo' : 'repos'}.
              </p>
              {generateError && <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>{generateError}</p>}
              <button
                onClick={handleGenerateNarrative}
                disabled={generating}
                style={{
                  padding: '11px 28px', borderRadius: '10px', border: 'none',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  backgroundColor: generating ? '#a5b4fc' : '#4f46e5',
                  color: 'white', fontWeight: 'bold', fontSize: '14px', transition: 'background-color 0.15s',
                }}
              >
                {generating ? 'Starting…' : 'Generate AI Narrative'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Step 1: Repo selection ─────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '8px 0' }}>

      {loading ? (
        <PortfolioBuilderSkeleton />
      ) : loadError ? (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>Failed to load repositories: {loadError}</p>
          <button onClick={loadRepos} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>↻ Retry</button>
        </div>
      ) : analyzedRepos.length === 0 ? (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {importedRepos.length === 0 ? (
            <>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                No repositories imported yet. Select and import repositories to get started.
              </p>
              {onGoToBrowse && (
                <button
                  onClick={onGoToBrowse}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#4f46e5',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Browse GitHub Repos →
                </button>
              )}
            </>
          ) : (
            <>
              {(() => {
                const allStopped = importedRepos.every(r =>
                  ['failed', 'cancelled'].includes(repoStatusMap[r.id]?.status)
                )
                const hasStopped = importedRepos.some(r =>
                  ['failed', 'cancelled'].includes(repoStatusMap[r.id]?.status)
                )
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <p style={{ color: '#374151', fontSize: '14px', margin: 0, fontWeight: '600' }}>
                        {allStopped
                          ? 'Analysis stopped'
                          : `Analyzing ${importedRepos.length} ${importedRepos.length === 1 ? 'repository' : 'repositories'}…`}
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {analysisInProgress && (
                          <button
                            onClick={handleCancelAnalysis}
                            disabled={cancelling}
                            style={{
                              padding: '5px 12px', borderRadius: '7px',
                              border: '1px solid #fca5a5', background: '#fff1f2',
                              color: '#dc2626', fontSize: '12px', fontWeight: '600',
                              cursor: cancelling ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {cancelling ? 'Stopping…' : '⏹ Stop'}
                          </button>
                        )}
                        {hasStopped && !analysisInProgress && (
                          <button
                            onClick={handleRestartAll}
                            disabled={cancelling}
                            style={{
                              padding: '5px 12px', borderRadius: '7px',
                              border: '1px solid #a5b4fc', background: '#eef2ff',
                              color: '#4f46e5', fontSize: '12px', fontWeight: '600',
                              cursor: cancelling ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {cancelling ? 'Restarting…' : '▶ Restart All'}
                          </button>
                        )}
                        {onGoToBrowse && !analysisInProgress && (
                          <button
                            onClick={onGoToBrowse}
                            style={{
                              padding: '5px 12px', borderRadius: '7px',
                              border: '1px solid #d1d5db', background: '#fff',
                              color: '#374151', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                            }}
                          >
                            ← Change repos
                          </button>
                        )}
                        {!analysisInProgress && (
                          <button
                            onClick={loadRepos}
                            style={{
                              padding: '5px 12px', borderRadius: '7px',
                              border: '1px solid #d1d5db', background: '#fff',
                              color: '#374151', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                            }}
                          >
                            ↻ Refresh
                          </button>
                        )}
                      </div>
                    </div>
                    {analysisInProgress && (
                      <p style={{ color: elapsedSec > 120 ? '#d97706' : '#9ca3af', fontSize: '12px', margin: '0 0 14px' }}>
                        {elapsedSec > 120
                          ? `⚠️ Taking longer than usual (${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s) — large repos can take up to 5 minutes. You can stop and retry.`
                          : `Running for ${elapsedSec}s — auto-refreshing every 5s. Usually takes 1–2 minutes per repo.`}
                      </p>
                    )}
                    {!analysisInProgress && (
                      <p style={{ color: '#9ca3af', fontSize: '12px', margin: '0 0 14px' }}>
                        You can restart stopped repos individually or all at once.
                      </p>
                    )}
                  </>
                )
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {importedRepos.map(repo => {
                  const st = repoStatusMap[repo.id]?.status || 'pending'
                  const isDone = ['completed', 'partial'].includes(st)
                  const isFailed = ['failed', 'cancelled'].includes(st)
                  return (
                    <div key={repo.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 14px', borderRadius: '10px',
                      border: `1px solid ${isDone ? '#86efac' : isFailed ? '#fca5a5' : '#e5e7eb'}`,
                      backgroundColor: isDone ? '#f0fdf4' : isFailed ? '#fff1f2' : '#fafafa',
                    }}>
                      <div style={{ width: '20px', flexShrink: 0, textAlign: 'center', fontSize: '14px' }}>
                        {isDone ? '✓' : isFailed ? '✗' : (
                          <span style={{
                            display: 'inline-block', width: '14px', height: '14px',
                            border: '2px solid #d1d5db', borderTopColor: '#4f46e5',
                            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                            verticalAlign: 'middle',
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#111827' }}>{repo.name}</p>
                        {repo.description && (
                          <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {repo.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {(isFailed || (!isDone && st === 'pending')) && (
                          <button
                            onClick={() => handleRestartRepo(repo.id)}
                            disabled={restarting === repo.id}
                            style={{
                              padding: '2px 9px', borderRadius: '8px',
                              border: '1px solid #a5b4fc', background: '#eef2ff',
                              color: '#4f46e5', fontSize: '11px', fontWeight: '600',
                              cursor: restarting === repo.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {restarting === repo.id ? '…' : isFailed ? '↺ Retry' : '▶ Analyze'}
                          </button>
                        )}
                        <span style={{
                          fontSize: '11px', fontWeight: '600', padding: '2px 9px', borderRadius: '10px',
                          backgroundColor: isDone ? '#dcfce7' : isFailed ? '#fee2e2' : '#eff6ff',
                          color: isDone ? '#166534' : isFailed ? '#991b1b' : '#1d4ed8',
                          border: `1px solid ${isDone ? '#86efac' : isFailed ? '#fca5a5' : '#bfdbfe'}`,
                        }}>
                          {isDone ? '✓ Analyzed' : isFailed ? (st === 'cancelled' ? 'Stopped' : 'Failed') : st === 'running' ? 'Analyzing…' : 'Queued'}
                        </span>
                        {deletingRepo === repo.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>Remove?</span>
                            <button
                              onClick={() => handleDeleteRepo(repo.id)}
                              disabled={deleting === repo.id}
                              style={{ padding: '2px 8px', borderRadius: '6px', background: '#dc2626', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                            >{deleting === repo.id ? '…' : 'Yes'}</button>
                            <button
                              onClick={() => setDeletingRepo(null)}
                              style={{ padding: '2px 8px', borderRadius: '6px', background: '#fff', border: '1px solid #d1d5db', color: '#374151', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                            >No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingRepo(repo.id)}
                            style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: '15px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
                            title="Remove this repo"
                          >×</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Pending repos not yet analyzed */}
          {importedRepos.filter(r => !['completed','partial'].includes(analysisMap[r.id]?.status)).length > 0 && (
            <div style={{ marginBottom: '16px', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: '#fafafa' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                Still analyzing ({importedRepos.filter(r => !['completed','partial'].includes(analysisMap[r.id]?.status)).length} repos)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {importedRepos.filter(r => !['completed','partial'].includes(analysisMap[r.id]?.status)).map(repo => {
                  const st = repoStatusMap[repo.id]?.status || 'pending'
                  const isFailed = ['failed','cancelled'].includes(st)
                  return (
                    <div key={repo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: isFailed ? '#dc2626' : '#6b7280', flex: 1 }}>{repo.name}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px',
                        backgroundColor: isFailed ? '#fee2e2' : '#eff6ff',
                        color: isFailed ? '#991b1b' : '#1d4ed8',
                        border: `1px solid ${isFailed ? '#fca5a5' : '#bfdbfe'}`,
                      }}>
                        {isFailed ? (st === 'cancelled' ? 'Stopped' : 'Failed') : st === 'running' ? 'Analyzing…' : 'Queued'}
                      </span>
                      {!isFailed && (
                        <button
                          onClick={() => handleRestartRepo(repo.id)}
                          disabled={restarting === repo.id}
                          style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                            border: '1px solid #a5b4fc', background: '#eef2ff', color: '#4f46e5',
                            cursor: restarting === repo.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {restarting === repo.id ? '…' : '▶ Analyze'}
                        </button>
                      )}
                      {isFailed && (
                        <button
                          onClick={() => handleDeleteRepo(repo.id)}
                          disabled={deleting === repo.id}
                          style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                            border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626',
                            cursor: deleting === repo.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {deleting === repo.id ? '…' : '✕ Remove'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Repo checklist */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '10px' }}>
              Select Repositories ({selected.size} selected)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {analyzedRepos.map(repo => {
                const isChecked = selected.has(repo.id)
                return (
                  <div
                    key={repo.id}
                    onClick={() => toggleSelect(repo.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', border: `1px solid ${isChecked ? '#818cf8' : '#e5e7eb'}`,
                      borderRadius: '10px', backgroundColor: isChecked ? '#eef2ff' : 'white',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(repo.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '16px', height: '16px', accentColor: '#4f46e5', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#111827' }}>{repo.name}</p>
                      {repo.description && (
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
                        ✓ Analyzed
                      </span>
                      {deletingRepo === repo.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>Remove?</span>
                          <button
                            onClick={() => handleDeleteRepo(repo.id)}
                            disabled={deleting === repo.id}
                            style={{ padding: '2px 8px', borderRadius: '6px', background: '#dc2626', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                          >{deleting === repo.id ? '…' : 'Yes'}</button>
                          <button
                            onClick={() => setDeletingRepo(null)}
                            style={{ padding: '2px 8px', borderRadius: '6px', background: '#fff', border: '1px solid #d1d5db', color: '#374151', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                          >No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingRepo(repo.id)}
                          style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: '15px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
                          title="Remove this repo from portfolio"
                        >×</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {createError && (
            <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>{createError}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              backgroundColor: creating ? '#a5b4fc' : '#4f46e5',
              color: 'white', fontWeight: 'bold', fontSize: '15px',
              cursor: creating ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {creating ? 'Creating…' : `Create Portfolio with ${selected.size} Repo${selected.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  )
}

export default PortfolioBuilder
