import Frame from '../models/Frame.js';
import cloudinaryService from '../services/cloudinaryService.js';
import ocrService from '../services/ocrService.js';
import cropService from '../services/cropService.js';
import pdfService from '../services/pdfService.js';
import visionService from '../services/visionService.js';

/**
 * Media Controller
 * Handles image/PDF uploads, cropping, and OCR processing
 */

/**
 * Upload image
 * POST /api/media/upload-image
 */
export const uploadImage = async (req, res) => {
    console.log('📸 uploadImage controller called');
    try {
        const { lectureId } = req.body;
        const userId = req.user._id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }

        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.upload(req.file.buffer, {
            folder: 'ayursetu/images',
            resourceType: 'image',
        });

        // Create Frame document
        const frame = await Frame.create({
            createdBy: userId,
            lectureId: lectureId || null,
            sourceType: 'image',
            sourceUrl: uploadResult.url,
            status: 'queued',
            dimensions: {
                width: uploadResult.width,
                height: uploadResult.height,
            },
            fileSize: uploadResult.bytes,
            mimeType: req.file.mimetype,
        });

        // Process OCR immediately and wait for completion
        await processImageImmediately(frame._id, uploadResult.url);

        // Fetch the updated frame with OCR data
        const processedFrame = await Frame.findById(frame._id);

        res.status(201).json({
            success: true,
            data: {
                frameId: processedFrame._id,
                previewUrl: uploadResult.url,
                status: processedFrame.status,
                ocrText: processedFrame.ocrText,
                ocrRaw: processedFrame.ocrRaw,
                ocrConfidence: processedFrame.ocrConfidence,
                conceptTags: processedFrame.conceptTags,
                difficulty: processedFrame.difficulty,
            },
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
            error: error.message,
        });
    }
};

/**
 * Upload PDF
 * POST /api/media/upload-pdf
 */
export const uploadPdf = async (req, res) => {
    try {
        const { lectureId } = req.body;
        const userId = req.user._id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No PDF file provided',
            });
        }

        // Upload PDF to Cloudinary
        const uploadResult = await cloudinaryService.upload(req.file.buffer, {
            folder: 'ayursetu/pdfs',
            resourceType: 'raw',
        });

        // Get PDF metadata
        const metadata = await pdfService.getMetadata(req.file.buffer);

        // Create parent PDF frame
        const pdfFrame = await Frame.create({
            createdBy: userId,
            lectureId: lectureId || null,
            sourceType: 'pdf_page', // Will be parent
            sourceUrl: uploadResult.url,
            status: 'processing',
            fileSize: uploadResult.bytes,
            mimeType: req.file.mimetype,
        });

        // Process PDF immediately and wait for completion
        const pageFrames = await processPdfImmediately(pdfFrame._id, req.file.buffer, userId, lectureId);

        res.status(201).json({
            success: true,
            data: {
                pdfId: pdfFrame._id,
                pageCount: metadata.pageCount,
                frames: pageFrames,
                status: 'completed',
            },
        });
    } catch (error) {
        console.error('Upload PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload PDF',
            error: error.message,
        });
    }
};

/**
 * Extract crop from image/PDF page
 * POST /api/media/extract-crop
 */
export const extractCrop = async (req, res) => {
    try {
        const { frameId, x, y, width, height, scale = 1 } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!frameId || x === undefined || y === undefined || !width || !height) {
            return res.status(400).json({
                success: false,
                message: 'Missing required crop parameters',
            });
        }

        // Get source frame
        const sourceFrame = await Frame.findOne({ _id: frameId, createdBy: userId });
        if (!sourceFrame) {
            return res.status(404).json({
                success: false,
                message: 'Frame not found',
            });
        }

        // Download source image
        const axios = (await import('axios')).default;
        const imageResponse = await axios.get(sourceFrame.sourceUrl, {
            responseType: 'arraybuffer',
        });
        const imageBuffer = Buffer.from(imageResponse.data);

        // Crop image
        const croppedBuffer = await cropService.cropImage(imageBuffer, {
            x,
            y,
            width,
            height,
            scale,
        });

        // Upload crop to Cloudinary
        const uploadResult = await cloudinaryService.upload(croppedBuffer, {
            folder: 'ayursetu/crops',
            resourceType: 'image',
        });

        // Create crop frame
        const cropFrame = await Frame.create({
            createdBy: userId,
            lectureId: sourceFrame.lectureId,
            sourceType: 'crop',
            sourceUrl: sourceFrame.sourceUrl,
            cropUrl: uploadResult.url,
            pdfId: sourceFrame._id,
            cropCoordinates: { x, y, width, height, scale },
            status: 'queued',
            dimensions: {
                width: uploadResult.width,
                height: uploadResult.height,
            },
            fileSize: uploadResult.bytes,
        });

        // Process crop
        processImageImmediately(cropFrame._id, uploadResult.url);

        res.status(201).json({
            success: true,
            data: {
                cropFrameId: cropFrame._id,
                cropUrl: uploadResult.url,
                status: 'queued',
            },
        });
    } catch (error) {
        console.error('Extract crop error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to extract crop',
            error: error.message,
        });
    }
};

