import { useState, useEffect } from 'react';

function App() {
  const [fullName, setFullName] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [email, setEmail] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [repoName, setRepoName] = useState('');
  const [portfolioMode, setPortfolioMode] = useState('create');

  const [githubConnected, setGithubConnected] = useState(false);
  const [connectedUsername, setConnectedUsername] = useState('');

  const [projectLinks, setProjectLinks] = useState(['']);
  const [loadedStudent, setLoadedStudent] = useState(null);
  const [loadedProjects, setLoadedProjects] = useState([]);
  const [networkProjects, setNetworkProjects] = useState([]);
  const [selectedProjectLinks, setSelectedProjectLinks] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingNetworkProjects, setIsLoadingNetworkProjects] = useState(false);
  const [projectSource, setProjectSource] = useState('my-projects');
  const [networkCategory, setNetworkCategory] = useState('All');
  const [networkCategories, setNetworkCategories] = useState([]);
  const [allNetworkProjectsCount, setAllNetworkProjectsCount] = useState(0);
  const [networkSearchQuery, setNetworkSearchQuery] = useState('');

  const normalizeProjectTitle = (title = '') =>
  title.trim().toLowerCase().replace(/\s+/g, ' ');

const visibleNetworkProjects = networkProjects.filter(
  (networkProject) => {
    const isDuplicate = loadedProjects.some(
      (myProject) =>
        normalizeProjectTitle(myProject.title) ===
        normalizeProjectTitle(networkProject.title)
    );

    const matchesSearch =
      networkProject.title
        .toLowerCase()
        .includes(networkSearchQuery.toLowerCase());

    return !isDuplicate && matchesSearch;
  }
);
const allVisibleProjectsSelected =
  visibleNetworkProjects.length > 0 &&
  visibleNetworkProjects.every((project) =>
    selectedProjectLinks.includes(project.projectLink)
  );
  
  const MAX_PROJECT_LINKS = 10;
  const selectedMyProjectsCount = loadedProjects.filter((project) =>
  selectedProjectLinks.includes(project.projectLink)
  ).length;

  const selectedNetworkProjectsCount = visibleNetworkProjects.filter((project) =>
  selectedProjectLinks.includes(project.projectLink)
  ).length;
  const totalSelectedProjectsCount = selectedProjectLinks.length;

  const [statusMessage, setStatusMessage] = useState('Ready to generate your GitHub portfolio 🚀');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const generationSteps = [
  {
    title: 'Sending request',
    description: 'Sending your portfolio request to the PortfolioForge server.'
  },
  {
    title: 'Browser launched',
    description: 'Opening an authenticated Colaberry browser session.'
  },
  {
    title: 'Student profile loaded',
    description: 'Retrieving your profile information.'
  },
  {
    title: 'Project links loaded',
    description: 'Loading your selected Colaberry projects.'
  },
  {
    title: 'Extracting project data',
    description: 'Extracting project content and screenshots.'
  },
  {
    title: 'Reading project content',
    description: 'Analyzing project files and documentation.'
  },
  {
    title: 'Generating portfolio content',
    description: 'Using AI to generate recruiter-ready documentation.'
  },
  {
    title: 'Building portfolio page',
    description: 'Creating your portfolio structure and README files.'
  },
  {
    title: 'Publishing to GitHub',
    description: 'Uploading your portfolio repository to GitHub.'
  },
  {
    title: 'Portfolio generated successfully',
    description: 'Your portfolio is complete and ready to share.'
  }
];

const [generationStep, setGenerationStep] = useState(0);
  
  useEffect(() => {
  fetch('http://localhost:3001/auth/github/status')
    .then((res) => res.json())
    .then((data) => {
      if (data.connected) {
        setGithubConnected(true);
        setConnectedUsername(data.username);
        setGithubUsername(data.username);
      }
    })
    .catch(() => {});
}, []);

  async function handleGeneratePortfolio() {
  const formData = {
    fullName,
    professionalTitle,
    linkedinUrl,
    email,
    githubUsername,
    repoName,
    portfolioMode,
    
    projectLinks: selectedProjectLinks.filter(Boolean)
  };

  if (!githubUsername || !githubConnected || !repoName) {
    setStatusMessage('Please connect GitHub and enter a repository name.');
    return;
  }

  setIsGenerating(true);
  setGenerationStep(0);
  setStatusMessage('Sending request to PortfolioForge backend...');
  setGenerationStep(1);

  try {
    const response = await fetch('http://localhost:3001/generate-portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    await response.json();

    setStatusMessage('Starting portfolio generation... Please complete Colaberry login in the opened browser.');

    const statusInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch('http://localhost:3001/portfolio-status');
        const statusData = await statusResponse.json();

if (statusData.failed) {
  setStatusMessage(
    statusData.error ||
      'Portfolio generation failed. Please try again.'
  );
  setErrorMessage(
    statusData.error ||
      'Portfolio generation failed. Please try again.'
  );
  setIsGenerating(false);
  clearInterval(statusInterval);
} else if (statusData.completed) {
  setGenerationStep(generationSteps.length);
  setStatusMessage(
    `Portfolio generated successfully! View Portfolio: ${statusData.portfolioUrl}`
  );
  setErrorMessage('');
  setIsGenerating(false);
  clearInterval(statusInterval);
} else {
  const currentStatus =
    statusData.step || 'Portfolio generation is running...';

  setStatusMessage(currentStatus);

  const stepIndex = generationSteps.findIndex((step) =>
    currentStatus.includes(step.title)
  );

  if (stepIndex !== -1) {
    setGenerationStep(stepIndex + 1);
  }
}
    } catch (error) {
    console.error(error);
    setStatusMessage('Unable to read portfolio generation status.');
    clearInterval(statusInterval);
    }
  }, 3000);

  } catch (error) {
    console.error(error);
    setStatusMessage('Failed to connect to backend.');
  } 
}

