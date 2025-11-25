import express from 'express';
import {
    askTextQuestion,
    getMyDoubts,
    getDoubtById,
    toggleBookmark,
    rateDoubt,
    getUserStats,
    generateStudyMaterial,
    deleteDoubt,
    generateDiagram,
} from '../controllers/askController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Ask a question
router.post('/text', askTextQuestion);

// Get user's doubts
router.get('/my', getMyDoubts);

// Get user statistics
router.get('/stats', getUserStats);

// Get specific doubt
router.get('/:id', getDoubtById);

// Toggle bookmark
router.post('/:id/bookmark', toggleBookmark);

// Rate doubt
router.post('/:id/rate', rateDoubt);

// Delete doubt
router.delete('/:id', deleteDoubt);

// Generate diagram
router.post('/:id/diagram', generateDiagram);

// Generate study material
router.post('/study', generateStudyMaterial);

export default router;
