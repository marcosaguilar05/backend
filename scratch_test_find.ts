import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from './src/models/user.model';

dotenv.config();

const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://yorlin:tTZRLoQtP4O68cO2@cluster1.tkgei.mongodb.net/';
const dbName = process.env.MONGO_DB_NAME || 'appUniversal';

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, { dbName });
    
    const email = 'universal.mantenimiento2@gmail.com';
    console.log('Searching for email:', email);
    const user = await UserModel.findOne({ email });
    console.log('User found with UserModel:', user);
    
    await mongoose.disconnect();
}

run().catch(console.error);
