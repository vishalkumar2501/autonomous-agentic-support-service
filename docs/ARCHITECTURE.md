# Autonomous Agentic Support Service - System Architecture

This document provides a comprehensive architectural breakdown of the **Autonomous Agentic Support Service**, an enterprise autonomous customer support service featuring LangGraph-powered state machines, tool-calling agents, deterministic business guardrails in code, BullMQ asynchronous processing, and an AWS ECS deployment topology.

---

## 1. High-Level System Architecture

The service follows a strict **Layered Architecture**:
- **Presentation Layer**: Express 4 routes, input validation middleware (Zod), JWT authentication & RBAC, idempotency headers, Helmet security, and rate limiting.
- **Controller Layer**: Decoupled HTTP handlers extracting parameters and returning uniform JSON responses.
- **Service Layer**: Business workflows, BullMQ queue dispatch, and SSE live step broadcasting.
- **Agent Orchestration**: LangGraph state machine with 5 core nodes, versioned system prompts, and tool calling.
- **Guardrails Engine**: Enforces deterministic financial thresholds, cross-user ownership verification, and security boundaries in TypeScript before and during tool calls.
- **Repository & Data Access**: Prisma ORM with connection pooling, transactional consistency, and Redis caching.

```mermaid
flowchart TD
    Client["Client / Customer Browser / Postman"]
    
    subgraph ExpressAPI ["Express API Gateway (Port 4000)"]
        MW["Security & Auth Middlewares<br/>(Helmet, CORS, RateLimiter, JWT RBAC, Idempotency)"]
        Routes["API Routes<br/>(/auth, /orders, /tickets, /agent, /escalations)"]
        Controllers["Controllers & Zod Validators"]
    end

    subgraph AsyncWorker ["BullMQ Asynchronous Worker"]
        AgentQueue["BullMQ Queue (support-agent-runs)"]
        WorkerProcess["Worker Process (node dist/worker.js)"]
    end

    subgraph AgentStateMachine ["LangGraph Agent Engine"]
        LoadContext["1. loadContext Node"]
        AgentNode["2. agentNode (LLM Reasoner)"]
        GuardrailsNode["3. guardrailCheck Node"]
        ToolExecutorNode["4. toolExecutor Node"]
        FinalizeNode["5. finalizeDecision Node"]
    end

    subgraph StorageInfrastructure ["Data & Caching Tier"]
        Postgres[(PostgreSQL 16/18<br/>Prisma ORM)]
        Redis[(Redis 7 Cache & Queue)]
    end

    Client -->|HTTP / REST| MW
    MW --> Routes
    Routes --> Controllers
    Controllers -->|Queue Job 202 Accepted| AgentQueue
    AgentQueue -->|Redis Backend| Redis
    WorkerProcess -->|Pulls Job| AgentQueue
    WorkerProcess --> LoadContext
    LoadContext --> AgentNode
    AgentNode --> GuardrailsNode
    GuardrailsNode --> ToolExecutorNode
    ToolExecutorNode --> AgentNode
    GuardrailsNode -->|Escalate / Complete| FinalizeNode
    AgentNode -->|Final Decision| FinalizeNode
    FinalizeNode --> Postgres
    ToolExecutorNode --> Postgres
    ToolExecutorNode --> Redis
    Client -.->|SSE Stream /stream| Controllers
```

---

## 2. LangGraph Agent State Machine

The autonomous support agent operates on a cyclical state machine built with **LangGraph**:
1. **`loadContext`**: Loads customer and complaint ticket from PostgreSQL. Executes heuristic prompt-injection guardrails.
2. **`agentNode`**: Invokes the LLM (Gemini 2.0 Flash or OpenAI) with 9 structured service tool definitions. Enforces max iterations (`AGENT_MAX_STEPS`).
3. **`guardrailCheck`**: Deterministic TypeScript code inspecting every planned tool call before execution:
   - Validates that the customer owns the requested order (`order.userId === ticket.userId`).
   - Validates that refund amounts do not exceed the order total.
   - Blocks refunds exceeding `HIGH_VALUE_THRESHOLD` (₹20,000) and redirects to human escalation.
   - Enforces prerequisites (`checkReturnEligibility` before `initiateRefund`; `checkWarrantyStatus` before `createReplacementOrder`).
   - Limits refunds to a maximum of 1 per run.
