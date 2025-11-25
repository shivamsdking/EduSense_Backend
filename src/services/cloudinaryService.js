import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Service
 * Handles media uploads and deletions
 */

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME  || 'dwsddmatc',
    api_key: process.env.CLOUDINARY_API_KEY || '223837411793941',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'EI_UZk_WhR0SW41AhkTDXqzTCIM',
});

console.log('☁️ Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
    api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing',
});

class CloudinaryService {
    /**
     * Upload image or PDF to Cloudinary
     * @param {Buffer|string} file - File buffer or path
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} - { url, publicId, format, width, height }
     */
    async upload(file, options = {}) {
        try {
            const {
                folder = 'ayursetu',
                resourceType = 'auto',
                format = null,
            } = options;

            const uploadOptions = {
                folder,
                resource_type: resourceType,
                use_filename: true,
                unique_filename: true,
            };

            if (format) {
                uploadOptions.format = format;
            }

            let result;
            if (Buffer.isBuffer(file)) {
                // Upload from buffer
                result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        uploadOptions,
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(file);
                });
            } else {
                // Upload from file path
                result = await cloudinary.uploader.upload(file, uploadOptions);
            }

            return {
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
            };
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
        }
    }

    /**
     * Delete media from Cloudinary
     * @param {string} publicId - Cloudinary public ID
     * @param {string} resourceType - Resource type (image, video, raw)
     * @returns {Promise<boolean>} - Success status
     */
    async delete(publicId, resourceType = 'image') {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType,
            });
            return result.result === 'ok';
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
        }
    }

    /**
     * Generate signed URL for secure access
     * @param {string} publicId - Cloudinary public ID
     * @param {Object} options - Transformation options
     * @returns {string} - Signed URL
     */
    generateSignedUrl(publicId, options = {}) {
        const { width, height, crop = 'fill', quality = 'auto' } = options;

        return cloudinary.url(publicId, {
            width,
            height,
            crop,
            quality,
            sign_url: true,
            secure: true,
        });
    }

    /**
     * Get media details
     * @param {string} publicId - Cloudinary public ID
     * @returns {Promise<Object>} - Media metadata
     */
    async getDetails(publicId) {
        try {
            const result = await cloudinary.api.resource(publicId);
            return {
                url: result.secure_url,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
                createdAt: result.created_at,
            };
        } catch (error) {
            console.error('Cloudinary get details error:', error);
            throw new Error(`Failed to get media details: ${error.message}`);
        }
    }
}

export default new CloudinaryService();
