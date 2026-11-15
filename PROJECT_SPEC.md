# PROJECT_SPEC.md — Autonomous Agentic Support Service (AI Tool Calling Backend)

> READ THIS FILE FULLY BEFORE WRITING ANY CODE.
> Follow it exactly. Do NOT add, remove, rename or "improve" anything outside this spec.
> If something is ambiguous, choose the simplest option written here and note it in `DECISIONS.md`. Do not invent new features.

---

## 1. Project Overview

**Repo name:** `autonomous-agentic-support-service`

An enterprise-style backend where a customer sends a complaint such as
*"My order #ORD-1042 arrived defective"*. An LLM-based agent then **autonomously calls multiple tools**
(order lookup, return-window check, warranty check, refund, replacement, escalation),
reasons over each tool result, picks the next step, and finally reaches a **decision**
(REFUND / REPLACEMENT / REJECT / ESCALATE_TO_HUMAN) with a full audit trail.

### Core learning goals
- Agentic loop (reason -> tool call -> observe -> next step -> final decision)
- Tool calling with strict schemas (Zod)
- Backend engineering: auth, queues, DB, caching, idempotency, observability
- Guardrails: business rules in CODE, never only in the prompt

---

## 2. Tech Stack (fixed, do not substitute)

| Area | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript (strict mode) |
| Web framework | Express.js 4 |
| Agent framework | LangChain.js (`langchain`, `@langchain/core`) + LangGraph.js (`@langchain/langgraph`) |
| LLM provider | Provider abstraction. Default: Google Gemini (`@langchain/google-genai`). Optional: OpenAI (`@langchain/openai`). Chosen via `LLM_PROVIDER` env |
| Validation | Zod |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Cache / Queue | Redis 7 + BullMQ |
| Auth | JWT (access + refresh), bcrypt, role based (CUSTOMER, AGENT, ADMIN) |
| Logging | Pino + pino-http |
| API docs | swagger-ui-express + OpenAPI from Zod (`zod-to-openapi`) |
| Security | helmet, cors, express-rate-limit, hpp |
| Testing | Vitest + Supertest |
| Lint/format | ESLint + Prettier |
| Containers | Docker (multi-stage) + docker-compose (local) |
| Cloud | AWS: ECR, ECS Fargate, ALB, ElastiCache Redis, Secrets Manager, CloudWatch, (optional RDS) |
| IaC | Terraform |
| CD auth | GitHub Actions OIDC to AWS (no long-lived keys) |
| CI | GitHub Actions (lint, typecheck, test, build) |

---

## 3. Folder Structure (create exactly this)

