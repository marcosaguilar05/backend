import { Schema, model, Types } from 'mongoose';

export interface IPago {
    consecutivo?: string;
    concepto: string;
    valorOperacion?: number;
    valorNeto?: number;
    descuento?: number;
    retencion?: number;
    estadoPago: string;
    tipoPago?: string;
    fecha?: Date;
    fechaPago?: Date;
    user?: string;
    userId: Types.ObjectId;
    tercero?: string;
    placa?: string;
    cuentaBancariaEmpresa?: string;
    banco?: string;
    observacionesUsuario?: string;
}

const pagoSchema = new Schema<IPago>(
    {
        consecutivo: { type: String },
        concepto: { type: String, required: true },
        valorOperacion: { type: Number },
        valorNeto: { type: Number },
        descuento: { type: Number },
        retencion: { type: Number },
        estadoPago: { type: String, required: true },
        tipoPago: { type: String },
        fecha: { type: Date },
        fechaPago: { type: Date },
        user: { type: String },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        tercero: { type: String },
        placa: { type: String },
        cuentaBancariaEmpresa: { type: String },
        banco: { type: String },
        observacionesUsuario: { type: String },
    },
    { timestamps: true, collection: 'pagos' }
);

export const PagoModel = model<IPago>('Pago', pagoSchema);
