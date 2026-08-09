'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// codeIntelligence.js
//
// Deterministic repository intelligence engine for the v2 deep-analysis pipeline.
// Implements Phase 2 (Code Intelligence) of runDeepAnalysisPipeline.
//
// Design constraints:
//   - Zero external dependencies (no require() of any npm package)
//   - No AI/LLM calls — pure deterministic regex + path analysis
//   - Fault-tolerant — a bad file or a throwing rule never crashes the phase
//   - All regex patterns compiled once at module load, not per-file call
//   - Fully deterministic — same input always produces identical output
// ─────────────────────────────────────────────────────────────────────────────

// ── Confidence levels ─────────────────────────────────────────────────────────
// Represent certainty of detection, ordered highest → lowest.
// Config match is strongest evidence (explicit declaration in a config file).
// Path-only is weakest (heuristic based on directory / filename alone).

const CONFIDENCE = {
  CONFIG:  0.95,  // exact config filename / file extension match
  IMPORT:  0.80,  // import or require() statement found in source
  CONTENT: 0.70,  // usage pattern found in file body (not an import line)
  PATH:    0.60,  // directory segment or filename heuristic only
};

// ── Domain labels ─────────────────────────────────────────────────────────────
// Top-level architectural capability buckets.
// A single file can belong to multiple domains.

const DOMAINS = {
  AUTHENTICATION: 'authentication',
  API_LAYER:      'api_layer',
  DATABASE:       'database',
  AI_TOOLING:     'ai_tooling',
  FRONTEND:       'frontend',
  INFRASTRUCTURE: 'infrastructure',
};

// ── Content types that carry architecture signals ─────────────────────────────
// 'style' (CSS) and 'unknown' are skipped — they rarely contain useful signals.
// 'documentation' is included because READMEs often declare the tech stack.

