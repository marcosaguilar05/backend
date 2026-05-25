import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://yorlin:tTZRLoQtP4O68cO2@cluster1.tkgei.mongodb.net/';
const dbName = process.env.MONGO_DB_NAME || 'appUniversal';

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, { dbName });
    
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection not established');
    }
    
    // Query users collection directly dynamically
    const users = await db.collection('users').find({}).toArray();
    console.log('--- REGISTERED MONGO USERS ---');
    console.log('Total users found:', users.length);
    users.forEach(u => {
        console.log(`- Name: ${u.name || u.nombre || 'S/N'}, Email: ${u.email}`);
    });
    
    await mongoose.disconnect();
}

run().catch(console.error);