const inputStyle = {
  width: '100%',
  height: '52px',
  padding: '0 16px',
  fontSize: '15px',
  color: '#111827',

  border: '1px solid #d1d5db',

  borderRadius: '10px',

  background: '#ffffff',

  boxSizing: 'border-box',

  transition: 'all .2s ease',

  outline: 'none',

  boxShadow: '0 1px 3px rgba(0,0,0,.04)'
};

  const sectionStyle = {
    background: '#ffffff',
    padding: '32px 36px',
    marginBottom: '24px',
    borderRadius: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  };

  const nextButtonStyle = {
    padding: '12px 24px',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer'
  };

  const backButtonStyle = {
    padding: '12px 24px',
    background: '#e5e7eb',
    color: '#111827',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    marginRight: '12px'
  };

  const handleInputFocus = (e) => {
    e.target.style.border = '1px solid #4f46e5';
    e.target.style.boxShadow = '0 0 0 4px rgba(79,70,229,.15)';
  };

  const handleInputBlur = (e) => {
    e.target.style.border = '1px solid #d1d5db';
    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)';
  };

  return (
    <div style={{ background: '#f5f7fb', minHeight: '100vh', padding: '56px 40px' }}>
  <div style={{ maxWidth: '850px', margin: '0 auto' }}>

{/* Header + Stepper Row */}
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '30px'
  }}
>
  {/* PortfolioForge AI Header */}
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      marginBottom: '15px'
    }}
  >
    <div
      style={{
        width: '38px',
        height: '38px',
        background: '#2563eb',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: '700',
        marginRight: '10px'
      }}
    >
      🚀
    </div>

    <span
      style={{
        fontSize: '25px',
        fontWeight: '750',
        color: '#111827'
      }}
    >
      PortfolioForge AI
    </span>
  </div>

  <div
  style={{
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    columnGap: '40px',
    width: '520px',
    marginLeft: 'auto',
    marginBottom: '40px'
  }}
>
  {/* connecting line */}
  <div
    style={{
      position: 'absolute',
      top: '20px',
      left: '65px',
      right: '65px',
      height: '2px',
      background: '#e5e7eb',
      zIndex: 0
    }}
  />

  {[
    'Profile',
    'Connect GitHub',
    'Add Projects',
    'Preview & Publish'
  ].map((step, index) => (
    <div
      key={step}
      style={{
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        whiteSpace: 'nowrap'
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          margin: '0 auto',
          background:
            currentStep >= index + 1
              ? '#2563eb'
              : '#d1d5db',
          color: 'white',
          lineHeight: '40px',
          fontWeight: 'bold'
        }}
      >
        {currentStep > index + 1 ? '✓' : index + 1}
      </div>

      <div
        style={{
          marginTop: '8px',
          fontSize: '14px'
        }}
      >
        {step}
      </div>
    </div>
  ))}
