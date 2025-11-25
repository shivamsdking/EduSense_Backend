import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { createCanvas } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * NodeCanvasFactory for pdfjs-dist
 * Required for rendering in Node.js environment
 */
class NodeCanvasFactory {
    create(width, height) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return { canvas, context };
    }

    reset(ctx, width, height) {
        ctx.canvas.width = width;
        ctx.canvas.height = height;
    }

    destroy(ctx) {
        ctx.canvas.width = 0;
        ctx.canvas.height = 0;
        ctx.canvas = null;
        ctx.context = null;
    }
}

/**
 * PDF Service
 * Handles PDF to image conversion and page extraction
 */
class PDFService {
    /**
     * Convert PDF pages to images
     * @param {Buffer} pdfBuffer - PDF file buffer
     * @param {Object} options - Conversion options
     * @returns {Promise<Array>} - Array of { pageNumber, imageBuffer, width, height }
     */
    async convertToImages(pdfBuffer, options = {}) {
        try {
            const { dpi = 200, format = 'png' } = options;

            console.log('📄 Loading PDF document for conversion...');

            // Convert Buffer to Uint8Array
            const data = new Uint8Array(pdfBuffer);

            // Configure paths for CMaps and Fonts
            // Adjust path based on your project structure (assuming node_modules is in root or server root)
            // Since this file is in server/src/services, project root is ../../
            const projectRoot = path.resolve(__dirname, '../../');
            const cMapUrl = path.join(projectRoot, 'node_modules/pdfjs-dist/cmaps/');
            const standardFontDataUrl = path.join(projectRoot, 'node_modules/pdfjs-dist/standard_fonts/');

            // Load PDF using pdfjs-dist with NodeCanvasFactory
            const loadingTask = pdfjsLib.getDocument({
                data,
                cMapUrl,
                cMapPacked: true,
                standardFontDataUrl,
                canvasFactory: new NodeCanvasFactory(),
            });

            const pdfDoc = await loadingTask.promise;
            const pageCount = pdfDoc.numPages;

            console.log(`📄 PDF has ${pageCount} pages`);

            const pages = [];

            for (let i = 1; i <= pageCount; i++) {
                console.log(`🖼️  Converting page ${i}/${pageCount}...`);

                const page = await pdfDoc.getPage(i);

                // Calculate scale based on DPI (72 DPI is default)
                const scale = dpi / 72;
                const viewport = page.getViewport({ scale });

                // Create canvas using the factory pattern implicitly or explicitly
                const canvasFactory = new NodeCanvasFactory();
                const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

                // Render page
                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                    canvasFactory: canvasFactory,
                }).promise;

                const imageBuffer = canvas.toBuffer('image/png');

                pages.push({
                    pageNumber: i,
                    imageBuffer,
                    width: viewport.width,
                    height: viewport.height,
                });
            }

            console.log(`✅ Converted ${pageCount} pages to images`);
            return pages;
        } catch (error) {
            console.error('PDF conversion error:', error);
            throw new Error(`Failed to convert PDF to images: ${error.message}`);
        }
    }

    /**
     * Get PDF metadata
     * @param {Buffer} pdfBuffer - PDF buffer
     * @returns {Promise<Object>} - { pageCount, title, author, creationDate }
     */
    async getMetadata(pdfBuffer) {
        try {
            // Use pdf-lib for metadata as it's lighter/easier for this
            const pdfDoc = await PDFDocument.load(pdfBuffer);

            return {
                pageCount: pdfDoc.getPageCount(),
                title: pdfDoc.getTitle() || 'Untitled',
                author: pdfDoc.getAuthor() || 'Unknown',
                creationDate: pdfDoc.getCreationDate(),
            };
        } catch (error) {
            console.error('PDF metadata error:', error);
            throw new Error(`Failed to get PDF metadata: ${error.message}`);
        }
    }

    /**
     * Extract single page as image
     * @param {Buffer} pdfBuffer - PDF buffer
     * @param {number} pageNumber - Page number (1-based)
     * @param {number} dpi - DPI for rendering
     * @returns {Promise<Buffer>} - Image buffer
     */
    async extractPage(pdfBuffer, pageNumber, dpi = 200) {
        try {
            const pages = await this.convertToImages(pdfBuffer, { dpi });
            const page = pages.find(p => p.pageNumber === pageNumber);

            if (!page) {
                throw new Error(`Page ${pageNumber} not found`);
            }

            return page.imageBuffer;
        } catch (error) {
            console.error('Page extraction error:', error);
            throw new Error(`Failed to extract page: ${error.message}`);
        }
    }
}

export default new PDFService();
