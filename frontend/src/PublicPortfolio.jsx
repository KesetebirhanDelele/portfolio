import { useState, useEffect, useRef } from 'react'
import { BASE_URL } from './api'
import { PublicPortfolioSkeleton } from './Skeleton'

function ensureHttps(url) {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

async function downloadPdf(slug) {
  const res = await fetch(`${BASE_URL}/api/portfolios/public/${slug}/pdf`)
  if (!res.ok) throw new Error('PDF generation failed')
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${slug}-resume.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const A = '#4361ee'          // accent blue
const AL = '#eef2ff'         // accent light
const T = '#0f172a'          // text primary
const TS = '#475569'         // text secondary
const TM = '#94a3b8'         // text muted
const BD = '#e2e8f0'         // border
const BG = '#f8fafc'         // page background

const CAT = {
  Frontend: { bg: '#ede9fe', text: '#5b21b6' },
  Backend:  { bg: '#dbeafe', text: '#1e40af' },
  Database: { bg: '#fef3c7', text: '#92400e' },
  DevOps:   { bg: '#dcfce7', text: '#166534' },
  Mobile:   { bg: '#fce7f3', text: '#9d174d' },
  AI:       { bg: '#f3e8ff', text: '#6b21a8' },
  Testing:  { bg: '#ecfdf5', text: '#065f46' },
  Other:    { bg: '#f1f5f9', text: '#334155' },
}
const cat = c => CAT[c] || CAT.Other

const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
]
const gradient = name => GRADIENTS[(name?.charCodeAt(0) || 0) % GRADIENTS.length]

function groupByCategory(skills) {
  return skills.reduce((acc, s) => {
    const k = s.category || 'Other'
    ;(acc[k] = acc[k] || []).push(s)
    return acc
  }, {})
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ title, headline, topSkills, githubUsername, profile, engineeringStrengths, careerSignals, repos, repoCount, className = '' }) {
  const grouped     = groupByCategory(topSkills)
  const displayName = profile?.fullName || title || 'Developer'
  const displayHead = profile?.headline || headline
  const initials    = displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <aside className={`pp-sidebar ${className}`} style={{
      width: '240px', flexShrink: 0,
      backgroundColor: BG,
      borderRight: `1px solid ${BD}`,
      padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: '20px',
      overflowY: 'auto',
    }}>
      {/* Avatar + identity */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '88px', height: '88px', borderRadius: '50%',
          background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: '800', fontSize: '28px',
          margin: '0 auto 14px',
          boxShadow: '0 4px 18px rgba(67,97,238,0.28)',
          overflow: 'hidden',
        }}>
          {profile?.photoUrl
            ? <img src={profile.photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
            : initials}
        </div>

        <h2 style={{ margin: '0 0 5px', fontSize: '19px', fontWeight: '800', color: T, lineHeight: 1.2 }}>
          {displayName}
        </h2>
        {displayHead && (
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: A, fontWeight: '600', lineHeight: 1.5 }}>
            {displayHead}
          </p>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '20px',
          backgroundColor: '#dcfce7', fontSize: '11px', fontWeight: '600', color: '#166534',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
          Open to opportunities
        </span>
      </div>

      {/* Contact */}
      {(profile?.location || profile?.email || profile?.githubUrl || profile?.linkedinUrl || profile?.website || githubUsername) && (
        <div>
          <Label>Contact</Label>
          {profile?.location   && <Row icon="📍">{profile.location}</Row>}
          {profile?.email      && <Row icon="📧"><a href={`mailto:${profile.email}`} style={{ color: A, textDecoration: 'none', fontSize: '12px' }}>{profile.email}</a></Row>}
          {(profile?.githubUrl || githubUsername) && (
            <Row icon="🔗">
              <a href={profile?.githubUrl || `https://github.com/${githubUsername}`} target="_blank" rel="noreferrer"
                style={{ color: A, fontSize: '12px', textDecoration: 'none', fontWeight: '500' }}>
                GitHub Profile
              </a>
            </Row>
          )}
          {profile?.linkedinUrl && (
            <Row icon="🔗">
              <a href={ensureHttps(profile.linkedinUrl)} target="_blank" rel="noreferrer"
                style={{ color: A, fontSize: '12px', textDecoration: 'none', fontWeight: '500' }}>
                LinkedIn
              </a>
            </Row>
          )}
          {profile?.website && (
            <Row icon="🌐">
              <a href={profile.website} target="_blank" rel="noreferrer"
                style={{ color: A, fontSize: '12px', textDecoration: 'none', fontWeight: '500' }}>
                Personal Site
              </a>
            </Row>
          )}
        </div>
      )}

      {/* Engineering Strengths */}
      {engineeringStrengths?.length > 0 && (
        <div>
          <Label>Engineering Skills</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {engineeringStrengths.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#166534' }}>
                <span style={{ fontWeight: '700', flexShrink: 0 }}>✓</span>{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Technologies grouped by category */}
      {Object.keys(grouped).length > 0 && (
        <div id="skills">
          <Label>Core Technologies</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(grouped).map(([c, skills]) => {
              const s = cat(c)
              return (
                <div key={c}>
                  <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: '700', color: TS }}>{c}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {skills.map((sk, i) => (
                      <span key={i} style={{
                        padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600',
                        backgroundColor: s.bg, color: s.text,
                      }}>{sk.name}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Insights — per-repo technical strengths */}
      {(() => {
        const insights = (repos || [])
          .filter(r => r.analysis?.highlights?.strengths)
          .sort((a, b) => (b.analysis?.confidenceScore ?? 0) - (a.analysis?.confidenceScore ?? 0))
          .slice(0, 3)
          .map(r => r.analysis.highlights.strengths)
        if (!insights.length) return null
        return (
          <div>
            <Label icon="🤖">AI Insights</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {insights.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: '#16a34a', flexShrink: 0, marginTop: '5px',
                  }} />
                  <p style={{ margin: 0, fontSize: '11px', color: TS, lineHeight: 1.65 }}>
                    {s.trim()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

    </aside>
  )
}

function Label({ children, icon }) {
  return (
    <h3 style={{
      margin: '0 0 10px', fontSize: '10px', fontWeight: '700', color: T,
      textTransform: 'uppercase', letterSpacing: '1.5px',
      display: 'flex', alignItems: 'center', gap: '5px',
    }}>
      {icon && <span>{icon}</span>}{children}
    </h3>
  )
}

function Row({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
      <span style={{ fontSize: '12px', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '12px', color: TS }}>{children}</span>
    </div>
  )
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Projects', 'Experience', 'Skills']

function TopNav({ active, onTab, slug }) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf() {
    if (downloading || !slug) return
    setDownloading(true)
    try {
      await downloadPdf(slug)
    } catch (err) {
      console.error('[pdf download]', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      backgroundColor: '#fff',
      borderBottom: `1px solid ${BD}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '13px 0', flexShrink: 0 }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '6px',
          background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: '800', fontSize: '11px',
        }}>R</div>
        <span style={{ fontWeight: '700', fontSize: '13px', color: T }}>
          Repo2<span style={{ color: A }}>Reputation</span>
        </span>
      </div>


      {/* Tabs */}
      <div className="pp-nav-tabs" style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const id = tab.toLowerCase()
          const on = active === id
          return (
            <a key={tab} href={`#${id}`} onClick={() => onTab(id)}
              style={{
                padding: '14px 13px', fontSize: '13px', fontWeight: on ? '700' : '500',
                color: on ? A : TS,
                borderBottom: on ? `2px solid ${A}` : '2px solid transparent',
                textDecoration: 'none', transition: 'all 0.15s',
              }}>
              {tab}
            </a>
          )
        })}
      </div>

      {/* PDF download CTA */}
      <button
        onClick={handleDownloadPdf}
        disabled={downloading}
        style={{
          padding: '7px 14px',
          backgroundColor: downloading ? '#a5b4fc' : A,
          color: '#fff',
          border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
          cursor: downloading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '5px',
          transition: 'background-color 0.15s',
        }}>
        <span className="pp-nav-pdf-text">{downloading ? 'Generating…' : 'Download Resume PDF ↓'}</span>
        <span className="pp-nav-pdf-icon">↓</span>
      </button>
    </nav>
  )
}

// ─── Summary with Show more ───────────────────────────────────────────────────
function SummaryText({ text }) {
  const [expanded, setExpanded] = useState(false)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const short     = sentences.slice(0, 2).join(' ').trim()
  const isTruncated = sentences.length > 2

  return (
    <p style={{ margin: '0 0 14px', fontSize: '13px', color: TS, lineHeight: 1.7 }}>
      {expanded ? text : short}
      {isTruncated && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ marginLeft: '6px', background: 'none', border: 'none', color: A, fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </p>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ id, icon, title, children, right }) {
  return (
    <section id={id} style={{ marginBottom: '20px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: '7px', marginBottom: '12px', borderBottom: `1px solid ${BD}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: T, textTransform: 'uppercase', letterSpacing: '2px' }}>
            {title}
          </h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}


// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ repo, oneLiner, aiDescription }) {
  const [hov, setHov]                   = useState(false)
  const [expanded, setExpanded]         = useState(false)
  const [gifHov, setGifHov]             = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const techs  = (repo.analysis?.technologies || []).slice(0, 6)
  const topics = Array.isArray(repo.topics) ? repo.topics : (repo.topics ? JSON.parse(repo.topics) : [])
  const tags   = [...techs.map(t => t.name), ...topics].slice(0, 6)
  const shortDesc = oneLiner || repo.analysis?.whatItDoes || repo.description || repo.analysis?.summary || ''

  const paragraphs = expanded && aiDescription
    ? aiDescription.split(/\n\n+/).filter(Boolean)
    : null

  const collapseText = shortDesc
  const hasReadMore = aiDescription || shortDesc.length > 120
  const stars = repo.stars || 0
  const forks = repo.forks || 0

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'row',
        padding: '0', marginBottom: '14px',
        border: `1px solid ${hov ? '#a5b4fc' : BD}`,
        borderRadius: '12px', backgroundColor: '#fff',
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hov ? '0 4px 16px rgba(67,97,238,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Media — left column, only shown when gifUrl exists */}
      {repo.gifUrl && (
        <div style={{
          width: '38%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          padding: '16px 12px 16px 16px',
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#fff',
          justifyContent: 'flex-start',
        }}>

          {/* Header label */}
          <p style={{
            margin: '0 0 8px', fontSize: '10px', fontWeight: '700',
            color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px',
          }}>
            🎬 Project Demo
          </p>

          {/* Browser frame */}
          <div
            onMouseEnter={() => setGifHov(true)}
            onMouseLeave={() => setGifHov(false)}
            onClick={() => setLightboxOpen(true)}
            style={{
              position: 'relative', borderRadius: '8px',
              border: '1px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer',
              boxShadow: gifHov ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
              transform: gifHov ? 'scale(1.02)' : 'scale(1)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            {/* Browser toolbar */}
            <div style={{
              height: '24px', backgroundColor: '#f3f4f6',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', padding: '0 8px', gap: '5px',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            </div>

            {/* GIF */}
            <img
              src={repo.gifUrl}
              alt={repo.name}
              style={{ width: '100%', display: 'block', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }}
            />

          </div>
        </div>
      )}

      {/* Details */}
      <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>

        {/* 1. Title — links to GitHub */}
        <a
          href={repo.fullName ? `https://github.com/${repo.fullName}` : '#'}
          target="_blank"
          rel="noreferrer"
          style={{
            margin: '0 0 6px', padding: 0,
            fontSize: '15px', fontWeight: '700', color: T, textAlign: 'left',
            display: 'block', lineHeight: 1.3,
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          className="proj-link"
        >
          {formatRepoName(repo.name)}
        </a>

        {/* 2. Summary — always show overview, expand for full AI analysis */}
        {collapseText && (
          <p style={{
            margin: '0 0 6px', fontSize: '12px', color: TS, lineHeight: 1.7,
          }}>
            {collapseText}
          </p>
        )}

        {!expanded && aiDescription && (
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: TM, lineHeight: 1.7 }}>
            {aiDescription.split(/\n\n+/)[0]}
          </p>
        )}

        {expanded && (
          <div style={{ marginBottom: '10px' }}>
            {paragraphs ? (
              <div style={{
                padding: '12px 14px',
                backgroundColor: '#f8faff',
                border: `1px solid #e0e7ff`,
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#4361ee', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                  Project Overview
                </span>
                {paragraphs.map((para, i) => (
                  <p key={i} style={{ margin: i > 0 ? '10px 0 0' : '0', fontSize: '12px', color: TS, lineHeight: 1.75 }}>
                    {para}
                  </p>
                ))}
              </div>
            ) : shortDesc ? (
              <p style={{ margin: 0, fontSize: '12px', color: TS, lineHeight: 1.7 }}>
                {shortDesc}
              </p>
            ) : null}

          </div>
        )}

        {/* 3. Technology chips */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '9px' }}>
            {tags.map((tag, i) => (
              <span key={i} style={{
                padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '600',
                backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac',
              }}>{tag}</span>
            ))}
          </div>
        )}

        {/* 4. Stats row — always visible */}
        {(stars > 0 || forks > 0 || repo.language || repo.updatedAt) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {stars > 0 && <span style={{ fontSize: '11px', color: TM }}>★ {stars}</span>}
            {forks > 0 && <span style={{ fontSize: '11px', color: TM }}>⑂ {forks}</span>}
            {repo.language && (
              <span style={{ fontSize: '11px', color: TM, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                {repo.language}
              </span>
            )}
            {repo.updatedAt && (
              <span style={{ fontSize: '11px', color: TM }}>
                Updated {new Date(repo.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {/* 5. Read more + View on GitHub CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          {hasReadMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: A }}
            >
              {expanded ? 'Show less ↑' : 'Show more ↓'}
            </button>
          )}
          {repo.fullName && (
            <a
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                border: `1px solid ${BD}`, color: T, backgroundColor: '#fff',
                textDecoration: 'none',
              }}
            >
              View on GitHub →
            </a>
          )}
        </div>

      </div>

      {/* Lightbox modal */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img
              src={repo.gifUrl}
              alt={repo.name}
              style={{
                maxWidth: '90vw', maxHeight: '85vh',
                objectFit: 'contain', borderRadius: '12px', display: 'block',
              }}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute', top: '-14px', right: '-14px',
                width: '28px', height: '28px', borderRadius: '50%',
                border: 'none', backgroundColor: '#fff', color: T,
                fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Experience helpers ───────────────────────────────────────────────────────
function formatRepoName(name = '') {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferRoleTitle(repo) {
  const techs  = repo.analysis?.technologies || []
  // Normalise: strip punctuation/spaces so "Node.js" = "nodejs", "React.js" = "reactjs"
  const raw    = new Set(techs.map(t => t.name.toLowerCase()))
  const names  = new Set([...raw, ...[...raw].map(n => n.replace(/[\s.]/g, ''))])
  const desc   = (repo.analysis?.whatItDoes || repo.description || '').toLowerCase()
  const counts = techs.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc }, {})
  const hasCat = c => (counts[c] || 0) > 0
  // has() checks exact tech names (with normalised aliases)
  const has    = (...ns) => ns.some(n => names.has(n.toLowerCase()) || names.has(n.toLowerCase().replace(/[\s.]/g, '')))
  const inDesc = (...ws) => ws.some(w => desc.includes(w))
  const top    = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]

  // ── 1. Specific AI / ML libraries ────────────────────────────────────────
  const aiLibs = [
    'tensorflow','pytorch','keras','scikit-learn','sklearn','huggingface',
    'langchain','openai','llama','bert','transformers','spacy','nltk',
    'stable-diffusion','anthropic','llamaindex','chromadb','ollama',
  ]
  if (aiLibs.some(l => names.has(l) || desc.includes(l))) {
    return hasCat('Frontend') || hasCat('Backend') ? 'AI Application Developer' : 'AI / ML Engineer'
  }

  // ── 2. AI category or strong AI keywords in description ──────────────────
  if (hasCat('AI') || inDesc('openai','llm','machine learning','neural network','nlp','gpt','generative ai')) {
    return hasCat('Frontend') || hasCat('Backend') ? 'AI Application Developer' : 'AI Engineer'
  }

  // ── 3. BI-specific tools ──────────────────────────────────────────────────
  const biTools = ['power bi','powerbi','tableau','looker','metabase','superset','dax','ssrs','ssas','qlik','grafana']
  if (biTools.some(t => names.has(t) || names.has(t.replace(/\s/g,'')) || desc.includes(t))) {
    return 'Business Intelligence Developer'
  }

  // ── 4. Python/R + data libraries → Data Scientist / Analyst ─────────────
  // Bug fix: was hasCat('Backend') which matched any Node/Express project
  const dataLibs = ['pandas','numpy','matplotlib','seaborn','plotly','scipy','streamlit','dash','jupyter','sklearn','polars']
  if (has('python','r','julia') && dataLibs.some(l => names.has(l))) {
    return inDesc('machine learning','predict','model','classif','cluster','regression','neural') ? 'Data Scientist' : 'Data Analyst'
  }

  // ── 5. SQL engine + analytics description → BI Developer ─────────────────
  const sqlEngines = ['sql','postgresql','postgres','mysql','mssql','sqlite','bigquery','redshift','snowflake','dbt']
  if (sqlEngines.some(s => names.has(s)) && inDesc('report','dashboard','analyt','visuali','insight','kpi','metric','warehouse')) {
    return 'BI Developer'
  }

  // ── 6. Frontend framework + backend framework → Full Stack ────────────────
  // Aliases cover common variations (node / nodejs / node.js, react / reactjs / react.js)
  const feFw = ['react','reactjs','vue','vuejs','angular','svelte','nextjs','nuxt','remix','astro','qwik']
  const beFw = ['node','nodejs','express','expressjs','django','flask','fastapi','spring','rails','laravel','nestjs','koa','hapi','gin','fiber','actix','axum','phoenix']
  const isFE = feFw.some(f => names.has(f))
  const isBE = beFw.some(b => names.has(b))
  if (isFE && isBE) return 'Full Stack Developer'

  // ── 7. Mobile frameworks ──────────────────────────────────────────────────
  if (has('react native','reactnative','flutter','expo','swift','kotlin','ionic','xamarin') || hasCat('Mobile')) {
    return 'Mobile Developer'
  }

  // ── 8. DevOps / cloud tools → Platform Engineer ──────────────────────────
  const devops = ['docker','kubernetes','k8s','terraform','ansible','jenkins','circleci','aws','gcp','azure','helm','pulumi','argocd']
  if (devops.some(d => names.has(d)) || top === 'DevOps') return 'Platform Engineer'

  // ── 9. Backend-only ───────────────────────────────────────────────────────
  if (isBE || (hasCat('Backend') && !hasCat('Frontend'))) return 'Backend Developer'

  // ── 10. Frontend-only ────────────────────────────────────────────────────
  if (isFE || (hasCat('Frontend') && !hasCat('Backend'))) return 'Frontend Developer'

  // ── 11. Category-level fallbacks ─────────────────────────────────────────
  if (hasCat('Frontend') && hasCat('Backend')) return 'Full Stack Developer'
  if (top === 'Database') return 'Data Engineer'
  return 'Software Engineer'
}

function buildImpactStatement(repo) {
  const what  = (repo.analysis?.whatItDoes || repo.description || '').trim()
  const techs = (repo.analysis?.technologies || []).slice(0, 3).map(t => t.name)
  const techStr = techs.length ? ` using ${techs.join(', ')}` : ''

  if (!what) return techs.length ? `Developed a solution${techStr}.` : null

  const verbs = ['Built', 'Developed', 'Engineered', 'Designed', 'Created']
  const verb  = verbs[what.charCodeAt(0) % verbs.length]

  // If what already opens with a past-tense verb, keep it
  if (/^(Built|Developed|Implemented|Created|Designed|Engineered|Architected|Analyzed|Automated)/i.test(what)) {
    const base = what.replace(/\.?$/, '')
    return techStr ? `${base}${techStr}.` : `${base}.`
  }

  // Strip leading article so we don't get "Built A TypeScript project…"
  const body = what.replace(/^(A |An |The )/i, '').replace(/\.?$/, '')
  return `${verb} ${body.charAt(0).toLowerCase()}${body.slice(1)}${techStr}.`
}

// ─── Experience timeline ──────────────────────────────────────────────────────
function Timeline({ repos }) {
  return (
    <div style={{ position: 'relative', paddingLeft: '26px' }}>
      <div style={{ position: 'absolute', left: '9px', top: 0, bottom: 0, width: '2px', backgroundColor: BD }} />

      {repos.map((repo, i) => {
        const roleTitle   = inferRoleTitle(repo)
        const displayName = formatRepoName(repo.name)
        const impact      = buildImpactStatement(repo)
        const techChips   = (repo.analysis?.technologies || []).slice(0, 5).map(t => t.name)

        return (
          <div key={i} style={{ display: 'flex', marginBottom: '24px', position: 'relative', alignItems: 'flex-start' }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: '-20px', top: '4px',
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: A, border: '3px solid #fff',
              boxShadow: `0 0 0 2px ${A}`, zIndex: 1,
            }} />

            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: '700', color: T }}>
                {roleTitle}
              </h4>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: A, fontWeight: '600' }}>
                {displayName}
              </p>
              {impact && (
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: TS, lineHeight: 1.65 }}>
                  {impact}
                </p>
              )}
              {techChips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {techChips.map((t, j) => (
                    <span key={j} style={{
                      padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '600',
                      backgroundColor: '#f1f5f9', color: '#334155', border: `1px solid ${BD}`,
                    }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PublicPortfolio({ slug }) {
  const [portfolio, setPortfolio] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const mainRef = useRef(null)

  useEffect(() => {
    fetch(`${BASE_URL}/api/portfolios/public/${slug}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); setLoading(false); return null }
        return res.json()
      })
      .then(json => {
        if (!json) return
        if (json.success) setPortfolio(json.data)
        else setNotFound(true)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  // Sync active tab on scroll
  useEffect(() => {
    const ids = ['overview', 'projects', 'experience', 'skills']
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveTab(e.target.id) })
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [portfolio])

  if (loading) return <PublicPortfolioSkeleton />

  if (notFound) return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <p style={{ fontSize: '56px', fontWeight: '800', color: BD, margin: 0, lineHeight: 1 }}>404</p>
      <p style={{ fontSize: '17px', fontWeight: '700', color: T, margin: 0 }}>Portfolio not found</p>
      <p style={{ fontSize: '13px', color: TS, margin: 0 }}>This portfolio may be private or the link may be incorrect.</p>
    </div>
  )

  const {
    title, headline, narrative, topSkills = [], repos = [], projects = [],
    publishedAt, engineeringStrengths = [], careerSignals = [], profile = {},
    linkedin = null,
  } = portfolio

  // Derive GitHub username from any repo fullName (e.g. "username/reponame")
  const githubUsername = repos.find(r => r.fullName)?.fullName?.split('/')?.[0] || null

  // Rank repos: highest confidence first, then featured (top 2) first
  const rankedRepos = [...repos].sort((a, b) =>
    (b.analysis?.confidenceScore ?? 0) - (a.analysis?.confidenceScore ?? 0)
  )

  const aiRepoCount = repos.filter(r =>
    (r.analysis?.technologies || []).some(t => ['OpenAI','LangChain','Anthropic','LlamaIndex'].includes(t.name))
  ).length

  const yearsExp = getYearsExperience(linkedin, profile)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: "'Inter', system-ui, sans-serif", color: T }}>

      <style>{`
        @media print {
          nav, aside { display: none !important; }
          #main-content { padding: 0 !important; }
        }
        a:hover { opacity: 0.8; }
        .proj-link:hover { color: #4361ee !important; }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .pp-sidebar { display: none !important; }
          .pp-layout { display: block !important; }
          .pp-main { padding: 16px 16px 40px !important; }
          .pp-mobile-header { display: flex !important; }
          .pp-nav-tabs { scrollbar-width: none; }
          .pp-nav-tabs::-webkit-scrollbar { display: none; }
          .pp-nav-pdf-text { display: none; }
          .pp-nav-pdf-icon { display: inline !important; }
          .pp-highlights { flex-direction: column !important; }
          .pp-highlights > div { border-right: none !important; border-bottom: 1px solid #e2e8f0 !important; }
          .pp-highlights > div:last-child { border-bottom: none !important; }
        }
        @media (min-width: 769px) {
          .pp-nav-pdf-icon { display: none !important; }
        }
      `}</style>

      <TopNav active={activeTab} onTab={setActiveTab} slug={portfolio.slug} />

      <div className="pp-layout" style={{ display: 'flex', minHeight: 'calc(100vh - 48px)' }}>

        <Sidebar
          title={title}
          headline={headline}
          topSkills={topSkills}
          githubUsername={githubUsername}
          profile={profile}
          engineeringStrengths={engineeringStrengths}
          careerSignals={careerSignals}
          repos={repos}
          repoCount={repos.length}
        />

        {/* Main content */}
        <main id="main-content" ref={mainRef} className="pp-main" style={{ flex: 1, padding: '20px 28px 32px', minWidth: 0, overflowY: 'auto' }}>

          {/* Mobile profile header — hidden on desktop via CSS */}
          {(() => {
            const displayName = profile?.fullName || title || 'Developer'
            const displayHead = profile?.headline || headline
            const initials    = displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
            return (
              <div className="pp-mobile-header" style={{
                display: 'none',
                flexDirection: 'column', alignItems: 'center', gap: '10px',
                paddingBottom: '20px', marginBottom: '16px',
                borderBottom: `1px solid ${BD}`, textAlign: 'center',
              }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: '800', fontSize: '22px', overflow: 'hidden',
                }}>
                  {profile?.photoUrl
                    ? <img src={profile.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                    : initials}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800', color: T }}>{displayName}</h2>
                  {displayHead && <p style={{ margin: '0 0 4px', fontSize: '12px', color: A, fontWeight: '600' }}>{displayHead}</p>}
                  {profile?.location && <p style={{ margin: 0, fontSize: '12px', color: TS }}>📍 {profile.location}</p>}
                </div>
                {topSkills.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', width: '100%', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                    {topSkills.slice(0, 8).map((sk, i) => {
                      const c = CAT[sk.category] || CAT.Other
                      return (
                        <span key={i} style={{
                          flexShrink: 0, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                          backgroundColor: c.bg, color: c.text,
                        }}>{sk.name}</span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Professional Summary ───────────────────────────────── */}
          <Section id="overview" icon="👤" title="Professional Summary">
            <SummaryText text={narrative || 'No summary available.'} />

            {/* Portfolio Highlights row */}
            <div className="pp-highlights" style={{
              display: 'flex',
              border: `1px solid ${BD}`, borderRadius: '10px',
              overflow: 'hidden', backgroundColor: '#fff', marginTop: '14px',
            }}>
              {[
                yearsExp
                  ? { value: yearsExp,      label: 'Years Experience',     icon: '📅' }
                  : aiRepoCount > 0
                    ? { value: aiRepoCount, label: 'AI Engineering',        icon: '🤖' }
                    : { value: '✓',         label: 'Professional Portfolio', icon: '💼' },
                { value: `${topSkills.length}+`,          label: 'Core Technologies', icon: '⚙️' },
                { value: repos.length, label: 'Projects', icon: '🚀' },
                ...(yearsExp && aiRepoCount > 0 ? [{ value: aiRepoCount, label: 'AI Systems Built', icon: '🤖' }] : []),
              ].map((s, i, arr) => (
                <div key={i} style={{
                  flex: 1, padding: '11px 8px', textAlign: 'center',
                  borderRight: i < arr.length - 1 ? `1px solid ${BD}` : 'none',
                }}>
                  <div style={{ fontSize: '13px', marginBottom: '2px' }}>{s.icon}</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: T, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: TS, marginTop: '3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Section>


          {/* ── Projects (ranked by confidence) ──────────────────────── */}
          {rankedRepos.length > 0 && (
            <Section id="projects" icon="🚀" title="Projects">
              {rankedRepos.map((repo, i) => {
                const match = projects.find(p => p.repoName === repo.name)
                return <ProjectCard key={i} repo={repo} oneLiner={match?.oneLiner} aiDescription={match?.description} />
              })}
            </Section>
          )}

          {/* ── Experience ─────────────────────────────────────────── */}
          <Section id="experience" icon="💼" title="Experience">
            {linkedin?.experience?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {/* LinkedIn experience entries — date left, dot center, content right */}
                <div style={{ position: 'relative', marginBottom: rankedRepos.length > 0 ? '28px' : '0' }}>
                  {/* Vertical line sits at: dateColWidth(88) + gap(12) + dotColWidth(22)/2 = 111px */}
                  <div style={{ position: 'absolute', left: '111px', top: 0, bottom: 0, width: '2px', backgroundColor: BD }} />
                  {linkedin.experience.map((exp, i) => {
                    const startYr = exp.startDate?.match(/\d{4}/)?.[0] ?? exp.startDate
                    const endYr   = /present/i.test(exp.endDate ?? '') ? 'Present' : (exp.endDate?.match(/\d{4}/)?.[0] ?? exp.endDate)
                    return (
                      <div key={i} style={{ display: 'flex', marginBottom: '28px', alignItems: 'flex-start' }}>
                        {/* Date */}
                        <div style={{ width: '88px', flexShrink: 0, textAlign: 'right', paddingRight: '12px', paddingTop: '3px' }}>
                          <span style={{ fontSize: '11px', color: TM, fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {startYr} – {endYr}
                          </span>
                        </div>
                        {/* Dot */}
                        <div style={{ width: '22px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '3px', zIndex: 1, position: 'relative' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: A, border: '3px solid #fff', boxShadow: `0 0 0 2px ${A}` }} />
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, paddingLeft: '14px' }}>
                          <h4 style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: '700', color: T }}>{exp.role}</h4>
                          <p style={{ margin: '0 0 8px', fontSize: '13px', color: A, fontWeight: '600' }}>{exp.company}</p>
                          {exp.bullets?.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {exp.bullets.map((b, j) => (
                                <li key={j} style={{ fontSize: '12px', color: TS, lineHeight: 1.6 }}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Education from LinkedIn */}
                {linkedin.education?.length > 0 && (
                  <div style={{ marginBottom: rankedRepos.length > 0 ? '28px' : '0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: '800', color: T, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Education</h3>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '111px', top: 0, bottom: 0, width: '2px', backgroundColor: BD }} />
                      {linkedin.education.map((edu, i) => (
                        <div key={i} style={{ display: 'flex', marginBottom: '20px', alignItems: 'flex-start' }}>
                          {/* Date */}
                          <div style={{ width: '88px', flexShrink: 0, textAlign: 'right', paddingRight: '12px', paddingTop: '3px' }}>
                            {(edu.startYear || edu.endYear) && (
                              <span style={{ fontSize: '11px', color: TM, fontWeight: '500', whiteSpace: 'nowrap' }}>
                                {edu.startYear ?? '–'} – {edu.endYear ?? '–'}
                              </span>
                            )}
                          </div>
                          {/* Dot */}
                          <div style={{ width: '22px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '3px', zIndex: 1, position: 'relative' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '3px solid #fff', boxShadow: '0 0 0 2px #10b981' }} />
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, paddingLeft: '14px' }}>
                            <h4 style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: '700', color: T }}>{edu.degree}</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#10b981', fontWeight: '600' }}>{edu.institution}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}
          </Section>

          {/* ── Let's Connect ──────────────────────────────────────── */}
          {(githubUsername || profile?.email || profile?.linkedinUrl) && (
            <div style={{
              padding: '20px 24px',
              border: `1px solid ${BD}`, borderRadius: '12px',
              backgroundColor: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '14px',
              marginBottom: '28px',
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: T }}>Let's Connect</h3>
                <p style={{ margin: 0, fontSize: '12px', color: TS }}>Open to exciting opportunities and collaborations.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(profile?.githubUrl || githubUsername) && (
                  <a href={githubUsername ? `https://github.com/${githubUsername}` : profile?.githubUrl} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: `1px solid ${BD}`, color: T, backgroundColor: '#fff', textDecoration: 'none' }}>
                    🐙 GitHub
                  </a>
                )}
                {profile?.linkedinUrl && (
                  <a href={ensureHttps(profile.linkedinUrl)} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: A, color: '#fff', textDecoration: 'none', border: 'none' }}>
                    LinkedIn →
                  </a>
                )}
                {profile?.email && (
                  <a href={`mailto:${profile.email}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: `1px solid ${BD}`, color: T, backgroundColor: '#fff', textDecoration: 'none' }}>
                    📧 Email
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div style={{ borderTop: `1px solid ${BD}`, paddingTop: '16px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '11px', color: TM }}>
              © {new Date().getFullYear()}
              {publishedAt ? ` · Published ${new Date(publishedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}
              {' · Built with '}
              <span style={{ color: A, fontWeight: '700' }}>Repo2Reputation</span>
            </p>
          </div>

        </main>
      </div>
    </div>
  )
}