```
autonomous-agentic-support-service/
├── .github/workflows/
│   ├── ci.yml                    # PR checks
│   └── cd.yml                    # deploy to AWS on push to main
├── infra/terraform/              # AWS infrastructure as code (Section 16)
│   ├── main.tf  variables.tf  outputs.tf  providers.tf  backend.tf
│   └── modules/ (network, ecr, ecs, alb, redis, rds, secrets, iam, monitoring)
├── scripts/
│   ├── migrate.sh                # prisma migrate deploy (used by CD)
│   └── docker-entrypoint.sh
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app.ts                    # express app setup (no listen)
│   ├── server.ts                 # API process only (listen)
│   ├── worker.ts                 # BullMQ worker process only (separate ECS service)
│   ├── config/
│   │   ├── env.ts                # zod validated env
│   │   ├── logger.ts
│   │   └── constants.ts
│   ├── db/
│   │   ├── prisma.ts
│   │   └── redis.ts
│   ├── modules/
│   │   ├── auth/                 # routes, controller, service, schema
│   │   ├── users/
│   │   ├── orders/               # CRUD for orders (used by tools)
│   │   ├── tickets/              # complaint tickets
│   │   └── agent/
│   │       ├── agent.routes.ts
│   │       ├── agent.controller.ts
│   │       ├── agent.service.ts      # creates run, enqueues job
│   │       ├── agent.graph.ts        # LangGraph state machine
│   │       ├── agent.prompts.ts      # system prompt, versioned
│   │       ├── agent.state.ts        # graph state types
│   │       ├── guardrails.ts         # hard business rules
│   │       ├── llm.factory.ts        # provider abstraction
│   │       └── tools/
│   │           ├── index.ts              # tool registry
│   │           ├── getOrderDetails.tool.ts
│   │           ├── getCustomerProfile.tool.ts
│   │           ├── checkReturnEligibility.tool.ts
│   │           ├── checkWarrantyStatus.tool.ts
│   │           ├── initiateRefund.tool.ts
│   │           ├── createReplacementOrder.tool.ts
│   │           ├── createReturnLabel.tool.ts
│   │           ├── sendNotification.tool.ts
│   │           └── escalateToHuman.tool.ts
│   ├── queues/
│   │   ├── agent.queue.ts
│   │   └── agent.worker.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── idempotency.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── error.middleware.ts
│   ├── utils/
│   │   ├── ApiError.ts
│   │   ├── asyncHandler.ts
│   │   └── retry.ts
│   └── types/
├── tests/
│   ├── unit/ (tools, guardrails)
│   ├── integration/ (auth, agent flow with mocked LLM)
│   └── mocks/mockLLM.ts
├── docs/
│   ├── ARCHITECTURE.md
│   └── DECISIONS.md
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. Database Schema (Prisma models)

- **User**: id, email (unique), passwordHash, name, role (CUSTOMER|AGENT|ADMIN), createdAt
- **Product**: id, name, sku, price, warrantyMonths, returnWindowDays
- **Order**: id, orderNumber (unique, e.g. ORD-1042), userId, status (PLACED|SHIPPED|DELIVERED|RETURNED|REFUNDED), totalAmount, orderedAt, deliveredAt
- **OrderItem**: id, orderId, productId, quantity, unitPrice
- **Ticket**: id, userId, orderId?, message, status (OPEN|IN_PROGRESS|RESOLVED|ESCALATED), createdAt
- **AgentRun**: id, ticketId, status (QUEUED|RUNNING|COMPLETED|FAILED|NEEDS_HUMAN), decision (REFUND|REPLACEMENT|REJECT|ESCALATE|null), finalMessage, totalTokens, startedAt, finishedAt, promptVersion, idempotencyKey (unique)
- **AgentStep**: id, runId, stepNumber, type (LLM_THOUGHT|TOOL_CALL|TOOL_RESULT|GUARDRAIL|FINAL), toolName?, input Json?, output Json?, latencyMs, createdAt
- **Refund**: id, orderId, amount, status, reason, runId, createdAt
- **ReplacementOrder**: id, originalOrderId, status, runId, createdAt
- **Escalation**: id, ticketId, runId, reason, assignedTo?, status

Add indexes on: `Order.userId`, `Ticket.userId`, `AgentStep.runId`, `AgentRun.ticketId`.

Seed: 3 users (customer, agent, admin), 6 products, 8 orders covering these scenarios:
inside return window, outside return window but in warranty, outside both, already refunded, high-value order (> ₹20,000), delivered-not-yet, someone else's order.

---

## 5. Agent Design (most important)

### 5.1 Flow (LangGraph state machine)

```
START -> loadContext -> agentNode(LLM) -> [has tool calls?]
   yes -> guardrailCheck -> toolExecutor -> agentNode (loop)
   no  -> finalizeDecision -> END
