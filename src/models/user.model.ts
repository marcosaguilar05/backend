import { Schema, model } from 'mongoose';

export interface IUsuario {
    name: string;
    email: string;
    activo: boolean;
}

const userSchema = new Schema<IUsuario>(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        activo: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true, collection: 'users' }
);

export const UserModel = model<IUsuario>('User', userSchema);
