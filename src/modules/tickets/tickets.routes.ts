import { Router } from 'express';
import { ticketsController } from './tickets.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createTicketSchema, getTicketParamsSchema } from './tickets.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(createTicketSchema), ticketsController.createTicket);
router.get('/', ticketsController.getMyTickets);
router.get('/:id', validate(getTicketParamsSchema), ticketsController.getTicketById);

export const ticketsRouter = router;