```

- Max iterations: `AGENT_MAX_STEPS` (default 8). On exceed -> ESCALATE.
- Every step is saved in `AgentStep`.
- Agent runs ASYNC through BullMQ worker. API returns `202 + runId`.

### 5.2 Tools (each = Zod input schema + description + handler)

| Tool | Input | Returns |
|---|---|---|
| getOrderDetails | orderNumber | order, items, dates, status |
| getCustomerProfile | userId | name, tier, past refund count |
| checkReturnEligibility | orderNumber | eligible(bool), daysLeft, reason |
| checkWarrantyStatus | orderNumber | inWarranty(bool), expiresOn |
| createReturnLabel | orderNumber | labelId, pickupDate |
| initiateRefund | orderNumber, amount, reason | refundId, status |
| createReplacementOrder | orderNumber, reason | replacementId |
| sendNotification | userId, channel, message | sent(bool) |
| escalateToHuman | ticketId, reason | escalationId |

Rules for tools:
1. Every tool validates input with Zod and returns `{ success, data?, error? }`. Never throw raw errors to the LLM.
2. Tools that change data (`initiateRefund`, `createReplacementOrder`) must be **idempotent** using `runId + toolName`.
3. A tool must verify that the order belongs to the ticket's user (ownership check).
4. Tools are plain functions in the service layer, and LangChain `DynamicStructuredTool` wrappers only call them.

### 5.3 Guardrails (`guardrails.ts`, enforced in CODE)

- Refund amount cannot exceed order total.
- Refund > `HIGH_VALUE_THRESHOLD` (default 20000) -> force `escalateToHuman`, block `initiateRefund`.
- No refund/replacement without a successful `checkReturnEligibility` or `checkWarrantyStatus` in the same run.
- Order of a different user -> block + escalate.
- Max 1 refund per run.
- Detect prompt injection patterns in the ticket message (e.g. "ignore previous instructions") -> flag and escalate.
- Any guardrail block is saved as an `AgentStep` type GUARDRAIL and the reason is sent back to the LLM as a tool message.

### 5.4 Decision policy (put in system prompt AND enforce via guardrails)

1. Product defective AND inside return window -> REFUND or REPLACEMENT (prefer replacement if stock/warranty applies).
2. Outside return window AND inside warranty -> REPLACEMENT.
3. Outside both -> REJECT politely with explanation.
4. Already refunded -> REJECT.
5. High value, suspicious, missing data, or low confidence -> ESCALATE.

### 5.5 Final output (structured, Zod validated)

```json
{
  "decision": "REFUND | REPLACEMENT | REJECT | ESCALATE",
  "confidence": 0.0,
  "reasoning": "short explanation",
  "customerMessage": "polite message to the user",
  "actionsTaken": ["checkReturnEligibility", "initiateRefund"]
}
```

---

## 6. API Endpoints (base `/api/v1`)

| Method | Path | Role | Description |
|---|---|---|---|
| POST | /auth/register | public | register |
| POST | /auth/login | public | login, returns tokens |
| POST | /auth/refresh | public | refresh token |
| GET | /orders | CUSTOMER | my orders |
| GET | /orders/:orderNumber | CUSTOMER | order detail |
| POST | /tickets | CUSTOMER | create complaint (`Idempotency-Key` header) |
| GET | /tickets/:id | CUSTOMER/AGENT | ticket + latest run |
| POST | /agent/runs | CUSTOMER/AGENT | start agent for a ticket -> `202 {runId}` |
| GET | /agent/runs/:id | owner/AGENT | status + decision |
| GET | /agent/runs/:id/steps | owner/AGENT | full audit trail |
| GET | /agent/runs/:id/stream | owner/AGENT | SSE live step stream |
| GET | /escalations | AGENT/ADMIN | pending human reviews |
| POST | /escalations/:id/resolve | AGENT/ADMIN | human resolves |
| GET | /health | public | liveness + db + redis |
| GET | /docs | public | Swagger UI |

---

## 7. Environment Variables (`.env.example`)

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentic
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
LLM_PROVIDER=gemini
GOOGLE_API_KEY=
OPENAI_API_KEY=
LLM_MODEL=gemini-2.0-flash
LLM_TEMPERATURE=0
AGENT_MAX_STEPS=8
HIGH_VALUE_THRESHOLD=20000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

---

## 8. Non-Functional Requirements

- Layered architecture: route -> controller -> service -> repository(Prisma). No business logic in controllers.
- Central error handler with a consistent JSON error format.
- Every request has a `requestId`, included in all logs.
- LLM calls: timeout 30s, retry 2 times with exponential backoff (`utils/retry.ts`).
- Cache `getOrderDetails` in Redis (TTL 60s).
- Graceful shutdown (close server, worker, prisma, redis).
- Never log passwords, tokens, or full API keys.
- LLM must be mockable. All tests run WITHOUT real API calls.

---

## 9. Testing Requirements

- Unit: each tool (happy + failure), each guardrail rule.
- Integration: register -> login -> create ticket -> run agent (mockLLM) -> check steps.
- Scenario tests (mockLLM scripted) for: refund, replacement via warranty, reject, high-value escalation, prompt injection, other user's order.
- Minimum 70% coverage on `modules/agent`.

---

## 10. Docker

- `docker-compose.yml`: services `api`, `worker`, `postgres`, `redis`.
- Multi-stage Dockerfile (build -> slim runtime, non-root user).
- `npm run dev` should work with `docker compose up postgres redis`.

---

## 11. Build Order (follow strictly, one phase at a time)

After each phase: run lint + typecheck + tests, fix, then print a short summary and continue.

1. **Setup**: package.json, tsconfig, eslint, prettier, env.ts, logger, app/server skeleton, /health.
2. **Database**: Prisma schema, migration, seed.
3. **Auth + RBAC**: register/login/refresh, middlewares.
4. **Orders + Tickets** modules.
5. **Tools** as plain service functions + unit tests (no LLM yet).
6. **Guardrails** + unit tests.
7. **LLM factory + LangGraph agent** + prompts + mockLLM.
8. **Queue + worker + agent API + audit steps + SSE**.
9. **Escalation module**.
10. **Swagger docs, rate limiting, idempotency, security hardening**.
11. **Scenario tests, Docker, CI**.
12. **README.md + docs/ARCHITECTURE.md** (with a Mermaid diagram of the agent flow).

---

## 12. Strict Rules for the AI Coding Agent

1. Do NOT change the stack, folder names, or endpoint paths.
2. Do NOT skip a phase or merge phases.
3. Do NOT hardcode secrets or API keys.
4. Do NOT put business rules only inside prompts. Guardrails must be in code.
5. Do NOT use `any`. Use proper types and Zod inference.
6. Do NOT add extra libraries without writing the reason in `docs/DECISIONS.md`.
7. Write clean code with short comments explaining WHY, not WHAT.
8. If a phase fails tests, fix it before moving on.
9. At the end, give: how to run, sample curl commands for every scenario, and a list of anything left unfinished.

---

## 13. Definition of Done

- `docker compose up` starts everything.
- `npm test` passes.
- Seeded customer can create a ticket for a defective order and the agent produces the correct decision for all 6 seeded scenarios.
- `/agent/runs/:id/steps` shows full tool-call trail.
- README explains setup in under 10 commands.
- CI passes on pull requests; CD deploys to AWS ECS on push to `main`; `GET /health` on the ALB URL returns 200.
- `terraform validate` passes.

---

## 14. Database Setup (user provides the connection string)

- Database type: **PostgreSQL**. Database name to use: `agentic_support_db`.
- The user will put the real connection string in `.env` as `DATABASE_URL`. If the provider needs a pooled + direct URL (Neon/Supabase), also support `DIRECT_URL` in `schema.prisma` (`directUrl = env("DIRECT_URL")`) and add it to `.env.example`.
- The agent must NEVER ask for, print, log, or hardcode the connection string. Only read it from `.env`.
- After the user's `.env` is ready, run: `npx prisma migrate dev --name init` then `npx prisma db seed`.
- Redis: use `REDIS_URL` from `.env`. If the user has no Redis, provide a `docker-compose.yml` Redis service and tell the user to run `docker compose up -d redis`.

---

## 15. Git & GitHub Setup (the agent does this itself)

Remote repo (already created, empty): `https://github.com/vishalkumar2501/autonomous-agentic-support-service.git`