4. **`toolExecutor`**: Executes authorized tools, records latency and parameters into `AgentStep` audit logs, and appends `ToolMessage` results back to LLM context.
5. **`finalizeDecision`**: Validates structured output schema (`AgentDecisionOutput`), records final audit step, updates `AgentRun.status`, and creates human review in `Escalation` table if escalated.

```mermaid
flowchart TD
    Start([Job Started from BullMQ]) --> LoadContext["loadContext Node<br/>Load Ticket & Customer Profile"]
    
    LoadContext --> CheckInjection{"Prompt Injection<br/>Detected?"}
    CheckInjection -- Yes --> ForceEscalate["Set forceEscalate = true<br/>Reason: Prompt injection pattern"]
    ForceEscalate --> FinalizeNode["finalizeDecision Node<br/>Persist Final AgentRun & Step"]
    
    CheckInjection -- No --> AgentNode["agentNode<br/>Invoke LLM with Tools"]
    
    AgentNode --> CheckMaxSteps{"Iterations ><br/>AGENT_MAX_STEPS?"}
    CheckMaxSteps -- Yes --> ExceededSteps["Set forceEscalate = true<br/>Reason: Max iterations exceeded"]
    ExceededSteps --> FinalizeNode
    
    CheckMaxSteps -- No --> HasToolCalls{"LLM Returned<br/>Tool Calls?"}
    
    HasToolCalls -- No --> FinalizeNode
    
    HasToolCalls -- Yes --> GuardrailCheck["guardrailCheck Node<br/>Evaluate Code Guardrails"]
    
    GuardrailCheck --> GuardrailPassed{"All Guardrails<br/>Passed?"}
    GuardrailPassed -- No (Violation) --> EscalateGuardrail["Log AgentStep (GUARDRAIL)<br/>Trigger Human Escalation"]
    EscalateGuardrail --> FinalizeNode
    
    GuardrailPassed -- Yes --> ToolExecutor["toolExecutor Node<br/>Execute Service Tools"]
    ToolExecutor --> PersistStep["Log AgentStep (TOOL_RESULT)<br/>Append to State Messages"]
    PersistStep --> AgentNode

    FinalizeNode --> PersistResult["Save AgentRun (COMPLETED / NEEDS_HUMAN)<br/>Update Ticket Status"]
    PersistResult --> End([Done])
```

---

## 3. End-to-End Request & Event Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant API as Express API
    participant Queue as BullMQ (Redis)
    participant Worker as Background Worker
    participant Graph as LangGraph Engine
    participant Guardrails as Code Guardrails
    participant DB as PostgreSQL (Prisma)

    Customer->>API: POST /api/v1/tickets (Create complaint with Idempotency-Key)
    API->>DB: Insert Ticket (Status: OPEN)
    API-->>Customer: 201 Created (ticketId)

    Customer->>API: POST /api/v1/agent/runs { ticketId }
    API->>DB: Insert AgentRun (Status: QUEUED)
    API->>Queue: Add Job to BullMQ
    API-->>Customer: 202 Accepted { runId, status: "QUEUED" }

    Customer->>API: GET /api/v1/agent/runs/:id/stream (SSE)
    API-->>Customer: HTTP 200 text/event-stream (event: connected)

    Queue->>Worker: Dequeue Job (runId, ticketId)
    Worker->>Graph: Execute AgentGraphBuilder
    Graph->>DB: loadContext & update AgentRun (Status: RUNNING)
    
    Graph->>Graph: agentNode (LLM decides tool calls)
    Graph->>Guardrails: Validate tool calls against business rules
    Guardrails-->>Graph: Approved / Escalate
    Graph->>DB: Execute tool & persist AgentStep (TOOL_RESULT)
    API-->>Customer: event: step (AgentStep payload)

    Graph->>DB: finalizeDecision (Status: COMPLETED / NEEDS_HUMAN)
    API-->>Customer: event: complete (final decision, message)
    Customer->>API: GET /api/v1/agent/runs/:id/steps (Inspect full audit trail)
    API-->>Customer: 200 OK (Array of all chronological AgentSteps)