</div>
</div>

      {currentStep === 1 && (
  <div style={sectionStyle}>
    <div style={{ textAlign: 'left', marginBottom: '30px' }}>
      <span style={{
        background: '#4f46e5',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '700'
      }}>
        STEP 1
      </span>

      <h2 style={{ marginTop: '18px', marginBottom: '10px', fontSize: '28px', fontWeight: '700' }}>
        Connect Colaberry Account 👋
      </h2>

      <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>
        Log into Colaberry so PortfolioForge can load your profile and projects automatically.
      </p>
    </div>

  {!loadedStudent && (
    <button
      style={{ ...nextButtonStyle, marginBottom: '20px' }}
      disabled={isLoadingProjects}
      onClick={async () => {
        setIsLoadingProjects(true);
        setErrorMessage('');

        try {
          const response = await fetch('http://localhost:3001/api/colaberry/load-portfolio-data');
          const data = await response.json();

          if (!data.found) {
            setErrorMessage('Could not load your Colaberry profile.');
            return;
          }

          setLoadedStudent(data.student);
          const loadedProjectLinks = (data.projects || []).map(project => project.projectLink);

          setLoadedProjects(data.projects || []);
          setSelectedProjectLinks(loadedProjectLinks);

          setFullName(`${data.student.FirstName} ${data.student.LastName}`);
          setEmail(data.student.Email);
          setProjectLinks(loadedProjectLinks);
        } catch (error) {
          console.error(error);
          setErrorMessage('Failed to connect to Colaberry.');
        } finally {
          setIsLoadingProjects(false);
        }
      }}
    >
      {isLoadingProjects ? 'Loading Colaberry Data...' : 'Connect Colaberry'}
    </button>
  )}
  
    {loadedStudent && (
      <>
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #86efac',
          color: '#166534',
          padding: '8px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontWeight: '600'
        }}>
          ✅ Colaberry profile loaded: {loadedStudent.FirstName} {loadedStudent.LastName}
          <br />
          Projects found: {loadedProjects.length}
        </div>

        <label
          style={{
            display: 'block',
            textAlign: 'left',
            marginBottom: '8px',
            marginTop: '18px',
            fontWeight: '700',
            fontSize: '16px',
            color: '#111827'
          }}
         >
           Full Name <span style={{ color: '#dc2626' }}>*</span>
        </label>
       <input
  value={fullName}
  onChange={(e) => setFullName(e.target.value)}
  style={inputStyle}
  onFocus={(e) => {
    e.target.style.border = '1px solid #4f46e5';
    e.target.style.boxShadow = '0 0 0 4px rgba(79,70,229,.15)';
  }}
  onBlur={(e) => {
    e.target.style.border = '1px solid #d1d5db';
    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)';
  }}
/>

        <label
          style={{
          display: 'block',
          textAlign: 'left',
          marginBottom: '8px',
          marginTop: '18px',
          fontWeight: '700',
          fontSize: '16px',
          color: '#111827'
        }}
       >
         Email <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  style={inputStyle}
  onFocus={(e) => {
    e.target.style.border = '1px solid #4f46e5';
    e.target.style.boxShadow = '0 0 0 4px rgba(79,70,229,.15)';
  }}
  onBlur={(e) => {
    e.target.style.border = '1px solid #d1d5db';
    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)';
  }}
/>

        <label
          style={{
          display: 'block',
          textAlign: 'left',
          marginBottom: '8px',
          marginTop: '18px',
          fontWeight: '700',
          fontSize: '16px',
          color: '#111827'
        }}
      >
         Professional Title <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
  value={professionalTitle}
  onChange={(e) => setProfessionalTitle(e.target.value)}
  style={inputStyle}
  onFocus={(e) => {
    e.target.style.border = '1px solid #4f46e5';
    e.target.style.boxShadow = '0 0 0 4px rgba(79,70,229,.15)';
  }}
  onBlur={(e) => {
    e.target.style.border = '1px solid #d1d5db';
    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)';
  }}
/>

        <label
  style={{
    display: 'block',
    textAlign: 'left',
    marginBottom: '8px',
    marginTop: '18px',
    fontWeight: '700',
    fontSize: '16px',
    color: '#111827'
  }}
>
  LinkedIn URL
  <span
    style={{
      color: '#64748b',
      fontWeight: '400',
      marginLeft: '6px'
    }}
  >
    (Optional)
  </span>
</label>
        <input
  value={linkedinUrl}
  onChange={(e) => setLinkedinUrl(e.target.value)}
  style={inputStyle}
  onFocus={(e) => {
    e.target.style.border = '1px solid #4f46e5';
    e.target.style.boxShadow = '0 0 0 4px rgba(79,70,229,.15)';
  }}
  onBlur={(e) => {
    e.target.style.border = '1px solid #d1d5db';
    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)';
  }}
/>
      </>
    )}

    {errorMessage && (
      <p style={{ color: '#dc2626', fontWeight: '600', textAlign: 'center' }}>
        {errorMessage}
      </p>
    )}

    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
      <button
        style={nextButtonStyle}
        onClick={() => {
          if (!loadedStudent) {
            setErrorMessage('Please connect your Colaberry account first.');
            return;
          }
          if (
             !fullName.trim() ||
             !email.trim() ||
             !professionalTitle.trim()
          ) {
             setErrorMessage(
                'Please complete all required fields before continuing.'
            );
            return;
            }
          setErrorMessage('');
          setCurrentStep(2);
        }}
      >
        Continue →
      </button>
    </div>
  </div>
)}