1. Before the first commit, create `.gitignore` containing at least: `node_modules/`, `dist/`, `.env`, `.env.*` (except `.env.example`), `coverage/`, `*.log`, `.DS_Store`.
2. Verify `.env` is NOT tracked (`git status`) before every commit. Never commit secrets.
3. Run: `git init`, `git branch -M main`, `git remote add origin <url above>`.
4. Add `README.md`, `LICENSE` (MIT) and `.gitignore` in the first commit.
5. Commit after EACH phase of Section 11 using Conventional Commits, e.g.:
   - `chore: project setup (phase 1)`
   - `feat(db): prisma schema and seed (phase 2)`
   - `feat(auth): jwt auth and rbac (phase 3)`
   ... and so on.
6. Push after each phase: `git push -u origin main` (first time), then `git push`.
7. If push fails because of authentication, STOP and tell the user exactly what to do (login via `gh auth login` or use a Personal Access Token). Do not try workarounds.


---

## 16. AWS Deployment Architecture

```
GitHub (push main) -> GitHub Actions -> build image -> ECR
                                          |
                                          v
Internet -> ALB (HTTPS) -> ECS Fargate service "api"    (private subnets)
                           ECS Fargate service "worker" (no ALB, same image, cmd: node dist/worker.js)
                                  |                 |
                          ElastiCache Redis    Postgres (user's external DB via DATABASE_URL,
                                                or optional RDS if create_rds=true)
Secrets Manager -> injected as env into tasks | CloudWatch Logs + Alarms
```

