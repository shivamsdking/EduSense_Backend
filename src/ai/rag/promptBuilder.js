/**
 * Prompt Builder
 * Constructs optimized prompts for Claude with RAG context
 */
class PromptBuilder {
    /**
     * Build a complete prompt for educational Q&A
     * @param {string} question - User's question
     * @param {Array} context - Retrieved context chunks
     * @param {Object} options - Additional options
     * @returns {string} - Formatted prompt
     */
    buildEducationalPrompt(question, context = [], options = {}) {
        const {
            includeSteps = true,
            includeConfidence = true,
            maxContextChunks = 5,
            tone = 'educational',
        } = options;

        // Limit context to prevent token overflow
        const limitedContext = context.slice(0, maxContextChunks);

        // Format context
        const contextSection = this.formatContext(limitedContext);

        // Build system message
        const systemMessage = this.getSystemMessage(tone);

        // Build instructions
        const instructions = this.getInstructions(includeSteps, includeConfidence);

        // Combine all parts
        return `${systemMessage}

**QUESTION:**
${question}

${contextSection}

${instructions}`;
    }

    /**
     * Get system message based on tone
     * @param {string} tone - Tone of response
     * @returns {string} - System message
     */
    getSystemMessage(tone) {
        const messages = {
            educational: `You are an expert educational mentor who excels at breaking down complex topics into clear, understandable explanations. Your goal is to help students learn and understand, not just provide answers.`,

            concise: `You are a knowledgeable tutor providing clear, concise explanations to academic questions.`,

            detailed: `You are a comprehensive educational assistant providing in-depth, detailed explanations with examples and analogies.`,

            encouraging: `You are a supportive and encouraging tutor who helps students build confidence while learning. You celebrate their curiosity and guide them step-by-step.`,
        };

        return messages[tone] || messages.educational;
    }

    /**
     * Format context chunks for the prompt
     * @param {Array} context - Context chunks
     * @returns {string} - Formatted context section
     */
    formatContext(context) {
        if (!context || context.length === 0) {
            return `**RELEVANT CONTEXT:**
No specific context available. Please use your general knowledge to provide a helpful answer.`;
        }

        const formattedChunks = context
            .map((chunk, idx) => {
                const source = chunk.metadata?.source || 'Unknown';
                const subject = chunk.metadata?.subject || '';
                const topic = chunk.metadata?.topic || '';

                let header = `[Context ${idx + 1}]`;
                if (subject) header += ` Subject: ${subject}`;
                if (topic) header += ` | Topic: ${topic}`;

                return `${header}
${chunk.text}
Source: ${source}
Relevance Score: ${(chunk.score * 100).toFixed(1)}%`;
            })
            .join('\n\n---\n\n');

        return `**RELEVANT CONTEXT:**
${formattedChunks}`;
    }

    /**
     * Get response instructions
     * @param {boolean} includeSteps - Include step-by-step breakdown
     * @param {boolean} includeConfidence - Include confidence score
     * @returns {string} - Instructions section
     */
    getInstructions(includeSteps, includeConfidence) {
        let instructions = `**INSTRUCTIONS:**
1. Analyze the question carefully
2. Use the provided context when relevant
3. Provide a clear, accurate explanation
4. Use simple language and avoid unnecessary jargon
5. Be encouraging and educational in tone
`;

        if (includeSteps) {
            instructions += `6. Break down your explanation into logical steps
`;
        }

        instructions += `
**RESPONSE FORMAT (JSON):**
{
  "steps": [
    "Step 1: [Clear explanation of the first concept or action]",
    "Step 2: [Next logical step in understanding]",
    "Step 3: [Continue building on previous steps]"
  ],
  "final_answer": "A concise summary that directly answers the question",`;

        if (includeConfidence) {
            instructions += `
  "confidence": 0.95`;
        }

        instructions += `
}

**IMPORTANT:** 
- Respond ONLY with valid JSON in the format above
- Ensure "steps" is an array of strings
- "final_answer" should be a clear, complete answer
${includeConfidence ? '- "confidence" should be a number between 0 and 1' : ''}
- Do not include any text outside the JSON structure`;

        return instructions;
    }

    /**
     * Build a simple prompt without context
     * @param {string} question - User's question
     * @returns {string} - Simple prompt
     */
    buildSimplePrompt(question) {
        return this.buildEducationalPrompt(question, [], {
            includeSteps: true,
            includeConfidence: true,
        });
    }

    /**
     * Build a prompt for follow-up questions
     * @param {string} question - Follow-up question
     * @param {string} previousAnswer - Previous answer
     * @param {Array} context - Context chunks
     * @returns {string} - Follow-up prompt
     */
    buildFollowUpPrompt(question, previousAnswer, context = []) {
        const contextSection = this.formatContext(context);

        return `You are an expert educational mentor helping a student with a follow-up question.

**PREVIOUS ANSWER:**
${previousAnswer}

**FOLLOW-UP QUESTION:**
${question}

${contextSection}

**INSTRUCTIONS:**
1. Consider the context of the previous answer
2. Build upon what was already explained
3. Provide additional clarity or depth
4. Maintain consistency with the previous explanation

**RESPONSE FORMAT (JSON):**
{
  "steps": ["Step 1: ...", "Step 2: ..."],
  "final_answer": "Clear answer to the follow-up question",
  "confidence": 0.95
}

Respond ONLY with valid JSON.`;
    }
}

export default new PromptBuilder();
