import geminiClient from '../llm/groqClient.js';
import retriever from '../rag/retriever.js';
import Doubt from '../../models/Doubt.js';
import User from '../../models/User.js';

/**
 * Ask Service
 * Main service for handling doubt-solving pipeline
 * Pipeline: Retrieve Context → Build Prompt → Ask Gemini → Save
 */

/**
 * Validate and fix common Mermaid syntax issues
 * @param {string} mermaidCode - Raw Mermaid code
 * @returns {string} - Fixed Mermaid code
 */
function validateAndFixMermaid(mermaidCode) {
    if (!mermaidCode || mermaidCode.trim() === '') return '';

    let fixed = mermaidCode.trim();

    // Remove markdown code blocks if present
    if (fixed.startsWith('```mermaid')) {
        fixed = fixed.replace(/```mermaid\n?/, '').replace(/```$/, '').trim();
    } else if (fixed.startsWith('```')) {
        fixed = fixed.replace(/```\n?/, '').replace(/```$/, '').trim();
    }

    // Fix common syntax issues
    // 1. Ensure proper line breaks
    fixed = fixed.replace(/;/g, '\n');

    // 2. Fix arrow syntax (replace wrong arrows)
    fixed = fixed.replace(/-->/g, ' --> ');
    fixed = fixed.replace(/---/g, ' --- ');

    // 3. Remove invalid characters from node IDs
    // Replace node IDs with special chars with simple IDs
    const lines = fixed.split('\n');
    const fixedLines = lines.map(line => {
        // Skip empty lines and diagram type declarations
        if (!line.trim() || line.trim().startsWith('graph') ||
            line.trim().startsWith('sequenceDiagram') ||
            line.trim().startsWith('classDiagram') ||
            line.trim().startsWith('stateDiagram') ||
            line.trim().startsWith('mindmap')) {
            return line;
        }

        // Fix node definitions with special characters
        return line.replace(/[^\w\s\[\]\(\)\{\}\-\>\<\:\"\'\|]/g, '');
    });

    fixed = fixedLines.join('\n');

    // 4. Ensure diagram type is present
    if (!fixed.match(/^(graph|sequenceDiagram|classDiagram|stateDiagram|mindmap)/)) {
        fixed = 'graph TD\n' + fixed;
    }

    // 5. Remove duplicate newlines
    fixed = fixed.replace(/\n\n+/g, '\n');

    return fixed.trim();
}

class AskService {
    /**
     * Process a text-based question
     * @param {string} questionText - User's question
     * @param {string} userId - User ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Answer and doubt record
     */
    async askTextQuestion(questionText, userId, options = {}) {
        const startTime = Date.now();

        try {
            console.log(`\n🤔 Processing question from user ${userId}`);
            console.log(`Question: "${questionText}"`);

            // Step 1: Retrieve relevant context from Qdrant
            console.log('\n📚 Step 1: Retrieving context...');
            let context = [];
            try {
                context = await retriever.retrieve(
                    questionText,
                    options.topK || 5,
                    options.filter
                );
                console.log(`Retrieved ${context.length} context chunks`);
            } catch (retrievalError) {
                console.warn('⚠️ Context retrieval failed, proceeding without context:', retrievalError.message);
            }

            // Step 2: Ask Gemini with context
            console.log('\n🤖 Step 2: Asking Gemini...');
            const answer = await geminiClient.askWithContext(questionText, context);

            console.log('✅ Answer generated');
            console.log(`Steps: ${answer.steps.length}`);
            console.log(`Confidence: ${answer.confidence}`);

            // Step 3: Save doubt to MongoDB
            console.log('\n💾 Step 3: Saving doubt...');
            const processingTime = Date.now() - startTime;

            // Validate and fix Mermaid code
            const validatedMermaidCode = validateAndFixMermaid(answer.mermaidCode || '');
            if (validatedMermaidCode) {
                console.log('✅ Mermaid diagram validated and fixed');
            }

            // Only save code if it has a valid snippet
            const codeToSave = (
                answer.code &&
                answer.code.snippet &&
                typeof answer.code.snippet === 'string' &&
                answer.code.snippet.trim()
            ) ? answer.code : null;

            const doubt = await Doubt.create({
                userId,
                questionText,
                answerSteps: answer.steps,
                explanation: answer.explanation,
                finalAnswer: answer.finalAnswer,
                confidence: Math.min(1, Math.max(0, (Number(answer.confidence) > 1 ? Number(answer.confidence) / 100 : Number(answer.confidence)) || 0)),
                retrievedContext: context.map((chunk) => ({
                    text: chunk.text,
                    score: chunk.score,
                    metadata: chunk.metadata,
                })),
                status: 'answered',
                processingTime,
                subject: answer.meta?.subject || options.subject || this.detectSubject(questionText),
                meta: {
                    subject: answer.meta?.subject,
                    topic: answer.meta?.topic,
                    subtopic: answer.meta?.subtopic,
                    difficulty: answer.meta?.difficulty,
                    questionType: answer.meta?.questionType,
                },
                followUpQuestions: answer.followUpQuestions,
                mermaidCode: validatedMermaidCode,
                code: codeToSave,
                tags: options.tags || [],
            });

            // Update user streak and points
            await this.updateUserStreak(userId);

            console.log(`✅ Doubt saved with ID: ${doubt._id}`);
            console.log(`⏱️  Total processing time: ${processingTime}ms`);

            // Step 4: Return formatted response
            // We return the full doubt object structure + formatted fields
            return {
                ...doubt.toObject(),
                steps: answer.steps, // Ensure steps are accessible
                explanation: answer.explanation,
                finalAnswer: answer.finalAnswer,
                followUpQuestions: answer.followUpQuestions,
                mermaidCode: answer.mermaidCode,
                processingTime,
            };
        } catch (error) {
            console.error('❌ Error in askTextQuestion:', error);

            // Save failed doubt
            try {
                await Doubt.create({
                    userId,
                    questionText,
                    answerSteps: [],
                    finalAnswer: 'Failed to generate answer. Please try again.',
                    confidence: 0,
                    status: 'failed',
                    processingTime: Date.now() - startTime,
                });
            } catch (saveError) {
                console.error('Error saving failed doubt:', saveError);
            }

            throw error;
        }
    }

    /**
     * Update user streak and points
     * @param {string} userId 
     */
    async updateUserStreak(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
            if (lastActive) lastActive.setHours(0, 0, 0, 0);

            if (!lastActive) {
                // First time
                user.streak = 1;
            } else if (lastActive.getTime() === today.getTime()) {
                // Already active today, do nothing
            } else if (today.getTime() - lastActive.getTime() === 86400000) {
                // Consecutive day (24 hours diff)
                user.streak += 1;
            } else {
                // Broken streak
                user.streak = 1;
            }

            user.lastActiveDate = new Date();
            user.points += 10; // Base points for asking

            // Streak Bonuses
            if (user.streak > 1) user.points += 5; // Daily consistency bonus
            if (user.streak % 7 === 0) user.points += 50; // Weekly bonus
            if (user.streak % 30 === 0) user.points += 200; // Monthly bonus

            await user.save();
        } catch (error) {
            console.error('Error updating streak:', error);
        }
    }

    /**
     * Simple subject detection based on keywords
     * @param {string} text - Question text
     * @returns {string} - Detected subject
     */
    detectSubject(text) {
        const lowerText = text.toLowerCase();

        const subjects = {
            mathematics: ['math', 'equation', 'algebra', 'calculus', 'geometry', 'trigonometry'],
            physics: ['physics', 'force', 'energy', 'motion', 'velocity', 'acceleration'],
            chemistry: ['chemistry', 'molecule', 'atom', 'reaction', 'element', 'compound'],
            biology: ['biology', 'cell', 'organism', 'dna', 'evolution', 'ecosystem'],
            computer_science: ['programming', 'algorithm', 'code', 'software', 'computer', 'data structure'],
            history: ['history', 'war', 'civilization', 'ancient', 'revolution'],
            literature: ['literature', 'novel', 'poem', 'author', 'story', 'character'],
        };

        for (const [subject, keywords] of Object.entries(subjects)) {
            if (keywords.some((keyword) => lowerText.includes(keyword))) {
                return subject;
            }
        }

        return 'general';
    }

    /**
     * Get user's doubt history
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of doubts
     */
    async getUserDoubts(userId, options = {}) {
        try {
            const {
                limit = 20,
                skip = 0,
                subject = null,
                bookmarked = null,
            } = options;

            const query = { userId };

            if (subject) {
                query.subject = subject;
            }

            if (bookmarked !== null) {
                query.isBookmarked = bookmarked;
            }

            const doubts = await Doubt.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .select('-retrievedContext -__v');

            return doubts;
        } catch (error) {
            console.error('Error getting user doubts:', error);
            throw error;
        }
    }

    /**
     * Get a single doubt by ID
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID (for authorization)
     * @returns {Promise<Object>} - Doubt object
     */
    async getDoubtById(doubtId, userId) {
        try {
            const doubt = await Doubt.findOne({ _id: doubtId, userId });

            if (!doubt) {
                throw new Error('Doubt not found');
            }

            return doubt;
        } catch (error) {
            console.error('Error getting doubt:', error);
            throw error;
        }
    }

    /**
     * Toggle bookmark status
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Updated doubt
     */
    async toggleBookmark(doubtId, userId) {
        try {
            const doubt = await Doubt.findOne({ _id: doubtId, userId });

            if (!doubt) {
                throw new Error('Doubt not found');
            }

            doubt.isBookmarked = !doubt.isBookmarked;
            await doubt.save();

            return doubt;
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            throw error;
        }
    }

    /**
     * Rate a doubt answer
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     * @param {number} rating - Rating (1-5)
     * @returns {Promise<Object>} - Updated doubt
     */
    async rateDoubt(doubtId, userId, rating) {
        try {
            const doubt = await Doubt.findOne({ _id: doubtId, userId });

            if (!doubt) {
                throw new Error('Doubt not found');
            }

            if (rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            doubt.rating = rating;
            await doubt.save();

            return doubt;
        } catch (error) {
            console.error('Error rating doubt:', error);
            throw error;
        }
    }

    /**
     * Get user stats
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - User stats
     */
    async getUserStats(userId) {
        try {
            const totalDoubts = await Doubt.countDocuments({ userId });
            const bookmarkedDoubts = await Doubt.countDocuments({ userId, isBookmarked: true });

            // Calculate average confidence
            const doubts = await Doubt.find({ userId }).select('confidence');
            const avgConfidence = doubts.length > 0
                ? doubts.reduce((acc, d) => acc + (d.confidence || 0), 0) / doubts.length
                : 0;

            return {
                totalDoubts,
                bookmarkedDoubts,
                avgConfidence,
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }

    async generateStudyMaterial(topic, type) {
        return await geminiClient.generateStudyMaterial(topic, type);
    }

    /**
     * Delete a doubt
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     */
    async deleteDoubt(doubtId, userId) {
        try {
            const result = await Doubt.deleteOne({ _id: doubtId, userId });
            if (result.deletedCount === 0) {
                throw new Error('Doubt not found or unauthorized');
            }
            return true;
        } catch (error) {
            console.error('Error deleting doubt:', error);
            throw error;
        }
    }

    /**
     * Generate a diagram for an existing doubt
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     * @param {string} diagramType - Type of diagram (flowchart, sequence, class, mindmap, state)
                    mathematics: ['math', 'equation', 'algebra', 'calculus', 'geometry', 'trigonometry'],
                    physics: ['physics', 'force', 'energy', 'motion', 'velocity', 'acceleration'],
                    chemistry: ['chemistry', 'molecule', 'atom', 'reaction', 'element', 'compound'],
                    biology: ['biology', 'cell', 'organism', 'dna', 'evolution', 'ecosystem'],
                    computer_science: ['programming', 'algorithm', 'code', 'software', 'computer', 'data structure'],
                    history: ['history', 'war', 'civilization', 'ancient', 'revolution'],
                    literature: ['literature', 'novel', 'poem', 'author', 'story', 'character'],
                };

                for (const [subject, keywords] of Object.entries(subjects)) {
                    if (keywords.some((keyword) => lowerText.includes(keyword))) {
                        return subject;
                    }
                }

                return 'general';
            }

    /**
     * Get user's doubt history
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of doubts
     */
    async getUserDoubts(userId, options = {}) {
        try {
            const {
                limit = 20,
                skip = 0,
                subject = null,
                bookmarked = null,
            } = options;

            const query = { userId };

            if (subject) {
                query.subject = subject;
            }

            if (bookmarked !== null) {
                query.isBookmarked = bookmarked;
            }

            const doubts = await Doubt.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .select('-retrievedContext -__v');

            return doubts;
        } catch (error) {
            console.error('Error getting user doubts:', error);
            throw error;
        }
    }

    /**
     * Get a single doubt by ID
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID (for authorization)
     * @returns {Promise<Object>} - Doubt object
     */
    async getDoubtById(doubtId, userId) {
        try {
            const doubt = await Doubt.findOne({ _id: doubtId, userId });

            if (!doubt) {
                throw new Error('Doubt not found');
            }

            return doubt;
        } catch (error) {
            console.error('Error getting doubt:', error);
            throw error;
        }
    }

    /**
     * Toggle bookmark status
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Updated doubt
     */
    async toggleBookmark(doubtId, userId) {
        try {
            const doubt = await Doubt.findOne({ _id: doubtId, userId });

            if (!doubt) {
                throw new Error('Doubt not found');
            }

            doubt.isBookmarked = !doubt.isBookmarked;
            await doubt.save();

            return doubt;
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            throw error;
        }
    }

    /**
     * Rate a doubt answer
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     * @param {number} rating - Rating (1-5)
     * @returns {Promise<Object>} - Updated doubt
     */
    async rateDoubt(doubtId, userId, rating) {
        try {
            const doubt = await Doubt.findOne({ _id: doubtId, userId });

            if (!doubt) {
                throw new Error('Doubt not found');
            }

            if (rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            doubt.rating = rating;
            await doubt.save();

            return doubt;
        } catch (error) {
            console.error('Error rating doubt:', error);
            throw error;
        }
    }

    /**
     * Get user stats
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - User stats
     */
    async getUserStats(userId) {
        try {
            const totalDoubts = await Doubt.countDocuments({ userId });
            const bookmarkedDoubts = await Doubt.countDocuments({ userId, isBookmarked: true });

            // Calculate average confidence
            const doubts = await Doubt.find({ userId }).select('confidence');
            const avgConfidence = doubts.length > 0
                ? doubts.reduce((acc, d) => acc + (d.confidence || 0), 0) / doubts.length
                : 0;

            return {
                totalDoubts,
                bookmarkedDoubts,
                avgConfidence,
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }

    async generateStudyMaterial(topic, type) {
        return await geminiClient.generateStudyMaterial(topic, type);
    }

    /**
     * Delete a doubt
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     */
    async deleteDoubt(doubtId, userId) {
        try {
            const result = await Doubt.deleteOne({ _id: doubtId, userId });
            if (result.deletedCount === 0) {
                throw new Error('Doubt not found or unauthorized');
            }
            return true;
        } catch (error) {
            console.error('Error deleting doubt:', error);
            throw error;
        }
    }

    /**
     * Generate a diagram for an existing doubt
     * @param {string} doubtId - Doubt ID
     * @param {string} userId - User ID
     * @param {string} diagramType - Type of diagram (flowchart, sequence, class, mindmap, state)
     * @returns {Promise<string>} - Mermaid code
     */
    async generateDiagram(doubtId, userId, diagramType) {
        try {
            // Get the doubt
            const doubt = await Doubt.findOne({ _id: doubtId, userId });
            if (!doubt) {
                throw new Error('Doubt not found or unauthorized');
            }

            // Build type-specific instructions
            let typeInstructions = '';
            switch (diagramType) {
                case 'flowchart':
                    typeInstructions = `
- Use 'graph TD' for top-down or 'graph LR' for left-right
- Use simple node IDs: A, B, C, D, etc.
- Use --> for arrows
- Put labels in square brackets: A[Label]
- Show decision points with diamond shapes: D{Decision?}`;
                    break;
                case 'sequence':
                    typeInstructions = `
- Start with 'sequenceDiagram'
- Define participants first
- Use -> for messages
- Use -->> for return messages
- Show activation with activate/deactivate`;
                    break;
                case 'class':
                    typeInstructions = `
- Start with 'classDiagram'
- Define classes with attributes and methods
- Use relationships: <|-- (inheritance), *-- (composition), o-- (aggregation)
- Show visibility: + (public), - (private), # (protected)`;
                    break;
                case 'mindmap':
                    typeInstructions = `
- Start with 'mindmap'
- Use indentation to show hierarchy
- Root at the top level
- Child nodes indented with spaces`;
                    break;
                case 'state':
                    typeInstructions = `
- Start with 'stateDiagram-v2'
- Use [*] for start/end states
- Use --> for transitions
- Label transitions with : description`;
                    break;
            }

            // Generate diagram using Groq
            const prompt = `Generate a ${diagramType} diagram in Mermaid syntax for the following educational content:

**Question:** ${doubt.questionText}
**Answer:** ${doubt.finalAnswer || doubt.explanation}

**Diagram Type:** ${diagramType}

**Requirements:**
${typeInstructions}
- Make it clear and educational
- Include all key concepts from the answer
- Use proper Mermaid syntax
- Keep it simple and easy to understand
- Return ONLY the Mermaid code, no explanations or markdown blocks

Example format for ${diagramType}:
${this.getDiagramExample(diagramType)}`;

            const response = await geminiClient.askRaw(prompt);

            // Validate and fix the generated Mermaid code
            const validatedMermaidCode = validateAndFixMermaid(response);

            console.log(`✅ ${diagramType} diagram generated and validated`);

            // Update the doubt with new diagram
            doubt.mermaidCode = validatedMermaidCode;
            await doubt.save();

            return validatedMermaidCode;
        } catch (error) {
            console.error('Error generating diagram:', error);
            throw error;
        }
    }

    /**
     * Get example diagram for each type
     */
    getDiagramExample(type) {
        const examples = {
            flowchart: 'graph TD\n    A[Start] --> B[Process]\n    B --> C{Decision?}\n    C -->|Yes| D[Action]\n    C -->|No| E[End]',
            sequence: 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: Request\n    B-->>A: Response',
            class: 'classDiagram\n    class Animal {\n        +String name\n        +makeSound()\n    }\n    class Dog {\n        +bark()\n    }\n    Animal <|-- Dog',
            mindmap: 'mindmap\n  root((Topic))\n    Branch1\n      Detail1\n      Detail2\n    Branch2',
            state: 'stateDiagram-v2\n    [*] --> State1\n    State1 --> State2 : transition\n    State2 --> [*]'
        };
        return examples[type] || examples.flowchart;
    }
}

export default new AskService();
