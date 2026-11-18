import { UserRole } from '../config/constants';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
      idempotencyKey?: string;
    }
  }
}
