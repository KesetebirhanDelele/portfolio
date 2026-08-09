import { useState, useEffect, useRef } from 'react'
import { BASE_URL } from './api'

const A  = '#4361ee'
const T  = '#0f172a'
const TS = '#475569'
const TM = '#94a3b8'
const BD = '#e2e8f0'
const BG = '#f8fafc'

const CAT_COLORS = {
  Frontend: { bg: '#ede9fe', text: '#5b21b6' },
  Backend:  { bg: '#dbeafe', text: '#1e40af' },
  Database: { bg: '#fef3c7', text: '#92400e' },
  DevOps:   { bg: '#dcfce7', text: '#166534' },
  Mobile:   { bg: '#fce7f3', text: '#9d174d' },
  AI:       { bg: '#f3e8ff', text: '#6b21a8' },
  Testing:  { bg: '#ecfdf5', text: '#065f46' },
  Other:    { bg: '#f1f5f9', text: '#334155' },
}
const cat = c => CAT_COLORS[c] || CAT_COLORS.Other

function SkillChip({ skill }) {
  const s = cat(skill.category)
  return (
    <span style={{
      padding: '2px 9px', borderRadius: '5px',
      fontSize: '11px', fontWeight: '600',
      backgroundColor: s.bg, color: s.text,
    }}>
      {skill.name}
    </span>
  )
}

