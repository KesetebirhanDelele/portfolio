const SHIMMER_CSS = `
@keyframes r2r-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}
.r2r-shimmer {
  background: linear-gradient(90deg, #f0f2f5 25%, #e4e6ea 50%, #f0f2f5 75%);
  background-size: 1200px 100%;
  animation: r2r-shimmer 1.5s ease-in-out infinite;
}
`

let injected = false
function injectOnce() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const el = document.createElement('style')
  el.textContent = SHIMMER_CSS
  document.head.appendChild(el)
}

export function Shimmer({ width = '100%', height = '14px', radius = '6px', style = {} }) {
  injectOnce()
  return (
    <div
      className="r2r-shimmer"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  )
}

// ── Repo card skeleton (Browse tab) ──────────────────────────────────────────
export function RepoCardSkeleton() {
  injectOnce()
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: '12px',
      padding: '16px', backgroundColor: '#fff',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <Shimmer width="18px" height="18px" radius="4px" />
        <Shimmer width="52%" height="15px" />
        <Shimmer width="62px" height="20px" radius="20px" style={{ marginLeft: 'auto' }} />
      </div>
      <Shimmer width="88%" height="13px" />
      <Shimmer width="65%" height="13px" />
      <div style={{ display: 'flex', gap: '6px' }}>
        <Shimmer width="58px" height="22px" radius="20px" />
        <Shimmer width="70px" height="22px" radius="20px" />
        <Shimmer width="48px" height="22px" radius="20px" />
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <Shimmer width="48px" height="11px" />
        <Shimmer width="68px" height="11px" />
      </div>
    </div>
  )
}

// ── Portfolio builder skeleton ────────────────────────────────────────────────
export function PortfolioBuilderSkeleton() {
  injectOnce()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          border: '1px solid #e5e7eb', borderRadius: '12px',
          padding: '16px', backgroundColor: '#fff',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Shimmer width="20px" height="20px" radius="4px" />
            <Shimmer width="42%" height="15px" />
          </div>
          <Shimmer width="82%" height="13px" />
          <Shimmer width="58%" height="13px" />
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            <Shimmer width="88px" height="30px" radius="8px" />
            <Shimmer width="118px" height="30px" radius="8px" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Public portfolio full-page skeleton ───────────────────────────────────────
export function PublicPortfolioSkeleton() {
  injectOnce()
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0',
        padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Shimmer width="88px" height="88px" radius="50%" />
          <Shimmer width="72%" height="18px" />
          <Shimmer width="88%" height="13px" />
          <Shimmer width="96px" height="22px" radius="20px" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Shimmer width="56px" height="11px" />
          <Shimmer width="100%" height="13px" />
          <Shimmer width="88%" height="13px" />
          <Shimmer width="76%" height="13px" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Shimmer width="48px" height="11px" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[78, 62, 90, 54, 70, 58, 74, 48].map((w, i) => (
              <Shimmer key={i} width={`${w}px`} height="24px" radius="20px" />
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Nav bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '4px' }}>
          <Shimmer width="80px" height="32px" radius="8px" />
          <Shimmer width="96px" height="32px" radius="8px" />
          <Shimmer width="80px" height="32px" radius="8px" />
        </div>
        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Shimmer width="38%" height="22px" />
          <Shimmer width="68%" height="14px" />
          <Shimmer width="52%" height="14px" />
        </div>
        {/* Project cards */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px', backgroundColor: '#fff',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Shimmer width="48%" height="17px" />
              <Shimmer width="76px" height="22px" radius="20px" style={{ marginLeft: 'auto' }} />
            </div>
            <Shimmer width="94%" height="13px" />
            <Shimmer width="82%" height="13px" />
            <Shimmer width="72%" height="13px" />
            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
              <Shimmer width="62px" height="22px" radius="20px" />
              <Shimmer width="48px" height="22px" radius="20px" />
              <Shimmer width="72px" height="22px" radius="20px" />
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
