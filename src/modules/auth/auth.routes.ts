import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.schema';

const router = Router();

// Public routes for user registration, authentication, and token refreshing
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);

export const authRouter = router;
