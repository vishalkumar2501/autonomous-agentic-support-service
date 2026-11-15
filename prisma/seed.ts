import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function seed() {
  console.log('--- Starting Database Seeding ---');

  // Clean existing tables in reverse dependency order
  await prisma.escalation.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.replacementOrder.deleteMany();
  await prisma.agentStep.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing records.');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Create Users
  const customer = await prisma.user.create({
    data: {
      id: 'usr-customer-001',
      email: 'customer@example.com',
      passwordHash,
      name: 'Rahul Customer',
      role: Role.CUSTOMER,
    },
  });

  const otherCustomer = await prisma.user.create({
    data: {
      id: 'usr-customer-002',
      email: 'priya@example.com',
      passwordHash,
      name: 'Priya Sharma',
      role: Role.CUSTOMER,
    },
  });

  const agent = await prisma.user.create({
    data: {
      id: 'usr-agent-001',
      email: 'agent@example.com',
      passwordHash,
      name: 'Sneha Support Agent',
      role: Role.AGENT,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: 'usr-admin-001',
      email: 'admin@example.com',
      passwordHash,
      name: 'Amit Admin',
      role: Role.ADMIN,
    },
  });

  console.log('Created Users:', { customer: customer.email, agent: agent.email, admin: admin.email });

  // 2. Create 6 Products
  const earbuds = await prisma.product.create({
    data: {
      id: 'prd-001',
      name: 'Wireless Earbuds Pro',
      sku: 'PRD-EARBUDS',
      price: 2499.0,
      warrantyMonths: 12,
      returnWindowDays: 14,
    },
  });

  const smartwatch = await prisma.product.create({
    data: {
      id: 'prd-002',
      name: 'Smart Fitness Watch',
      sku: 'PRD-SMARTWATCH',
      price: 4999.0,
      warrantyMonths: 12,
      returnWindowDays: 14,
    },
  });

  const headphones = await prisma.product.create({
    data: {
      id: 'prd-003',
      name: 'Studio ANC Headphones',
      sku: 'PRD-HEADPHONES',
      price: 7999.0,
      warrantyMonths: 24,
      returnWindowDays: 30,
    },
  });

  const laptop = await prisma.product.create({
    data: {
      id: 'prd-004',
      name: 'UltraBook 15 Pro',
      sku: 'PRD-LAPTOP',
      price: 65000.0,
      warrantyMonths: 24,
      returnWindowDays: 14,
    },
  });

  const cable = await prisma.product.create({
    data: {
      id: 'prd-005',
      name: 'Braided USB-C Cable',
      sku: 'PRD-CABLE',
      price: 499.0,
      warrantyMonths: 6,
      returnWindowDays: 7,
    },
  });

  const keyboard = await prisma.product.create({
    data: {
      id: 'prd-006',
      name: 'Mechanical Gaming Keyboard',
      sku: 'PRD-KEYBOARD',
      price: 3499.0,
      warrantyMonths: 12,
      returnWindowDays: 14,
    },
  });

  console.log('Created 6 Products.');

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 3. Create 8 Orders covering all scenarios
  // Scenario 1: Inside return window (delivered 3 days ago, return window is 14 days)
  await prisma.order.create({
    data: {
      id: 'ord-1001',
      orderNumber: 'ORD-1001',
      userId: customer.id,
      status: OrderStatus.DELIVERED,
      totalAmount: 2499.0,
      orderedAt: daysAgo(5),
      deliveredAt: daysAgo(3),
      items: {
        create: [{ productId: earbuds.id, quantity: 1, unitPrice: earbuds.price }],
      },
    },
  });

  // Scenario 2: Outside return window (delivered 45 days ago) but inside warranty (12 months = ~365 days)
  await prisma.order.create({
    data: {
      id: 'ord-1002',
      orderNumber: 'ORD-1002',
      userId: customer.id,
      status: OrderStatus.DELIVERED,
      totalAmount: 4999.0,
      orderedAt: daysAgo(50),
      deliveredAt: daysAgo(45),
      items: {
        create: [{ productId: smartwatch.id, quantity: 1, unitPrice: smartwatch.price }],
      },
    },
  });

  // Scenario 3: Outside both return window and warranty (delivered 400 days ago, warranty is 12 months)
  await prisma.order.create({
    data: {
      id: 'ord-1003',
      orderNumber: 'ORD-1003',
      userId: customer.id,
      status: OrderStatus.DELIVERED,
      totalAmount: 3499.0,
      orderedAt: daysAgo(405),
      deliveredAt: daysAgo(400),
      items: {
        create: [{ productId: keyboard.id, quantity: 1, unitPrice: keyboard.price }],
      },
    },
  });

  // Scenario 4: Already refunded order (status REFUNDED, has existing Refund record)
  const order1004 = await prisma.order.create({
    data: {
      id: 'ord-1004',
      orderNumber: 'ORD-1004',
      userId: customer.id,
      status: OrderStatus.REFUNDED,
      totalAmount: 499.0,
      orderedAt: daysAgo(12),
      deliveredAt: daysAgo(10),
      items: {
        create: [{ productId: cable.id, quantity: 1, unitPrice: cable.price }],
      },
    },
  });

  // Placeholder ticket and run for prior refund record
  const dummyTicket = await prisma.ticket.create({
    data: {
      id: 'tkt-prior-refund',
      userId: customer.id,
      orderId: order1004.id,
      message: 'Initial defective cable request',
      status: 'RESOLVED',
    },
  });

  const dummyRun = await prisma.agentRun.create({
    data: {
      id: 'run-prior-refund',
      ticketId: dummyTicket.id,
      status: 'COMPLETED',
      decision: 'REFUND',
      finalMessage: 'Refund processed successfully',
      idempotencyKey: 'idemp-seed-prior-refund',
    },
  });

  await prisma.refund.create({
    data: {
      id: 'ref-seed-1004',
      orderId: order1004.id,
      amount: 499.0,
      status: 'COMPLETED',
      reason: 'Prior refund already processed',
      runId: dummyRun.id,
    },
  });

  // Scenario 5: High-value order (> Rs. 20,000 threshold), delivered 5 days ago
  await prisma.order.create({
    data: {
      id: 'ord-1005',
      orderNumber: 'ORD-1005',
      userId: customer.id,
      status: OrderStatus.DELIVERED,
      totalAmount: 65000.0,
      orderedAt: daysAgo(7),
      deliveredAt: daysAgo(5),
      items: {
        create: [{ productId: laptop.id, quantity: 1, unitPrice: laptop.price }],
      },
    },
  });

  // Scenario 6: Delivered-not-yet order (status: SHIPPED, deliveredAt: null)
  await prisma.order.create({
    data: {
      id: 'ord-1006',
      orderNumber: 'ORD-1006',
      userId: customer.id,
      status: OrderStatus.SHIPPED,
      totalAmount: 7999.0,
      orderedAt: daysAgo(2),
      deliveredAt: null,
      items: {
        create: [{ productId: headphones.id, quantity: 1, unitPrice: headphones.price }],
      },
    },
  });

  // Scenario 7: Someone else's order (belongs to Priya Sharma / otherCustomer)
  await prisma.order.create({
    data: {
      id: 'ord-1007',
      orderNumber: 'ORD-1007',
      userId: otherCustomer.id,
      status: OrderStatus.DELIVERED,
      totalAmount: 7999.0,
      orderedAt: daysAgo(6),
      deliveredAt: daysAgo(4),
      items: {
        create: [{ productId: headphones.id, quantity: 1, unitPrice: headphones.price }],
      },
    },
  });

  // Scenario 8: Multi-item order delivered 8 days ago
  await prisma.order.create({
    data: {
      id: 'ord-1008',
      orderNumber: 'ORD-1008',
      userId: customer.id,
      status: OrderStatus.DELIVERED,
      totalAmount: 2998.0,
      orderedAt: daysAgo(10),
      deliveredAt: daysAgo(8),
      items: {
        create: [
          { productId: earbuds.id, quantity: 1, unitPrice: earbuds.price },
          { productId: cable.id, quantity: 1, unitPrice: cable.price },
        ],
      },
    },
  });

  console.log('Seeded 8 orders covering all business scenarios.');
  console.log('--- Database Seeding Completed Successfully ---');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error('Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
