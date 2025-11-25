import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude Client for AI-powered doubt solving
 * Uses Claude Sonnet 4.5 for high-quality educational responses
 */
class ClaudeClient {
    constructor() {
        // Validate API key
        const apiKey = process.env.ANTHROPIC_API_KEY ;

        if (!apiKey) {
            console.error('❌ ANTHROPIC_API_KEY is not set in environment variables!');
            console.error('   Please add it to server/.env file');
            throw new Error('ANTHROPIC_API_KEY is required');
        }

        console.log('✅ Anthropic API key found (length:', apiKey.length, ')');

        this.client = new Anthropic({
            apiKey: apiKey.trim(), // Trim any whitespace
        });
        // Use Claude 3.5 Sonnet - the latest stable model
        this.model = 'claude-3-5-sonnet-20241022';
    }

    /**
     * Generate embeddings for text using Claude
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} - Embedding vector
     */
    async generateEmbedding(text) {
        try {
            // Claude doesn't have native embeddings API yet
            // We'll use a workaround: generate a semantic representation
            // For production, consider using Voyage AI or OpenAI embeddings

            // Fallback: Use a simple hash-based approach or external service
            // For now, we'll return a placeholder that should be replaced
            console.warn('Using placeholder embeddings - integrate Voyage AI or OpenAI for production');

            // Generate a deterministic embedding based on text
            // This is a simplified version - replace with actual embedding service
            const embedding = await this.generateSimpleEmbedding(text);
            return embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Simplified embedding generation (placeholder)
     * Replace with actual embedding service (Voyage AI, OpenAI, etc.)
     */
    async generateSimpleEmbedding(text) {
        // This is a placeholder - use proper embedding service in production
        const dimension = 1536; // Standard embedding dimension
        const embedding = new Array(dimension).fill(0);

        // Simple hash-based approach for demo
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            embedding[i % dimension] += charCode / 1000;
        }

        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / (magnitude || 1));
    }

    /**
     * Ask Claude a question with context using RAG
     * @param {string} question - User's question
     * @param {Array} context - Retrieved context chunks
     * @returns {Promise<Object>} - Structured answer with steps
     */
    async askWithContext(question, context = []) {
        try {
            const prompt = this.buildPrompt(question, context);

            console.log('Sending request to Claude...');

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                temperature: 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            });

            console.log('Received response from Claude');

            // Check if response has content
            if (!response.content || response.content.length === 0) {
                console.error('Empty response from Claude');
                return this.getFallbackResponse(question);
            }

            // Parse the response
            const content = response.content[0].text;

            if (!content || content.trim().length === 0) {
                console.error('Empty text content from Claude');
                return this.getFallbackResponse(question);
            }

            // Try to parse as JSON
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        steps: parsed.steps || [],
                        finalAnswer: parsed.final_answer || parsed.finalAnswer || '',
                        confidence: parsed.confidence || 0.8,
                        rawResponse: content,
                    };
                }
            } catch (parseError) {
                console.log('JSON parsing failed, using text structure');
                // If JSON parsing fails, structure the response manually
                return this.structureNonJsonResponse(content);
            }

            return this.structureNonJsonResponse(content);
        } catch (error) {
            console.error('Error asking Claude:', error.message);

            // Check for specific error types
            if (error.message && error.message.includes('model output must contain')) {
                console.error('Claude returned empty output - using fallback');
                return this.getFallbackResponse(question);
            }

            throw error;
        }
    }

    /**
     * Get a fallback response when Claude fails
     * @param {string} question - User's question
     * @returns {Object} - Fallback response
     */
    getFallbackResponse(question) {
        return {
            steps: [
                "I apologize, but I encountered an issue generating a detailed response.",
                "This could be due to the complexity of the question or a temporary service issue.",
                "Please try rephrasing your question or asking something more specific."
            ],
            finalAnswer: `I'm having trouble answering "${question}" right now. Please try again with a more specific question.`,
            confidence: 0.3,
            rawResponse: "Fallback response due to empty Claude output",
        };
    }

    /**
     * Build a structured prompt for Claude
     * @param {string} question - User's question
     * @param {Array} context - Retrieved context
     * @returns {string} - Formatted prompt
     */
    buildPrompt(question, context) {
        const contextText = context
            .map((chunk, idx) => `[${idx + 1}] ${chunk.text}\nSource: ${chunk.metadata?.source || 'Unknown'}`)
            .join('\n\n');

        return `You are an expert educational mentor specializing in clear, step-by-step explanations.

**QUESTION:**
${question}

**RELEVANT CONTEXT:**
${contextText || 'No specific context available - use your general knowledge.'}

**INSTRUCTIONS:**
1. Provide a clear, step-by-step explanation
2. Break down complex concepts into simple terms
3. Use examples where helpful
4. Be encouraging and educational

**RESPONSE FORMAT (JSON):**
{
  "steps": [
    "Step 1: [Clear explanation]",
    "Step 2: [Next step]",
    ...
  ],
  "final_answer": "Concise summary of the complete answer",
  "confidence": 0.95
}

Provide your response in the JSON format above.`;
    }

    /**
     * Structure non-JSON response into expected format
     * @param {string} content - Raw response text
     * @returns {Object} - Structured response
     */
    structureNonJsonResponse(content) {
        // Split into steps based on common patterns
        const lines = content.split('\n').filter(line => line.trim());
        const steps = [];
        let finalAnswer = '';

        for (const line of lines) {
            if (line.match(/^(Step \d+|[0-9]+\.|\*)/)) {
                steps.push(line.replace(/^(Step \d+:|[0-9]+\.|\*)\s*/, ''));
            } else if (line.length > 50) {
                finalAnswer += line + ' ';
            }
        }

        return {
            steps: steps.length > 0 ? steps : [content],
            finalAnswer: finalAnswer.trim() || content.substring(0, 200),
            confidence: 0.75,
            rawResponse: content,
        };
    }

    /**
     * Simple question answering without RAG context
     * @param {string} question - User's question
     * @returns {Promise<Object>} - Answer object
     */
    async ask(question) {
        return this.askWithContext(question, []);
    }
}

export default new ClaudeClient();
