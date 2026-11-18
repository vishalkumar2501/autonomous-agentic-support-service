# Autonomous Agentic Support Service

[![CI](https://github.com/vishalkumar2501/autonomous-agentic-support-service/actions/workflows/ci.yml/badge.svg)](https://github.com/vishalkumar2501/autonomous-agentic-support-service/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue)](tsconfig.json)

Enterprise autonomous AI agent customer support backend service leveraging **LangGraph** cyclical state machines, tool calling, deterministic business guardrails in code, **BullMQ** asynchronous processing, **PostgreSQL** with **Prisma ORM**, **Redis** caching, and containerized deployment on **AWS ECS Fargate**.

---

## 🚀 Quick Start (Under 10 Commands)

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment (copy template)
cp .env.example .env

# 3. Start local Redis & Postgres (or use existing local instances)
docker compose up -d redis postgres

# 4. Generate Prisma client & apply database migrations
npx prisma migrate dev --name init

# 5. Seed database with users, products, and scenario orders
npm run seed

# 6. Run automated tests (80+ unit, integration & scenario tests)
npm test

# 7. Start API server (port 4000)
npm run dev

# 8. Start background agent queue worker (separate terminal)
npm run worker:dev
```

---

## 🏗️ System Architecture

For exhaustive architecture documentation and Mermaid state diagrams, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
Customer Request -> Express API -> BullMQ (Redis) -> Worker Process
                                                          |
                                                          v
                                                 LangGraph Engine
                                           (observe -> reason -> tools)
                                                          |
                                                          v
                                                 Business Guardrails
                                                 (enforced in CODE)
                                                          |
                                                          v
                                                PostgreSQL + Audit Trail
```

### Core Architecture Highlights:
- **Layered Clean Architecture**: `routes` -> `controllers` -> `services` -> `repositories` (Prisma isolated in repositories only). Zero business logic in controllers.
- **Deterministic Guardrails in Code**: Prompt injection heuristic defense, cross-user order ownership checks, high-value transaction escalations (> ₹20,000), single refund limits, and tool prerequisite ordering.
- **Asynchronous Scalability**: Long-running LLM workflows run decoupled in BullMQ workers returning `202 Accepted` immediately. Real-time updates delivered via Server-Sent Events (SSE).
- **Auditability**: Every agent reasoning step, tool call input, output, and guardrail decision is immutably stored in the `AgentStep` database table.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Runtime & Language** | Node.js 20 LTS, TypeScript 5.7 (Strict Mode, 0 `any`) |
| **Framework & Security** | Express 4, Zod, Helmet, CORS, HPP, Express Rate Limit |
| **Agent Orchestration** | LangGraph (`@langchain/langgraph`), LangChain Core |
| **LLM Providers** | Google Gemini (Gemini 2.0 Flash) & OpenAI (GPT-4o) with MockLLM for testing |
| **Queue & Worker** | BullMQ with Redis 7 backend |
| **Database & Cache** | PostgreSQL 16/18 with Prisma ORM, Redis for 60s TTL caching |
| **Testing** | Vitest with V8 code coverage (>= 70% requirement exceeded at 90%) |
| **Infrastructure & CI/CD** | Multi-stage Docker, GitHub Actions (OIDC), Terraform AWS ECS Fargate |

---

## 🧪 6 Core Customer Support Scenarios

The service seeds and validates 6 core automated support scenarios:
1. **Defective product inside return window**: Agent calls `checkReturnEligibility` -> `initiateRefund` -> **REFUND** issued.
2. **Outside return window but inside warranty**: Agent calls `checkWarrantyStatus` -> `createReplacementOrder` -> **REPLACEMENT** order created.
3. **Outside both return window and warranty**: Product delivered >1 year ago -> polite **REJECT** explanation.
4. **Already refunded order**: Order has existing refund status -> immediate **REJECT**.
5. **High-value order (> ₹20,000)**: Customer requests ₹65,000 laptop refund -> Guardrail intercepts -> forced **ESCALATE** to human queue (`NEEDS_HUMAN`).
6. **Prompt injection attack**: Malicious prompt injection pattern in complaint -> Guardrail blocks -> forced **ESCALATE** to human queue.

---

## 📡 API Endpoints Overview

Interactive Swagger OpenAPI 3.0 documentation is available at `http://localhost:4000/docs` and `http://localhost:4000/api/v1/docs`.

| Method | Path | Access Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register new customer or agent |
| `POST` | `/api/v1/auth/login` | Public | Login and receive JWT access & refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Public | Refresh expired access tokens |
| `GET` | `/api/v1/orders` | CUSTOMER | Retrieve customer's order history |
| `GET` | `/api/v1/orders/:orderNumber`| CUSTOMER | Detailed order lookup with Redis 60s cache |
| `POST` | `/api/v1/tickets` | CUSTOMER | Create complaint ticket (`Idempotency-Key` supported) |
| `GET` | `/api/v1/tickets/:id` | CUSTOMER / AGENT | Get complaint ticket and latest agent run |
| `POST` | `/api/v1/agent/runs` | CUSTOMER / AGENT | Start autonomous agent run (`202 Accepted`) |
| `GET` | `/api/v1/agent/runs/:id` | CUSTOMER / AGENT | Get agent run status and structured decision |
| `GET` | `/api/v1/agent/runs/:id/steps`| CUSTOMER / AGENT | Get ordered audit trail of agent thoughts & tools |
| `GET` | `/api/v1/agent/runs/:id/stream`| CUSTOMER / AGENT | Real-time Server-Sent Events (SSE) live step stream |
| `GET` | `/api/v1/escalations` | AGENT / ADMIN | View pending human agent escalation queue |
| `POST` | `/api/v1/escalations/:id/resolve`| AGENT / ADMIN | Human resolution of escalated ticket |
| `GET` | `/api/v1/health` | Public | Liveness probe |
| `GET` | `/api/v1/ready` | Public | Readiness probe (verifies database connectivity) |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in necessary values:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://user:password@localhost:5432/autonomous-agentic-support-service?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/autonomous-agentic-support-service?schema=public"
REDIS_URL="redis://localhost:6379"

JWT_ACCESS_SECRET="your_super_secret_access_key_min_32_characters"
JWT_REFRESH_SECRET="your_super_secret_refresh_key_min_32_characters"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

LLM_PROVIDER="gemini"
GOOGLE_API_KEY=""
OPENAI_API_KEY=""
LLM_MODEL="gemini-2.0-flash"
LLM_TEMPERATURE=0

AGENT_MAX_STEPS=8
HIGH_VALUE_THRESHOLD=20000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60

DB_POOL_MAX=10
WORKER_CONCURRENCY=3
CORS_ORIGINS="http://localhost:3000"
TRUST_PROXY=1
```

---

## 🧪 Testing

All tests execute completely without real LLM API keys using scripted `MockChatModel` implementations:

```bash
# Run all unit, integration, and scenario tests
npm test

# Generate test coverage report
npm run test:coverage

# Run TypeScript strict type-checking
npm run typecheck

# Run ESLint validation
npm run lint
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
