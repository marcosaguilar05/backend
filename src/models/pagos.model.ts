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
    // Nuevos campos agregados
    responsable?: string;
    empresa?: string;
    areaOperacion?: string;
    dependencia?: string;
    grupoRubro?: string;
    rubro?: string;
    subRubro?: string;
    factura?: string;
    soporte?: string;
    activo?: boolean;
    valorFactura?: number;
    pagoParcial?: boolean;
    ingresoGasto?: string;
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
        // Nuevos campos agregados al esquema Mongoose
        responsable: { type: String },
        empresa: { type: String },
        areaOperacion: { type: String },
        dependencia: { type: String },
        grupoRubro: { type: String },
        rubro: { type: String },
        subRubro: { type: String },
        factura: { type: String },
        soporte: { type: String },
        activo: { type: Boolean, default: true },
        valorFactura: { type: Number },
        pagoParcial: { type: Boolean, default: false },
        ingresoGasto: { type: String }
    },
    { timestamps: true, collection: 'pagos' }
);

export const PagoModel = model<IPago>('Pago', pagoSchema);
