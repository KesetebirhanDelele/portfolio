import { BASE_URL } from './api'

function LoginForm({ sessionMessage }) {
  function handleGitHubLogin() {
    window.location.href = `${BASE_URL}/api/auth/github`
  }

  return (
    <div className="min-h-screen flex">

      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-indigo-600 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
            <span className="text-indigo-600 font-bold text-lg">R</span>
          </div>
          <span className="text-white font-bold text-lg">Repo2Reputation</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Turn your GitHub work into a reputation that speaks for you.
          </h2>
          <p className="text-indigo-200 text-base leading-relaxed mb-8">
            We analyze your repositories and highlight your skills, impact, and expertise.
          </p>
          <div className="space-y-4">
            {[
              'AI-powered repository analysis',
              'Automatic skill & tech extraction',
              'Portfolio-ready reports',
            ].map(feature => (
              <div key={feature} className="flex items-center gap-3 text-indigo-100">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-indigo-400 text-xs">© 2026 Repo2Reputation</p>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="max-w-sm w-full">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="text-indigo-600 font-bold text-lg">Repo2Reputation</span>
          </div>

          {/* Session expired banner */}
          {sessionMessage && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium">
              {sessionMessage}
            </div>
          )}

          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome</h2>
          <p className="text-gray-500 text-sm mb-8">
            Analyze your GitHub repositories and generate recruiter-ready portfolios.
          </p>

          {/* GitHub OAuth button */}
          <button
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-xl text-sm transition"
          >
            {/* GitHub mark SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          <p className="mt-6 text-xs text-gray-400 text-center">
            By continuing, you agree to allow Repo2Reputation to access your GitHub profile and repositories.
          </p>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-2">Need to use a different GitHub account?</p>
            <a
              href="https://github.com/logout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-700 underline"
            >
              Sign out of GitHub first →
            </a>
          </div>

        </div>
      </div>

    </div>
  )
}

export default LoginForm
