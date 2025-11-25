import geminiClient from '../llm/groqClient.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Embedder Service
 * Handles text chunking and embedding generation
 */
class Embedder {
    constructor() {
        this.chunkSize = 400; // Target tokens per chunk
        this.overlapSize = 50; // Overlap between chunks
        this.avgCharsPerToken = 4; // Approximate chars per token
    }

    /**
     * Split text into overlapping chunks
     * @param {string} text - Text to chunk
     * @param {Object} metadata - Metadata for chunks
     * @returns {Array} - Array of text chunks
     */
    chunkText(text, metadata = {}) {
        const chunkSizeChars = this.chunkSize * this.avgCharsPerToken;
        const overlapChars = this.overlapSize * this.avgCharsPerToken;

        const chunks = [];
        let startIndex = 0;

        while (startIndex < text.length) {
            const endIndex = Math.min(startIndex + chunkSizeChars, text.length);
            const chunkText = text.substring(startIndex, endIndex).trim();

            if (chunkText.length > 0) {
                chunks.push({
                    id: uuidv4(),
                    text: chunkText,
                    metadata: {
                        ...metadata,
                        chunkIndex: chunks.length,
                        startChar: startIndex,
                        endChar: endIndex,
                    },
                });
            }

            // Move start index with overlap
            startIndex = endIndex - overlapChars;

            // Prevent infinite loop
            if (startIndex >= text.length - overlapChars) {
                break;
            }
        }

        return chunks;
    }

    /**
     * Generate embedding for a single text
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} - Embedding vector
     */
    async generateEmbedding(text) {
        try {
            return await geminiClient.generateEmbedding(text);
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple chunks
     * @param {Array} chunks - Array of chunk objects
     * @returns {Promise<Array>} - Chunks with embeddings
     */
    async embedChunks(chunks) {
        try {
            const embeddedChunks = await Promise.all(
                chunks.map(async (chunk) => {
                    const embedding = await this.generateEmbedding(chunk.text);
                    return {
                        ...chunk,
                        embedding,
                    };
                })
            );

            return embeddedChunks;
        } catch (error) {
            console.error('Error embedding chunks:', error);
            throw error;
        }
    }

    /**
     * Process document: chunk and embed
     * @param {string} text - Document text
     * @param {Object} metadata - Document metadata
     * @returns {Promise<Array>} - Embedded chunks ready for Qdrant
     */
    async processDocument(text, metadata = {}) {
        try {
            console.log('Chunking document...');
            const chunks = this.chunkText(text, metadata);
            console.log(`Created ${chunks.length} chunks`);

            console.log('Generating embeddings...');
            const embeddedChunks = await this.embedChunks(chunks);
            console.log('✅ Embeddings generated');

            return embeddedChunks;
        } catch (error) {
            console.error('Error processing document:', error);
            throw error;
        }
    }

    /**
     * Embed a single query (no chunking)
     * @param {string} query - Query text
     * @returns {Promise<number[]>} - Query embedding
     */
    async embedQuery(query) {
        try {
            return await this.generateEmbedding(query);
        } catch (error) {
            console.error('Error embedding query:', error);
            throw error;
        }
    }
}

export default new Embedder();
