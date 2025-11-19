// src/config/env.ts
// Environment variable validation using Zod
// Ensures all required environment variables are present and valid at startup

import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url({
    message: 'FRONTEND_URL must be a valid URL',
  }),

  // Database
  DATABASE_URL: z.string().url({
    message: 'DATABASE_URL must be a valid PostgreSQL connection string',
  }),

  // JWT Authentication
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters for security',
  }),
  JWT_EXPIRATION: z.string().default('7d'),

  // Azure Computer Vision API
  AZURE_VISION_KEY: z.string().min(32, {
    message: 'AZURE_VISION_KEY must be a valid Azure API key',
  }),
  AZURE_VISION_ENDPOINT: z.string().url({
    message: 'AZURE_VISION_ENDPOINT must be a valid Azure endpoint URL',
  }),

  // File Storage
  UPLOAD_DIR: z
    .string()
    .min(1, {
      message: 'UPLOAD_DIR must be a valid directory path',
    })
    .refine(
      (dirPath) => {
        try {
          // Resolve to absolute path
          const absolutePath = path.isAbsolute(dirPath)
            ? dirPath
            : path.resolve(process.cwd(), dirPath);
          const stat = fs.statSync(absolutePath);
          return stat.isDirectory();
        } catch {
          return false;
        }
      },
      { message: 'UPLOAD_DIR must be an existing directory' }
    )
    .refine(
      (dirPath) => {
        try {
          // Check if directory is writable
          const absolutePath = path.isAbsolute(dirPath)
            ? dirPath
            : path.resolve(process.cwd(), dirPath);
          fs.accessSync(absolutePath, fs.constants.W_OK);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'UPLOAD_DIR must be writable' }
    ),
  THUMBNAIL_DIR: z
    .string()
    .min(1, {
      message: 'THUMBNAIL_DIR must be a valid directory path',
    })
    .refine(
      (dirPath) => {
        try {
          // Resolve to absolute path
          const absolutePath = path.isAbsolute(dirPath)
            ? dirPath
            : path.resolve(process.cwd(), dirPath);
          const stat = fs.statSync(absolutePath);
          return stat.isDirectory();
        } catch {
          return false;
        }
      },
      { message: 'THUMBNAIL_DIR must be an existing directory' }
    )
    .refine(
      (dirPath) => {
        try {
          // Check if directory is writable
          const absolutePath = path.isAbsolute(dirPath)
            ? dirPath
            : path.resolve(process.cwd(), dirPath);
          fs.accessSync(absolutePath, fs.constants.W_OK);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'THUMBNAIL_DIR must be writable' }
    ),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(26214400), // 25MB in bytes
});

// Infer TypeScript type from Zod schema
export type Env = z.infer<typeof envSchema>;

// Parse and validate environment variables
// This will throw an error if validation fails, preventing the app from starting with invalid config
let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment variable validation failed:');
    console.error(
      error.issues.map((err) => `  - ${err.path.join('.')}: ${err.message}`).join('\n')
    );
    process.exit(1);
  }
  throw error;
}

export { env };
