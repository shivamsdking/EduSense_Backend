import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://dombeshivam80_db_user:EduSense@edusense-c01.ac0qbzd.mongodb.net/edusense", {
            // These options are no longer needed in Mongoose 6+
            // but keeping them doesn't hurt
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
