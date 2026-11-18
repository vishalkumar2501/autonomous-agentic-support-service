import { Router } from 'express';
import { listEscalationsHandler, resolveEscalationHandler } from './escalations.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { getEscalationsSchema, resolveEscalationSchema } from './escalations.schema';
import { USER_ROLES } from '../../config/constants';

const router = Router();

// WHY: Escalation management is restricted to customer support agents and admins (Section 6).
router.use(authenticate);
router.use(authorize(USER_ROLES.AGENT, USER_ROLES.ADMIN));

router.get(
  '/',
  validate(getEscalationsSchema),
  listEscalationsHandler,
);

router.post(
  '/:id/resolve',
  validate(resolveEscalationSchema),
  resolveEscalationHandler,
);

export const escalationsRouter = router;
