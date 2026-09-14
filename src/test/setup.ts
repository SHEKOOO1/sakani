import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32chars!!';
