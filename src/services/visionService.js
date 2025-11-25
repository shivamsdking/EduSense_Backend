import groqClient from '../ai/llm/groqClient.js';

/**
 * Vision Service
 * Handles concept extraction and semantic analysis using Vision LLMs (via Groq)
 */

class VisionService {
    /**
     * Extract concepts from image using Vision LLM (Groq Llama 3.2 Vision)
     * @param {string} imageUrl - Cloudinary URL
     * @param {string} ocrText - Extracted OCR text
     * @returns {Promise<Object>} - { conceptTags, difficulty, summary, topics }
     */
    async extractConcepts(imageUrl, ocrText) {
        try {
            console.log('🧠 Extracting concepts with Groq Vision...');

            // Note: Groq's Llama 3.2 Vision Preview supports image inputs.
            // If the URL is accessible, we can pass it. Otherwise, we rely on OCR text.

            const prompt = `Analyze this educational content based on the extracted text:
            
OCR Text: ${ocrText}

Provide a JSON response with:
1. conceptTags: Array of 3-5 key concepts/topics (e.g., ["calculus", "derivatives", "limits"])
2. difficulty: One of ["easy", "medium", "hard"]
3. summary: Brief 1-sentence summary of the content
4. topics: Array of broader subject areas (e.g., ["mathematics", "physics"])

Return ONLY valid JSON, no other text.`;

            // Using askRaw for now as we are passing text. 
            // TODO: Update groqClient to support image_url messages for Llama 3.2 Vision
            const responseText = await groqClient.askRaw(prompt);

            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.warn('⚠️ No JSON found in response, using fallback');
                return this.getFallbackConcepts(ocrText);
            }

            const result = JSON.parse(jsonMatch[0]);

            console.log('✅ Concept extraction complete');

            return {
                conceptTags: result.conceptTags || [],
                difficulty: result.difficulty || 'unknown',
                summary: result.summary || '',
                topics: result.topics || [],
            };
        } catch (error) {
            console.error('Vision concept extraction error:', error.message);
            return this.getFallbackConcepts(ocrText);
        }
    }

    /**
     * Fallback concept extraction using simple keyword matching
     * @param {string} text - OCR text
     * @returns {Object} - Basic concepts
     */
    getFallbackConcepts(text) {
        const lowerText = text.toLowerCase();
        const conceptTags = [];
        const topics = [];

        // Subject detection
        const subjectKeywords = {
            mathematics: ['math', 'equation', 'formula', 'theorem', 'proof', 'calculate'],
            physics: ['force', 'energy', 'velocity', 'acceleration', 'momentum'],
            chemistry: ['molecule', 'atom', 'reaction', 'element', 'compound'],
            biology: ['cell', 'organism', 'dna', 'evolution', 'species'],
            'computer science': ['algorithm', 'code', 'program', 'function', 'variable'],
        };

        for (const [subject, keywords] of Object.entries(subjectKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                topics.push(subject);
                conceptTags.push(...keywords.filter(kw => lowerText.includes(kw)).slice(0, 2));
            }
        }

        // Difficulty estimation (simple heuristic)
        const wordCount = text.split(/\s+/).length;
        let difficulty = 'medium';
        if (wordCount < 50) difficulty = 'easy';
        else if (wordCount > 200) difficulty = 'hard';

        return {
            conceptTags: [...new Set(conceptTags)].slice(0, 5),
            difficulty,
            summary: text.substring(0, 100) + '...',
            topics: [...new Set(topics)],
        };
    }

    /**
     * Detect if image contains diagrams or equations
     * @param {string} imageUrl - Image URL
     * @returns {Promise<Object>} - { hasDiagram, hasEquations, hasHandwriting }
     */
    async detectContentType(imageUrl) {
        try {
            // For now, return default as we are not doing full image analysis yet
            // This can be enhanced with Groq Vision later
            return { hasDiagram: false, hasEquations: false, hasHandwriting: false };
        } catch (error) {
            console.error('Content type detection error:', error);
            return { hasDiagram: false, hasEquations: false, hasHandwriting: false };
        }
    }
}

export default new VisionService();
