import jwt from 'jsonwebtoken';

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode in token
 * @param {String} expiresIn - Token expiration time (default: 7 days)
 * @returns {String} JWT token
 */
export const generateToken = (payload, expiresIn = '7d') => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn,
    });
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

/**
 * Set JWT cookie in response
 * @param {Object} res - Express response object
 * @param {String} token - JWT token
 */
export const setTokenCookie = (res, token) => {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: isProduction, // Must be true for sameSite: 'none'
        sameSite: isProduction ? 'none' : 'lax', // 'none' allows cross-origin, 'lax' for local dev
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

/**
 * Clear JWT cookie
 * @param {Object} res - Express response object
 */
export const clearTokenCookie = (res) => {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('auth_token', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        expires: new Date(0),
    });
};
