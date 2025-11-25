import Tesseract from 'tesseract.js';
import axios from 'axios';

/**
 * OCR Service
 * Handles text extraction from images using Tesseract and optional Vision LLM
 */

class OCRService {
    /**
     * Extract text using Tesseract OCR
     * @param {string|Buffer} image - Image URL or buffer
     * @returns {Promise<Object>} - { text, confidence, raw }
     */
    async extractWithTesseract(image) {
        try {
            console.log('🔍 Running Tesseract OCR...');

            const result = await Tesseract.recognize(image, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });

            const text = result.data.text.trim();
            const confidence = result.data.confidence / 100; // Convert to 0-1 scale

            console.log(`✅ Tesseract OCR complete. Confidence: ${Math.round(confidence * 100)}%`);

            return {
                text,
                confidence,
                raw: {
                    words: (result.data.words || []).map(w => ({
                        text: w.text,
                        confidence: w.confidence / 100,
                        bbox: w.bbox,
                    })),
                    lines: (result.data.lines || []).map(l => ({
                        text: l.text,
                        confidence: l.confidence / 100,
                        bbox: l.bbox,
                    })),
                },
            };
        } catch (error) {
            console.error('Tesseract OCR error:', error);
            throw new Error(`Tesseract OCR failed: ${error.message}`);
        }
    }

    /**
     * Extract text using Vision LLM (Claude/GPT-4V)
     * @param {string} imageUrl - Cloudinary URL
     * @returns {Promise<Object>} - { text, confidence, concepts }
     */
    async extractWithVision(imageUrl) {
        try {
            const apiKey = process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY;

            if (!apiKey) {
                console.warn('⚠️ No Vision API key found, skipping Vision OCR');
                return null;
            }

            console.log('🔍 Running Vision LLM OCR...');

            // Use Claude Sonnet Vision if available
            if (process.env.CLAUDE_API_KEY) {
                // return await this.extractWithClaude(imageUrl);
                console.log('⚠️ Claude Vision temporarily disabled, falling back to Tesseract');
            }

            // Fallback to GPT-4V
            if (process.env.OPENAI_API_KEY) {
                return await this.extractWithGPT4V(imageUrl);
            }

            return null;
        } catch (error) {
            console.error('Vision OCR error:', error);
            return null; // Graceful fallback to Tesseract
        }
    }

    /**
     * Extract text using Claude Vision
     * @param {string} imageUrl - Image URL
     * @returns {Promise<Object>} - OCR result
     */
    async extractWithClaude(imageUrl) {
        try {
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 2000,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: 'image/jpeg', // Assuming JPEG for now, ideally detect from URL
                                        data: '', // Claude API requires base64 for 'image' type, or 'image_url' for URL type (if supported)
                                    },
                                    // NOTE: Claude API currently supports base64 images. URL support might vary.
                                    // For now, let's stick to Tesseract as primary or implement URL fetching + base64 conversion.
                                    // However, to fix the immediate 500 error, let's disable Vision if it's causing issues or fix the payload.
                                    // Actually, standard Claude API expects base64. Let's return null to fallback to Tesseract for now to stabilize.
                                },
                                {
                                    type: 'text',
                                    text: 'Extract all text from this image. Preserve formatting, equations, and structure. Return ONLY the extracted text, nothing else.',
                                },
                            ],
                        },
                    ],
                },
                {
                    headers: {
                        'x-api-key': process.env.CLAUDE_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                }
            );

            const text = response.data.content[0].text.trim();

            console.log('✅ Claude Vision OCR complete');

            return {
                text,
                confidence: 0.95, // Claude Vision is highly accurate
                raw: { source: 'claude-vision' },
            };
        } catch (error) {
            console.error('Claude Vision error:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Choose best OCR method and extract text
     * @param {string|Buffer} image - Image URL or buffer
     * @returns {Promise<Object>} - Best OCR result
     */
    async extractText(image) {
        try {
            // Always use Tesseract first to get bounding boxes (required for text selection)
            const tesseractResult = await this.extractWithTesseract(image);

            // Optional: Enhance text with Vision LLM (if configured), but preserve Tesseract's raw data
            if (typeof image === 'string' && image.startsWith('http')) {
                // Check if Vision is enabled
                if (process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY) {
                    try {
                        const visionResult = await this.extractWithVision(image);
                        if (visionResult && visionResult.text) {
                            console.log('✨ Enhancing OCR text with Vision LLM');
                            tesseractResult.text = visionResult.text;
                            tesseractResult.confidence = Math.max(tesseractResult.confidence, visionResult.confidence);
                            // We keep tesseractResult.raw because Vision doesn't provide bounding boxes
                        }
                    } catch (err) {
                        console.warn('Vision enhancement failed, using Tesseract text:', err.message);
                    }
                }
            }

            return tesseractResult;
        } catch (error) {
            console.error('OCR extraction error:', error);
            throw error;
        }
    }

    /**
     * Detect if image contains handwriting
     * @param {Object} ocrRaw - Raw OCR data from Tesseract
     * @returns {boolean} - True if handwriting detected
     */
    detectHandwriting(ocrRaw) {
        if (!ocrRaw || !ocrRaw.words) return false;

        // Simple heuristic: if average confidence is low, might be handwriting
        const avgConfidence = ocrRaw.words.reduce((sum, w) => sum + w.confidence, 0) / ocrRaw.words.length;

        return avgConfidence < 0.6; // Below 60% confidence suggests handwriting
    }
}

export default new OCRService();
