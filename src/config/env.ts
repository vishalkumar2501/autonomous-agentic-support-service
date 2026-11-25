import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isTest = process.env.NODE_ENV === 'test';

// Schema to strictly validate all runtime environment variables on startup
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default(isTest ? 'postgresql://test:test@localhost:5432/test_db' : ''),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
    .default(isTest ? 'test_jwt_access_secret_key_32_chars_long' : ''),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters')
    .default(isTest ? 'test_jwt_refresh_secret_key_32_chars_long' : ''),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  LLM_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  GOOGLE_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().default('gemini-2.0-flash'),
  LLM_TEMPERATURE: z.coerce.number().default(0),
  AGENT_MAX_STEPS: z.coerce.number().default(8),
  HIGH_VALUE_THRESHOLD: z.coerce.number().default(20000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
  DB_POOL_MAX: z.coerce.number().default(10),
  WORKER_CONCURRENCY: z.coerce.number().default(3),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  TRUST_PROXY: z.coerce.number().default(1),
  RUN_WORKER_IN_PROCESS: z.coerce.boolean().default(false),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Fail fast on startup if configuration is invalid
  const formattedErrors = parsedEnv.error.format();
  // eslint-disable-next-line no-console
  console.error('CRITICAL: Invalid environment configuration:', JSON.stringify(formattedErrors, null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
