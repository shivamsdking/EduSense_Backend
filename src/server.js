import 'dotenv/config'; // Load env vars before other imports
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// import dotenv from 'dotenv'; // Removed
import connectDB from './config/database.js';
import { initializeFirebaseAdmin } from './config/firebase.js';
import authRoutes from './routes/authRoutes.js';
import askRoutes from './routes/askRoutes.js';
import mediaRoutes from './routes/media.routes.js';
import qdrantClient from './ai/rag/qdrantClient.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Load environment variables
// dotenv.config(); // Loaded at top


// Initialize Express app
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Allowed origins for CORS
const allowedOrigins = [
    'http://localhost:5173',
    'https://eduusense.netlify.app',
    process.env.FRONTEND_URL
].filter(Boolean);

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
});

// Make io accessible to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // Join user's personal room
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Socket disconnected: ${socket.id}`);
    });
});

// Middleware
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
    console.log(`📨 Request: ${req.method} ${req.url}`);
    next();
});

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// API Routes
import userRoutes from './routes/userRoutes.js';

// ...

app.use('/api/auth', authRoutes);
app.use('/api/ask', askRoutes);
console.log('Mounting media routes at /api/media');
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Initialize Firebase Admin
        initializeFirebaseAdmin();

        // Initialize Qdrant (optional - will log if unavailable)
        try {
            await qdrantClient.initializeCollection();
        } catch (qdrantError) {
            console.warn('⚠️  Qdrant not available - RAG features will be limited');
            console.warn('   Start Qdrant with: docker run -p 6333:6333 qdrant/qdrant');
        }

        // Start server
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔑 Groq Key Status: ${process.env.GROQ_API_KEY ? 'Loaded' : 'Checking Code...'}`);
            console.log(`🧠 Qdrant URL: ${process.env.QDRANT_URL || 'Default (localhost)'}`);
            console.log(`🔌 Socket.IO ready for real-time updates`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;

