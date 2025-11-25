import express from 'express';
import { getLeaderboard, getUserStats } from '../controllers/userController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.get('/leaderboard', getLeaderboard); // Public or protected? Let's make it public for now
router.get('/stats', authenticateUser, getUserStats);

export default router;