function PortfolioCard({ portfolio }) {
  const initials = (portfolio.title || 'D').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const published = portfolio.publishedAt
    ? new Date(portfolio.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <a
      href={portfolio.publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${BD}`,
          borderRadius: '14px',
          padding: '20px',
          transition: 'box-shadow 0.18s, border-color 0.18s',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(67,97,238,0.12)'
          e.currentTarget.style.borderColor = '#a5b4fc'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = BD
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: '800', fontSize: '15px',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: '700', color: T }}>
              {portfolio.title}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {portfolio.githubUsername && (
                <span style={{ fontSize: '12px', color: A, fontWeight: '500' }}>
                  @{portfolio.githubUsername}
                </span>
              )}
              {portfolio.languages?.slice(0, 3).map(lang => (
                <span key={lang} style={{ fontSize: '11px', color: TM, backgroundColor: BG, padding: '1px 7px', borderRadius: '4px', border: `1px solid ${BD}` }}>
                  {lang}
                </span>
              ))}
            </div>
          </div>
          {published && (
            <span style={{ fontSize: '11px', color: TM, flexShrink: 0 }}>{published}</span>
          )}
        </div>

        {/* Headline */}
        {portfolio.headline && (
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: TS, lineHeight: 1.6,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {portfolio.headline}
          </p>
        )}

        {/* Skills */}
        {portfolio.topSkills?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
            {portfolio.topSkills.slice(0, 6).map((skill, i) => (
              <SkillChip key={i} skill={typeof skill === 'string' ? { name: skill } : skill} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '12px', color: A, fontWeight: '600' }}>
            View portfolio →
          </span>
        </div>
      </div>
    </a>
  )
}

export default function RecruiterSearch() {
  const [query, setQuery]           = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [langFilter, setLangFilter] = useState('')
  const [languages, setLanguages]   = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [loading, setLoading]       = useState(false)
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetch(`${BASE_URL}/api/search/filters`)
      .then(r => r.json())
      .then(d => { if (d.success) setLanguages(d.data.languages) })
      .catch(() => {})
    doSearch(1)
  }, [])

  function doSearch(p = 1) {
    setLoading(true)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (skillFilter.trim()) params.set('skill', skillFilter.trim())
    if (langFilter) params.set('language', langFilter)
    params.set('page', p)
    params.set('limit', 12)

    fetch(`${BASE_URL}/api/search/portfolios?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPortfolios(d.data)
          setTotal(d.meta.total)
          setTotalPages(d.meta.totalPages)
          setPage(p)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(1), 400)
  }

  function handleFilter(field, val) {
    if (field === 'skill') setSkillFilter(val)
    if (field === 'lang') setLangFilter(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(1), 200)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Top nav */}
      <nav style={{
        backgroundColor: '#fff', borderBottom: `1px solid ${BD}`,
        padding: '0 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '52px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '6px',
            background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: '800', fontSize: '11px',
          }}>R</div>
          <span style={{ fontWeight: '700', fontSize: '14px', color: T }}>
            Repo2<span style={{ color: A }}>Reputation</span>
          </span>
        </div>
        <span style={{ fontSize: '12px', color: TM }}>Recruiter Search</span>
      </nav>

      {/* Hero */}
      <div style={{ backgroundColor: '#fff', borderBottom: `1px solid ${BD}`, padding: '32px 28px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: '800', color: T }}>
            Find developer talent by real evidence
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: TS }}>
            Browse AI-analyzed portfolios backed by GitHub repositories — every skill claim is evidence-grounded.
          </p>

          {/* Search bar */}
          <div style={{ display: 'flex', gap: '10px', maxWidth: '560px', margin: '0 auto 16px' }}>
            <input
              type="text"
              placeholder="Search by name, skill, or keyword…"
              value={query}
              onChange={handleQueryChange}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: '10px',
                border: `1px solid ${BD}`, fontSize: '14px', color: T,
                outline: 'none', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
              }}
              onFocus={e => e.target.style.borderColor = A}
              onBlur={e => e.target.style.borderColor = BD}
            />
            <button
              onClick={() => doSearch(1)}
              style={{
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                backgroundColor: A, color: '#fff', fontWeight: '700',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              Search
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Filter by skill (e.g. React)"
              value={skillFilter}
              onChange={e => handleFilter('skill', e.target.value)}
              style={{
                padding: '7px 14px', borderRadius: '8px', border: `1px solid ${BD}`,
                fontSize: '13px', color: T, outline: 'none', width: '200px',
              }}
            />
            <select
              value={langFilter}
              onChange={e => handleFilter('lang', e.target.value)}
              style={{
                padding: '7px 14px', borderRadius: '8px', border: `1px solid ${BD}`,
                fontSize: '13px', color: langFilter ? T : TM,
                outline: 'none', backgroundColor: '#fff', cursor: 'pointer',
              }}
            >
              <option value="">All languages</option>
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {(query || skillFilter || langFilter) && (
              <button
                onClick={() => { setQuery(''); setSkillFilter(''); setLangFilter(''); setTimeout(() => doSearch(1), 50) }}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: `1px solid ${BD}`, backgroundColor: '#fff',
                  color: TS, fontSize: '13px', cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Meta row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: TM }}>
            {loading ? 'Searching…' : `${total} portfolio${total !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: TM, fontSize: '14px' }}>
            Searching portfolios…
          </div>
        ) : portfolios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '32px', fontWeight: '800', color: BD, margin: '0 0 8px' }}>0</p>
            <p style={{ fontSize: '15px', fontWeight: '700', color: T, margin: '0 0 6px' }}>No portfolios found</p>
            <p style={{ fontSize: '13px', color: TS, margin: 0 }}>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}>
            {portfolios.map(p => <PortfolioCard key={p.portfolioId} portfolio={p} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => doSearch(page - 1)}
              disabled={page === 1}
              style={{
                padding: '7px 14px', borderRadius: '8px', border: `1px solid ${BD}`,
                backgroundColor: '#fff', color: TS, fontSize: '13px',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.4 : 1,
              }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '13px', color: TM }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => doSearch(page + 1)}
              disabled={page === totalPages}
              style={{
                padding: '7px 14px', borderRadius: '8px', border: `1px solid ${BD}`,
                backgroundColor: '#fff', color: TS, fontSize: '13px',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${BD}`, padding: '20px 28px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '11px', color: TM }}>
          © {new Date().getFullYear()} Repo2Reputation · AI-grounded developer portfolios
        </p>
      </div>
    </div>
  )
}
