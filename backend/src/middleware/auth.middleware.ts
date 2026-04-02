// src/middleware/auth.middleware.ts
// JWT authentication middleware using Supabase Auth
// Verifies Supabase JWT via network call and auto-creates local user records

import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import prisma from '../prisma/client.js';

/**
 * Authentication middleware for Supabase JWT verification
 *
 * Workflow:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies token via supabase.auth.getUser() (network call, catches revoked tokens)
 * 3. Looks up local user in database by Supabase user ID
 * 4. Auto-creates local user record if not found (first OAuth login)
 * 5. Attaches user object to req.user
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

  const {
    data: { user: supabaseUser },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !supabaseUser) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // Look up local user by Supabase ID
  let user = await prisma.user.findUnique({ where: { id: supabaseUser.id } });

  if (!user) {
    // Auto-create local user on first authenticated request (e.g. first OAuth login)
    user = await prisma.user.create({
      data: {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
      },
    });
  }

  req.user = user;
  next();
};
