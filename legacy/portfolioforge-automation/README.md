# 🚀 PortfolioForge AI

## Overview

PortfolioForge AI is an automated portfolio generation system that converts Colaberry project links into professional GitHub portfolios.

The system extracts project content directly from authenticated Colaberry projects, generates structured portfolio documentation using AI and rule-based content generation, and automatically publishes the final portfolio to GitHub.

The goal is to help students transform project work into recruiter-ready portfolios without manually writing documentation or building portfolio websites.

---

## Problem Statement

Many students complete high-quality analytics and data projects but struggle to present their work professionally.

Common challenges include:

* Writing project documentation
* Organizing project artifacts
* Creating portfolio pages
* Building GitHub repositories
* Presenting projects in a recruiter-friendly format

PortfolioForge AI automates this process by generating a complete portfolio directly from project links.

---

## Solution

PortfolioForge AI automates the entire portfolio creation workflow:

1. Student provides project links
2. Student authenticates into Colaberry
3. System extracts project content
4. AI generates portfolio documentation
5. Portfolio structure is created automatically
6. GitHub repository is created or updated
7. Portfolio is published and ready to share

---

## System Workflow

```text
Student Profile
       ↓
Project Links
       ↓
Colaberry Authentication
       ↓
Project Data Extraction
       ↓
AI Content Generation
       ↓
Portfolio Generation
       ↓
GitHub Repository Creation
       ↓
Portfolio Publishing
       ↓
Shareable GitHub Portfolio
```

---

## Features

### Student Profile Automation

Stores student information for future portfolio generation:

* Full Name
* Professional Title
* GitHub Username
* LinkedIn URL
* Email
* Portfolio Repository Name

### Project Extraction

Extracts:

* Project title
* Description
* Tags
* Dashboard images
* Step-by-step content
* Project workflow details

### AI Content Generation

Automatically generates:

* About section
* Project summaries
* Business problem statements
* Objectives
* Tools & Technologies
* Workflow descriptions
* Key insights
* Business impact

### Portfolio Generation

Creates:

```text
README.md
project-1/
project-2/
project-3/
```

with structured project documentation.

### GitHub Automation

Supports:

* Repository creation
* Repository updates
* Automated commits
* Automated publishing

---

## Technology Stack

### Backend

* Node.js

### Browser Automation

* Playwright

### AI Content Generation

* OpenRouter
* OpenAI SDK

### GitHub Integration

* GitHub REST API
* simple-git

### Configuration

* dotenv

### Portfolio Format

* Markdown
* GitHub README Pages

---

## Generated Portfolio Structure

```text
generated-portfolio/
│
├── README.md
│
├── project-1/
│   ├── README.md
│   ├── project-data.json
│   └── screenshots/
│
├── project-2/
│   ├── README.md
│   ├── project-data.json
│   └── screenshots/
│
└── project-3/
    ├── README.md
    ├── project-data.json
    └── screenshots/
```

---

## Portfolio Structure

### Homepage

Includes:

* About Me
* Skills & Tools
* Project Cards
* Project Summaries
* Contact Links
* Dashboard Preview Images

### Project Pages

Each project contains:

* Project Summary
* Business Problem
* Objectives
* Tools & Technologies
* Project Workflow
* Key Insights
* Final Dashboard / Project Preview
* Business Impact

---

## Installation

### Clone Repository

```bash
git clone <repository-url>
cd PortfolioForge-AI
```

### Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env` file:

```env
GITHUB_USERNAME=your_github_username
GITHUB_TOKEN=your_github_token
OPENROUTER_API_KEY=your_openrouter_key
```

---

## Running the Application

```bash
node src/index.js
```

---

## Student Usage Flow

### Step 1

Run PortfolioForge AI

```bash
node src/index.js
```

### Step 2

Enter student profile information.

### Step 3

Paste 1–3 Colaberry project links.

### Step 4

Authenticate into Colaberry when prompted.

### Step 5

PortfolioForge AI:

* Extracts project data
* Generates portfolio content
* Creates project pages
* Creates or updates GitHub repository
* Publishes portfolio

### Step 6

Receive GitHub portfolio link.

---

## Example Output

```text
https://github.com/student-name/data-analytics-portfolio
```

---

## Current Constraints

### MVP Scope

* Supports 1–3 project links
* Requires Colaberry authentication
* Depends on Colaberry page structure
* Requires GitHub token
* Requires Node.js environment

### AI Constraints

* Free AI models may occasionally fail
* Fallback content generation is used when AI responses are unavailable

---

## Latest Validation

✔ Existing portfolio update workflow tested

✔ New repository creation tested

✔ Automated GitHub publishing validated

✔ Student profile persistence validated

✔ End-to-end portfolio generation validated

---

## Future Enhancements

* Web-based UI
* Multiple portfolio templates
* Resume generation
* LinkedIn integration improvements
* Portfolio themes
* Database-backed student profiles
* Advanced AI content customization
* Portfolio analytics dashboard

---

## Business Value

PortfolioForge AI reduces the time required to create a professional portfolio from several hours of manual work to a largely automated process.

Benefits include:

* Faster portfolio creation
* Consistent project documentation
* Improved recruiter presentation
* Better project visibility
* Increased student portfolio adoption

---

## Project Status

```text
Phase 1  ✔ Project Extraction
Phase 2  ✔ Portfolio Generation
Phase 3  ✔ AI Content Generation
Phase 4  ✔ GitHub Publishing
Phase 5  ✔ Student Profile Automation
Phase 6  ✔ End-to-End Validation

Status: MVP Complete
```

---

## Author

Developed as part of the PortfolioForge AI automation engineering project.
