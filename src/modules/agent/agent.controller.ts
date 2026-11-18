import { Request, Response } from 'express';
import { agentService } from './agent.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export class AgentController {
  startRun = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const idempotencyHeader = req.headers['idempotency-key'] as string | undefined;
    const result = await agentService.startRun(req.body, req.user, idempotencyHeader);

    // Section 5.1 & Section 6: API returns 202 Accepted + runId
    res.status(202).json({
      success: true,
      message: 'Agent run initiated successfully',
      data: result,
    });
  });

  getRun = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const run = await agentService.getRunById(req.params.id as string, req.user);
    res.status(200).json({
      success: true,
      data: run,
    });
  });

  getRunSteps = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const steps = await agentService.getRunSteps(req.params.id as string, req.user);
    res.status(200).json({
      success: true,
      data: steps,
    });
  });

  streamRun = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    await agentService.streamRun(req.params.id as string, req.user, req, res);
  });
}

export const agentController = new AgentController();