/**
 * Get frame by ID
 * GET /api/frames/:id
 */
export const getFrame = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const frame = await Frame.findOne({ _id: id, createdBy: userId });

        if (!frame) {
            return res.status(404).json({
                success: false,
                message: 'Frame not found',
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...frame.toObject(),
                previewUrl: frame.sourceUrl,
            },
        });
    } catch (error) {
        console.error('Get frame error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get frame',
            error: error.message,
        });
    }
};

/**
 * Get PDF pages
 * GET /api/frames/:id/pages
 */
export const getPdfPages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const pages = await Frame.find({
            pdfId: id,
            createdBy: userId,
        }).sort({ pageNumber: 1 });

        const pagesWithPreview = pages.map(page => ({
            ...page.toObject(),
            previewUrl: page.sourceUrl,
        }));

        res.status(200).json({
            success: true,
            data: pagesWithPreview,
        });
    } catch (error) {
        console.error('Get PDF pages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get PDF pages',
            error: error.message,
        });
    }
};

/**
 * Get user's past uploads
 * GET /api/media/my-uploads
 */
export const getUserUploads = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 20 } = req.query;

        const skip = (page - 1) * limit;

        // Find user's frames, excluding child PDF pages and failed uploads
        const frames = await Frame.find({
            createdBy: userId,
            parentPdfId: { $exists: false }, // Exclude individual PDF pages
            status: { $ne: 'failed' },
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('sourceUrl mimeType createdAt status frameType pageNumber sourceType');

        const total = await Frame.countDocuments({
            createdBy: userId,
            parentPdfId: { $exists: false },
            status: { $ne: 'failed' },
        });

        // Map frames to include previewUrl
        const uploads = frames.map(frame => ({
            ...frame.toObject(),
            previewUrl: frame.sourceUrl,
        }));

        res.status(200).json({
            success: true,
            data: {
                uploads,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('Get user uploads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch uploads',
            error: error.message,
        });
    }
};

/**
 * Extract text from specific region of an image
 * POST /api/media/extract-region
 */
export const extractTextFromRegion = async (req, res) => {
    try {
        const { frameId, x, y, width, height } = req.body;
        const userId = req.user._id;

        // Validate inputs
        if (!frameId || x === undefined || y === undefined || width === undefined || height === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: frameId, x, y, width, height',
            });
        }

        // Find frame and verify ownership
        const frame = await Frame.findById(frameId);
        if (!frame) {
            return res.status(404).json({
                success: false,
                message: 'Frame not found',
            });
        }

        if (frame.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to frame',
            });
        }

        // If frame doesn't have OCR data yet, run OCR first
        if (!frame.ocrRaw || !frame.ocrRaw.words || frame.ocrRaw.words.length === 0) {
            console.log(`🔄 Frame ${frameId} has no OCR data, running OCR first...`);
            const ocrResult = await ocrService.extractText(frame.previewUrl);

            // Update frame with OCR data
            frame.ocrText = ocrResult.text;
            frame.ocrRaw = ocrResult.raw;
            frame.ocrConfidence = ocrResult.confidence;
            frame.status = 'completed';
            await frame.save();
        }

        // Filter words within the specified region
        const selectedWords = (frame.ocrRaw.words || []).filter(word => {
            if (!word.bbox) return false;

            // Calculate word center
            const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
            const centerY = (word.bbox.y0 + word.bbox.y1) / 2;

            // Check if center is within the region
            return (
                centerX >= x &&
                centerX <= x + width &&
                centerY >= y &&
                centerY <= y + height
            );
        });

        const extractedText = selectedWords.map(w => w.text).join(' ');

        console.log(`✅ Extracted ${selectedWords.length} words from region:`, extractedText.substring(0, 100));

        res.status(200).json({
            success: true,
            data: {
                text: extractedText,
                wordCount: selectedWords.length,
                region: { x, y, width, height },
            },
        });
    } catch (error) {
        console.error('Extract region error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to extract text from region',
            error: error.message,
        });
    }
};

