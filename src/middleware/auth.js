import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticateUser = async (req, res, next) => {
    console.log(`🔐 Auth check for: ${req.method} ${req.originalUrl}`);
    try {
        // Get token from cookie
        const token = req.cookies.auth_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Verify token
        const decoded = verifyToken(token);

        // Get user from database
        const user = await User.findById(decoded.userId).select('-__v');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            error: error.message,
        });
    }
};