```

---

## 4. AWS Cloud Production Architecture

The application is deployed on AWS following secure, cost-optimized best practices:
- **Networking**: VPC across 2 Availability Zones (`ap-south-1`), 2 public subnets (ALB & NAT), 2 private subnets (ECS & ElastiCache).
- **Application Load Balancer (ALB)**: Terminating SSL/TLS with ACM certificate, routing HTTP to HTTPS, forward to ECS task target group with `/api/v1/health` health checks.
- **ECS Fargate Services**:
  - `api` service: Autoscaling from 1 to 4 tasks based on 60% CPU utilization.
  - `worker` service: Autoscaling from 1 to 3 tasks running `node dist/worker.js`.
- **Database & Secrets**: Managed via AWS Secrets Manager with zero secrets in source control or Terraform state files.
- **Monitoring**: CloudWatch log streams with 14-day retention, 5xx error alarms, high CPU alarms, and SNS email notifications.

```mermaid
flowchart LR
    Internet((Internet / HTTPS)) --> ALB[Application Load Balancer]
    
    subgraph VPC ["AWS Virtual Private Cloud (VPC)"]
        subgraph PublicSubnets ["Public Subnets (AZ-a / AZ-b)"]
            ALB
            NAT[NAT Gateway]
        end
        
        subgraph PrivateSubnets ["Private Subnets (AZ-a / AZ-b)"]
            subgraph ECSCluster ["Amazon ECS Fargate Cluster"]
                APIService["ECS Service: api<br/>(Task Def: node dist/server.js)"]
                WorkerService["ECS Service: worker<br/>(Task Def: node dist/worker.js)"]
            end
            
            Cache[(Amazon ElastiCache Redis 7)]
            DB[(External PostgreSQL / RDS)]
        end
    end
    
    ALB -->|Port 4000| APIService
    APIService -->|Queue Jobs| Cache
    WorkerService -->|Consume Jobs| Cache
    APIService --> DB
    WorkerService --> DB
    WorkerService -->|Outbound LLM API calls| NAT
    NAT --> Internet
    
    SecretsManager[(AWS Secrets Manager)] -.->|Injected as Env| APIService
    SecretsManager -.->|Injected as Env| WorkerService
    
    APIService --> CloudWatch[(CloudWatch Logs & Alarms)]
    WorkerService --> CloudWatch
```

---

## 5. Summary of Decision Policies & Guardrails

| Guardrail Rule | Condition / Threshold | Action Taken |
|---|---|---|
| **Prompt Injection** | Regex matches malicious override patterns | Blocks run, logs GUARDRAIL step, forces `escalateToHuman` |
| **Cross-User Ownership** | `order.userId !== ticket.userId` | Blocks tool, logs security violation, forces `escalateToHuman` |
| **Max Refund Limit** | `run.refundCount >= 1` | Blocks subsequent refunds in the same run |
| **Refund Amount Cap** | `refund.amount > order.totalAmount` | Blocks refund, notifies LLM of invalid amount |
| **High Value Transaction** | `refund.amount > HIGH_VALUE_THRESHOLD` (₹20,000) | Blocks automatic refund, forces `escalateToHuman` |
| **Prerequisite Check: Refund** | `initiateRefund` called without prior `checkReturnEligibility` | Blocks refund with prerequisite error |
| **Prerequisite Check: Replacement** | `createReplacementOrder` without `checkWarrantyStatus` or `checkReturnEligibility` | Blocks replacement with prerequisite error |
| **Max Step Iterations** | `iterations > AGENT_MAX_STEPS` (8) | Halts cycle, marks run `NEEDS_HUMAN`, triggers human queue |
