import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Qdrant Vector Database Client
 * Manages semantic search for educational content
 */
class QdrantService {
    constructor() {
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY,
        });
        this.collectionName = 'academic_chunks';
        this.vectorSize = 1536; // Standard embedding dimension
    }

    /**
     * Initialize the academic_chunks collection
     * Creates collection if it doesn't exist
     */
    async initializeCollection() {
        try {
            // Check if collection exists
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(
                (col) => col.name === this.collectionName
            );

            if (!exists) {
                console.log(`Creating collection: ${this.collectionName}`);
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine', // Cosine similarity for semantic search
                    },
                });
                console.log('✅ Collection created successfully');
            } else {
                console.log(`✅ Collection ${this.collectionName} already exists`);
            }
        } catch (error) {
            console.error('Error initializing collection:', error);
            throw error;
        }
    }

    /**
     * Upsert (insert or update) chunks into Qdrant
     * @param {Array} chunks - Array of chunk objects
     * @returns {Promise<void>}
     */
    async upsertChunks(chunks) {
        try {
            const points = chunks.map((chunk) => ({
                id: chunk.id,
                vector: chunk.embedding,
                payload: {
                    text: chunk.text,
                    metadata: chunk.metadata || {},
                },
            }));

            await this.client.upsert(this.collectionName, {
                wait: true,
                points,
            });

            console.log(`✅ Upserted ${chunks.length} chunks to Qdrant`);
        } catch (error) {
            console.error('Error upserting chunks:', error);
            throw error;
        }
    }

    /**
     * Search for similar chunks using vector similarity
     * @param {number[]} queryEmbedding - Query vector
     * @param {number} topK - Number of results to return
     * @param {Object} filter - Optional metadata filter
     * @returns {Promise<Array>} - Array of search results
     */
    async search(queryEmbedding, topK = 5, filter = null) {
        try {
            const searchParams = {
                vector: queryEmbedding,
                limit: topK,
                with_payload: true,
            };

            if (filter) {
                searchParams.filter = filter;
            }

            const results = await this.client.search(this.collectionName, searchParams);

            return results.map((result) => ({
                id: result.id,
                score: result.score,
                text: result.payload.text,
                metadata: result.payload.metadata,
            }));
        } catch (error) {
            console.error('Error searching Qdrant:', error);
            throw error;
        }
    }

    /**
     * Delete chunks by IDs
     * @param {Array<string>} ids - Array of chunk IDs to delete
     */
    async deleteChunks(ids) {
        try {
            await this.client.delete(this.collectionName, {
                wait: true,
                points: ids,
            });
            console.log(`✅ Deleted ${ids.length} chunks`);
        } catch (error) {
            console.error('Error deleting chunks:', error);
            throw error;
        }
    }

    /**
     * Get collection info
     * @returns {Promise<Object>} - Collection information
     */
    async getCollectionInfo() {
        try {
            return await this.client.getCollection(this.collectionName);
        } catch (error) {
            console.error('Error getting collection info:', error);
            throw error;
        }
    }

    /**
     * Count total points in collection
     * @returns {Promise<number>} - Total count
     */
    async count() {
        try {
            const info = await this.getCollectionInfo();
            return info.points_count || 0;
        } catch (error) {
            console.error('Error counting points:', error);
            return 0;
        }
    }
}

export default new QdrantService();
