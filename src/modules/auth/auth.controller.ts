import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';

export class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body);
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  });
}

export const authController = new AuthController();
