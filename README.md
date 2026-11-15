# Autonomous Agentic Support Service

Enterprise-grade autonomous AI agent customer support backend powered by LangGraph, LangChain, Express, TypeScript, BullMQ, Redis, PostgreSQL, and AWS ECS.

## Core Features
- Autonomous LLM tool-calling loop (observe -> reason -> tool execution -> decision)
- Hardcoded business guardrails in code (not just in prompts)
- Idempotent tool execution and distributed queueing via BullMQ
- Full audit step logging and Server-Sent Events (SSE) live step streaming
- Layered architecture (Route -> Controller -> Service -> Repository)
- Multi-stage Docker, GitHub Actions CI/CD with AWS OIDC, and modular Terraform

## Quick Start (Local Development)
```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Start PostgreSQL and Redis
# (Ensure Postgres is running on port 5432 and Redis on 6379)

# 4. Generate Prisma client & run migrations
npx prisma migrate dev --name init
npm run seed

# 5. Run tests
npm test

# 6. Start API server & Worker
npm run dev
npm run worker:dev
```

## License
MIT
