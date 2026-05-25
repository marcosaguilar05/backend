import mongoose, { ConnectOptions } from 'mongoose';

export async function connectMongoDB(): Promise<void> {
    const mongoUrl = process.env.MONGO_URL;
    const dbName = process.env.MONGO_DB_NAME;

    if (!mongoUrl || !dbName) {
        console.error('⚠️ MONGO_URL o MONGO_DB_NAME no configurados en las variables de entorno');
        return;
    }

    try {
        const options: ConnectOptions = {
            dbName,
            autoIndex: true
        };

        await mongoose.connect(mongoUrl, options);
        console.log(`🔌 Conexión exitosa a MongoDB externa: ${dbName}`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB externa:', error);
        throw error;
    }
}
