import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        picture: {
            type: String,
            default: '',
        },
        provider: {
            type: String,
            enum: ['google', 'email'],
            required: true,
        },
        hasPassword: {
            type: Boolean,
            default: false,
        },
        points: {
            type: Number,
            default: 0,
        },
        badges: {
            type: [String],
            default: [],
        },
        streak: {
            type: Number,
            default: 0,
        },
        lastActiveDate: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model('User', userSchema);

export default User;
