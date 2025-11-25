import embedder from './embedder.js';
import qdrantClient from './qdrantClient.js';

/**
 * Retriever Service
 * Handles semantic search and context retrieval for RAG
 */
class Retriever {
    constructor() {
        this.defaultTopK = 5; // Default number of chunks to retrieve
        this.minScore = 0.5; // Minimum similarity score threshold
    }

    /**
     * Retrieve relevant context for a question
     * @param {string} question - User's question
     * @param {number} topK - Number of results to retrieve
     * @param {Object} filter - Optional metadata filter
     * @returns {Promise<Array>} - Retrieved context chunks
     */
    async retrieve(question, topK = this.defaultTopK, filter = null) {
        try {
            console.log(`Retrieving context for: "${question}"`);

            // 1. Embed the question
            const queryEmbedding = await embedder.embedQuery(question);

            // 2. Search Qdrant for similar chunks
            const results = await qdrantClient.search(queryEmbedding, topK, filter);

            // 3. Filter by minimum score
            const filteredResults = results.filter(
                (result) => result.score >= this.minScore
            );

            console.log(
                `✅ Retrieved ${filteredResults.length} relevant chunks (score >= ${this.minScore})`
            );

            return filteredResults;
        } catch (error) {
            console.error('Error retrieving context:', error);
            // Return empty array on error to allow graceful degradation
            return [];
        }
    }

    /**
     * Retrieve with subject filtering
     * @param {string} question - User's question
     * @param {string} subject - Subject to filter by
     * @param {number} topK - Number of results
     * @returns {Promise<Array>} - Retrieved chunks
     */
    async retrieveBySubject(question, subject, topK = this.defaultTopK) {
        const filter = {
            must: [
                {
                    key: 'metadata.subject',
                    match: {
                        value: subject,
                    },
                },
            ],
        };

        return this.retrieve(question, topK, filter);
    }

    /**
     * Retrieve with difficulty filtering
     * @param {string} question - User's question
     * @param {string} difficulty - Difficulty level (easy, medium, hard)
     * @param {number} topK - Number of results
     * @returns {Promise<Array>} - Retrieved chunks
     */
    async retrieveByDifficulty(question, difficulty, topK = this.defaultTopK) {
        const filter = {
            must: [
                {
                    key: 'metadata.difficulty',
                    match: {
                        value: difficulty,
                    },
                },
            ],
        };

        return this.retrieve(question, topK, filter);
    }

    /**
     * Format retrieved chunks for display
     * @param {Array} chunks - Retrieved chunks
     * @returns {Array} - Formatted chunks
     */
    formatChunks(chunks) {
        return chunks.map((chunk, index) => ({
            index: index + 1,
            text: chunk.text,
            score: chunk.score.toFixed(3),
            source: chunk.metadata?.source || 'Unknown',
            subject: chunk.metadata?.subject || 'General',
            topic: chunk.metadata?.topic || 'N/A',
        }));
    }

    /**
     * Get retrieval statistics
     * @param {Array} chunks - Retrieved chunks
     * @returns {Object} - Statistics
     */
    getStats(chunks) {
        if (chunks.length === 0) {
            return {
                count: 0,
                avgScore: 0,
                maxScore: 0,
                minScore: 0,
            };
        }

        const scores = chunks.map((c) => c.score);
        return {
            count: chunks.length,
            avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3),
            maxScore: Math.max(...scores).toFixed(3),
            minScore: Math.min(...scores).toFixed(3),
        };
    }
}

export default new Retriever();
