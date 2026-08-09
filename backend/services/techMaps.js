'use strict';

const TECH_CATEGORIES = {
  // Backend
  express: 'Backend',     fastify: 'Backend',     nestjs: 'Backend',
  graphql: 'Backend',     trpc: 'Backend',         koa: 'Backend',
  hono: 'Backend',        django: 'Backend',       flask: 'Backend',
  fastapi: 'Backend',     rails: 'Backend',        spring: 'Backend',
  jwt: 'Backend',         passport: 'Backend',     'next-auth': 'Backend',
  clerk: 'Backend',       'firebase-auth': 'Backend', 'rest-routes': 'Backend',
  // Frontend
  react: 'Frontend',      nextjs: 'Frontend',      vue: 'Frontend',
  angular: 'Frontend',    svelte: 'Frontend',      tailwind: 'Frontend',
  redux: 'Frontend',      zustand: 'Frontend',     jotai: 'Frontend',
  // Databases
  postgresql: 'Databases', mysql: 'Databases',     mongodb: 'Databases',
  redis: 'Databases',     elasticsearch: 'Databases', dynamodb: 'Databases',
  sqlite: 'Databases',
  // ORM & data-access layers
  prisma: 'ORM & Data Access',    drizzle: 'ORM & Data Access',
  mongoose: 'ORM & Data Access',  sequelize: 'ORM & Data Access',
  typeorm: 'ORM & Data Access',   knex: 'ORM & Data Access',
  // AI/ML
  openai: 'AI/ML',        anthropic: 'AI/ML',      langchain: 'AI/ML',
  llamaindex: 'AI/ML',    'vercel-ai-sdk': 'AI/ML', pinecone: 'AI/ML',
  weaviate: 'AI/ML',      chromadb: 'AI/ML',       embeddings: 'AI/ML',
  mistral: 'AI/ML',       cohere: 'AI/ML',         groq: 'AI/ML',
  // DevOps
  docker: 'DevOps',       kubernetes: 'DevOps',    'github-actions': 'DevOps',
  terraform: 'DevOps',
  // Integrations
  stripe: 'Integrations',
  // Data & Analytics Platforms
  'microsoft-fabric':       'Data & Analytics',
  'power-bi':               'Data & Analytics',
  'azure-synapse':          'Data & Analytics',
  databricks:               'Data & Analytics',
  pyspark:                  'Data & Analytics',
  dbt:                      'Data & Analytics',
  'medallion-architecture': 'Data & Analytics',
};

const TECH_LABELS = {
  nextjs: 'Next.js',                'next-auth': 'NextAuth',
  'vercel-ai-sdk': 'Vercel AI SDK', 'github-actions': 'GitHub Actions',
  'firebase-auth': 'Firebase Auth', graphql: 'GraphQL',
  trpc: 'tRPC',                     postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',               openai: 'OpenAI API',
  langchain: 'LangChain',           llamaindex: 'LlamaIndex',
  chromadb: 'ChromaDB',             pinecone: 'Pinecone',
  weaviate: 'Weaviate',             nestjs: 'NestJS',
  tailwind: 'Tailwind CSS',         typeorm: 'TypeORM',
  dynamodb: 'DynamoDB',             elasticsearch: 'Elasticsearch',
  jwt: 'JWT',                       'rest-routes': 'REST API Design',
  embeddings:               'Vector Embeddings',
  'microsoft-fabric':       'Microsoft Fabric',
  'power-bi':               'Power BI',
  'azure-synapse':          'Azure Synapse',
  databricks:               'Databricks',
  pyspark:                  'PySpark',
  dbt:                      'dbt',
  'medallion-architecture': 'Medallion Architecture',
};

module.exports = { TECH_CATEGORIES, TECH_LABELS };
