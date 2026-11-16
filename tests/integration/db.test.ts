import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../src/db/prisma';

describe('Database Connectivity and Seeded Records (Phase 2)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can query seeded users', async () => {
    const users = await prisma.user.findMany();
    expect(users.length).toBeGreaterThanOrEqual(4);
    const emails = users.map((u) => u.email);
    expect(emails).toContain('customer@example.com');
    expect(emails).toContain('agent@example.com');
    expect(emails).toContain('admin@example.com');
  });

  it('can query seeded products', async () => {
    const products = await prisma.product.findMany();
    expect(products.length).toBe(6);
    const skus = products.map((p) => p.sku);
    expect(skus).toContain('PRD-EARBUDS');
    expect(skus).toContain('PRD-LAPTOP');
  });

  it('can query seeded orders covering scenarios', async () => {
    const orders = await prisma.order.findMany({
      include: { items: true },
    });
    expect(orders.length).toBe(8);
    const orderNumbers = orders.map((o) => o.orderNumber);
    expect(orderNumbers).toContain('ORD-1001'); // Inside return window
    expect(orderNumbers).toContain('ORD-1002'); // In warranty only
    expect(orderNumbers).toContain('ORD-1003'); // Outside both
    expect(orderNumbers).toContain('ORD-1004'); // Already refunded
    expect(orderNumbers).toContain('ORD-1005'); // High value
    expect(orderNumbers).toContain('ORD-1006'); // Shipped not delivered
    expect(orderNumbers).toContain('ORD-1007'); // Other user order
  });
});
