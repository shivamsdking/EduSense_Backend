import User from '../models/User.js';

/**
 * Get Global Leaderboard
 * Returns top 10 users by points
 */
export const getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find({})
            .sort({ points: -1 })
            .limit(10)
            .select('name points streak picture badge');

        res.status(200).json({
            success: true,
            data: topUsers,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard',
        });
    }
};

/**
 * Get User Stats (Streak, Points, Rank)
 */
export const getUserStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('points streak badges');

        // Calculate rank
        const rank = await User.countDocuments({ points: { $gt: user.points } }) + 1;

        res.status(200).json({
            success: true,
            data: {
                points: user.points,
                streak: user.streak,
                badges: user.badges,
                rank,
            },
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats',
        });
    }
};
