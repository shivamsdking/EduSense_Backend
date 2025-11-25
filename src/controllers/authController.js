import { admin } from '../config/firebase.js';
import User from '../models/User.js';
import { generateToken, setTokenCookie, clearTokenCookie } from '../utils/jwt.js';

/**
 * Verify Firebase ID token and create/login user
 * POST /api/auth/verify-token
 */
export const verifyFirebaseToken = async (req, res) => {
    try {
        const { idToken, hasSetPassword } = req.body;

        if (!idToken) {
            return res.status(400).json({
                success: false,
                message: 'ID token is required',
            });
        }

        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name, picture, firebase } = decodedToken;

        // Determine provider
        const provider = firebase.sign_in_provider === 'google.com' ? 'google' : 'email';

        // Check if user exists
        let user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            // Create new user
            user = await User.create({
                firebaseUid: uid,
                email: email || decodedToken.email,
                name: name || decodedToken.name || email.split('@')[0],
                picture: picture || decodedToken.picture || '',
                provider,
                hasPassword: provider === 'email' || hasSetPassword === true,
            });

            console.log('✅ New user created:', user.email);
        } else {
            // Update hasPassword if user set password after Google login
            if (hasSetPassword && !user.hasPassword) {
                user.hasPassword = true;
                await user.save();
            }
        }

        // Generate JWT
        const jwtToken = generateToken({
            userId: user._id,
            email: user.email,
            firebaseUid: user.firebaseUid,
        });

        // Set HTTP-only cookie
        setTokenCookie(res, jwtToken);

        // Return user data
        res.status(200).json({
            success: true,
            message: 'Authentication successful',
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture,
                provider: user.provider,
                hasPassword: user.hasPassword,
                streak: user.streak,
                points: user.points,
                badges: user.badges,
            },
            needsPassword: provider === 'google' && !user.hasPassword,
        });
    } catch (error) {
        console.error('❌ Token verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: error.message,
        });
    }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res) => {
    try {
        const user = req.user;

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture,
                provider: user.provider,
                hasPassword: user.hasPassword,
                createdAt: user.createdAt,
                streak: user.streak,
                points: user.points,
                badges: user.badges,
            },
        });
    } catch (error) {
        console.error('❌ Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user data',
            error: error.message,
        });
    }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
    try {
        clearTokenCookie(res);

        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message,
        });
    }
};

/**
 * Update user password status (called after Google user sets password)
 * POST /api/auth/update-password-status
 */
export const updatePasswordStatus = async (req, res) => {
    try {
        const user = req.user;

        user.hasPassword = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password status updated',
            user: {
                id: user._id,
                hasPassword: user.hasPassword,
            },
        });
    } catch (error) {
        console.error('❌ Update password status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update password status',
            error: error.message,
        });
    }
};