// Helper functions (in production, these would be worker jobs)

async function processImageImmediately(frameId, imageUrl) {
    try {
        console.log(`🔄 Processing frame ${frameId}...`);

        const frame = await Frame.findById(frameId);
        if (!frame) return;

        frame.status = 'processing';
        await frame.save();

        // Run OCR
        const ocrResult = await ocrService.extractText(imageUrl);

        // Extract concepts (optional)
        let concepts = { conceptTags: [], difficulty: 'unknown' };
        try {
            concepts = await visionService.extractConcepts(imageUrl, ocrResult.text);
        } catch (err) {
            console.warn('Concept extraction failed:', err.message);
        }

        // Update frame
        frame.ocrText = ocrResult.text;
        frame.ocrRaw = ocrResult.raw;
        frame.ocrConfidence = ocrResult.confidence;
        frame.conceptTags = concepts.conceptTags;
        frame.difficulty = concepts.difficulty;
        frame.status = 'completed';
        frame.processedAt = new Date();
        await frame.save();

        console.log(`✅ Frame ${frameId} processed successfully`);
        return frame; // Return processed frame
    } catch (error) {
        console.error(`❌ Frame ${frameId} processing failed:`, error);
        await Frame.findByIdAndUpdate(frameId, {
            status: 'failed',
            processingError: error.message,
        });
        return null;
    }
}

async function processPdfImmediately(pdfFrameId, pdfBuffer, userId, lectureId) {
    try {
        console.log(`📄 Processing PDF ${pdfFrameId}...`);

        // Convert PDF to images
        const pages = await pdfService.convertToImages(pdfBuffer);

        const pageFrames = [];

        for (const page of pages) {
            // Upload page image
            const uploadResult = await cloudinaryService.upload(page.imageBuffer, {
                folder: 'ayursetu/pdf-pages',
                resourceType: 'image',
            });

            // Create page frame
            const pageFrame = await Frame.create({
                createdBy: userId,
                lectureId,
                sourceType: 'pdf_page',
                sourceUrl: uploadResult.url,
                pdfId: pdfFrameId,
                pageNumber: page.pageNumber,
                status: 'queued',
                dimensions: {
                    width: page.width,
                    height: page.height,
                },
            });

            // Process each page and wait for OCR
            const processedFrame = await processImageImmediately(pageFrame._id, uploadResult.url);

            if (processedFrame) {
                pageFrames.push({
                    ...processedFrame.toObject(),
                    previewUrl: processedFrame.sourceUrl,
                });
            } else {
                pageFrames.push({
                    pageNumber: page.pageNumber,
                    frameId: pageFrame._id,
                    previewUrl: uploadResult.url,
                    status: 'failed'
                });
            }
        }

        // Update parent PDF frame
        await Frame.findByIdAndUpdate(pdfFrameId, {
            status: 'completed',
            processedAt: new Date(),
        });

        console.log(`✅ PDF ${pdfFrameId} processed: ${pages.length} pages`);
        return pageFrames;

    } catch (error) {
        console.error(`❌ PDF ${pdfFrameId} processing failed:`, error);
        await Frame.findByIdAndUpdate(pdfFrameId, {
            status: 'failed',
            processingError: error.message,
        });
        return [];
    }
}
/**
 * Delete frame
 * DELETE /api/media/frames/:id
 */
export const deleteFrame = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const frame = await Frame.findOne({ _id: id, createdBy: userId });

        if (!frame) {
            return res.status(404).json({
                success: false,
                message: 'Frame not found',
            });
        }

        // If it's a PDF, delete all child pages
        if (frame.sourceType === 'pdf_page' && !frame.parentPdfId) {
            await Frame.deleteMany({ pdfId: id });
        }

        // Delete the frame itself
        await Frame.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Frame deleted successfully',
        });
    } catch (error) {
        console.error('Delete frame error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete frame',
            error: error.message,
        });
    }
};
