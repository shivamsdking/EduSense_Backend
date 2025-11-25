import askService from '../ai/services/askService.js';

/**
 * Ask Controller
 * Handles HTTP requests for doubt-solving
 */

/**
 * Ask a text-based question
 * POST /api/ask/text
 */
export const askTextQuestion = async (req, res) => {
    try {
        const { questionText, subject, tags } = req.body;
        const userId = req.user._id;

        // Validation
        if (!questionText || questionText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Question text is required',
            });
        }

        if (questionText.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Question is too long (max 1000 characters)',
            });
        }

        // Process question
        const result = await askService.askTextQuestion(questionText, userId, {
            subject,
            tags,
        });

        // Emit Socket.IO event (if io is available)
        if (req.app.get('io')) {
            req.app.get('io').to(userId.toString()).emit('doubt:new', result);
        }

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error in askTextQuestion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process question',
            error: error.message,
        });
    }
}


/**
 * Ask an image-based question
 * POST /api/ask/image
 */
export const askImageQuestion = async (req, res) => {
    try {
        const { frameId, questionText } = req.body;
        const userId = req.user._id;

        // Validation
        if (!frameId) {
            return res.status(400).json({
                success: false,
                message: 'Frame ID is required',
            });
        }

        if (!questionText || questionText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Question text is required',
            });
        }

        // Process question
        const result = await askService.askImageQuestion(frameId, questionText, userId);

        // Emit Socket.IO event
        if (req.app.get('io')) {
            req.app.get('io').to(userId.toString()).emit('doubt:new', result);
        }

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error in askImageQuestion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process image question',
            error: error.message,
        });
    }
};

/**
 * Get user's doubt history
 * GET /api/doubts/my
 */
export const getMyDoubts = async (req, res) => {
    try {
        const userId = req.user._id;
        const { limit, skip, subject, bookmarked } = req.query;

        const options = {
            limit: parseInt(limit) || 20,
            skip: parseInt(skip) || 0,
            subject: subject || null,
            bookmarked: bookmarked === 'true' ? true : bookmarked === 'false' ? false : null,
        };

        const doubts = await askService.getUserDoubts(userId, options);

        res.status(200).json({
            success: true,
            count: doubts.length,
            data: doubts,
        });
    } catch (error) {
        console.error('Error in getMyDoubts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch doubts',
            error: error.message,
        });
    }
};

/**
 * Get a single doubt by ID
 * GET /api/doubts/:id
 */
export const getDoubtById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const doubt = await askService.getDoubtById(id, userId);

        res.status(200).json({
            success: true,
            data: doubt,
        });
    } catch (error) {
        console.error('Error in getDoubtById:', error);
        res.status(404).json({
            success: false,
            message: 'Doubt not found',
            error: error.message,
        });
    }
};

/**
 * Toggle bookmark status
 * POST /api/doubts/:id/bookmark
 */
export const toggleBookmark = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const doubt = await askService.toggleBookmark(id, userId);

        res.status(200).json({
            success: true,
            data: {
                doubtId: doubt._id,
                isBookmarked: doubt.isBookmarked,
            },
        });
    } catch (error) {
        console.error('Error in toggleBookmark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle bookmark',
            error: error.message,
        });
    }
};

/**
 * Rate a doubt answer
 * POST /api/doubts/:id/rate
 */
export const rateDoubt = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, feedback } = req.body;
        const userId = req.user._id;

        // Validation
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5',
            });
        }

        const doubt = await askService.rateDoubt(id, userId, rating, feedback);

        res.status(200).json({
            success: true,
            data: {
                doubtId: doubt._id,
                rating: doubt.rating,
                feedback: doubt.feedback,
            },
        });
    } catch (error) {
        console.error('Error in rateDoubt:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to rate doubt',
            error: error.message,
        });
    }
};

/**
 * Get user statistics
 * GET /api/doubts/stats
 */
export const getUserStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const stats = await askService.getUserStats(userId);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Error in getUserStats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user stats',
            error: error.message,
        });
    }
};

/**
 * Generate study material
 * POST /api/ask/study
 */
export const generateStudyMaterial = async (req, res) => {
    try {
        const { topic, type } = req.body;

        if (!topic || !type) {
            return res.status(400).json({
                success: false,
                message: 'Topic and type are required'
            });
        }

        const content = await askService.generateStudyMaterial(topic, type);

        res.status(200).json({
            success: true,
            data: content
        });
    } catch (error) {
        console.error('Error generating study material:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate study material',
            error: error.message
        });
    }
};

/**
 * Delete a doubt
 * DELETE /api/ask/:id
 */
export const deleteDoubt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await askService.deleteDoubt(id, userId);

        res.status(200).json({
            success: true,
            message: 'Doubt deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting doubt:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete doubt',
            error: error.message
        });
    }
};

/**
 * Generate diagram for a doubt
 * POST /api/ask/:id/diagram
 */
export const generateDiagram = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        const userId = req.user._id;

        if (!type) {
            return res.status(400).json({
                success: false,
                message: 'Diagram type is required'
            });
        }

        const mermaidCode = await askService.generateDiagram(id, userId, type);

        res.status(200).json({
            success: true,
            data: { mermaidCode }
        });
    } catch (error) {
        console.error('Error generating diagram:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate diagram',
            error: error.message
        });
    }
};