{currentStep === 2 && (
  <div style={sectionStyle}>
    <div style={{ textAlign: 'left', marginBottom: '28px' }}>
      <span
        style={{
          background: '#4f46e5',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '700'
        }}
      >
        STEP 2
      </span>

      <h2
        style={{
          marginTop: '18px',
          marginBottom: '10px',
          fontSize: '28px',
          fontWeight: '700'
        }}
      >
        Connect GitHub 🐙
      </h2>

      <p
        style={{
          color: '#64748b',
          fontSize: '15px',
          lineHeight: '1.6',
          maxWidth: '550px'
        }}
      >
        Connect your GitHub account so PortfolioForge can create or update your portfolio repository.
      </p>
    </div>

    <div
      style={{
        background: githubConnected ? '#dcfce7' : '#fef3c7',
        border: githubConnected ? '1px solid #22c55e' : '1px solid #f59e0b',
        color: githubConnected ? '#166534' : '#92400e',
        padding: '8px',
        borderRadius: '10px',
        marginBottom: '20px',
        
        fontWeight: '500'
      }}
    >
      {githubConnected ? (
        <>
          ✅ GitHub connected successfully
          <br />
          <span style={{ fontWeight: '500' }}>
            Connected as {connectedUsername}
          </span>
        </>
      ) : (
        'GitHub is not connected yet.'
      )}
    </div>

    {!githubConnected && (
      <button
        style={{
          ...nextButtonStyle,
          marginBottom: '24px'
        }}
        onClick={() => {
          window.open(
            'http://localhost:3001/auth/github',
            'githubOAuthPopup',
            'width=300,height=150,top=200,left=550,resizable=no'
          );

          const checkConnection = setInterval(async () => {
            try {
              const res = await fetch('http://localhost:3001/auth/github/status');
              const data = await res.json();

              if (data.connected) {
                setGithubConnected(true);
                setConnectedUsername(data.username);
                setGithubUsername(data.username);
                clearInterval(checkConnection);
              }
            } catch (error) {
              console.error('GitHub connection check failed:', error);
            }
          }, 2000);
        }}
      >
        Connect GitHub Account
      </button>
    )}

   <div
  style={{
    border: '1px solid #dbe3ef',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '24px',
    background: '#ffffff'
  }}
>
  <h3
    style={{
      margin: '0 0 6px 0',
      fontSize: '17px',
      color: '#111827',
      textAlign: 'left'
    }}
  >
    Repository Selection
  </h3>

  <p
    style={{
      margin: '0 0 18px 0',
      color: '#64748b',
      fontSize: '14px',
      textAlign: 'left'
    }}
  >
    Choose whether to create a new GitHub repository or update an existing one.
  </p>

  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '14px',
      cursor: 'pointer',
      fontWeight: '700'
    }}
  >
    <input
      type="radio"
      checked={portfolioMode === 'create'}
      onChange={() => {
        setPortfolioMode('create');
        setRepoName('');
      }}
    />
    Create a new repository
  </label>

  {portfolioMode === 'create' && (
    <>
      <label
        style={{
          display: 'block',
          textAlign: 'left',
          marginBottom: '8px',
          fontWeight: '700',
          fontSize: '16px',
          color: '#111827'
        }}
      >
        New Repository Name <span style={{ color: '#dc2626' }}>*</span>
      </label>

      <input
        value={repoName}
        onChange={(e) => setRepoName(e.target.value)}
        placeholder="e.g. kalkidan-portfolio"
        style={inputStyle}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />
    </>
  )}

  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginTop: '20px',
      marginBottom: '14px',
      cursor: 'pointer',
      fontWeight: '700'
    }}
  >
    <input
      type="radio"
      checked={portfolioMode === 'update'}
      onChange={() => {
        setPortfolioMode('update');
        setRepoName('');
      }}
    />
    Update an existing repository
  </label>

  {portfolioMode === 'update' && (
    <>
      <label
        style={{
          display: 'block',
          textAlign: 'left',
          marginBottom: '8px',
          fontWeight: '700',
          fontSize: '16px',
          color: '#111827'
        }}
      >
        Existing Repository Name <span style={{ color: '#dc2626' }}>*</span>
      </label>

      <input
        value={repoName}
        onChange={(e) => setRepoName(e.target.value)}
        placeholder="Enter existing repository name"
        style={inputStyle}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />

      <p
        style={{
          marginTop: '8px',
          fontSize: '13px',
          color: '#64748b',
          textAlign: 'left'
        }}
      >
        Enter the GitHub repository name you want PortfolioForge to update.
      </p>
    </>
  )}
