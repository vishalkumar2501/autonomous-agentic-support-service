import { Router } from 'express';
import { agentController } from './agent.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { startRunSchema, getRunParamsSchema } from './agent.schema';

const router = Router();

// All agent endpoints require authentication
router.use(authenticate);

// Start agent execution for a ticket -> 202 Accepted + runId
router.post('/runs', validate(startRunSchema), agentController.startRun);

// Get run status and decision
router.get('/runs/:id', validate(getRunParamsSchema), agentController.getRun);

// Audit trail: full step-by-step history
router.get('/runs/:id/steps', validate(getRunParamsSchema), agentController.getRunSteps);

// Server-Sent Events (SSE) live step stream
router.get('/runs/:id/stream', validate(getRunParamsSchema), agentController.streamRun);

export const agentRouter = router;