const ANALYZABLE_CONTENT_TYPES = new Set([
  'source_code',
  'manifest',
  'config',
  'infrastructure',
  'test',
  'notebook',  // Jupyter .ipynb files
  'data',
  'documentation',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Internal path helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the lowercase filename from a repo-relative path.
 * e.g. "src/auth/jwt.service.ts" → "jwt.service.ts"
 */
function getFilename(filePath) {
  const parts = (typeof filePath === 'string' ? filePath : '').split('/');
  return (parts[parts.length - 1] ?? '').toLowerCase();
}

/**
 * Returns the lowercase file extension including the dot, or '' if none.
 * e.g. "auth.service.ts" → ".ts"
 */
function getExtension(filePath) {
  const fn  = getFilename(filePath);
  const idx = fn.lastIndexOf('.');
  return idx !== -1 ? fn.slice(idx) : '';
}

/**
 * Returns true if any directory segment of the path (excluding the filename)
 * matches one of the given segment strings (case-insensitive).
 *
 * @param {string}   filePath   — repo-relative path
 * @param {string[]} segments   — lowercase directory names to match
 */
function pathHasDir(filePath, segments) {
  const parts = (typeof filePath === 'string' ? filePath : '').split('/');
  const dirs  = parts.slice(0, -1).map(s => s.toLowerCase());
  return segments.some(seg => dirs.includes(seg));
}

// ─────────────────────────────────────────────────────────────────────────────
// Import / require pattern factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a RegExp that detects ES import or CommonJS require of a package.
 *
 * Matches any of:
 *   require('pkg')         require("pkg")
 *   require('pkg/sub')     require("pkg/sub")
 *   import X from 'pkg'    import X from "pkg"
 *   import 'pkg'           import "pkg"
 *   from 'pkg/sub'
 *
 * The pattern is intentionally prefix-based so that `@clerk/nextjs`,
 * `@clerk/express` etc. are caught by a single `@clerk/` pattern.
 *
 * @param {string} pkg  — npm package name or prefix (literal string)
 * @returns {RegExp}
 */
function importPattern(pkg) {
  // Escape all regex metacharacters in the package name.
  // Note: '/' does not need escaping inside new RegExp().
  const esc = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:require\\s*\\(\\s*['"]${esc}|from\\s+['"]${esc}|import\\s+['"]${esc})`,
    'i',
  );
}

// ── Pre-compiled import patterns ──────────────────────────────────────────────
// Compiled once at module load — never inside a per-file function call.

const IMPORT = {
  // ── Authentication ─────────────────────────────────────────────────────────
  jsonwebtoken:    importPattern('jsonwebtoken'),
  jose:            importPattern('jose'),
  passport:        importPattern('passport'),
  nextAuth:        importPattern('next-auth'),
  clerkNextjs:     importPattern('@clerk/nextjs'),
  clerkReact:      importPattern('@clerk/react'),
  clerkNode:       importPattern('@clerk/clerk-sdk-node'),
  clerkExpress:    importPattern('@clerk/express'),
  firebaseAuth:    importPattern('firebase/auth'),
  betterAuth:      importPattern('better-auth'),
  lucia:           importPattern('lucia'),

  // ── API layer ──────────────────────────────────────────────────────────────
  express:         importPattern('express'),
  fastify:         importPattern('fastify'),
  nestjsCore:      importPattern('@nestjs/core'),
  nestjsCommon:    importPattern('@nestjs/common'),
  graphql:         importPattern('graphql'),
  apolloServer:    importPattern('apollo-server'),
  apolloServerExp: importPattern('apollo-server-express'),
  apolloServerV4:  importPattern('@apollo/server'),
  trpcServer:      importPattern('@trpc/server'),
  trpcNext:        importPattern('@trpc/next'),
  koa:             importPattern('koa'),
  koaRouter:       importPattern('@koa/router'),
  hono:            importPattern('hono'),

  // ── Database ───────────────────────────────────────────────────────────────
  prismaClient:    importPattern('@prisma/client'),
  mongoose:        importPattern('mongoose'),
  sequelize:       importPattern('sequelize'),
  sequelizeTs:     importPattern('sequelize-typescript'),
  pg:              importPattern('pg'),
  postgres:        importPattern('postgres'),
  knex:            importPattern('knex'),
  typeorm:         importPattern('typeorm'),
  drizzleOrm:      importPattern('drizzle-orm'),
  mysql2:          importPattern('mysql2'),
  mysql:           importPattern('mysql'),
  redis:           importPattern('redis'),
  ioredis:         importPattern('ioredis'),
  mongodb:         importPattern('mongodb'),
  elasticsearch:   importPattern('@elastic/elasticsearch'),
  dynamodb:        importPattern('@aws-sdk/client-dynamodb'),

  // ── AI tooling ─────────────────────────────────────────────────────────────
  openai:          importPattern('openai'),
  anthropicSdk:    importPattern('@anthropic-ai/sdk'),
  langchainCore:   importPattern('@langchain/core'),
  langchainOpenai: importPattern('@langchain/openai'),
  langchain:       importPattern('langchain'),
  pinecone:        importPattern('@pinecone-database/pinecone'),
  weaviate:        importPattern('weaviate-ts-client'),
  chromadb:        importPattern('chromadb'),
  llamaindex:      importPattern('llamaindex'),
  mistral:         importPattern('@mistralai/mistralai'),
  cohere:          importPattern('cohere-ai'),
  groq:            importPattern('groq-sdk'),
  // Vercel AI SDK — 'ai' is very short; always guard with a content check
  vercelAi:        importPattern('ai'),
  hnswlib:         importPattern('hnswlib-node'),

  // ── Frontend ───────────────────────────────────────────────────────────────
  react:           importPattern('react'),
  next:            importPattern('next'),
  vue:             importPattern('vue'),
  angularCore:     importPattern('@angular/core'),
  svelte:          importPattern('svelte'),
  redux:           importPattern('redux'),
  reduxToolkit:    importPattern('@reduxjs/toolkit'),
  zustand:         importPattern('zustand'),
  jotai:           importPattern('jotai'),

  // ── Infrastructure ─────────────────────────────────────────────────────────
  stripe:          importPattern('stripe'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Detection rules table
// ─────────────────────────────────────────────────────────────────────────────
//
// Rule shape:
//   domain             — one of DOMAINS.*
//   technology         — unique key for this technology (used for deduplication)
//   framework          — optional display-friendly framework label
//   architectureSignal — optional architectural pattern label
//   confidence         — one of CONFIDENCE.* values
//   matchType          — 'config' | 'import' | 'content' | 'path'
//   test(file)         — pure function returning boolean; receives the full file
//                        object {path, content, contentType, languageHint,
//                                score, tier, signals}
//
// Rules are evaluated independently per file.
// Multiple rules matching the same technology are deduplicated by technology key.
// The highest confidence seen for a technology is used in scoring.
//
// Rule ordering within a group: config → import → content → path
// (mirrors descending confidence order for readability).

const RULES = [

  // ══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // Detects identity verification, session, and token strategies.
  // ══════════════════════════════════════════════════════════════════════════

  // ── JWT (JSON Web Tokens) ─────────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'jwt', framework: 'jwt',
    architectureSignal: 'stateless_auth',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    // Matches jsonwebtoken (the canonical Node.js JWT library) or jose (Web Crypto JWT)
    test: f => IMPORT.jsonwebtoken.test(f.content) || IMPORT.jose.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'jwt', framework: 'jwt',
    architectureSignal: 'stateless_auth',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // jwt.sign / jwt.verify / jwt.decode are the three canonical JWT operations
    test: f => /\bjwt\.(sign|verify|decode)\b/i.test(f.content) ||
               /\bverifyToken\b|\bdecodeJWT\b|\bsignToken\b/.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'jwt', framework: 'jwt',
    architectureSignal: 'stateless_auth',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    test: f => /\bjwt\b/i.test(getFilename(f.path)),
  },

  // ── Passport.js ───────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'passport', framework: 'passport',
    architectureSignal: 'strategy_based_auth',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.passport.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'passport', framework: 'passport',
    architectureSignal: 'strategy_based_auth',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // passport.use() registers a strategy; passport.authenticate() protects a route
    test: f => /passport\.use\s*\(|passport\.authenticate\s*\(|new\s+(Local|Jwt|Google|GitHub|Facebook)Strategy\s*\(/i.test(f.content),
  },

  // ── NextAuth / Auth.js ────────────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'next-auth', framework: 'next-auth',
    architectureSignal: 'provider_based_auth',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.nextAuth.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'next-auth', framework: 'next-auth',
    architectureSignal: 'provider_based_auth',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // Next.js catch-all auth route: [...nextauth].js / [...nextauth].ts
    test: f => /\[\.\.\.nextauth\]/i.test(f.path) &&
               /NextAuth|authOptions/i.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'next-auth', framework: 'next-auth',
    architectureSignal: 'provider_based_auth',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /\bNextAuth\s*\(|\bauthOptions\b|\bgetServerSession\s*\(|\buseSession\s*\(/.test(f.content) &&
               /next-auth/i.test(f.content),
  },

  // ── Clerk ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'clerk', framework: 'clerk',
    architectureSignal: 'hosted_auth_provider',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.clerkNextjs.test(f.content) || IMPORT.clerkReact.test(f.content) ||
               IMPORT.clerkNode.test(f.content)   || IMPORT.clerkExpress.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'clerk', framework: 'clerk',
    architectureSignal: 'hosted_auth_provider',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // clerkMiddleware / ClerkProvider are Clerk-exclusive; guard against Firebase's getAuth()
    test: f => /ClerkProvider|clerkMiddleware|authMiddleware\s*\(\{/.test(f.content) ||
               (/\bcurrentUser\s*\(\)|useUser\s*\(\)/.test(f.content) && /clerk/i.test(f.content)),
  },

  // ── Firebase Authentication ───────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'firebase-auth', framework: 'firebase',
    architectureSignal: 'hosted_auth_provider',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.firebaseAuth.test(f.content),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'firebase-auth', framework: 'firebase',
    architectureSignal: 'hosted_auth_provider',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // All Firebase Auth function names; require 'firebase' in file to reduce false positives
    test: f => /signInWithEmailAndPassword|signInWithPopup|createUserWithEmailAndPassword|onAuthStateChanged/.test(f.content) &&
               /firebase/i.test(f.content),
  },

  // ── Better Auth ──────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'better-auth', framework: 'better-auth',
    architectureSignal: 'session_based_auth',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.betterAuth.test(f.content),
  },

  // ── Lucia ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'lucia', framework: 'lucia',
    architectureSignal: 'session_based_auth',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.lucia.test(f.content),
  },

  // ── Generic auth middleware (custom-built, no library match) ──────────────
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'auth-middleware', framework: null,
    architectureSignal: 'custom_auth_middleware',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    // File inside an auth or middleware directory whose name implies auth
    test: f => pathHasDir(f.path, ['middleware', 'middlewares', 'auth', 'authentication']) &&
               /auth|authenticate|authorize|isAuth|requireAuth|verifyToken/i.test(getFilename(f.path)),
  },
  {
    domain: DOMAINS.AUTHENTICATION, technology: 'auth-middleware', framework: null,
    architectureSignal: 'custom_auth_middleware',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Exported function with an auth-guard name that isn't a known library
    test: f => /function\s+(authenticate|authorize|isAuthenticated|requireAuth|verifyToken|checkAuth)\s*\(/i.test(f.content) &&
               !IMPORT.passport.test(f.content) && !IMPORT.nextAuth.test(f.content),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // API LAYER
  // Detects server frameworks, API design patterns, and routing structures.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Express.js ────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'express', framework: 'express',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.express.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'express', framework: 'express',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // express() creates the app; Router() creates a sub-router; app.get/post/etc. add routes
    test: f => /\bexpress\s*\(\)|Router\s*\(\)|app\.(get|post|put|delete|patch|use)\s*\(/i.test(f.content),
  },

  // ── Fastify ───────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'fastify', framework: 'fastify',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.fastify.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'fastify', framework: 'fastify',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Fastify-specific API surface; guard with 'fastify' to avoid false positives
    test: f => /Fastify\s*\(\)|fastify\s*\(\)|\.register\s*\(|\.addHook\s*\(/i.test(f.content) &&
               /fastify/i.test(f.content),
  },

  // ── NestJS ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'nestjs', framework: 'nestjs',
    architectureSignal: 'enterprise_rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.nestjsCore.test(f.content) || IMPORT.nestjsCommon.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'nestjs', framework: 'nestjs',
    architectureSignal: 'enterprise_rest_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // NestJS decorator signatures; these are NestJS-exclusive in Node.js
    test: f => /@(Controller|Module|Injectable|Get|Post|Put|Delete|Patch|Guard|Interceptor|Pipe)\s*\(/.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'nestjs', framework: 'nestjs',
    architectureSignal: 'enterprise_rest_api',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    // NestJS file naming convention: *.controller.ts, *.module.ts, *.guard.ts, etc.
    test: f => /\.(controller|module|guard|interceptor|pipe|decorator)\.[jt]s$/i.test(f.path),
  },

  // ── GraphQL ───────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'graphql', framework: 'graphql',
    architectureSignal: 'graphql_api',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // .graphql and .gql files are schema / query definition files
    test: f => getExtension(f.path) === '.graphql' || getExtension(f.path) === '.gql',
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'graphql', framework: 'graphql',
    architectureSignal: 'graphql_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.graphql.test(f.content)    || IMPORT.apolloServer.test(f.content) ||
               IMPORT.apolloServerExp.test(f.content) || IMPORT.apolloServerV4.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'graphql', framework: 'graphql',
    architectureSignal: 'graphql_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /typeDefs|gql`|buildSchema|makeExecutableSchema|GraphQLObjectType|ApolloServer/i.test(f.content),
  },

  // ── tRPC ──────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'trpc', framework: 'trpc',
    architectureSignal: 'type_safe_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.trpcServer.test(f.content) || IMPORT.trpcNext.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'trpc', framework: 'trpc',
    architectureSignal: 'type_safe_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /initTRPC|createTRPCRouter|publicProcedure|protectedProcedure|t\.router\s*\(/.test(f.content),
  },

  // ── Koa ───────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'koa', framework: 'koa',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.koa.test(f.content) || IMPORT.koaRouter.test(f.content),
  },

  // ── Hono ──────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'hono', framework: 'hono',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.hono.test(f.content),
  },

  // ── Routes / controllers (path-based, framework-agnostic) ─────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'rest-routes', framework: null,
    architectureSignal: 'rest_routing',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    // Presence of routes/, controllers/, or handlers/ directory implies REST routing
    test: f => pathHasDir(f.path, ['routes', 'route', 'controllers', 'controller', 'handlers', 'handler']),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DATABASE
  // Detects ORMs, query builders, raw drivers, caches, and search engines.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Prisma ORM ────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'prisma', framework: 'prisma',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // schema.prisma is the definitive Prisma indicator
    test: f => getFilename(f.path) === 'schema.prisma',
  },
  {
    domain: DOMAINS.DATABASE, technology: 'prisma', framework: 'prisma',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.prismaClient.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'prisma', framework: 'prisma',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // PrismaClient instantiation or query through the generated client
    test: f => /new\s+PrismaClient\s*\(|prisma\.\$connect\b|prisma\.\$transaction\b/.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'prisma', framework: 'prisma',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    // prisma/ directory conventionally holds schema.prisma and migrations
    test: f => pathHasDir(f.path, ['prisma']),
  },

  // ── Mongoose (MongoDB ODM) ────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'mongoose', framework: 'mongoose',
    architectureSignal: 'document_database_odm',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.mongoose.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'mongoose', framework: 'mongoose',
    architectureSignal: 'document_database_odm',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /mongoose\.connect\s*\(|mongoose\.model\s*\(|new\s+Schema\s*\(\{|Schema\.Types\./.test(f.content),
  },

  // ── Sequelize ORM ─────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'sequelize', framework: 'sequelize',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.sequelize.test(f.content) || IMPORT.sequelizeTs.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'sequelize', framework: 'sequelize',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /new\s+Sequelize\s*\(|DataTypes\.\w+|sequelize\.define\s*\(|\.belongsTo\s*\(|\.hasMany\s*\(/.test(f.content),
  },

  // ── TypeORM ───────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'typeorm', framework: 'typeorm',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.typeorm.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'typeorm', framework: 'typeorm',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // TypeORM-specific decorators; guard with 'typeorm' to avoid NestJS false positives
    test: f => /@(Entity|Column|PrimaryGeneratedColumn|OneToMany|ManyToOne|ManyToMany|JoinColumn)\s*\(/.test(f.content) &&
               /typeorm/i.test(f.content),
  },

  // ── Drizzle ORM ───────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'drizzle', framework: 'drizzle',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.drizzleOrm.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'drizzle', framework: 'drizzle',
    architectureSignal: 'orm',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /drizzle\s*\(\s*(client|db|pool)\b|pgTable\s*\(|mysqlTable\s*\(|sqliteTable\s*\(/.test(f.content),
  },

  // ── Knex.js (query builder) ───────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'knex', framework: 'knex',
    architectureSignal: 'query_builder',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.knex.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'knex', framework: 'knex',
    architectureSignal: 'query_builder',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /knex\s*\(\{|knex\.schema\.|knex\.migrate\.|\.withSchema\s*\(/.test(f.content),
  },

  // ── PostgreSQL (raw pg driver) ────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'postgresql', framework: null,
    architectureSignal: 'relational_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    // 'pg' is the canonical Node.js PostgreSQL driver; 'postgres' is the tagged-template variant
    test: f => IMPORT.pg.test(f.content) || IMPORT.postgres.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'postgresql', framework: null,
    architectureSignal: 'relational_database',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Pool and Client are the two pg classes; guard with 'pg' or 'postgres' to avoid MySQL collision
    test: f => /new\s+Pool\s*\(\{|new\s+Client\s*\(\{|pool\.query\s*\(/.test(f.content) &&
               /\bpg\b|postgres/i.test(f.content),
  },

  // ── MySQL ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'mysql', framework: null,
    architectureSignal: 'relational_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.mysql2.test(f.content) || IMPORT.mysql.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'mysql', framework: null,
    architectureSignal: 'relational_database',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /createConnection\s*\(\{|createPool\s*\(\{/.test(f.content) &&
               /mysql/i.test(f.content),
  },

  // ── Redis ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'redis', framework: null,
    architectureSignal: 'cache_store',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.redis.test(f.content) || IMPORT.ioredis.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'redis', framework: null,
    architectureSignal: 'cache_store',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // createClient() is the redis v4 constructor; new Redis() is ioredis
    test: f => /createClient\s*\(\{?|new\s+Redis\s*\(/.test(f.content) &&
               /redis/i.test(f.content),
  },

  // ── MongoDB (raw driver) ──────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'mongodb', framework: null,
    architectureSignal: 'document_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.mongodb.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'mongodb', framework: null,
    architectureSignal: 'document_database',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /MongoClient\.connect\s*\(|new\s+MongoClient\s*\(|db\.collection\s*\(/.test(f.content),
  },

  // ── Elasticsearch ─────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'elasticsearch', framework: null,
    architectureSignal: 'search_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.elasticsearch.test(f.content),
  },

  // ── DynamoDB (AWS) ────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'dynamodb', framework: null,
    architectureSignal: 'nosql_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.dynamodb.test(f.content),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AI TOOLING
  // Detects LLM SDKs, orchestration frameworks, and vector databases.
  // ══════════════════════════════════════════════════════════════════════════

  // ── OpenAI ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'openai', framework: 'openai',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.openai.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'openai', framework: 'openai',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // OpenAI SDK v4 constructor and canonical API calls
    test: f => /new\s+OpenAI\s*\(|openai\.chat\.completions|openai\.embeddings\.create|gpt-[34]|gpt-4o/i.test(f.content),
  },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'anthropic', framework: 'anthropic',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.anthropicSdk.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'anthropic', framework: 'anthropic',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /new\s+Anthropic\s*\(|anthropic\.messages|claude-[23]-|claude-opus|claude-sonnet|claude-haiku/i.test(f.content),
  },

  // ── LangChain ─────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'langchain', framework: 'langchain',
    architectureSignal: 'llm_orchestration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.langchain.test(f.content) || IMPORT.langchainCore.test(f.content) ||
               IMPORT.langchainOpenai.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'langchain', framework: 'langchain',
    architectureSignal: 'llm_orchestration',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // LangChain class names are distinctive; no guard needed
    test: f => /ChatOpenAI|ChatAnthropic|LLMChain|AgentExecutor|VectorStoreRetriever|ConversationChain|PromptTemplate/i.test(f.content),
  },

  // ── LlamaIndex ────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'llamaindex', framework: 'llamaindex',
    architectureSignal: 'rag_framework',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.llamaindex.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'llamaindex', framework: 'llamaindex',
    architectureSignal: 'rag_framework',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /VectorStoreIndex|SimpleDirectoryReader|QueryEngine|ServiceContext/.test(f.content) &&
               /llamaindex|llama.index/i.test(f.content),
  },

  // ── Vercel AI SDK ─────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'vercel-ai-sdk', framework: 'vercel-ai',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    // 'ai' package name is too short to trust alone — require confirming API usage
    test: f => IMPORT.vercelAi.test(f.content) &&
               /streamText|generateText|generateObject|useChat|useCompletion/i.test(f.content),
  },

  // ── Pinecone (vector database) ────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'pinecone', framework: 'pinecone',
    architectureSignal: 'vector_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.pinecone.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'pinecone', framework: 'pinecone',
    architectureSignal: 'vector_database',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /new\s+Pinecone\s*\(|pinecone\.index\s*\(|pinecone\.createIndex/i.test(f.content),
  },

  // ── Weaviate (vector database) ────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'weaviate', framework: 'weaviate',
    architectureSignal: 'vector_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.weaviate.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'weaviate', framework: 'weaviate',
    architectureSignal: 'vector_database',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /weaviate\.client\s*\(|weaviate\.connectToWeaviateCloud/i.test(f.content),
  },

  // ── ChromaDB (vector database) ────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'chromadb', framework: 'chromadb',
    architectureSignal: 'vector_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.chromadb.test(f.content),
  },

  // ── Embeddings (generic — catches any embedding usage pattern) ────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'embeddings', framework: null,
    architectureSignal: 'vector_embeddings',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Covers OpenAI embeddings API, LangChain embed helpers, and generic vector store writes
    test: f => /createEmbedding|embeddings\.create|\.embed\s*\(|vectorStore\.addDocuments|\.addDocuments\s*\(/.test(f.content),
  },
  {
    domain: DOMAINS.AI_TOOLING, technology: 'embeddings', framework: null,
    architectureSignal: 'vector_embeddings',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    test: f => pathHasDir(f.path, ['embeddings', 'embedding', 'vectors', 'vector']) ||
               /embed/i.test(getFilename(f.path)),
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'mistral', framework: 'mistral',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.mistral.test(f.content),
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'cohere', framework: 'cohere',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.cohere.test(f.content),
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'groq', framework: 'groq',
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.groq.test(f.content),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FRONTEND
  // Detects UI frameworks, SSR frameworks, styling systems, and state managers.
  // ══════════════════════════════════════════════════════════════════════════

  // ── React ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'react', framework: 'react',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // JSX / TSX files are React-specific by convention
    test: f => /\.(jsx|tsx)$/.test(f.path),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'react', framework: 'react',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.react.test(f.content),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'react', framework: 'react',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Core React hooks that appear in virtually every React component
    test: f => /useState\s*\(|useEffect\s*\(|useRef\s*\(|useContext\s*\(|React\.createElement/.test(f.content),
  },

  // ── Next.js (SSR / SSG on React) ──────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'nextjs', framework: 'nextjs',
    architectureSignal: 'ssr_framework',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // next.config.js/ts is the definitive Next.js config file
    test: f => /next\.config\.[jt]s$/.test(f.path),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'nextjs', framework: 'nextjs',
    architectureSignal: 'ssr_framework',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.next.test(f.content),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'nextjs', framework: 'nextjs',
    architectureSignal: 'ssr_framework',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // These exports / types are Next.js-specific
    test: f => /getServerSideProps|getStaticProps|getStaticPaths|NextApiRequest|NextApiResponse/.test(f.content),
  },

  // ── Vue.js ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'vue', framework: 'vue',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // .vue Single File Components are Vue-exclusive
    test: f => getExtension(f.path) === '.vue',
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'vue', framework: 'vue',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.vue.test(f.content),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'vue', framework: 'vue',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // createApp() is Vue 3; guard with 'vue' to avoid React false positives
    test: f => /createApp\s*\(|defineComponent\s*\(/.test(f.content) &&
               /vue/i.test(f.content),
  },

  // ── Angular ───────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'angular', framework: 'angular',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // angular.json is the Angular CLI workspace config — definitive Angular indicator
    test: f => getFilename(f.path) === 'angular.json',
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'angular', framework: 'angular',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.angularCore.test(f.content),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'angular', framework: 'angular',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Angular component / module / service decorators
    test: f => /@Component\s*\(\{|@NgModule\s*\(\{|@Injectable\s*\(\{/.test(f.content),
  },

  // ── Svelte ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'svelte', framework: 'svelte',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    test: f => getExtension(f.path) === '.svelte' || getFilename(f.path) === 'svelte.config.js',
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'svelte', framework: 'svelte',
    architectureSignal: 'component_ui',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.svelte.test(f.content),
  },

  // ── Tailwind CSS ──────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'tailwind', framework: 'tailwind',
    architectureSignal: 'utility_css_framework',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    test: f => /tailwind\.config\.[jt]s$/.test(f.path),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'tailwind', framework: 'tailwind',
    architectureSignal: 'utility_css_framework',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Multiple Tailwind utility classes in className / class attributes
    test: f => /className=["'][^"']*(?:flex|grid|bg-|text-|p-\d|m-\d|rounded|border|shadow|hover:)[^"']*["']/.test(f.content),
  },

  // ── Redux ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'redux', framework: 'redux',
    architectureSignal: 'global_state_management',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.redux.test(f.content) || IMPORT.reduxToolkit.test(f.content),
  },
  {
    domain: DOMAINS.FRONTEND, technology: 'redux', framework: 'redux',
    architectureSignal: 'global_state_management',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /createSlice\s*\(|configureStore\s*\(|createReducer\s*\(|useSelector\s*\(|useDispatch\s*\(/.test(f.content),
  },

  // ── Zustand ───────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'zustand', framework: 'zustand',
    architectureSignal: 'global_state_management',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.zustand.test(f.content),
  },

  // ── Jotai ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.FRONTEND, technology: 'jotai', framework: 'jotai',
    architectureSignal: 'global_state_management',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.jotai.test(f.content),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE
  // Detects containerization, orchestration, CI/CD, IaC, and payment systems.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Docker ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'docker', framework: null,
    architectureSignal: 'containerization',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // Dockerfile (any variant) or docker-compose files are definitive Docker indicators
    test: f => /^dockerfile/i.test(getFilename(f.path)) ||
               /^docker-compose\.(yml|yaml)$/.test(getFilename(f.path)),
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'docker', framework: null,
    architectureSignal: 'containerization',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Both FROM and RUN must appear for this to be a Dockerfile (not a random YAML)
    test: f => /^\s*FROM\s+\S+/m.test(f.content) && /^\s*RUN\s+\S+/m.test(f.content),
  },

  // ── Kubernetes ────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'kubernetes', framework: null,
    architectureSignal: 'container_orchestration',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // k8s/ or kubernetes/ directories are authoritative Kubernetes indicators
    test: f => pathHasDir(f.path, ['k8s', 'kubernetes', 'helm']) &&
               /\.(yaml|yml)$/.test(f.path),
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'kubernetes', framework: null,
    architectureSignal: 'container_orchestration',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Kubernetes manifests always have apiVersion + kind (Deployment, Service, etc.)
    test: f => /^apiVersion:\s*\S+/m.test(f.content) &&
               /^kind:\s*(Deployment|Service|Pod|ConfigMap|Secret|Ingress|StatefulSet|DaemonSet|Job|CronJob)/m.test(f.content),
  },

  // ── GitHub Actions ────────────────────────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'github-actions', framework: null,
    architectureSignal: 'cicd_pipeline',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // .github/workflows/*.yml is the canonical GitHub Actions location
    test: f => /\.github[/\\]workflows[/\\].+\.(yml|yaml)$/i.test(f.path),
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'github-actions', framework: null,
    architectureSignal: 'cicd_pipeline',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // GitHub Actions YAML always has 'on:' (trigger) and 'jobs:' (job definitions)
    // plus at least one 'uses: actions/' step
    test: f => /^on:/m.test(f.content) && /^jobs:/m.test(f.content) &&
               /uses:\s+actions\//m.test(f.content),
  },

  // ── Terraform (Infrastructure as Code) ────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'terraform', framework: null,
    architectureSignal: 'infrastructure_as_code',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    // .tf and .hcl file extensions are Terraform-exclusive
    test: f => getExtension(f.path) === '.tf' || getExtension(f.path) === '.hcl',
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'terraform', framework: null,
    architectureSignal: 'infrastructure_as_code',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // terraform {} block or resource "type" "name" {} declaration
    test: f => /^terraform\s*\{/m.test(f.content) ||
               /^resource\s+"[^"]+"\s+"[^"]+"\s*\{/m.test(f.content) ||
               /^provider\s+"[^"]+"\s*\{/m.test(f.content),
  },

  // ── Stripe (payment infrastructure) ──────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'stripe', framework: null,
    architectureSignal: 'payment_processing',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => IMPORT.stripe.test(f.content),
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'stripe', framework: null,
    architectureSignal: 'payment_processing',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // Stripe SDK instantiation or API surface
    test: f => /new\s+Stripe\s*\(|stripe\.paymentIntents|stripe\.customers|stripe\.webhooks/i.test(f.content),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DATA & ANALYTICS PLATFORMS
  // Cloud data platforms — detected via file paths, notebook content, imports.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Microsoft Fabric ──────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'microsoft-fabric', framework: null,
    architectureSignal: 'cloud_data_platform',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => /import\s+sempy\.fabric|from\s+sempy\.fabric|notebookutils|mssparkutils/i.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'microsoft-fabric', framework: null,
    architectureSignal: 'cloud_data_platform',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /microsoft[\s_-]?fabric|fabric[\s_-]?(lakehouse|warehouse|notebook|pipeline|dataflow)|OneLake|\.pbix/i.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'microsoft-fabric', framework: null,
    architectureSignal: 'cloud_data_platform',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    test: f => /fabric|lakehouse|\.SemanticModel|\.pbix/i.test(f.path),
  },

  // ── Power BI ──────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'power-bi', framework: null,
    architectureSignal: 'business_intelligence',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /power[\s_-]?bi|powerbi|\.pbix|semantic[\s_-]?model|DAX[\s(]|CALCULATE\s*\(|RELATED\s*\(/i.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'power-bi', framework: null,
    architectureSignal: 'business_intelligence',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    test: f => /\.pbix|power[\s_-]?bi|semantic.model/i.test(f.path),
  },

  // ── Azure Synapse / Databricks ────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'azure-synapse', framework: null,
    architectureSignal: 'cloud_data_platform',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /azure[\s_-]?synapse|synapse[\s_-]?analytics|sqlpool|dedicatedpool/i.test(f.content),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'databricks', framework: null,
    architectureSignal: 'cloud_data_platform',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => /from\s+databricks|import\s+databricks|dbutils\.|spark\.conf\.set|SparkSession/i.test(f.content),
  },

  // ── Apache Spark / PySpark ────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'pyspark', framework: null,
    architectureSignal: 'big_data_processing',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => /from\s+pyspark|import\s+pyspark|SparkContext|SparkSession|pyspark\.sql/i.test(f.content),
  },

  // ── dbt ───────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'dbt', framework: null,
    architectureSignal: 'data_transformation',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    test: f => /dbt_project\.yml|profiles\.yml/.test(f.path),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'dbt', framework: null,
    architectureSignal: 'data_transformation',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /\{\{\s*ref\s*\(|dbt[\s_-]?core|dbt[\s_-]?cloud/i.test(f.content),
  },

  // ── Medallion Architecture ────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'medallion-architecture', framework: null,
    architectureSignal: 'data_architecture',
    confidence: CONFIDENCE.PATH, matchType: 'path',
    test: f => /bronze|silver|gold/.test(f.path),
  },
  {
    domain: DOMAINS.DATABASE, technology: 'medallion-architecture', framework: null,
    architectureSignal: 'data_architecture',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /medallion|bronze[\s_-]?(layer|table)|silver[\s_-]?(layer|table)|gold[\s_-]?(layer|table)/i.test(f.content),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Technology → human-readable display label
// Used by inferDominantStack to build the stack string.
// ─────────────────────────────────────────────────────────────────────────────

const STACK_LABELS = {
  'nextjs':          'Next.js',
  'react':           'React',
  'vue':             'Vue',
  'angular':         'Angular',
  'svelte':          'Svelte',
  'tailwind':        'Tailwind CSS',
  'redux':           'Redux',
  'zustand':         'Zustand',
  'jotai':           'Jotai',
  'express':         'Express',
  'fastify':         'Fastify',
  'nestjs':          'NestJS',
  'graphql':         'GraphQL',
  'trpc':            'tRPC',
  'koa':             'Koa',
  'hono':            'Hono',
  'prisma':          'Prisma',
  'drizzle':         'Drizzle',
  'mongoose':        'Mongoose',
  'sequelize':       'Sequelize',
  'typeorm':         'TypeORM',
  'knex':            'Knex',
  'postgresql':      'PostgreSQL',
  'mysql':           'MySQL',
  'mongodb':         'MongoDB',
  'redis':           'Redis',
  'elasticsearch':   'Elasticsearch',
  'dynamodb':        'DynamoDB',
  'openai':          'OpenAI',
  'anthropic':       'Anthropic',
  'langchain':       'LangChain',
  'llamaindex':      'LlamaIndex',
  'vercel-ai-sdk':   'Vercel AI SDK',
  'pinecone':        'Pinecone',
  'weaviate':        'Weaviate',
  'chromadb':        'ChromaDB',
  'embeddings':      'Embeddings',
  'mistral':         'Mistral',
  'cohere':          'Cohere',
  'groq':            'Groq',
  'jwt':             'JWT',
  'passport':        'Passport',
  'next-auth':       'NextAuth',
  'clerk':           'Clerk',
  'firebase-auth':   'Firebase Auth',
  'better-auth':     'Better Auth',
  'lucia':           'Lucia',
  'docker':          'Docker',
  'kubernetes':      'Kubernetes',
  'github-actions':  'GitHub Actions',
  'terraform':       'Terraform',
  'stripe':               'Stripe',
  'microsoft-fabric':     'Microsoft Fabric',
  'power-bi':             'Power BI',
  'azure-synapse':        'Azure Synapse',
  'databricks':           'Databricks',
  'pyspark':              'PySpark',
  'dbt':                  'dbt',
  'medallion-architecture': 'Medallion Architecture',
};

// ─────────────────────────────────────────────────────────────────────────────
// inferDominantStack  (internal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a concise human-readable stack string from detected signals.
 * Selects one technology per layer (frontend → API → DB → AI) to avoid noise.
 *
 * Examples:
 *   "Next.js + Prisma + OpenAI"
 *   "NestJS + TypeORM"
 *   "Express + MongoDB"
 *
 * @param {string[]} technologies   — all detected technology keys
 * @param {string[]} frameworks     — all detected framework keys
 * @param {string[]} domains        — detected domains ordered by file frequency
 * @returns {string}
 */
function inferDominantStack(technologies, frameworks, domains) {
  const has  = t => technologies.includes(t) || frameworks.includes(t);
  const label = t => STACK_LABELS[t] ?? t;
  const parts = [];

  // ── Layer 1: Frontend framework ───────────────────────────────────────────
  // Priority: Next.js > Angular > Svelte > Vue > React (React is catch-all)
  const frontendPriority = ['nextjs', 'angular', 'svelte', 'vue', 'react'];
  for (const tech of frontendPriority) {
    if (has(tech)) { parts.push(label(tech)); break; }
  }

  // ── Layer 2: API / server framework ──────────────────────────────────────
  // Only add if no frontend was found OR this is clearly a backend project
  const apiPriority = ['nestjs', 'fastify', 'trpc', 'express', 'graphql', 'hono', 'koa'];
  const isBackend   = !domains.includes(DOMAINS.FRONTEND) || domains[0] === DOMAINS.API_LAYER;
  if (parts.length === 0 || isBackend) {
    for (const tech of apiPriority) {
      if (has(tech) && !parts.includes(label(tech))) {
        parts.push(label(tech)); break;
      }
    }
  }

  // ── Layer 3: Database / ORM ───────────────────────────────────────────────
  // Pick the highest-signal ORM/driver; prefer ORMs over raw drivers
  const dbPriority = ['prisma', 'drizzle', 'typeorm', 'mongoose', 'sequelize', 'knex',
                      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb'];
  for (const tech of dbPriority) {
    if (has(tech) && !parts.includes(label(tech))) {
      parts.push(label(tech)); break;
    }
  }

  // ── Layer 4: AI / LLM ─────────────────────────────────────────────────────
  const aiPriority = ['openai', 'anthropic', 'langchain', 'llamaindex', 'vercel-ai-sdk',
                      'pinecone', 'weaviate', 'chromadb', 'mistral', 'cohere', 'groq'];
  for (const tech of aiPriority) {
    if (has(tech) && !parts.includes(label(tech))) {
      parts.push(label(tech)); break;
    }
  }

  return parts.length > 0 ? parts.join(' + ') : 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// extractTopicSignals  (internal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts GitHub repository topics into low-confidence domain / technology hints.
 * Topics are user-declared and may not reflect the actual codebase, so results
 * are used only to supplement (not override) file-level signals.
 *
 * @param {string[]} topics  — GitHub repository topics (raw strings)
 * @returns {{ technologies: string[], domains: string[] }}
 */
function extractTopicSignals(topics) {
  if (!Array.isArray(topics) || topics.length === 0) {
    return { technologies: [], domains: [] };
  }

  // topic (lowercase) → { tech?, domain }
  const TOPIC_MAP = {
    'react':           { tech: 'react',       domain: DOMAINS.FRONTEND },
    'nextjs':          { tech: 'nextjs',       domain: DOMAINS.FRONTEND },
    'next-js':         { tech: 'nextjs',       domain: DOMAINS.FRONTEND },
    'vue':             { tech: 'vue',          domain: DOMAINS.FRONTEND },
    'vuejs':           { tech: 'vue',          domain: DOMAINS.FRONTEND },
    'angular':         { tech: 'angular',      domain: DOMAINS.FRONTEND },
    'svelte':          { tech: 'svelte',       domain: DOMAINS.FRONTEND },
    'tailwindcss':     { tech: 'tailwind',     domain: DOMAINS.FRONTEND },
    'express':         { tech: 'express',      domain: DOMAINS.API_LAYER },
    'expressjs':       { tech: 'express',      domain: DOMAINS.API_LAYER },
    'nestjs':          { tech: 'nestjs',       domain: DOMAINS.API_LAYER },
    'fastify':         { tech: 'fastify',      domain: DOMAINS.API_LAYER },
    'graphql':         { tech: 'graphql',      domain: DOMAINS.API_LAYER },
    'trpc':            { tech: 'trpc',         domain: DOMAINS.API_LAYER },
    'prisma':          { tech: 'prisma',       domain: DOMAINS.DATABASE },
    'mongoose':        { tech: 'mongoose',     domain: DOMAINS.DATABASE },
    'mongodb':         { tech: 'mongodb',      domain: DOMAINS.DATABASE },
    'postgresql':      { tech: 'postgresql',   domain: DOMAINS.DATABASE },
    'postgres':        { tech: 'postgresql',   domain: DOMAINS.DATABASE },
    'mysql':           { tech: 'mysql',        domain: DOMAINS.DATABASE },
    'redis':           { tech: 'redis',        domain: DOMAINS.DATABASE },
    'openai':          { tech: 'openai',       domain: DOMAINS.AI_TOOLING },
    'langchain':       { tech: 'langchain',    domain: DOMAINS.AI_TOOLING },
    'llm':             { tech: null,           domain: DOMAINS.AI_TOOLING },
    'ai':              { tech: null,           domain: DOMAINS.AI_TOOLING },
    'machine-learning':{ tech: null,           domain: DOMAINS.AI_TOOLING },
    'vector-database': { tech: null,           domain: DOMAINS.AI_TOOLING },
    'rag':             { tech: null,           domain: DOMAINS.AI_TOOLING },
    'docker':          { tech: 'docker',       domain: DOMAINS.INFRASTRUCTURE },
    'kubernetes':      { tech: 'kubernetes',   domain: DOMAINS.INFRASTRUCTURE },
    'terraform':       { tech: 'terraform',    domain: DOMAINS.INFRASTRUCTURE },
    'jwt':             { tech: 'jwt',          domain: DOMAINS.AUTHENTICATION },
    'authentication':  { tech: null,           domain: DOMAINS.AUTHENTICATION },
    'oauth':           { tech: null,           domain: DOMAINS.AUTHENTICATION },
    'oauth2':          { tech: null,           domain: DOMAINS.AUTHENTICATION },
  };

  const technologies = new Set();
  const domains      = new Set();

  for (const topic of topics) {
    const key     = typeof topic === 'string' ? topic.toLowerCase().trim() : '';
    const mapping = TOPIC_MAP[key];
    if (!mapping) continue;
    if (mapping.tech)   technologies.add(mapping.tech);
    if (mapping.domain) domains.add(mapping.domain);
  }

  return { technologies: [...technologies], domains: [...domains] };
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSignalsFromFile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all detection rules against a single file and returns structured signals.
 *
 * Fault-tolerant: any exception thrown inside a rule's test() function is
 * silently swallowed — a bad rule never propagates to the caller.
 *
 * @param {object} file
 *   @param {string}      file.path         — repo-relative file path
 *   @param {string}      file.content      — file text (may be truncated by enricher)
 *   @param {string}      file.contentType  — classification from githubEnricher
 *   @param {string|null} file.languageHint — canonical language name or null
 *   @param {number}      file.score        — intelligence score (0.0–1.0)
 *   @param {string}      file.tier         — 'critical'|'high'|'medium'|'low'|'minimal'
 *   @param {string[]}    file.signals      — path-level signals from repoIntelligenceScorer
 *
 * @returns {{
 *   path:               string,
 *   domains:            string[],
 *   frameworks:         string[],
 *   technologies:       string[],
 *   architectureSignals:string[],
 *   confidence:         number,
 *   matchedRules:       Array<{technology, domain, matchType, confidence}>,
 * }}
 */
function extractSignalsFromFile(file) {
  // Normalise input — handle null, undefined, or partial objects gracefully
  const path        = (file && typeof file.path === 'string')        ? file.path        : '';
  const content     = (file && typeof file.content === 'string')     ? file.content     : '';
  const contentType = (file && typeof file.contentType === 'string') ? file.contentType : 'unknown';

  // Files whose content type carries no architecture signal are skipped entirely
  if (!ANALYZABLE_CONTENT_TYPES.has(contentType)) {
    return {
      path,
      domains:             [],
      frameworks:          [],
      technologies:        [],
      architectureSignals: [],
      confidence:          0,
      matchedRules:        [],
    };
  }

  const safeFile = {
    path,
    content,
    contentType,
    languageHint: (file && file.languageHint != null) ? file.languageHint : null,
    score:        (file && typeof file.score === 'number') ? file.score : 0,
    tier:         (file && typeof file.tier  === 'string') ? file.tier  : 'minimal',
    signals:      (file && Array.isArray(file.signals))   ? file.signals : [],
  };

  const domainsSet     = new Set();
  const frameworksSet  = new Set();
  const techSet        = new Set();
  const archSigSet     = new Set();
  const matchedRules   = [];

  // Track highest confidence per technology for accurate per-file scoring
  const techMaxConf = {};

  for (const rule of RULES) {
    let matched = false;
    try {
      matched = rule.test(safeFile);
    } catch {
      // Per-rule fault isolation — a regex error or type error is never fatal
      continue;
    }

    if (!matched) continue;

    domainsSet.add(rule.domain);
    if (rule.framework)         frameworksSet.add(rule.framework);
    techSet.add(rule.technology);
    if (rule.architectureSignal) archSigSet.add(rule.architectureSignal);

    // Keep the highest confidence seen for each technology (multiple rules may
    // match the same technology at different confidence levels)
    const prev = techMaxConf[rule.technology] ?? 0;
    if (rule.confidence > prev) techMaxConf[rule.technology] = rule.confidence;

    matchedRules.push({
      technology: rule.technology,
      domain:     rule.domain,
      matchType:  rule.matchType,
      confidence: rule.confidence,
    });
  }

  // File-level confidence = average of per-technology maximum confidences.
  // Using per-technology max (not per-rule) prevents a technology with many
  // matching rules from artificially inflating the file's confidence score.
  const techConfs  = Object.values(techMaxConf);
  const confidence = techConfs.length > 0
    ? parseFloat((techConfs.reduce((a, b) => a + b, 0) / techConfs.length).toFixed(3))
    : 0;

  return {
    path,
    domains:             [...domainsSet],
    frameworks:          [...frameworksSet],
    technologies:        [...techSet],
    architectureSignals: [...archSigSet],
    confidence,
    matchedRules,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// aggregateRepositorySignals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collapses an array of per-file signal results into a single repository-level
 * intelligence summary.
 *
 * Deduplication: domains, frameworks, technologies, and architecture patterns
 * are deduplicated using Sets. Domains are sorted by detection frequency
 * (most-detected files first) so the dominant domain appears first.
 *
 * Confidence: the repository-level confidenceScore is the arithmetic mean of
 * all non-zero per-file confidence values.
 *
 * @param {Array<ReturnType<extractSignalsFromFile>>} fileResults
 * @returns {{
 *   detectedDomains:      string[],
 *   frameworks:           string[],
 *   technologies:         string[],
 *   architecturePatterns: string[],
 *   dominantStack:        string,
 *   confidenceScore:      number,
 *   filesAnalyzed:        number,
 *   totalSignals:         number,
 * }}
 */
function aggregateRepositorySignals(fileResults) {
  if (!Array.isArray(fileResults) || fileResults.length === 0) {
    return {
      detectedDomains:      [],
      frameworks:           [],
      technologies:         [],
      architecturePatterns: [],
      dominantStack:        'unknown',
      confidenceScore:      0,
      filesAnalyzed:        0,
      totalSignals:         0,
    };
  }

  // domain → count of files that detected it (for frequency-based sorting)
  const domainCount      = {};
  const allFrameworks    = new Set();
  const allTechnologies  = new Set();
  const allArchPatterns  = new Set();
  const confidenceValues = [];
  let   totalSignals     = 0;

  for (const result of fileResults) {
    // Per-entry fault isolation — a malformed entry is silently skipped
    if (!result || typeof result !== 'object') continue;

    const domains  = Array.isArray(result.domains)             ? result.domains             : [];
    const fwks     = Array.isArray(result.frameworks)          ? result.frameworks          : [];
    const techs    = Array.isArray(result.technologies)        ? result.technologies        : [];
    const archSigs = Array.isArray(result.architectureSignals) ? result.architectureSignals : [];
    const conf     = typeof result.confidence === 'number'     ? result.confidence          : 0;

    for (const d of domains)  { domainCount[d] = (domainCount[d] ?? 0) + 1; }
    for (const f of fwks)     allFrameworks.add(f);
    for (const t of techs)    allTechnologies.add(t);
    for (const a of archSigs) allArchPatterns.add(a);

    // Signal count = unique technologies + frameworks + arch signals for this file
    totalSignals += techs.length + fwks.length + archSigs.length;

    if (conf > 0) confidenceValues.push(conf);
  }

  // Sort domains by detection frequency (descending) — most-prevalent first
  const detectedDomains = Object.keys(domainCount).sort(
    (a, b) => domainCount[b] - domainCount[a],
  );

  const technologies = [...allTechnologies];
  const frameworks   = [...allFrameworks];

  // Weighted mean confidence across all files that had at least one match
  const confidenceScore = confidenceValues.length > 0
    ? parseFloat((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length).toFixed(3))
    : 0;

  const dominantStack = inferDominantStack(technologies, frameworks, detectedDomains);

  return {
    detectedDomains,
    frameworks,
    technologies,
    architecturePatterns: [...allArchPatterns],
    dominantStack,
    confidenceScore,
    filesAnalyzed: fileResults.length,
    totalSignals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeRepositoryIntelligence  — Phase 2 entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Receives Phase 1 (enrichment) output and produces a structured repository
 * intelligence object using only deterministic analysis — no AI calls.
 *
 * Pipeline contract: returns { data, meta, dbUpdate } as expected by
 * runPhaseIsolated() in deepAnalysisPipeline.js.
 *
 * The returned `data` is passed to Phase 5 (Intelligence Agents) as
 * `ciResult.data` so agents can use pre-computed signals to focus attention.
 *
 * @param {object} enrichmentData  — enrichResult.data from Phase 1
 *   @param {object} enrichmentData.repoMeta      — normalised repo metadata
 *   @param {object} enrichmentData.fileContents  — { path → file object } map
 *   @param {object} enrichmentData.complexity    — complexity estimate from Phase 1
 *   @param {object} enrichmentData.summary       — enrichment summary stats
 *
 * @returns {{ data: object, meta: object, dbUpdate: object }}
 */
function analyzeRepositoryIntelligence(enrichmentData) {
  // Defensive normalisation — handle null, undefined, or unexpected types
  const safe         = (enrichmentData && typeof enrichmentData === 'object') ? enrichmentData : {};
  const fileContents = (safe.fileContents && typeof safe.fileContents === 'object') ? safe.fileContents : {};
  const repoMeta     = safe.repoMeta   ?? {};
  const complexity   = safe.complexity ?? {};

  // ── Per-file signal extraction ────────────────────────────────────────────
  // Each file is processed independently; an exception in one never aborts
  // the loop — the file is counted as skipped and analysis continues.

  const fileResults  = [];
  let   filesSkipped = 0;

  for (const [filePath, fc] of Object.entries(fileContents)) {
    try {
      fileResults.push(extractSignalsFromFile({
        path:         filePath,
        content:      typeof fc.content      === 'string' ? fc.content      : '',
        contentType:  typeof fc.contentType  === 'string' ? fc.contentType  : 'unknown',
        languageHint: fc.languageHint ?? null,
        score:        typeof fc.score        === 'number' ? fc.score        : 0,
        tier:         typeof fc.tier         === 'string' ? fc.tier         : 'minimal',
        signals:      Array.isArray(fc.signals)           ? fc.signals      : [],
      }));
    } catch {
      // Should never reach here due to internal fault isolation, but belt-and-suspenders
      filesSkipped++;
    }
  }

  // ── Repository-level aggregation ──────────────────────────────────────────
  const aggregated = aggregateRepositorySignals(fileResults);

  // ── Topic signal supplementation ─────────────────────────────────────────
  // GitHub topics are user-declared — they can hint at technologies that may
  // not appear in the fetched file sample (large repos, skipped files, etc.).
  // Topic signals only add new entries; they never override file-level signals.
  const topicSignals = extractTopicSignals(repoMeta.topics ?? []);

  for (const tech of topicSignals.technologies) {
    if (!aggregated.technologies.includes(tech)) aggregated.technologies.push(tech);
  }
  for (const domain of topicSignals.domains) {
    if (!aggregated.detectedDomains.includes(domain)) aggregated.detectedDomains.push(domain);
  }

  // ── Normalized intelligence object ────────────────────────────────────────
  const intelligence = {
    // Repository-level aggregated signals
    detectedDomains:      aggregated.detectedDomains,
    frameworks:           aggregated.frameworks,
    technologies:         aggregated.technologies,
    architecturePatterns: aggregated.architecturePatterns,
    dominantStack:        aggregated.dominantStack,
    confidenceScore:      aggregated.confidenceScore,

    // Per-file signals — available to downstream phases (Phase 5 agents)
    fileSignals:  fileResults,

    // Repo context snapshot
    repoMeta: {
      name:            repoMeta.name            ?? null,
      fullName:        repoMeta.fullName         ?? null,
      primaryLanguage: repoMeta.primaryLanguage  ?? null,
      topics:          repoMeta.topics           ?? [],
    },

    // Complexity tier from Phase 1 enrichment
    complexity: {
      tier:  complexity.complexity      ?? null,
      score: complexity.complexityScore ?? null,
    },

    // Versioning for future schema migrations
    analysisVersion: 2,
    analyzedAt:      new Date().toISOString(),
  };

  // ── Phase result envelope ─────────────────────────────────────────────────
  const meta = {
    filesAnalyzed:   fileResults.length,
    filesSkipped,
    totalSignals:    aggregated.totalSignals,
    detectedDomains: aggregated.detectedDomains,
    dominantStack:   aggregated.dominantStack,
    confidenceScore: aggregated.confidenceScore,
  };

  return {
    data:     intelligence,
    meta,
    // Persisted immediately by persistCheckpoint() in deepAnalysisPipeline.js
    dbUpdate: { code_intelligence_json: intelligence },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  extractSignalsFromFile,
  aggregateRepositorySignals,
  analyzeRepositoryIntelligence,
};
