/** @type {import('tailwindcss').Config} */

// Every token in styles/colors.css is a plain `var(--x)` reference (a hex
// value under the hood), not the "R G B" channel-triplet format Tailwind's
// bg-x/50 opacity-modifier syntax expects — so a plain `var(--x)` color
// value silently drops any `/opacity` modifier (Tailwind can't compute an
// alpha-composited value from an opaque var() reference). Wrapping every
// color in this function instead makes Tailwind call it with the resolved
// opacityValue and lets us return a color-mix() (the same technique
// colors.css itself already uses for --focus-ring), so `bg-brand-50/60` etc.
// keep working. Confirmed necessary: several existing usages
// (Header.jsx onboarding banner, connect-account modal overlay, search
// input background) rely on opacity-modified brand/neutral classes.
function withOpacity(variable) {
  return ({ opacityValue }) => {
    // Tailwind passes the *string* 'var(--tw-bg-opacity)' (its own legacy
    // opacity-variable placeholder), not `undefined`, for the no-modifier
    // base case — confirmed live: an `undefined` check alone let that
    // string through and produced `color-mix(... NaN%, transparent)`.
    // Only build the color-mix when a real numeric alpha (from an actual
    // `/50` modifier) comes through; otherwise fall back to the plain var().
    const n = Number(opacityValue)
    return Number.isFinite(n)
      ? `color-mix(in srgb, var(${variable}) ${n * 100}%, transparent)`
      : `var(${variable})`
  }
}

function ramp(varPrefix, defaultShade = 500) {
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  const obj = { DEFAULT: withOpacity(`--${varPrefix}-${defaultShade}`) }
  for (const s of shades) obj[s] = withOpacity(`--${varPrefix}-${s}`)
  return obj
}

function aliasGroup(mapping) {
  const obj = {}
  for (const key in mapping) obj[key] = withOpacity(mapping[key])
  return obj
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cherry Red — primary brand/action color, used site-wide (not a sparing accent)
        brand: ramp('red'),
        // Leaf Green — secondary (success states, secondary CTAs)
        leaf: ramp('green'),
        // Berry Blue — tertiary (links, info states, badges)
        berry: ramp('blue'),
        neutral: aliasGroup({
          0: '--neutral-0', 50: '--neutral-50', 100: '--neutral-100',
          200: '--neutral-200', 300: '--neutral-300', 400: '--neutral-400',
          500: '--neutral-500', 600: '--neutral-600', 700: '--neutral-700',
          800: '--neutral-800', 900: '--neutral-900', 950: '--neutral-950',
          1000: '--neutral-1000',
        }),
        // Semantic aliases — reference these over raw ramps wherever possible
        surface: aliasGroup({
          page: '--surface-page', subtle: '--surface-subtle',
          card: '--surface-card', sunken: '--surface-sunken',
          inverse: '--surface-inverse', brand: '--surface-brand',
          'brand-subtle': '--surface-brand-subtle',
          'green-subtle': '--surface-green-subtle',
          'blue-subtle': '--surface-blue-subtle',
        }),
        text: aliasGroup({
          strong: '--text-strong', body: '--text-body',
          muted: '--text-muted', subtle: '--text-subtle',
          'on-accent': '--text-on-accent', 'on-inverse': '--text-on-inverse',
          link: '--text-link', 'link-hover': '--text-link-hover',
        }),
        // "line" not "border" — Tailwind's own `border` color key would collide
        // with the borderColor-driven `border` width utility (border-border-subtle
        // reads worse than line-subtle for the same var(--border-subtle) tokens).
        line: aliasGroup({
          subtle: '--border-subtle', DEFAULT: '--border-default',
          strong: '--border-strong', brand: '--border-brand',
          focus: '--border-focus',
        }),
        status: aliasGroup({
          success: '--status-success', 'success-bg': '--status-success-bg',
          danger: '--status-danger', 'danger-bg': '--status-danger-bg',
          info: '--status-info', 'info-bg': '--status-info-bg',
          warning: '--status-warning', 'warning-bg': '--status-warning-bg',
        }),
      },
      fontFamily: {
        heading: ['var(--heading-font)'],
        body: ['var(--body-font)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        focus: 'var(--focus-ring)',
      },
    },
  },
  plugins: [],
}
