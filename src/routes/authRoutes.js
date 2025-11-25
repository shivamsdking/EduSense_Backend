import express from 'express';
import {
    verifyFirebaseToken,
    getCurrentUser,
    logout,
    updatePasswordStatus,
} from '../controllers/authController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/verify-token', verifyFirebaseToken);

// Protected routes
router.get('/me', authenticateUser, getCurrentUser);
router.post('/logout', authenticateUser, logout);
router.post('/update-password-status', authenticateUser, updatePasswordStatus);

export default router;
