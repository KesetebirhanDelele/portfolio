Purpose

Define versioned API contracts for Repo2Reputation covering authentication, repository ingestion, AI generation, portfolios, search, analytics, and tenant administration.

1. API Standards
Base URL
https://api.repo2reputation.com/v1
Protocol
HTTPS only
JSON request/response
UTF-8 encoding
Authentication
Bearer JWT access token
Refresh token via secure HTTP-only cookie or token endpoint
Common Headers
Authorization: Bearer <token>
Content-Type: application/json
X-Request-Id: <uuid>
Idempotency

POST endpoints that create jobs should support:

Idempotency-Key: <uuid>
2. Response Envelope Standard
Success
{
  "success": true,
  "data": {},
  "meta": {}
}
Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Readable error message",
    "details": {}
  }
}
3. Auth APIs
3.1 Register
Endpoint
POST /auth/register
Request
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Jane Doe",
  "consentAccepted": true
}
Response
{
  "success": true,
  "data": {
    "userId": "usr_123",
    "verificationSent": true
  }
}
3.2 Login
Endpoint
POST /auth/login
Request
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
Response
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "expiresIn": 3600,
    "refreshToken": "opaque"
  }
}
3.3 GitHub OAuth Start
GET /auth/github/start
Response

302 Redirect to provider.

3.4 Refresh Token
POST /auth/refresh
3.5 Logout
POST /auth/logout
4. User APIs
4.1 Get Current User
GET /users/me
Response
{
  "success": true,
  "data": {
    "id": "usr_123",
    "email": "user@example.com",
    "role": "student",
    "tenantId": null
  }
}
4.2 Update Profile
PATCH /users/me
Request
{
  "name": "Jane Smith",
  "headline": "Frontend Developer"
}
5. Repository APIs
5.1 List Connected Repositories
GET /repos
Query Params
page
limit
visibility
imported
Response
{
  "success": true,
  "data": [
    {
      "repoId": "gh_1",
      "name": "portfolio-site",
      "private": false,
      "language": "TypeScript",
      "lastUpdatedAt": "2026-04-17T10:00:00Z"
    }
  ]
}
5.2 Start Import
POST /repos/import
Request
{
  "repositoryIds": ["gh_1", "gh_2"]
}
Response
{
  "success": true,
  "data": {
    "jobId": "job_1001",
    "status": "queued"
  }
}
5.3 Import Status
GET /repos/import/{jobId}
Response
{
  "success": true,
  "data": {
    "jobId": "job_1001",
    "status": "processing",
    "progress": 65
  }
}
6. AI Analysis APIs
6.1 Analyze Imported Repositories
POST /analysis/run
Request
{
  "repositoryIds": ["repo_internal_1"]
}
Response
{
  "success": true,
  "data": {
    "jobId": "job_2001",
    "status": "queued"
  }
}
6.2 Get Analysis Result
GET /analysis/{jobId}
Response
{
  "success": true,
  "data": {
    "skills": [
      {
        "name": "React",
        "confidence": 0.94
      }
    ],
    "domains": [
      {
        "name": "E-commerce",
        "confidence": 0.82
      }
    ],
    "evidenceRefs": [
      "README.md",
      "package.json"
    ]
  }
}
7. Narrative Generation APIs
7.1 Generate Portfolio Content
POST /generation/run
Request
{
  "analysisId": "an_123",
  "tone": "professional",
  "sections": ["summary", "projects", "resume_bullets"]
}
Response
{
  "success": true,
  "data": {
    "jobId": "job_3001",
    "status": "queued"
  }
}
7.2 Get Generation Result
GET /generation/{jobId}
Response
{
  "success": true,
  "data": {
    "summary": "Full-stack developer with hands-on experience...",
    "projects": [],
    "resumeBullets": []
  }
}
8. Portfolio APIs
8.1 Create / Save Draft
POST /portfolios
Request
{
  "title": "Jane Doe Portfolio",
  "content": {},
  "theme": "modern"
}
8.2 Get Portfolio
GET /portfolios/{portfolioId}
8.3 Update Portfolio
PATCH /portfolios/{portfolioId}
8.4 Publish Portfolio
POST /portfolios/{portfolioId}/publish
Response
{
  "success": true,
  "data": {
    "publicUrl": "https://app.repo2reputation.com/p/jane-doe"
  }
}
8.5 Unpublish Portfolio
POST /portfolios/{portfolioId}/unpublish
8.6 Export PDF
POST /portfolios/{portfolioId}/export
9. Search APIs (Hiring Manager)
9.1 Candidate Search
GET /search/candidates
Query Params
q
skills
graduationYear
institution
page
limit
Response
{
  "success": true,
  "data": [
    {
      "candidateId": "usr_1",
      "name": "Jane Doe",
      "skills": ["React", "Node.js"]
    }
  ]
}
9.2 Save Shortlist
POST /search/shortlists
10. Institutional APIs
10.1 Create Tenant
POST /tenants
Request
{
  "name": "State University",
  "plan": "institutional"
}
10.2 Bulk Onboarding
POST /tenants/{tenantId}/users/import
Request
{
  "csvFileUrl": "signed-upload-url"
}
10.3 Tenant Dashboard
GET /tenants/{tenantId}/analytics
11. Analytics APIs
11.1 Track Event
POST /events
Request
{
  "eventType": "portfolio_view",
  "portfolioId": "pf_1",
  "source": "public"
}
11.2 User Dashboard Metrics
GET /analytics/me
12. Admin APIs
12.1 List Users
GET /admin/users
Access

Admin only.

12.2 Suspend User
POST /admin/users/{userId}/suspend
13. Error Codes
Code	Meaning
VALIDATION_ERROR	Invalid request payload
UNAUTHORIZED	Missing/invalid auth
FORBIDDEN	Role not allowed
NOT_FOUND	Resource missing
RATE_LIMITED	Too many requests
JOB_FAILED	Async job failed
PROVIDER_ERROR	Third-party dependency failed
TENANT_SCOPE_ERROR	Cross-tenant violation
14. Rate Limits
Endpoint Group	Limit
Auth	10 req/min/IP
Search	60 req/min/user
Generation	20 req/hr/user
Public Portfolio	CDN controlled
15. Webhooks (Optional Future)
POST /webhooks/partner/events

Events:

portfolio.published
student.opted_in
candidate.contacted
16. Versioning Rules
Breaking changes require /v2
Additive fields allowed in current version
Deprecated endpoints require 90-day notice minimum
17. Assumptions

ASSUMPTION: Async jobs are preferred for imports and AI workloads.
Alternative: Limited synchronous fast-lane for small tasks.

ASSUMPTION: REST is sufficient for first release.
Alternative: Add GraphQL gateway later.

18. Definition of Done
OpenAPI spec generated
Auth enforced on protected routes
Contract tests passing
Error responses standardized
Monitoring added per endpoint group