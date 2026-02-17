export interface Usuario {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    creado_en: string;
}

export interface TanqueoRelacion {
    idx: number;
    id: number;
    fecha: string;
    conductor_id: number;
    conductor: string;
    placa_id: number;
    placa: string;
    bomba_id: number;
    bomba: string;
    area_operacion_id: number;
    area_operacion: string;
    tipo_combustible: string;
    valor_tanqueo: number;
    cantidad_galones: number;
    horometro: number | null;
    costo_por_galon: number | null;
    valor_anticipo: number | null;
    saldo_disponible: number;
    concepto: string;
    tipo_operacion: string;
    observacion: string | null;
}

export interface Conductor {
    idx: number;
    id: number;
    conductor: string;
    identificacion: string;
}

export interface Placa {
    idx: number;
    id: number;
    placa: string;
    estado: string;
    funcion: string | null;
}

export interface Bomba {
    idx: number;
    id: number;
    bomba: string;
    estado: string;
    identificacion: string;
    area_operacion_id: number;
    area_operacion_id_secundario: number | null;
    area_operacion_id_tecero: number | null;
}

export interface AreaOperacion {
    idx: number;
    id: number;
    nombre: string;
    empresa_id: number;
    nombre_financiero: string;
}