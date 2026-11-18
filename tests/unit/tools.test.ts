import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../src/db/prisma';
import {
  executeGetOrderDetails,
  executeGetCustomerProfile,
  executeCheckReturnEligibility,
  executeCheckWarrantyStatus,
  executeCreateReturnLabel,
  executeInitiateRefund,
  executeCreateReplacementOrder,
  executeSendNotification,
  executeEscalateToHuman,
  ToolContext,
} from '../../src/modules/agent/tools';

describe('Agent Tools Unit Tests (Phase 5)', () => {
  const customerId = 'usr-customer-001';
  let dummyTicketId = '';
  let refundTestOrderNumber = '';
  const testRunId = `run-unit-tool-test-${Date.now()}`;

  const context: ToolContext = {
    userId: customerId,
    ticketId: '',
    runId: testRunId,
  };

  beforeAll(async () => {
    // Create dedicated test order for refund testing
    refundTestOrderNumber = `ORD-REF-${Date.now()}`;
    await prisma.order.create({
      data: {
        orderNumber: refundTestOrderNumber,
        userId: customerId,
        status: 'DELIVERED',
        totalAmount: 2000.0,
        deliveredAt: new Date(),
      },
    });

    // Ensure an agent run and ticket exist in DB for foreign key constraints on refund/escalation
    const ticket = await prisma.ticket.create({
      data: {
        userId: customerId,
        message: 'Unit test complaint ticket',
      },
    });
    dummyTicketId = ticket.id;
    context.ticketId = ticket.id;

    await prisma.agentRun.create({
      data: {
        id: testRunId,
        ticketId: ticket.id,
        status: 'RUNNING',
        idempotencyKey: `idemp-tool-test-${Date.now()}`,
      },
    });
  });

  // 1. getOrderDetails
  describe('getOrderDetails', () => {
    it('returns order details for customer owned order (ORD-1001)', async () => {
      const res = await executeGetOrderDetails({ orderNumber: 'ORD-1001' }, context);
      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty('orderNumber', 'ORD-1001');
      expect(res.data).toHaveProperty('items');
    });

    it('rejects access to another customer order (ORD-1007)', async () => {
      const res = await executeGetOrderDetails({ orderNumber: 'ORD-1007' }, context);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Security violation');
    });

    it('returns error for non-existent order', async () => {
      const res = await executeGetOrderDetails({ orderNumber: 'ORD-NON-EXISTENT' }, context);
      expect(res.success).toBe(false);
      expect(res.error).toContain('not found');
    });
  });

  // 2. getCustomerProfile
  describe('getCustomerProfile', () => {
    it('returns customer profile with past refund count', async () => {
      const res = await executeGetCustomerProfile({ userId: customerId }, context);
      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty('userId', customerId);
      expect(res.data).toHaveProperty('tier');
      expect(res.data).toHaveProperty('pastRefundCount');
    });

    it('rejects access to another user profile', async () => {
      const res = await executeGetCustomerProfile({ userId: 'usr-customer-002' }, context);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Security violation');
    });
  });

  // 3. checkReturnEligibility
  describe('checkReturnEligibility', () => {
    it('ORD-1001 (delivered 3 days ago) is eligible for return', async () => {
      const res = await executeCheckReturnEligibility({ orderNumber: 'ORD-1001' }, context);
      expect(res.success).toBe(true);
      expect((res.data as { eligible: boolean }).eligible).toBe(true);
      expect((res.data as { daysLeft: number }).daysLeft).toBeGreaterThan(0);
    });

    it('ORD-1002 (delivered 45 days ago) is NOT eligible for return', async () => {
      const res = await executeCheckReturnEligibility({ orderNumber: 'ORD-1002' }, context);
      expect(res.success).toBe(true);
      expect((res.data as { eligible: boolean }).eligible).toBe(false);
    });

    it('ORD-1006 (shipped, not delivered) is NOT eligible for return', async () => {
      const res = await executeCheckReturnEligibility({ orderNumber: 'ORD-1006' }, context);
      expect(res.success).toBe(true);
      expect((res.data as { eligible: boolean }).eligible).toBe(false);
    });

    it('ORD-1004 (already refunded) is NOT eligible for return', async () => {
      const res = await executeCheckReturnEligibility({ orderNumber: 'ORD-1004' }, context);
      expect(res.success).toBe(true);
      expect((res.data as { eligible: boolean }).eligible).toBe(false);
    });
  });

  // 4. checkWarrantyStatus
  describe('checkWarrantyStatus', () => {
    it('ORD-1002 (delivered 45 days ago, 12 month warranty) is IN warranty', async () => {
      const res = await executeCheckWarrantyStatus({ orderNumber: 'ORD-1002' }, context);
      expect(res.success).toBe(true);
      expect((res.data as { inWarranty: boolean }).inWarranty).toBe(true);
    });

    it('ORD-1003 (delivered 400 days ago, 12 month warranty) is OUT of warranty', async () => {
      const res = await executeCheckWarrantyStatus({ orderNumber: 'ORD-1003' }, context);
      expect(res.success).toBe(true);
      expect((res.data as { inWarranty: boolean }).inWarranty).toBe(false);
    });
  });

  // 5. createReturnLabel
  describe('createReturnLabel', () => {
    it('generates a return label for customer order', async () => {
      const res = await executeCreateReturnLabel({ orderNumber: 'ORD-1001' }, context);
      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty('labelId');
      expect(res.data).toHaveProperty('pickupDate');
    });
  });

  // 6. initiateRefund & Idempotency
  describe('initiateRefund', () => {
    it('processes refund and returns idempotently when called multiple times in same run', async () => {
      // First call: creates refund
      const res1 = await executeInitiateRefund(
        { orderNumber: refundTestOrderNumber, amount: 2000.0, reason: 'Defective earbuds and cable' },
        context,
      );
      expect(res1.success).toBe(true);
      expect((res1.data as { idempotent: boolean }).idempotent).toBe(false);
      expect(res1.data).toHaveProperty('refundId');

      // Second call: idempotent return of existing refund
      const res2 = await executeInitiateRefund(
        { orderNumber: refundTestOrderNumber, amount: 2000.0, reason: 'Defective earbuds and cable' },
        context,
      );
      expect(res2.success).toBe(true);
      expect((res2.data as { idempotent: boolean }).idempotent).toBe(true);
      expect((res2.data as { refundId: string }).refundId).toBe(
        (res1.data as { refundId: string }).refundId,
      );
    });
  });

  // 7. createReplacementOrder & Idempotency
  describe('createReplacementOrder', () => {
    it('creates replacement order and returns idempotently', async () => {
      const res1 = await executeCreateReplacementOrder(
        { orderNumber: 'ORD-1002', reason: 'Defective screen replacement under warranty' },
        context,
      );
      expect(res1.success).toBe(true);
      expect((res1.data as { idempotent: boolean }).idempotent).toBe(false);

      const res2 = await executeCreateReplacementOrder(
        { orderNumber: 'ORD-1002', reason: 'Defective screen replacement under warranty' },
        context,
      );
      expect(res2.success).toBe(true);
      expect((res2.data as { idempotent: boolean }).idempotent).toBe(true);
      expect((res2.data as { replacementId: string }).replacementId).toBe(
        (res1.data as { replacementId: string }).replacementId,
      );
    });
  });

  // 8. sendNotification
  describe('sendNotification', () => {
    it('sends customer notification successfully', async () => {
      const res = await executeSendNotification(
        { userId: customerId, channel: 'EMAIL', message: 'Your refund has been initiated' },
        context,
      );
      expect(res.success).toBe(true);
      expect((res.data as { sent: boolean }).sent).toBe(true);
    });

    it('rejects sending notification to a different user', async () => {
      const res = await executeSendNotification(
        { userId: 'usr-customer-002', channel: 'SMS', message: 'Unauthorized message' },
        context,
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('Security violation');
    });
  });

  // 9. escalateToHuman & Idempotency
  describe('escalateToHuman', () => {
    it('creates escalation record and updates ticket status idempotently', async () => {
      const res1 = await executeEscalateToHuman(
        { ticketId: dummyTicketId, reason: 'High value defect requires human verification' },
        context,
      );
      expect(res1.success).toBe(true);
      expect((res1.data as { idempotent: boolean }).idempotent).toBe(false);

      const res2 = await executeEscalateToHuman(
        { ticketId: dummyTicketId, reason: 'High value defect requires human verification' },
        context,
      );
      expect(res2.success).toBe(true);
      expect((res2.data as { idempotent: boolean }).idempotent).toBe(true);
    });

    it('rejects escalation for mismatched ticket ID', async () => {
      const res = await executeEscalateToHuman(
        { ticketId: 'different-ticket-id', reason: 'Mismatch test' },
        context,
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('Security violation');
    });
  });
});
