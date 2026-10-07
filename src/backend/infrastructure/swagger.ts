import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sakani API — نظام إدارة السكن الطلابي',
      version: '1.0.0',
      description: 'توثيق واجهات API لنظام إدارة السكن الطلابي (DormMaster)',
    },
    servers: [
      { url: '/api', description: 'الخادم الرئيسي' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
      },
    },
    paths: {},
  },
  apis: ['./src/backend/api/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
