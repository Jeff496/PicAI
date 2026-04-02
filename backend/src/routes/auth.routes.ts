// src/routes/auth.routes.ts
// Authentication routes — simplified for Supabase Auth
// Register/login/refresh handled by Supabase JS client on frontend

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /auth/me
 *
 * Get current authenticated user profile.
 * Middleware verifies Supabase token and auto-creates local user if needed.
 */
router.get('/me', authenticateJWT, authController.getCurrentUser);

/**
 * POST /auth/logout
 *
 * Server-side logout endpoint.
 * Supabase session is cleared client-side; this is for optional server cleanup.
 */
router.post('/logout', authenticateJWT, authController.logout);

export default router;
