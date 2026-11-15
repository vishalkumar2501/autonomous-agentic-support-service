# Architecture Decisions Record (DECISIONS.md)

This document records architectural, dependency, and design decisions made during the development of the Autonomous Agentic Support Service.

## ADR 1: Database Name Configuration
- **Context**: PROJECT_SPEC.md Section 14 mentioned `agentic_support_db`, but the user's running PostgreSQL instance uses `autonomous-agentic-support-service`.
- **Decision**: Used `autonomous-agentic-support-service` as requested by user prompt and loaded securely via `DATABASE_URL` in `.env`.
- **Date**: 2026-11-15

## ADR 2: Library Additions & Justifications
- **uuid (@types/uuid)**: Used for distributed request tracing (`x-request-id`) across the API and BullMQ worker jobs.
- **hpp (@types/hpp)**: Enforces security against HTTP parameter pollution.
- **pino-pretty**: Used in development and test environments for readable colored logs, while production outputs raw JSON to stdout for CloudWatch ingestion.
- **rimraf**: Cross-platform clean script for `npm run build` (`rimraf dist`).
- **tsx**: Modern zero-config TypeScript runtime for dev servers and database seeding.
- **vitest**: Lightning-fast native ESM/CJS test runner compatible with TypeScript and mocking.

## ADR 3: State Management & LangGraph Node Structure
- **Decision**: Implemented LangGraph state machine with strict message-passing state (`AgentState`). Guardrail checks intercept tool execution before any action node runs, logging `AgentStep` with type `GUARDRAIL` and preventing unauthorized actions.
