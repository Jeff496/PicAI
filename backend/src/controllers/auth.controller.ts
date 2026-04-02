// src/controllers/auth.controller.ts
// Authentication controller — most auth logic moved to frontend via Supabase JS client
// Backend only provides profile lookup and logout

import type { Request, Response } from 'express';

/**
 * Get current user profile
 *
 * GET /auth/me
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * The authenticateJWT middleware verifies the Supabase token and
 * auto-creates a local user record if needed, then attaches it to req.user.
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_USER',
    });
    return;
  }

  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      profilePictureUrl: req.user.profilePictureUrl,
    },
  });
};

/**
 * Logout user
 *
 * POST /auth/logout
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Server-side cleanup endpoint. Supabase session is cleared client-side.
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
};
