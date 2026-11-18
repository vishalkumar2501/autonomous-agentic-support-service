export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Autonomous Agentic Support Service API',
    version: '1.0.0',
    description:
      'Enterprise autonomous AI customer support service with tool calling, business guardrails, and audit trail.',
    contact: {
      name: 'Vishal Kumar',
      url: 'https://github.com/vishalkumar2501/autonomous-agentic-support-service',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 base path',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token to authenticate.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              statusCode: { type: 'number' },
              details: { type: 'object', nullable: true },
              requestId: { type: 'string' },
            },
          },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', example: 'customer@example.com' },
          password: { type: 'string', minLength: 8, example: 'Password@123' },
          name: { type: 'string', example: 'Vishal Kumar' },
          role: { type: 'string', enum: ['CUSTOMER', 'AGENT', 'ADMIN'], default: 'CUSTOMER' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'customer@example.com' },
          password: { type: 'string', example: 'Password@123' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
      CreateTicketInput: {
        type: 'object',
        required: ['message'],
        properties: {
          orderId: { type: 'string', example: 'ord-1001-id', nullable: true },
          message: { type: 'string', example: 'My order ORD-1001 was delivered damaged.' },
        },
      },
      StartRunInput: {
        type: 'object',
        required: ['ticketId'],
        properties: {
          ticketId: { type: 'string', format: 'uuid' },
        },
      },
      ResolveEscalationInput: {
        type: 'object',
        required: ['resolution'],
        properties: {
          resolution: { type: 'string', minLength: 5, example: 'Replacement order created and approved.' },
          decision: { type: 'string', enum: ['REFUND', 'REPLACEMENT', 'REJECT'] },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness health check',
        responses: {
          200: { description: 'Service is live and healthy' },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'Readiness check for database connectivity',
        responses: {
          200: { description: 'Service is ready to handle traffic' },
          503: { description: 'Database dependency is unready' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new customer or agent',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } },
        },
        responses: {
          201: { description: 'User registered successfully' },
          400: { description: 'Validation error' },
          409: { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user with email and password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          200: { description: 'Logged in successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token using refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token refreshed successfully' },
          401: { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/orders': {
      get: {
        summary: 'Get all orders belonging to authenticated customer',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'List of customer orders' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/orders/{orderNumber}': {
      get: {
        summary: 'Get order details with items by orderNumber',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'orderNumber', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Order details' },
          403: { description: 'Forbidden if order belongs to another customer' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/tickets': {
      post: {
        summary: 'Create support complaint ticket',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTicketInput' } } },
        },
        responses: {
          201: { description: 'Ticket created successfully' },
          403: { description: 'Forbidden if order belongs to another customer' },
        },
      },
    },
    '/tickets/{id}': {
      get: {
        summary: 'Get ticket with customer and latest agent run',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Ticket details' },
          404: { description: 'Ticket not found' },
        },
      },
    },
    '/agent/runs': {
      post: {
        summary: 'Trigger autonomous agent run for a complaint ticket',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StartRunInput' } } },
        },
        responses: {
          202: { description: 'Agent run accepted and queued' },
          403: { description: 'Forbidden if ticket belongs to another customer' },
        },
      },
    },
    '/agent/runs/{id}': {
      get: {
        summary: 'Get agent run status and final structured decision',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Agent run status and result' },
          404: { description: 'Run not found' },
        },
      },
    },
    '/agent/runs/{id}/steps': {
      get: {
        summary: 'Get step-by-step audit trail of agent thoughts, tool calls, and guardrail validations',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Ordered list of audit steps' },
          404: { description: 'Run not found' },
        },
      },
    },
    '/agent/runs/{id}/stream': {
      get: {
        summary: 'Server-Sent Events (SSE) live stream of agent steps and final decision',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Live event stream (text/event-stream)' },
        },
      },
    },
    '/escalations': {
      get: {
        summary: 'List human agent escalation queues (AGENT / ADMIN only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['PENDING', 'RESOLVED'] } },
        ],
        responses: {
          200: { description: 'List of escalations' },
          403: { description: 'Forbidden for CUSTOMER role' },
        },
      },
    },
    '/escalations/{id}/resolve': {
      post: {
        summary: 'Resolve ticket escalation by human agent (AGENT / ADMIN only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResolveEscalationInput' } } },
        },
        responses: {
          200: { description: 'Escalation resolved successfully' },
          400: { description: 'Validation failure or already resolved' },
          403: { description: 'Forbidden for CUSTOMER role' },
        },
      },
    },
  },
};
