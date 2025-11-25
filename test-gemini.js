import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

console.log('----------------------------------------');
console.log('🔍 Testing Gemini API Key');
console.log('----------------------------------------');

if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is missing in .env file');
    process.exit(1);
}

console.log(`🔑 Key found: ${apiKey.substring(0, 8)}...`);

const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
    try {
        // 1. List Models (if possible, though SDK doesn't always expose this easily directly via client)
        // We'll try to just run a simple prompt on gemini-pro first

        console.log('\n🧪 Attempting to generate content with "gemini-pro"...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hello, are you working?');
        const response = await result.response;
        console.log('✅ Success! Response:', response.text());

    } catch (error) {
        console.error('❌ Failed with gemini-pro:', error.message);

        try {
            console.log('\n🧪 Attempting to generate content with "gemini-1.5-flash"...');
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent('Hello, are you working?');
            const response = await result.response;
            console.log('✅ Success! Response:', response.text());
        } catch (error2) {
            console.error('❌ Failed with gemini-1.5-flash:', error2.message);
            console.log('\n⚠️  DIAGNOSIS:');
            console.log('1. If error is "404 Not Found", your API key is valid but has no access to these models.');
            console.log('   - Ensure you created the key in a NEW project.');
            console.log('   - Check if your region supports Gemini API.');
            console.log('2. If error is "400 Bad Request" or "403 Forbidden", the key is invalid.');
        }
    }
}

test();
