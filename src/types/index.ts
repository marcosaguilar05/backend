import { Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Usuario {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    creado_en?: string;
}

export interface AuthRequest extends Request {
    user?: Usuario;
    accessToken?: string;
    supabase?: SupabaseClient;
}

export interface Tanqueo {
    id?: number;
    fecha: string;
    // Campos opcionales/nulos dependiendo del tipo de operación
    conductor_id?: number | null;
    placa_id?: number | null;
    tipo_combustible?: string | null;
    valor_tanqueo?: number | null;
    cantidad_galones?: number | null;
    costo_por_galon?: number | null;
    valor_anticipo?: number | null;
    saldo_disponible?: number | null;

    bomba_id: number;
    area_operacion_id: number;
    concepto: string;
    tipo_operacion: string;
    observacion?: string | null;
    horometro?: number | null;
    creado_por?: string;
    actualizado_por?: string;
    actualizado_en?: string;
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

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: Usuario;
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
}


export interface PaginatedResponse {
    data: TanqueoRelacion[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface TanqueoFilters {
    conductor?: string;
    placa?: string;
    bomba?: string;
    area_operacion?: string;
    tipo_combustible?: string;
    concepto?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
}

export interface FilterOptions {
    conductores: string[];
    placas: string[];
    bombas: string[];
    areas_operacion: string[];
    tipos_combustible: string[];
    conceptos: string[];
}

export interface Engrase {
    id?: number;
    fecha: string;
    conductor_id: number;
    placa_id: number;
    area_operacion_id: number;
    lavado: number;
    engrase: number;
    otros: number;
    suma?: number; // Backend usually calculates or it is passed
    observaciones?: string | null;
    creado_por?: string;
    actualizado_por?: string;
    actualizado_en?: string;
}

export interface EngraseRelacion {
    idx: number;
    id: number;
    fecha: string;
    conductor_id: number;
    conductor: string;
    placa_id: number;
    placa: string;
    area_operacion_id: number;
    area_operacion: string;
    lavado: number;
    engrase: number;
    otros: number;
    suma: number;
    observaciones: string | null;
}

export interface EngraseFilters {
    conductor?: string;
    placa?: string;
    area_operacion?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
}

export interface EngraseFilterOptions {
    conductores: string[];
    placas: string[];
    areas_operacion: string[];
}

export interface DocumentoVehiculo {
    id?: number;
    placa_id: number;
    area_operacion_id: number;
    fecha_vencimiento_soat?: string | null;
    fecha_vencimiento_rtm?: string | null;
    fecha_vencimiento_poliza?: string | null;
    pdf_soat?: string | null;
    pdf_rtm?: string | null;
    tarjeta_propiedad?: string | null;
    pdf_poliza?: string | null;
    creado_por?: string;
    actualizado_por?: string;
    actualizado_en?: string;
}

export interface DocumentoVehiculoRelacion {
    idx: number;
    id: number;
    placa_id: number;
    placa: string;
    area_operacion_id: number;
    area_operacion: string;
    fecha_vencimiento_soat: string | null;
    fecha_vencimiento_rtm: string | null;
    fecha_vencimiento_poliza: string | null;
    pdf_soat: string | null;
    pdf_rtm: string | null;
    tarjeta_propiedad: string | null;
    pdf_poliza: string | null;
}

export interface DocumentoFilters {
    placa?: string;
    area_operacion?: string;
    vencimiento_proximo?: boolean;
}

export interface DocumentoFilterOptions {
    placas: string[];
    areas_operacion: string[];
}

// ==================== MÓDULO DE PRESUPUESTOS ====================

export interface MaestroRubro {
    id: number;
    nivel: number;
    codigo: string;
    nombre: string;
    tipo: 'DEPENDENCIA' | 'GRUPO_RUBRO' | 'RUBRO';
    codigo_concatenado: string | null;
    abreviatura: string | null;
    activo: boolean;
    rubro_padre_id: number | null;
}

export interface TipoPresupuesto {
    id: number;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
}

export interface ConceptoPresupuesto {
    id: number;
    tipo_presupuesto_id: number;
    nombre: string;
    unidad: string | null;
    activo: boolean;
}

export interface Presupuesto {
    id?: number;
    empresa_id: number;
    vehiculo_id: number | null;
    area_operacion_id: number;
    grupo_rubro_id: number;
    rubro_id: number;
    anio: number;
    estado: 'BORRADOR' | 'APROBADO';
    empleado_id?: number | null;
    created_at?: string;
}

export interface PresupuestoItem {
    id?: number;
    presupuesto_id: number;
    tipo_presupuesto_id: number;
    concepto_presupuesto_id: number;
    frecuencia_mes: number;
    meses_aplicables: number[];
    valor_unitario: number;
    valor_total: number;
    nota?: string;
}

export interface PresupuestoConItems extends Presupuesto {
    items: PresupuestoItem[];
    // Relaciones
    vehiculo?: { placa: string };
    area_operacion?: { nombre: string };
    grupo_rubro?: { nombre: string; codigo: string };
    rubro?: { nombre: string; codigo: string };
}

export interface PresupuestoFilters {
    empresa_id?: number;
    vehiculo_id?: number;
    area_operacion_id?: number;
    anio?: number;
    estado?: 'BORRADOR' | 'APROBADO';
}

// ==================== GESTIÓN DE FLOTA ====================

export interface CatClaseVehiculo {
    id: number;
    nombre: string;
}

export interface CatCombustible {
    id: number;
    nombre: string;
}

export interface CatMarca {
    id: number;
    nombre: string;
}

export interface CatMarcaCompactadora {
    id: number;
    nombre: string;
}

export interface CatTipoVehiculo {
    id: number;
    nombre: string;
}

export interface Vehiculo {
    id: number;
    placa_id: number;
    empresa_id: number | null;
    operacion_id: number | null;
    created_at?: string;
    // Relations (Partial)
    areas_placas?: { placa: string };
    empresas?: { empresa: string };
    areas_operacion?: { nombre: string };
    vehiculo_caracteristicas?: VehiculoCaracteristicas;
}

export interface VehiculoCaracteristicas {
    vehiculo_id: number;
    marca_id: number | null;
    tipo_vehiculo_id: number | null;
    clase_vehiculo_id: number | null;
    combustible_id: number | null;
    marca_compactadora_id: number | null;
    nro_ejes: string | null;
    nro_llantas: string | null;
    anio: string | null; // año en DB es text
    linea: string | null;
    nro_serie: string | null;
    // Relations
    cat_marca?: CatMarca;
    cat_tipo_vehiculo?: CatTipoVehiculo;
    cat_clase_vehiculo?: CatClaseVehiculo;
    cat_combustible?: CatCombustible;
    cat_marca_compactadora?: CatMarcaCompactadora;
}

// ==================== MANTENIMIENTO ====================

export interface TipoMantenimiento {
    id: number;
    tipo: string;
}

export interface TipoCondicion {
    id: number;
    codigo: string;
    nombre: string;
}

export interface PlanMantenimiento {
    id: number;
    vehiculo_id: number;
    tipo_mantenimiento_id: number;
    nombre: string;
    activo: boolean;
    // Relations
    vehiculo?: Vehiculo;
    tipo_mantenimiento?: TipoMantenimiento;
    condiciones?: PlanCondicion[];
}

export interface PlanCondicion {
    id: number;
    plan_id: number;
    tipo_condicion_id: number;
    valor: number;
    unidad: string;
    // Relations
    tipo_condicion?: TipoCondicion;
}

export interface MantenimientoEvento {
    id: number;
    plan_id: number;
    vehiculo_id: number;
    fecha: string;
    descripcion: string | null;
    taller_id: number | null;
    costo: number | null;
    hr_evento: number | null;
    km_evento: number | null;
    observaciones: string | null;
    // Relations
    plan_mantenimiento?: PlanMantenimiento;
    vehiculo?: Vehiculo;
    talleres?: { nombre: string }; // Assuming talleres table exists or created later
}
