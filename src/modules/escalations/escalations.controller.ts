import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { escalationsService } from './escalations.service';
import { GetEscalationsQuery, ResolveEscalationInput } from './escalations.schema';

export const listEscalationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as GetEscalationsQuery;
  const result = await escalationsService.listEscalations(query);
  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

export const resolveEscalationHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const input = req.body as ResolveEscalationInput;
  const agentId = req.user!.id;

  const result = await escalationsService.resolveEscalation(id!, agentId, input);
  res.status(200).json({
    success: true,
    data: result,
    message: 'Escalation resolved successfully',
  });
});
