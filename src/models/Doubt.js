import mongoose from 'mongoose';

/**
 * Doubt Schema
 * Stores user questions, AI answers, and retrieved context
 */
const doubtSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        questionText: {
            type: String,
            required: true,
            trim: true,
        },
        answerSteps: {
            type: [String],
            default: [],
        },
        explanation: {
            type: String,
            default: '',
        },
        meta: {
            subject: String,
            topic: String,
            subtopic: String,
            difficulty: {
                type: String,
                enum: ['school', 'easy', 'medium', 'hard', 'competitive', 'college', 'N/A'],
            },
            category: String, // Maps to questionType
            questionType: {
                type: String,
                enum: ['concept', 'numerical', 'programming', 'debugging', 'theory', 'practice', 'proof', 'diagram'],
            },
        },
        followUpQuestions: {
            easy: String,
            medium: String,
            challenge: String,
        },
        mermaidCode: {
            type: String, // For diagrams
            default: '',
        },
        code: {
            language: { type: String, default: null },
            snippet: { type: String, default: null },
        },
        finalAnswer: {
            type: String,
            required: true,
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.8,
        },
        retrievedContext: [
            {
                text: String,
                score: Number,
                metadata: {
                    source: String,
                    subject: String,
                    topic: String,
                    difficulty: String,
                },
            },
        ],
        status: {
            type: String,
            enum: ['answered', 'pending', 'failed'],
            default: 'answered',
        },
        processingTime: {
            type: Number, // milliseconds
            default: 0,
        },
        subject: {
            type: String,
            trim: true,
            index: true,
        },
        tags: {
            type: [String],
            default: [],
        },
        isBookmarked: {
            type: Boolean,
            default: false,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        feedback: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
doubtSchema.index({ userId: 1, createdAt: -1 });
doubtSchema.index({ subject: 1, createdAt: -1 });
doubtSchema.index({ isBookmarked: 1, userId: 1 });
doubtSchema.index({ createdAt: -1 });

// Virtual for formatted date
doubtSchema.virtual('formattedDate').get(function () {
    return this.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
});

// Method to get summary
doubtSchema.methods.getSummary = function () {
    return {
        id: this._id,
        question: this.questionText.substring(0, 100) + (this.questionText.length > 100 ? '...' : ''),
        answer: this.finalAnswer.substring(0, 150) + (this.finalAnswer.length > 150 ? '...' : ''),
        confidence: this.confidence,
        date: this.formattedDate,
        subject: this.subject,
        isBookmarked: this.isBookmarked,
    };
};

// Static method to get user's recent doubts
doubtSchema.statics.getRecentByUser = function (userId, limit = 10) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('-retrievedContext -__v');
};

// Static method to get bookmarked doubts
doubtSchema.statics.getBookmarked = function (userId) {
    return this.find({ userId, isBookmarked: true })
        .sort({ createdAt: -1 })
        .select('-retrievedContext -__v');
};

const Doubt = mongoose.model('Doubt', doubtSchema);

export default Doubt;
