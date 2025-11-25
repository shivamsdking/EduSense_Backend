import sharp from 'sharp';

/**
 * Crop Service
 * Handles server-side image cropping using Sharp
 */

class CropService {
    /**
     * Crop image from buffer
     * @param {Buffer} imageBuffer - Original image buffer
     * @param {Object} cropData - Crop coordinates
     * @param {number} cropData.x - X coordinate
     * @param {number} cropData.y - Y coordinate
     * @param {number} cropData.width - Crop width
     * @param {number} cropData.height - Crop height
     * @param {number} cropData.scale - Scale factor (optional)
     * @returns {Promise<Buffer>} - Cropped image buffer
     */
    async cropImage(imageBuffer, cropData) {
        try {
            const { x, y, width, height, scale = 1 } = cropData;

            // Validate crop data
            if (x < 0 || y < 0 || width <= 0 || height <= 0) {
                throw new Error('Invalid crop coordinates');
            }

            // Apply scale if provided
            const scaledX = Math.round(x * scale);
            const scaledY = Math.round(y * scale);
            const scaledWidth = Math.round(width * scale);
            const scaledHeight = Math.round(height * scale);

            // Get image metadata
            const metadata = await sharp(imageBuffer).metadata();

            // Ensure crop doesn't exceed image bounds
            if (
                scaledX + scaledWidth > metadata.width ||
                scaledY + scaledHeight > metadata.height
            ) {
                throw new Error('Crop coordinates exceed image bounds');
            }

            // Perform crop
            const croppedBuffer = await sharp(imageBuffer)
                .extract({
                    left: scaledX,
                    top: scaledY,
                    width: scaledWidth,
                    height: scaledHeight,
                })
                .toBuffer();

            return croppedBuffer;
        } catch (error) {
            console.error('Crop error:', error);
            throw new Error(`Failed to crop image: ${error.message}`);
        }
    }

    /**
     * Resize image
     * @param {Buffer} imageBuffer - Image buffer
     * @param {Object} options - Resize options
     * @returns {Promise<Buffer>} - Resized image buffer
     */
    async resizeImage(imageBuffer, options = {}) {
        try {
            const { width, height, fit = 'cover', quality = 90 } = options;

            return await sharp(imageBuffer)
                .resize(width, height, { fit })
                .jpeg({ quality })
                .toBuffer();
        } catch (error) {
            console.error('Resize error:', error);
            throw new Error(`Failed to resize image: ${error.message}`);
        }
    }

    /**
     * Optimize image for web
     * @param {Buffer} imageBuffer - Image buffer
     * @param {number} quality - Quality (1-100)
     * @returns {Promise<Buffer>} - Optimized image buffer
     */
    async optimizeImage(imageBuffer, quality = 85) {
        try {
            return await sharp(imageBuffer)
                .jpeg({ quality, progressive: true })
                .toBuffer();
        } catch (error) {
            console.error('Optimize error:', error);
            throw new Error(`Failed to optimize image: ${error.message}`);
        }
    }

    /**
     * Get image metadata
     * @param {Buffer} imageBuffer - Image buffer
     * @returns {Promise<Object>} - Image metadata
     */
    async getMetadata(imageBuffer) {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: metadata.size,
                hasAlpha: metadata.hasAlpha,
            };
        } catch (error) {
            console.error('Metadata error:', error);
            throw new Error(`Failed to get image metadata: ${error.message}`);
        }
    }
}

export default new CropService();