</div>

    {errorMessage && (
      <p
        style={{
          color: '#dc2626',
          marginBottom: '16px',
          fontWeight: '600',
          textAlign: 'center'
        }}
      >
        {errorMessage}
      </p>
    )}

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '24px'
      }}
    >
      <button
        style={backButtonStyle}
        onClick={() => setCurrentStep(1)}
      >
        ← Back
      </button>

      <button
        style={nextButtonStyle}
        onClick={() => {
          if (!githubConnected || !repoName) {
            setErrorMessage('Please connect GitHub and enter a repository name.');
            return;
          }

          setErrorMessage('');
          setCurrentStep(3);
        }}
      >
        Continue →
      </button>
    </div>
  </div>
)}

{currentStep === 3 && (
  <div style={sectionStyle}>
    <div style={{ textAlign: 'left', marginBottom: '24px' }}>
      <span
        style={{
          background: '#4f46e5',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '700'
        }}
      >
        STEP 3
      </span>

      <h2 style={{ marginTop: '18px', marginBottom: '10px', fontSize: '28px', fontWeight: '700' }}>
        My Colaberry Projects 📂
      </h2>

      <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>
        Load your real Colaberry projects from the database and choose which ones to include.
      </p>
      <div
  style={{
    display: 'flex',
    gap: '10px',
    marginTop: '18px',
    marginBottom: '22px'
  }}
>
  <button
    type="button"
    onClick={() => setProjectSource('my-projects')}
    style={{
      padding: '10px 16px',
      borderRadius: '8px',
      border: '1px solid #2563eb',
      background: projectSource === 'my-projects' ? '#2563eb' : '#ffffff',
      color: projectSource === 'my-projects' ? '#ffffff' : '#2563eb',
      fontWeight: '700',
      cursor: 'pointer'
    }}
  >
    My Projects ({selectedMyProjectsCount})
  </button>

  <button
    type="button"
  onClick={async () => {
  setProjectSource('network-projects');

  {/*if (networkProjects.length > 0) {
    return;
  }*/}

  setIsLoadingNetworkProjects(true);
  setErrorMessage('');

  try {
    const response = await fetch(
      'http://localhost:3001/api/colaberry/network-projects'
    );

    if (!response.ok) {
      throw new Error('Failed to load network projects.');
    }

    const data = await response.json();

    setNetworkProjects(data.projects || []);
    setAllNetworkProjectsCount((data.projects || []).length);

const categoryResponse = await fetch(
  'http://localhost:3001/api/colaberry/network-project-categories'
);

if (!categoryResponse.ok) {
  throw new Error('Failed to load network project categories.');
}

const categoryData = await categoryResponse.json();

setNetworkCategories(categoryData.categories || []);
  } catch (error) {
    console.error(error);
    setErrorMessage('Could not load Colaberry Network projects.');
  } finally {
    setIsLoadingNetworkProjects(false);
  }
}}
    style={{
      padding: '10px 16px',
      borderRadius: '8px',
      border: '1px solid #2563eb',
      background: projectSource === 'network-projects' ? '#2563eb' : '#ffffff',
      color: projectSource === 'network-projects' ? '#ffffff' : '#2563eb',
      fontWeight: '700',
      cursor: 'pointer'
    }}
  >
    {isLoadingNetworkProjects
      ? 'Loading...'
      : `Network Projects (${selectedNetworkProjectsCount})`}
  </button>
</div>

<div
  style={{
    marginTop: '10px',
    marginBottom: '18px',
    fontSize: '14px',
    color: '#475569',
    fontWeight: '700',
    textAlign: 'left'
  }}
>
  {totalSelectedProjectsCount} project
  {totalSelectedProjectsCount === 1 ? '' : 's'} selected
</div>

{projectSource === 'network-projects' && (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      marginBottom: '22px'
    }}
  >
    <button
      type="button"
      onClick={async () => {
  setNetworkCategory('All');
  setNetworkSearchQuery('');
  setIsLoadingNetworkProjects(true);
  setNetworkProjects([]);
  setErrorMessage('');

  try {
    const response = await fetch(
      'http://localhost:3001/api/colaberry/network-projects?category=All'
    );

    if (!response.ok) {
      throw new Error('Failed to load all network projects.');
    }

    const data = await response.json();
    setNetworkProjects(data.projects || []);
  } catch (error) {
    console.error(error);
    setErrorMessage('Could not load network projects.');
  } finally {
    setIsLoadingNetworkProjects(false);
  }
}}
      style={{
        padding: '8px 14px',
        borderRadius: '999px',
        border: '1px solid #cbd5e1',
        background: networkCategory === 'All' ? '#2563eb' : '#ffffff',
        color: networkCategory === 'All' ? '#ffffff' : '#334155',
        fontWeight: '700',
        cursor: 'pointer'
      }}
    >
      All ({allNetworkProjectsCount})
    </button>

    {networkCategories.map((category) => (
      <button
        key={category.name}
        type="button"
        onClick={async () => {
  setNetworkCategory(category.name);
  setNetworkSearchQuery('');
  setIsLoadingNetworkProjects(true);
  setNetworkProjects([]);
  setErrorMessage('');

  try {
    const response = await fetch(
      `http://localhost:3001/api/colaberry/network-projects?category=${encodeURIComponent(category.name)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to load ${category.name} projects.`);
    }

    const data = await response.json();
    setNetworkProjects(data.projects || []);
  } catch (error) {
    console.error(error);
    setErrorMessage(`Could not load ${category.name} projects.`);
  } finally {
    setIsLoadingNetworkProjects(false);
  }
}}
        style={{
          padding: '8px 14px',
          borderRadius: '999px',
          border: '1px solid #cbd5e1',
          background:
            networkCategory === category.name ? '#2563eb' : '#ffffff',
          color:
            networkCategory === category.name ? '#ffffff' : '#334155',
          fontWeight: '700',
          cursor: 'pointer'
        }}
      >
        {category.name} ({category.count})
      </button>
    ))}
  </div>
)}
    </div>

  {projectSource === 'network-projects' && (
  <div style={{ marginBottom: '18px' }}>
    <input
      type="text"
      value={networkSearchQuery}
      onChange={(e) => setNetworkSearchQuery(e.target.value)}
      placeholder="Search Network Projects..."
      style={{
        ...inputStyle,
        height: '46px'
      }}
      onFocus={handleInputFocus}
      onBlur={handleInputBlur}
    />

    <div
  style={{
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  }}
>
  <div
    style={{
      fontSize: '13px',
      color: '#64748b',
      fontWeight: '600'
    }}
  >
    {visibleNetworkProjects.length} project
    {visibleNetworkProjects.length === 1 ? '' : 's'} found
  </div>

  <button
  type="button"
  onClick={() => {
    const visibleProjectLinks = visibleNetworkProjects.map(
      (project) => project.projectLink
    );

    if (allVisibleProjectsSelected) {
      const visibleProjectLinksSet = new Set(visibleProjectLinks);

      setSelectedProjectLinks((currentLinks) =>
        currentLinks.filter(
          (link) => !visibleProjectLinksSet.has(link)
        )
      );
    } else {
      setSelectedProjectLinks((currentLinks) => [
        ...new Set([...currentLinks, ...visibleProjectLinks])
      ]);
    }
  }}
  disabled={visibleNetworkProjects.length === 0}
  style={{
    padding: '7px 14px',
    border: '1px solid #2563eb',
    borderRadius: '8px',
    background:
      visibleNetworkProjects.length === 0
        ? '#f1f5f9'
        : allVisibleProjectsSelected
        ? '#ffffff'
        : '#2563eb',
    color:
      visibleNetworkProjects.length === 0
        ? '#94a3b8'
        : allVisibleProjectsSelected
        ? '#2563eb'
        : '#ffffff',
    fontWeight: '700',
    cursor:
      visibleNetworkProjects.length === 0
        ? 'not-allowed'
        : 'pointer'
  }}
>
  {allVisibleProjectsSelected ? 'Clear All' : 'Select All'}
</button>

</div>
  </div>
)}

    <div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: projectSource === 'network-projects' ? '390px' : 'none',
    overflowY: projectSource === 'network-projects' ? 'auto' : 'visible',
    paddingRight: projectSource === 'network-projects' ? '8px' : '0'
  }}
