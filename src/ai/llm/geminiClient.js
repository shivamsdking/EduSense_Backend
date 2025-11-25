import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Client for AI-powered doubt solving
 * Uses Gemini 1.5 Flash for fast, high-quality educational responses
 * Implements fallback to other models if primary fails
 */
class GeminiClient {
    constructor() {
        // Validate API key
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('⚠️ GEMINI_API_KEY is not set! AI features will not work.');
        } else {
            console.log('✅ Gemini API key found');
        }

        this.genAI = new GoogleGenerativeAI(apiKey || 'placeholder');

        // Initialize with primary model
        this.modelName = 'gemini-1.5-flash-001';
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    }

    /**
     * Generate embeddings for text using Gemini
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} - Embedding vector
     */
    async generateEmbedding(text) {
        try {
            if (!text || !text.trim()) return [];

            // Add delay to avoid rate limits (free tier is strict)
            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await this.embeddingModel.embedContent(text);
            const embedding = result.embedding;
            return embedding.values;
        } catch (error) {
            // Log error but don't crash - fallback to simple embedding
            console.warn('⚠️ Embedding failed (using fallback):', error.message.split('\n')[0]);
            return this.generateSimpleEmbedding(text);
        }
    }

    /**
     * Simplified embedding generation (fallback)
     */
    async generateSimpleEmbedding(text) {
        console.warn('Using fallback simple embedding');
        const dimension = 768; // Gemini embedding dimension
        const embedding = new Array(dimension).fill(0);
        for (let i = 0; i < text.length; i++) {
            embedding[i % dimension] += text.charCodeAt(i) / 1000;
        }
        return embedding;
    }

    /**
     * Ask Gemini with automatic model fallback
     */
    async askWithContext(question, context = []) {
        const modelsToTry = [
            'gemini-1.5-flash-001',
            'gemini-1.5-flash',
            'gemini-pro',
            'gemini-1.0-pro'
        ];

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 Asking Gemini using model: ${modelName}...`);
                const model = this.genAI.getGenerativeModel({ model: modelName });
                const prompt = this.buildPrompt(question, context);

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                console.log(`✅ Success with ${modelName}`);
                return this.parseResponse(text);
            } catch (error) {
                console.warn(`⚠️ Failed with ${modelName}:`, error.message.split('\n')[0]);

                // If this was the last model, return fallback
                if (modelName === modelsToTry[modelsToTry.length - 1]) {
                    console.error('❌ All models failed.');
                    return this.getFallbackResponse(question);
                }
                // Otherwise continue to next model
                continue;
            }
        }
    }

    /**
     * Build a structured prompt for Gemini
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
5. **CRITICAL**: Return your response in valid JSON format ONLY. Do not include markdown formatting (like \`\`\`json).

**RESPONSE FORMAT (JSON):**
{
  "steps": [
    "Step 1: [Clear explanation]",
    "Step 2: [Next step]",
    ...
  ],
  "final_answer": "Concise summary of the complete answer",
  "confidence": 0.95
}`;
    }

    /**
     * Parse Gemini's response into structured object
     */
    parseResponse(text) {
        try {
            // Clean up text (remove markdown code blocks if present)
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanText);
            return {
                steps: parsed.steps || [],
                finalAnswer: parsed.final_answer || parsed.finalAnswer || '',
                confidence: parsed.confidence || 0.85,
                rawResponse: text,
            };
        } catch (error) {
            console.log('JSON parsing failed, structuring manually');
            return this.structureNonJsonResponse(text);
        }
    }

    /**
     * Structure non-JSON response
     */
    structureNonJsonResponse(content) {
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
     * Fallback response
     */
    getFallbackResponse(question) {
        return {
            steps: [
                "I apologize, but I encountered an issue generating a detailed response.",
                "Please try asking your question again.",
            ],
            finalAnswer: `I'm having trouble answering "${question}" right now.`,
            confidence: 0.3,
            rawResponse: "Fallback response",
        };
    }
}

export default new GeminiClient();
