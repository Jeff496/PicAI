// src/middleware/auth.middleware.ts
// JWT authentication middleware using Supabase Auth
// Verifies Supabase JWT via network call and auto-creates local user records

import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import prisma from '../prisma/client.js';
import logger from '../utils/logger.js';

/**
 * Authentication middleware for Supabase JWT verification
 *
 * Workflow:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies token via supabase.auth.getUser() (network call, catches revoked tokens)
 * 3. Looks up or auto-creates local user record by Supabase user ID
 * 4. Attaches user object to req.user
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN',
    });
    return;
  }

  const token = authHeader.substring(7);

  let supabaseUser;
  let error;

  try {
    ({ data: { user: supabaseUser }, error } = await supabase.auth.getUser(token));
  } catch (e) {
    logger.error('Supabase token verification failed', {
      error: e instanceof Error ? e.message : 'Unknown error',
      requestId: req.id,
    });
    res.status(503).json({
      success: false,
      error: 'Authentication service temporarily unavailable',
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
    return;
  }

  if (error || !supabaseUser) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // Upsert local user — handles first OAuth login and avoids race conditions
  // when concurrent requests arrive for a new user
  const user = await prisma.user.upsert({
    where: { id: supabaseUser.id },
    update: {},
    create: {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
    },
  });

  req.user = user;
  next();
};
