import mongoose from 'mongoose';

/**
 * Frame Schema
 * Stores metadata for uploaded images, PDF pages, and crops
 * Used for OCR text extraction, embeddings, and doubt context
 */
const frameSchema = new mongoose.Schema(
    {
        // Reference to lecture (optional - can be standalone upload)
        lectureId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lecture',
            default: null,
        },

        // Type of frame
        sourceType: {
            type: String,
            enum: ['image', 'pdf_page', 'crop'],
            required: true,
        },

        // Cloudinary URLs
        sourceUrl: {
            type: String,
            required: true,
        },
        cropUrl: {
            type: String,
            default: null,
        },

        // PDF-specific metadata
        pageNumber: {
            type: Number,
            default: null,
        },
        pdfId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Frame', // Reference to parent PDF frame
            default: null,
        },

        // Crop coordinates (if this is a crop)
        cropCoordinates: {
            x: Number,
            y: Number,
            width: Number,
            height: Number,
            scale: Number,
        },

        // OCR Results
        ocrText: {
            type: String,
            default: '',
        },
        ocrRaw: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        ocrConfidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
        },

        // Embeddings (vector IDs in Qdrant)
        embeddingsIds: {
            type: [String],
            default: [],
        },

        // AI-extracted concepts
        conceptTags: {
            type: [String],
            default: [],
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard', 'unknown'],
            default: 'unknown',
        },

        // Processing status
        status: {
            type: String,
            enum: ['queued', 'processing', 'completed', 'failed'],
            default: 'queued',
        },
        processingError: {
            type: String,
            default: null,
        },

        // Metadata
        fileSize: Number,
        mimeType: String,
        dimensions: {
            width: Number,
            height: Number,
        },

        // User who uploaded
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // Timestamps
        processedAt: Date,
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
frameSchema.index({ createdBy: 1, createdAt: -1 });
frameSchema.index({ lectureId: 1, pageNumber: 1 });
frameSchema.index({ status: 1 });
frameSchema.index({ sourceType: 1 });

// Virtual for formatted processing time
frameSchema.virtual('processingTime').get(function () {
    if (this.processedAt && this.createdAt) {
        return this.processedAt - this.createdAt;
    }
    return null;
});

// Method to check if frame is ready for asking
frameSchema.methods.isReady = function () {
    return this.status === 'completed' && this.embeddingsIds.length > 0;
};

// Static method to get user's frames
frameSchema.statics.getUserFrames = function (userId, options = {}) {
    const { limit = 20, skip = 0, sourceType = null } = options;
    const query = { createdBy: userId };

    if (sourceType) {
        query.sourceType = sourceType;
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('-ocrRaw -__v');
};

const Frame = mongoose.model('Frame', frameSchema);

export default Frame;