>
  {projectSource === 'network-projects' &&
  isLoadingNetworkProjects && (
    <div
      style={{
        padding: '28px',
        textAlign: 'center',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '10px',
        color: '#1d4ed8',
        fontWeight: '700'
      }}
    >
      ⏳ Loading Network Projects...
    </div>
  )}

  {projectSource === 'network-projects' &&
  !isLoadingNetworkProjects &&
  visibleNetworkProjects.length === 0 && (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '10px',
        color: '#64748b',
        fontWeight: '600'
      }}
    >
      {networkSearchQuery.trim()
        ? 'No projects match your search.'
        : 'No projects were found in this category.'}
    </div>
  )}

     {(!isLoadingNetworkProjects || projectSource === 'my-projects') &&
      (projectSource === 'my-projects'
        ? loadedProjects
        : visibleNetworkProjects
       ).map((project, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
            background: '#ffffff'
          }}
        >
          <input
  type="checkbox"
  checked={selectedProjectLinks.includes(project.projectLink)}
  onChange={(e) => {
    if (e.target.checked) {
      setSelectedProjectLinks([...selectedProjectLinks, project.projectLink]);
    } else {
      setSelectedProjectLinks(
        selectedProjectLinks.filter(link => link !== project.projectLink)
      );
    }
  }}
          />
          {project.imageUrl && (
            <img
              src={project.imageUrl}
              alt={project.title}
              style={{
                width: '90px',
                height: '56px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}
            />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', color: '#111827', fontSize: '14px', lineHeight: '1.35' }}>
              {project.title}
            </div>

            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
              {project.summary ? project.summary.slice(0, 120) + '...' : 'Loaded from Colaberry database'}
            </div>
          </div>
        </div>
      ))}
    </div>

    {errorMessage && (
      <p style={{ color: '#dc2626', marginTop: '16px', fontWeight: '600', textAlign: 'center' }}>
        {errorMessage}
      </p>
    )}

    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
      <button style={backButtonStyle} onClick={() => setCurrentStep(2)}>
        ← Back
      </button>

      <button
        style={nextButtonStyle}
        onClick={() => {
          if (selectedProjectLinks.length === 0) {
            setErrorMessage('Please select at least one project to include.');
            return;
          }

          setErrorMessage('');
          setCurrentStep(4);
        }}
      >
        Continue to Preview →
      </button>
    </div>
  </div>
)}