### 16.1 Terraform (infra/terraform)
- Region from variable `aws_region` (default `ap-south-1`).
- Remote state: S3 bucket + DynamoDB lock table (`backend.tf`, bucket name via variable; document one-time bootstrap in README).
- Modules:
  - **network**: VPC, 2 public + 2 private subnets across 2 AZs, NAT gateway (1, cost-aware, variable to disable), security groups (ALB->api only, tasks->redis only).
  - **ecr**: repo `autonomous-agentic-support-service`, scan on push, lifecycle policy keep last 15 images.
  - **alb**: ALB, target group (health check `/api/v1/health`), HTTP->HTTPS redirect, HTTPS listener using ACM cert ARN from variable `acm_certificate_arn` (if empty, HTTP only for testing).
  - **ecs**: cluster, task definitions for `api` and `worker`, services, deployment circuit breaker with rollback ENABLED, autoscaling on CPU 60% (api min 1 max 4, worker min 1 max 3), awslogs to CloudWatch (retention 14 days).
  - **redis**: ElastiCache Redis 7 (single node `cache.t4g.micro`), variable `create_elasticache` (default true). If false, use `REDIS_URL` from Secrets Manager.
  - **rds** (optional): variable `create_rds` default **false**. If false, `DATABASE_URL` comes from Secrets Manager (user provided).
  - **secrets**: Secrets Manager entries (values set manually by the user, NOT in Terraform state): `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL` (only if external).
  - **iam**: task execution role (pull ECR, read secrets), task role (least privilege), GitHub OIDC provider + deploy role trusted only for repo `vishalkumar2501/autonomous-agentic-support-service` on branch `main`.
  - **monitoring**: CloudWatch alarms (api 5xx > 5/min, unhealthy hosts, CPU > 80%, worker queue stuck) + SNS email topic (variable `alert_email`).
- Non-secret env (NODE_ENV, PORT, LLM_PROVIDER, LLM_MODEL, AGENT_MAX_STEPS, HIGH_VALUE_THRESHOLD) go in task definition `environment`; secrets go in `secrets` (valueFrom Secrets Manager).
- Add `tags` (Project, Env) on every resource. Env variable `environment` (dev|prod).

### 16.2 Dockerfile requirements
- Multi-stage: `deps` -> `build` (tsc + `prisma generate`) -> `runtime` (node:20-alpine, only prod deps, non-root user `node`, `tini` as init).
- Copy `prisma/` and `dist/`. Expose 4000. `HEALTHCHECK` hitting `/api/v1/health`.
- Default CMD: `node dist/server.js`. Worker uses command override `node dist/worker.js`.
- `.dockerignore`: node_modules, dist, .git, .env*, tests, coverage, infra, docs.
- Image tags: `<git-sha>` and `latest`. Never deploy `latest` only.

### 16.3 CI workflow (`.github/workflows/ci.yml`)
Triggers: pull_request and push to any branch except main.
Steps: checkout -> setup-node 20 (npm cache) -> `npm ci` -> lint -> typecheck -> `prisma generate` -> tests with service containers (postgres:16, redis:7) and `prisma migrate deploy` -> coverage upload -> `docker build` (no push) -> Trivy image scan (fail on CRITICAL) -> `terraform fmt -check` and `terraform validate` (working dir infra/terraform).
Use a mocked LLM; CI must not need real API keys.

