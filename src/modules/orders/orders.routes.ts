import { Router } from 'express';
import { ordersController } from './orders.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { getOrderParamsSchema } from './orders.schema';

const router = Router();

// All order endpoints require authentication
router.use(authenticate);

router.get('/', ordersController.getMyOrders);
router.get('/:orderNumber', validate(getOrderParamsSchema), ordersController.getOrderDetail);

export const ordersRouter = router;
