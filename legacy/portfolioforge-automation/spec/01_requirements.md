spec/01_requirements.md

# Requirements

## Project Name

PortfolioForge AI

---

# Purpose

PortfolioForge AI enables students to convert completed Colaberry projects into professional GitHub portfolio repositories.

The MVP extracts project content from authenticated Colaberry project pages, uses AI to generate recruiter-focused documentation, creates a structured GitHub repository, and publishes the repository under the student's GitHub account.

---

# Scope Mode

MVP

---

# Requirement Categories

1. Student input requirements
2. Colaberry authentication requirements
3. Project extraction requirements
4. AI content generation requirements
5. Repository generation requirements
6. GitHub publishing requirements
7. Security requirements
8. Performance requirements
9. Reliability requirements
10. User experience requirements

---

# Functional Requirements

## FR-001 — Student Profile Input

The system must allow the student to provide basic portfolio profile information before generation.

Required fields:

* Student full name
* Professional title or target role
* Short bio or career summary
* Skills or tools, if available
* GitHub authorization

Acceptance Criteria:

Given a student starts portfolio generation
When the student submits profile information
Then the system must validate required fields before continuing.

Given required profile information is missing
When the student attempts to continue
Then the system must block generation and identify missing fields.

---

## FR-002 — Colaberry Project Link Submission

The system must allow the student to submit between one and three Colaberry project links.

Rules:

* Minimum project links: 1
* Maximum project links: 3
* Links must be manually provided by the student
* Automatic project discovery is not supported in MVP

Acceptance Criteria:

Given a student submits one valid Colaberry project link
When validation runs
Then the system must allow the workflow to continue.

Given a student submits more than three project links
When validation runs
Then the system must reject the submission.

Given a student submits zero project links
When validation runs
Then the system must block generation.

---

## FR-003 — Colaberry Authentication Through Controlled Browser

The system must open a Playwright-controlled browser session for Colaberry authentication.

Rules:

* Student logs in directly through Colaberry
* System must not store passwords
* System must not request passwords through custom forms
* Session state must exist only during processing

Acceptance Criteria:

Given the student needs authenticated access
When the system opens Colaberry login
Then the student must authenticate directly on Colaberry.

Given authentication succeeds
When the session is active
Then the system may access submitted project links.

Given authentication fails
When the system cannot access project content
Then the workflow must stop and notify the student.

---

## FR-004 — Authenticated Project Page Access

The system must open each submitted Colaberry project link using the authenticated browser session.

Acceptance Criteria:

Given a valid authenticated session
When the system opens a project link
Then project content must be accessible for extraction.

Given a submitted link is inaccessible
When the system attempts to open it
Then the system must mark that project as failed and continue only if at least one project can be processed.

---

## FR-005 — Project Section Navigation

The system must navigate available project sections such as:

* Overview
* Step-by-Step
* Instructions
* Resources
* Files
* Images
* Screenshots
* Deliverables

Acceptance Criteria:

Given a project page contains multiple sections
When extraction runs
Then the system must attempt to collect content from all supported sections.

Given a section is missing
When extraction runs
Then the system must continue without failing the full project.

---

## FR-006 — Content Extraction

The system must extract project data from Colaberry project pages.

Extracted data may include:

* Project title
* Project description
* Problem statement
* Steps or methodology
* Tools and technologies
* Images and screenshots
* Files or downloadable artifacts
* Project outcomes
* Insights
* Instructions
* Supporting content

Acceptance Criteria:

Given a project page contains readable text
When extraction runs
Then the system must capture the text into a normalized project data structure.

Given a project contains images
When extraction runs
Then the system must attempt to capture image references or downloadable image assets.

Given a project contains files
When extraction runs
Then the system must attempt to collect supported downloadable files.

---

## FR-007 — Screenshot and Image Handling

The system must support both existing Colaberry images and attempted browser screenshot capture.

MVP priority:

1. Reuse available Colaberry project images and screenshots.
2. Attempt screenshot capture only when stable and safe.
3. Do not block generation if screenshots are unavailable.

Acceptance Criteria:

Given project images are available
When extraction runs
Then the system must save them into the project screenshots folder.

Given images are unavailable
When generation runs
Then the project README must still be generated.

---

## FR-008 — AI Content Structuring

The system must use AI to transform extracted content into structured portfolio content.

The AI must:

* Reorganize raw project content
* Rewrite content professionally
* Generate recruiter-focused summaries
* Extract skills and tools
* Create concise project descriptions
* Avoid unsupported claims

Acceptance Criteria:

Given extracted project content
When AI generation runs
Then the system must generate structured project documentation.

Given extracted content is incomplete
When AI generation runs
Then the system must avoid inventing missing facts.

Given tools or skills are detected
When AI generation runs
Then the system must include them in the portfolio output.

---

## FR-009 — Main Portfolio README Generation

The system must generate a root-level `README.md` as the portfolio landing page.

The main README must include:

* Student name
* Professional title or target role
* Short about section
* Skills and tools
* Featured project summaries
* Project preview images when available
* Links to each project folder

Acceptance Criteria:

Given portfolio generation completes
When the repository is created
Then the root `README.md` must exist.

Given at least one project is processed
When the main README is generated
Then it must include a summary and link for each processed project.

---

## FR-010 — Project README Generation

The system must generate a project-level `README.md` for each processed project.

Each project README must include:

* Project title
* Problem or objective
* Approach
* Tools used
* Key steps
* Insights or outcomes
* Screenshots when available
* Files or artifacts when available

Acceptance Criteria:

Given a project is successfully processed
When repository files are generated
Then that project must have its own `README.md`.