{currentStep === 4 && (
  <div style={sectionStyle}>
    <div style={{ textAlign: 'left', marginBottom: '30px' }}>

  <span
    style={{
      background: '#4f46e5',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '700'
    }}
  >
    STEP 4
  </span>

  <h2
    style={{
      marginTop: '18px',
      marginBottom: '10px',
      fontSize: '28px',
      fontWeight: '700'
    }}
  >
    Review & Generate ✨
  </h2>

  <p
    style={{
      color: '#64748b',
      fontSize: '15px',
      lineHeight: '1.6',
      margin: 0
    }}
  >
    Review your information and projects before generating your portfolio
  </p>

</div>
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '36% 1fr',
    gap: '30px',
    maxWidth: '850px',
    margin: '20px auto'
  }}
>
  <div
    style={{
      background: '#f8fafc',
      border: '1px solid #e5e7eb',
      borderRadius: '14px',
      padding: '24px',
      textAlign: 'left',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}
  >
    
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px'
  }}
>
  <h3
    style={{
      margin: 0,
      color: '#111827'
    }}
  >
    Your Information
  </h3>

  <button
    type="button"
    aria-label="Edit your information"
    title="Edit your information"
    onClick={() => setCurrentStep(1)}
    style={{
      width: '30px',
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      background: '#ffffff',
      color: '#2563eb',
      fontSize: '15px',
      cursor: 'pointer'
    }}
  >
    ✏️
  </button>
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

  {[
    ['👤', 'Name', fullName || 'Not provided'],
    ['💼', 'Title', professionalTitle || 'Not provided'],
    ['📧', 'Email', email || 'Not provided'],
    ['🔗', 'LinkedIn', linkedinUrl || 'Not provided'],
    ['🐙', 'GitHub', githubUsername || 'Not provided'],
    ['📁', 'Repository', repoName || 'Not provided']
  ].map(([icon, label, value]) => (

    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px'
      }}
    >

      <span
        style={{
          fontSize: '14px',
          marginTop: '2px',
          width: '18px',
          textAlign: 'center'
        }}
      >
        {icon}
      </span>

      <div style={{ flex: 1 }}>

        <div
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#6b7280',
            lineHeight: '1.2'
          }}
        >
          {label}
        </div>

        <div
          style={{
            marginTop: '3px',
            fontSize: '15px',
            fontWeight: '700',
            color: '#111827',
            lineHeight: '1.4'
          }}
        >
          {value}
        </div>

      </div>

    </div>

  ))}

</div>
  </div>

  <div
    style={{
      background: '#f8fafc',
      border: '1px solid #e5e7eb',
      borderRadius: '14px',
      padding: '24px',
      textAlign: 'left',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}
  >
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px'
  }}
