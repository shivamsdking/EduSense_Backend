import express from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/auth.js';
import {
    uploadImage,
    uploadPdf,
    extractCrop,
    getFrame,
    getUserUploads,
    getPdfPages,
    deleteFrame,
} from '../controllers/media.controller.js';
import { askImageQuestion } from '../controllers/askController.js';

const router = express.Router();

console.log('✅ Media routes loaded');

router.get('/test', (req, res) => {
    res.json({ message: 'Media routes working' });
});

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and PDFs
        const allowedMimes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF allowed.'));
        }
    },
});

/**
 * @route   POST /api/media/upload-image
 * @desc    Upload image for OCR processing
 * @access  Private
 */
router.post('/upload-image', authenticateUser, upload.single('file'), uploadImage);

/**
 * @route   POST /api/media/upload-pdf
 * @desc    Upload PDF for page extraction and OCR
 * @access  Private
 */
router.post('/upload-pdf', authenticateUser, upload.single('file'), uploadPdf);

/**
 * @route   POST /api/media/extract-crop
 * @desc    Extract and process crop from image/PDF page
 * @access  Private
 */
router.post('/extract-crop', authenticateUser, extractCrop);

/**
 * @route   POST /api/ask/image
 * @desc    Ask question based on uploaded image frame
 * @access  Private
 */
router.post('/ask/image', authenticateUser, askImageQuestion);

/**
 * @route   GET /api/frames/:id
 * @desc    Get frame metadata by ID
 * @access  Private
 */
router.get('/frames/:id', authenticateUser, getFrame);

/**
 * @route   GET /api/media/my-uploads
 * @desc    Get user's past uploads
 * @access  Private
 */
router.get('/my-uploads', authenticateUser, getUserUploads);

/**
 * @route   GET /api/frames/:id/pages
 * @desc    Get pages for a PDF frame
 * @access  Private
 */
router.get('/frames/:id/pages', authenticateUser, getPdfPages);

/**
 * @route   DELETE /api/media/frames/:id
 * @desc    Delete a frame
 * @access  Private
 */
router.delete('/frames/:id', authenticateUser, deleteFrame);

export default router;
