import Groq from 'groq-sdk';

/**
 * Groq Client for Ultra-Fast AI Doubt Solving
 * Uses Llama 3.3 70B via Groq Cloud
 */
class GroqClient {
    constructor() {
        // Validate API key
        const apiKey = process.env.GROQ_API_KEY ;

        if (!apiKey) {
            console.warn('⚠️ GROQ_API_KEY is not set! AI features will not work.');
        } else {
            console.log('✅ Groq API key found');
        }

        this.groq = new Groq({
            apiKey: apiKey,
        });

        // Use Llama 3.3 70B - Latest high-performance model
        this.modelName = 'llama-3.3-70b-versatile';
    }

    /**
     * Generate embeddings (Mock implementation)
     */
    async generateEmbedding(text) {
        return new Array(768).fill(0);
    }

    /**
     * Ask Groq a question with context
     */
    async askWithContext(question, context = []) {
        try {
            const prompt = this.buildPrompt(question, context);

            console.log(`🤖 Asking Groq (${this.modelName})...`);

            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert educational mentor named "EduSense AI". 
Your goal is to explain complex topics simply, clearly, and conversationally.

**BEHAVIOR RULES:**
1. **NO DISCLAIMERS**: Never say "As an AI", "I cannot", or "I am a model". Just answer.
2. **Tone**: Friendly, teacher-like, encouraging. Explain like you are teaching a smart student.
3. **Structure**: 
   - Start with a direct, simple answer.
   - Break down into clear steps.
   - Use analogies where helpful.
4. **Diagrams**: Always provide a Mermaid diagram for concepts, flows, or structures.
5. **Code - MANDATORY FOR PROGRAMMING**: 
   - For ANY programming, coding, algorithm, or computer science question, you MUST provide code.
   - Include complete, runnable code examples.
   - Use proper syntax for the language.
   - Add comments to explain key parts.
   - NEVER skip code for programming questions.
6. **Output**: You MUST return valid JSON only.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: this.modelName,
                temperature: 0.4, // Lower temperature for more consistent JSON
                max_tokens: 2048,
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content;

            if (!content) {
                throw new Error('Empty response from Groq');
            }

            return this.parseResponse(content);

        } catch (error) {
            console.error('❌ Groq Error:', error.message);
            return this.getFallbackResponse(question);
        }
    }

    /**
     * Build a structured prompt for Groq
     */
    buildPrompt(question, context) {
        const contextText = context
            .map((chunk, idx) => `[${idx + 1}] ${chunk.text}`)
            .join('\n\n');

        return `
**USER QUESTION:** "${question}"

**CONTEXT (RAG):**
${contextText || 'No specific context available.'}

**INSTRUCTIONS:**
1. Analyze the question to determine the Subject, Topic, and Difficulty.
2. Provide a clear, step-by-step explanation.
3. If the concept involves a process, system, hierarchy, or logic flow, YOU MUST GENERATE A MERMAID DIAGRAM.
   - CRITICAL: Use ONLY valid Mermaid syntax
   - For flowcharts: Use 'graph TD' or 'graph LR'
   - For sequences: Use 'sequenceDiagram'
   - For classes: Use 'classDiagram'
   - For mindmaps: Use 'mindmap' with proper indentation
   - For state diagrams: Use 'stateDiagram-v2'
   - AVOID special characters in node IDs (use A, B, C or simple words)
   - Use proper arrow syntax: --> or --- for connections
   - Escape special characters in labels with quotes
4. **CRITICAL - CODE GENERATION:**
   - If the question mentions: programming, code, algorithm, function, class, loop, variable, syntax, or ANY programming concept
   - OR if the subject is Computer Science, Programming, Software, etc.
   - YOU MUST INCLUDE A CODE BLOCK
   - Provide complete, runnable code with comments
   - Use proper syntax for the detected language
   - NEVER return empty code for programming questions
5. Suggest 3 follow-up questions.

**REQUIRED JSON RESPONSE FORMAT:**
{
  "explanation": "A friendly, conversational overview. NO 'As an AI' or disclaimers.",
  "steps": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "finalAnswer": "A concise summary statement.",
  "confidence": 0.95,
  "meta": {
    "subject": "Math/Physics/CS/etc",
    "topic": "Specific topic",
    "subtopic": "Specific subtopic",
    "difficulty": "school/easy/medium/hard/competitive",
    "questionType": "concept/numerical/programming/theory/diagram"
  },
  "followUpQuestions": {
    "easy": "...",
    "medium": "...",
    "challenge": "..."
  },
  "mermaidCode": "graph TD\\n    A[Start] --> B[End]\\n(MUST be valid Mermaid syntax OR empty string)",
  "code": {
    "language": "python/javascript/java/cpp/etc (REQUIRED for programming questions)",
    "snippet": "Complete, runnable code with comments (REQUIRED for programming questions, empty object {} for non-programming)"
  }
}
`;
    }

    /**
     * Parse JSON response
     */
    parseResponse(text) {
        try {
            return JSON.parse(text);
        } catch (error) {
            console.warn('⚠️ Failed to parse JSON from Groq, attempting manual fix');
            return {
                explanation: text,
                steps: ["See explanation above."],
                finalAnswer: "Could not parse structured answer.",
                confidence: 0,
                meta: { subject: "General", difficulty: "Unknown", type: "General" }
            };
        }
    }

    /**
     * Generate study material (notes, flashcards, etc.)
     */
    async generateStudyMaterial(topic, type) {
        const prompts = {
            notes: `Create concise, easy-to-read revision notes for "${topic}". Use bullet points, headers, and bold text.`,
            flashcards: `Create 5 flashcards for "${topic}". Format as JSON: [{"front": "Question", "back": "Answer"}]`,
            analogy: `Explain "${topic}" using a simple, real-life analogy that a 10-year-old would understand.`,
            quiz: `Create 3 multiple-choice questions for "${topic}" with answers.`
        };

        const prompt = prompts[type] || prompts.notes;

        try {
            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert educational content generator. Return clean Markdown for notes/analogy, or JSON for flashcards/quiz.'
                    },
                    { role: 'user', content: prompt }
                ],
                model: this.modelName,
                temperature: 0.5,
            });

            return completion.choices[0]?.message?.content;
        } catch (error) {
            console.error('Groq Study Gen Error:', error);
            return "Failed to generate study material.";
        }
    }

    /**
     * Ask Groq a raw question without context or structured output
     * @param {string} prompt - The prompt to send
     * @returns {Promise<string>} - Raw text response
     */
    async askRaw(prompt) {
        try {
            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: this.modelName,
                temperature: 0.7,
                max_tokens: 2000,
            });

            return completion.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('Groq Raw Error:', error);
            throw error;
        }
    }

    /**
     * Fallback response
     */
    getFallbackResponse(question) {
        return {
            explanation: "I'm having trouble connecting to my brain right now. It might be a network issue.",
            steps: ["Please check your internet connection.", "Try again in a moment."],
            finalAnswer: "Temporary connection issue.",
            confidence: 0,
            meta: { subject: "System", difficulty: "N/A", category: "Error" }
        };
    }
}

export default new GroqClient();