>
  <h3
    style={{
      margin: 0,
      color: '#111827'
    }}
  >
    Selected Projects
  </h3>

  <button
    type="button"
    aria-label="Edit selected projects"
    title="Edit selected projects"
    onClick={() => setCurrentStep(3)}
    style={{
      width: '30px',
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      background: '#ffffff',
      color: '#2563eb',
      fontSize: '15px',
      cursor: 'pointer'
    }}
  >
    ✏️
  </button>
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#374151', width: '100%' }}>
  {[...loadedProjects, ...visibleNetworkProjects]
  .filter((project) =>
    selectedProjectLinks.includes(project.projectLink)
  )
  .map((project, index) => (
    <div
      key={index}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '12px',
        background: '#ffffff',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {project.imageUrl && (
        <img
          src={project.imageUrl}
          alt={project.title}
          style={{
            width: '72px',
            height: '46px',
            objectFit: 'cover',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}
        />
      )}

      <div>
        <div style={{ fontWeight: '700', color: '#111827', fontSize: '14px', lineHeight: '1.35'}}>
          {project.title}
        </div>

        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          Loaded from Colaberry database
        </div>
      </div>
    </div>
  ))}
</div>
  </div>
</div>

{errorMessage && (
  <div
    role="alert"
    style={{
      marginTop: '20px',
      marginBottom: '20px',
      padding: '16px 18px',
      background: '#fef2f2',
      border: '1px solid #f87171',
      borderRadius: '10px',
      color: '#991b1b',
      fontWeight: '600',
      lineHeight: '1.5',
      textAlign: 'left'
    }}
  >
    <div
      style={{
        fontSize: '16px',
        fontWeight: '700',
        marginBottom: '6px'
      }}
    >
      ❌ Portfolio generation failed
    </div>

    <div>{errorMessage}</div>
    <button
  type="button"
  onClick={() => {
    window.open(
      'http://localhost:3001/auth/github',
      'githubOAuthPopup',
      'width=500,height=650,top=120,left=500,resizable=yes'
    );
    const checkConnection = setInterval(async () => {
    try {
      const response = await fetch(
        'http://localhost:3001/auth/github/status'
      );

      const data = await response.json();

      if (data.connected) {
        setGithubConnected(true);
        setConnectedUsername(data.username);
        setGithubUsername(data.username);
        setErrorMessage('');
        setStatusMessage('GitHub reconnected successfully.');
        clearInterval(checkConnection);
      }
    } catch (error) {
      console.error('GitHub reconnection check failed:', error);
    }
  }, 2000);
  }}
  style={{
    marginTop: '14px',
    padding: '10px 16px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer'
  }}
>
  Reconnect GitHub
</button>
  </div>
)}

{generationStep > 0 && !errorMessage && (
  <div style={{
    background: '#ffffff',
    padding: '24px',
    marginBottom: '24px',
    borderRadius: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  }}>
    {/* <h3 style={{ marginTop: 0, color: '#111827' }}>
      Portfolio Generation Progress
    </h3> */}
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#4b5563',
    fontWeight: '600'
  }}
>
  <span>
    Step {Math.min(generationStep, generationSteps.length)} of {generationSteps.length}
  </span>

  <span>
    {Math.round((generationStep / generationSteps.length) * 100)}%
  </span>
</div>

<div style={{
  width: '100%',
  height: '10px',
  background: '#e5e7eb',
  borderRadius: '999px',
  overflow: 'hidden',
  marginBottom: '20px'
}}>
  <div style={{
    width: `${(generationStep / generationSteps.length) * 100}%`,
    height: '100%',
    background: '#2563eb',
    transition: 'width 0.3s ease'
  }} />
</div>

<div
  style={{
    marginTop: '20px',
    padding: '18px 24px',
    background: generationStep === generationSteps.length ? '#dcfce7' : '#eef2ff',
    border: generationStep === generationSteps.length ? '1px solid #22c55e' : 'none',
    borderRadius: '10px',
    textAlign: 'center',
    color: generationStep === generationSteps.length ? '#166534' : '#111827',
    fontSize: '18px',
    fontWeight: '600'
  }}
>
  {generationStep === generationSteps.length ? (
    <>
      <div>Portfolio generated successfully!</div>
      {statusMessage.includes('http') && (
        <a
          href={statusMessage.match(/https?:\/\/\S+/)?.[0]}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '8px',
            color: '#2563eb',
            fontWeight: '700'
          }}
        >
          Open Portfolio
        </a>
      )}
    </>
  ) : (
    <>⏳ {generationSteps[Math.max(generationStep - 1, 0)]?.title || statusMessage}...</>
  )}
</div>


  </div>
)}



    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '24px',
        maxWidth: '850px',
        margin: '24px auto 0 auto'
      }}
    >
      <button
       style={{
         ...backButtonStyle,
         opacity: isGenerating || statusMessage.includes('Portfolio generated successfully') ? 0.5 : 1,
         cursor: isGenerating || statusMessage.includes('Portfolio generated successfully') ? 'not-allowed' : 'pointer'
       }}
       disabled={isGenerating || statusMessage.includes('Portfolio generated successfully')}
       onClick={() => setCurrentStep(3)}
      >
      ← Back
      </button>

      <button
        onClick={handleGeneratePortfolio}
        disabled={isGenerating || statusMessage.includes('Portfolio generated successfully')}
        style={{
          ...nextButtonStyle,
          background: isGenerating ? '#94a3b8' : '#2563eb',
          cursor: isGenerating ? 'not-allowed' : 'pointer'
        }}
      >
        {statusMessage.includes('Portfolio generated successfully')
          ? 'Portfolio Generated'
          : isGenerating
          ? 'Generating Portfolio...'
          : 'Generate Portfolio🚀'}
      </button>
    </div>
  </div>
)}
      </div>
    </div>
  );
}

export default App;