Given screenshots are available
When project README is generated
Then screenshots must be referenced in the README.

---

## FR-011 — Repository Structure Generation

The system must create the following repository structure:

```text
student-portfolio/
├── README.md
├── project-1/
│   ├── README.md
│   ├── screenshots/
│   └── files/
├── project-2/
└── project-3/
```

Acceptance Criteria:

Given one project is processed
When repository generation completes
Then the repository must contain root `README.md` and one project folder.

Given three projects are processed
When repository generation completes
Then the repository must contain three project folders.

---

## FR-012 — GitHub OAuth Authorization

The system must use GitHub OAuth to authorize repository creation in the student's GitHub account.

Rules:

* Student must explicitly authorize GitHub access
* Personal access tokens are not required for MVP
* Repositories are created under the student's account

Acceptance Criteria:

Given a student connects GitHub
When OAuth authorization succeeds
Then the system may create a portfolio repository.

Given GitHub authorization fails
When repository creation is attempted
Then the system must stop and notify the student.

---

## FR-013 — GitHub Repository Publishing

The system must create and publish the generated portfolio repository to the student's GitHub account.

Acceptance Criteria:

Given portfolio files are generated
When GitHub publishing runs
Then a repository must be created under the student's GitHub account.

Given repository creation succeeds
When publishing completes
Then the student must receive the GitHub repository URL.

Given repository creation fails
When publishing completes
Then the system must show a clear failure message and preserve generated content if possible.

---

## FR-014 — Post-Publishing Review

The MVP must allow the student to review the generated output after publishing.

Acceptance Criteria:

Given the repository is published
When the workflow completes
Then the student must receive a link to inspect the portfolio.

Given the student wants to edit content
When the MVP workflow is complete
Then editing must happen manually in GitHub.

---

# Non-Functional Requirements

## NFR-001 — Performance

The system must complete portfolio generation within measurable limits.

Targets:

* One project: ≤ 5 minutes
* Three projects: ≤ 10 minutes
* GitHub publishing after generation: ≤ 60 seconds

---

## NFR-002 — Availability

The MVP should run reliably during local testing and demo usage.

---

## NFR-003 — Security

The system must not store Colaberry passwords.

The system must not log sensitive credentials.

The system must store GitHub OAuth credentials securely.

The system must use HTTPS for all web application traffic.

---

## NFR-004 — Privacy

The system must process only project links provided by the student.

The system must not automatically discover unrelated projects.

The system must not extract content outside the authenticated project pages submitted by the student.

---

## NFR-005 — Reliability

The system must recover gracefully from partial failures.

Rules:

* If one project fails and another succeeds, generation may continue.
* If all projects fail, repository generation must stop.
* If AI generation fails, the system must use fallback portfolio content when possible.
* If GitHub publishing fails, system must preserve generated content when possible.

---

## NFR-006 — Maintainability

The system must separate:

* Browser automation
* Content extraction
* AI generation
* Repository generation
* GitHub publishing

Each layer must be independently replaceable.

---

# MVP Constraints

## Constraint 1 — Project Limit

The MVP supports one to three Colaberry project links.

---

## Constraint 2 — Manual Link Submission

The MVP does not support automatic project discovery.

---

## Constraint 3 — GitHub Repo Only

The MVP does not require GitHub Pages.

---

## Constraint 4 — Post-Publish Editing Only

The MVP does not support editing generated content before publishing.

---

## Constraint 5 — Colaberry Page Dependency

Extraction depends on Colaberry page structure.

If page structure changes, extraction behavior may require updates.

---

# Data Requirements

The system must process the following data types:

## Student Data

* Name
* Role or target title
* Bio
* Skills
* GitHub account identity

## Project Data

* Project URL
* Project title
* Extracted content
* Extracted images
* Extracted files
* Generated summaries
* Generated README content

## Operational Data

* Job status
* Error status
* Processing timestamps
* GitHub repository URL

---

# Security Requirements

## SR-001 — No Password Storage

The system must never store Colaberry passwords.

---

## SR-002 — Session Memory Only

Colaberry authenticated session state must exist only during processing.

---

## SR-003 — GitHub OAuth Protection

GitHub OAuth tokens must be stored securely and used only for repository creation and publishing.

---

## SR-004 — Access Boundaries

The system must only access project URLs provided by the student.

---

# Acceptance Criteria Summary

## Successful MVP Flow

Given a student provides profile information and one to three valid Colaberry project links
And the student authenticates to Colaberry
And the student authorizes GitHub through OAuth
When the student starts generation
Then the system must extract project content
And generate a main portfolio README
And generate project-level README files
And create the repository structure
And publish the repository to the student's GitHub account
And return the repository URL.

---

## Partial Project Failure

Given a student provides three project links
And one project fails extraction
When at least one project succeeds
Then the system may generate the portfolio using successful projects
And must report failed project links clearly.

---

## Total Project Failure

Given all submitted project links fail extraction
When generation runs
Then the system must not create an empty GitHub repository
And must notify the student that no projects could be processed.

---

## GitHub Failure

Given project content was successfully generated
When GitHub publishing fails
Then the system must report the GitHub failure
And preserve generated content if possible.

---

# Out of Scope

The following are excluded from MVP:

* GitHub Pages publishing
* Resume generation
* LinkedIn content generation
* Automatic Colaberry project discovery
* Institution dashboards
* Recruiter portal
* Pre-publication editor
* Multi-tenant administration
* Advanced analytics
* Continuous portfolio sync
* Multiple portfolio themes

---

# Requirement Status

This requirements file is ready to support:

* System architecture design
* Data model definition
* Business rule directives
* Execution planning
* State model design
* Acceptance testing
* Failure playbook creation
