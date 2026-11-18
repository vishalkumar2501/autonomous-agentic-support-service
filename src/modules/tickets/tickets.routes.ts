import { Router } from 'express';
import { ticketsController } from './tickets.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware';
import { createTicketSchema, getTicketParamsSchema } from './tickets.schema';

const router = Router();

router.use(authenticate);

// WHY: Prevent duplicate ticket creations if the customer experiences network timeouts or retries
router.post('/', idempotencyMiddleware, validate(createTicketSchema), ticketsController.createTicket);
router.get('/', ticketsController.getMyTickets);
router.get('/:id', validate(getTicketParamsSchema), ticketsController.getTicketById);

export const ticketsRouter = router;
