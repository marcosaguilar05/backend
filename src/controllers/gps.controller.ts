import { Response } from 'express';
import { AuthRequest } from '../types';

interface GeotabCredentials {
    database: string;
    userName: string;
    sessionId: string;
}

let cachedSession: {
    credentials: GeotabCredentials;
    serverUrl: string;
    expiresAt: number;
} | null = null;

async function getGeotabSession() {
    if (cachedSession && cachedSession.expiresAt > Date.now()) {
        return cachedSession;
    }

    console.log("🔑 Authenticating with Geotab API...");
    const response = await fetch("https://my.geotab.com/apiv1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "Authenticate",
            params: {
                database: "sespa_sas",
                userName: "universal.analisis.mant@gmail.com",
                password: "1096254990"
            },
            id: 1
        })
    });

    const body = await response.json() as any;
    if (body.error) {
        throw new Error(`Geotab Auth Error: ${body.error.message}`);
    }

    const { credentials, path } = body.result;
    const serverUrl = path === "ThisServer" ? "https://my.geotab.com/apiv1" : `https://${path}/apiv1`;

    cachedSession = {
        credentials,
        serverUrl,
        expiresAt: Date.now() + 1000 * 60 * 60 * 12 // Cache for 12 hours
    };

    return cachedSession;
}

async function queryGeotab(method: string, typeName: string, search?: any): Promise<any> {
    const session = await getGeotabSession();
    
    const response = await fetch(session.serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method,
            params: {
                typeName,
                search,
                credentials: session.credentials
            },
            id: 2
        })
    });

    const body = await response.json() as any;
    
    // Check if session expired
    if (body.error && body.error.message && body.error.message.includes("SessionExpiredException")) {
        console.log("⚠️ Geotab session expired, re-authenticating...");
        cachedSession = null; // Clear cache
        return queryGeotab(method, typeName, search); // Retry once
    }

    if (body.error) {
        throw new Error(`Geotab query error for ${typeName}: ${body.error.message}`);
    }

    return body.result;
}

export const gpsController = {
    async getTracking(req: AuthRequest, res: Response) {
        try {
            console.log("📡 Fetching Geotab GPS live tracking data...");
            const [devices, statuses] = await Promise.all([
                queryGeotab("Get", "Device"),
                queryGeotab("Get", "DeviceStatusInfo")
            ]);

            const statusMap = new Map();
            if (Array.isArray(statuses)) {
                statuses.forEach((status: any) => {
                    if (status.device && status.device.id) {
                        statusMap.set(status.device.id, status);
                    }
                });
            }

            const trackingData = Array.isArray(devices) ? devices.map((device: any) => {
                const status = statusMap.get(device.id);
                return {
                    id: device.id,
                    name: device.name || device.licensePlate || 'Vehículo sin nombre',
                    licensePlate: device.licensePlate || '',
                    serialNumber: device.serialNumber || '',
                    latitude: status ? status.latitude : null,
                    longitude: status ? status.longitude : null,
                    speed: status ? status.speed : 0,
                    bearing: status ? status.bearing : 0,
                    dateTime: status ? status.dateTime : null,
                    isCommunicating: status ? status.isDeviceCommunicating : false
                };
            }) : [];

            res.json(trackingData);
        } catch (error: any) {
            console.error("Error fetching GPS tracking data:", error);
            res.status(500).json({ error: error.message || "Error al obtener datos de GPS Geotab" });
        }
    }
};