### 16.4 CD workflow (`.github/workflows/cd.yml`)
Trigger: push to `main` (and manual `workflow_dispatch`). Permissions: `id-token: write`, `contents: read`. Concurrency group so deploys don't overlap.
1. Run the same checks as CI (reuse via `workflow_call` or repeat the job).
2. Configure AWS credentials via **OIDC** (`aws-actions/configure-aws-credentials`) using `vars.AWS_ROLE_ARN` and `vars.AWS_REGION`.
3. Login to ECR, build and push image tagged with `${{ github.sha }}` and `latest`.
4. Run DB migration as a one-off ECS task (`aws ecs run-task` using the same image, command `sh scripts/migrate.sh`), wait for exit code 0, fail pipeline otherwise.
5. Render new task definitions (`aws-actions/amazon-ecs-render-task-definition`) for `api` and `worker` with the new image, deploy both (`aws-actions/amazon-ecs-deploy-task-definition`) with `wait-for-service-stability: true`.
6. Smoke test: `curl` the ALB `/api/v1/health` (URL from `vars.APP_URL`), retry 10 times, fail if not 200.
7. On failure: ECS circuit breaker auto-rolls back; the workflow prints the rollback notice.
GitHub repo variables to document in README: `AWS_ROLE_ARN`, `AWS_REGION`, `ECS_CLUSTER`, `ECS_API_SERVICE`, `ECS_WORKER_SERVICE`, `ECR_REPOSITORY`, `APP_URL`, `PRIVATE_SUBNET_IDS`, `TASK_SECURITY_GROUP_ID`. No AWS access keys in GitHub secrets.

### 16.5 Production hardening (must implement)
- `trust proxy` enabled in Express (behind ALB), correct client IP for rate limiting.
- Graceful shutdown on SIGTERM (ECS stop): stop accepting, drain, close worker, prisma, redis within 30s.
- JSON logs to stdout only (CloudWatch picks them up).
- `/api/v1/health` (liveness) and `/api/v1/ready` (db + redis check).
- Prisma connection pool limit set via env `DB_POOL_MAX` (default 10).
- BullMQ worker: concurrency from env `WORKER_CONCURRENCY` (default 3), failed job retries with backoff, dead-letter handling to `AgentRun.status=FAILED`.
- CORS origin whitelist from env `CORS_ORIGINS`.

### 16.6 Docs to produce
- `README.md`: local run, env, testing, Docker, deploy steps.
- `docs/DEPLOYMENT.md`: step by step AWS first-time setup:
  1. Bootstrap Terraform state bucket + lock table
  2. `terraform init/plan/apply`
  3. Put secret values in Secrets Manager (AWS CLI commands)
  4. Set GitHub repo variables
  5. Push to main and watch CD
  6. How to rollback manually, view logs, scale
  7. Estimated monthly cost notes (NAT, Fargate, ElastiCache) and how to reduce
- `docs/ARCHITECTURE.md`: Mermaid diagrams for agent flow AND AWS infra.

### 16.7 Extra env vars (add to `.env.example`)
```
DB_POOL_MAX=10
WORKER_CONCURRENCY=3
CORS_ORIGINS=http://localhost:3000
TRUST_PROXY=1
```

### 16.8 Build order addition (after Phase 12)
13. **Dockerfile, .dockerignore, docker-compose** (api, worker, postgres, redis) and verify local `docker compose up`.
14. **CI workflow.**
15. **Terraform modules** (`terraform fmt` + `validate` must pass; do NOT run `apply` yourself).
16. **CD workflow + docs/DEPLOYMENT.md.**
Commit and push after each phase (Section 15).

### 16.9 Agent restrictions for deployment
- NEVER run `terraform apply`, `terraform destroy`, or any AWS CLI command that creates/deletes resources. Only write the files and `validate`. The user will apply manually.
- NEVER put real AWS account IDs, keys or secrets in any file. Use variables and placeholders.
