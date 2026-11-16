import { Request, Response } from 'express';
import { ordersService } from './orders.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export class OrdersController {
  getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const orders = await ordersService.getMyOrders(req.user.id);
    res.status(200).json({
      success: true,
      data: orders,
    });
  });

  getOrderDetail = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const orderNumber = req.params.orderNumber as string;
    const order = await ordersService.getOrderByNumber(orderNumber, req.user);
    res.status(200).json({
      success: true,
      data: order,
    });
  });
}

export const ordersController = new OrdersController();
