import { Request, Response } from 'express';
import { ticketsService } from './tickets.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export class TicketsController {
  createTicket = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const ticket = await ticketsService.createTicket(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Complaint ticket created successfully',
      data: ticket,
    });
  });

  getTicketById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const ticket = await ticketsService.getTicketById(req.params.id as string, req.user);
    res.status(200).json({
      success: true,
      data: ticket,
    });
  });

  getMyTickets = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const tickets = await ticketsService.getMyTickets(req.user.id);
    res.status(200).json({
      success: true,
      data: tickets,
    });
  });
}

export const ticketsController = new TicketsController();
