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

async function queryGeotab(method: string, typeName: string, search?: any, resultsLimit?: number): Promise<any> {
    const session = await getGeotabSession();
    
    const params: any = {
        typeName,
        credentials: session.credentials
    };
    if (search) params.search = search;
    if (resultsLimit) params.resultsLimit = resultsLimit;

    const response = await fetch(session.serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method,
            params,
            id: 2
        })
    });

    const body = await response.json() as any;
    
    // Check if session expired
    if (body.error && body.error.message && body.error.message.includes("SessionExpiredException")) {
        console.log("⚠️ Geotab session expired, re-authenticating...");
        cachedSession = null; // Clear cache
        return queryGeotab(method, typeName, search, resultsLimit); // Retry once
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
    },

    async getHistory(req: AuthRequest, res: Response) {
        try {
            const { deviceId } = req.params;
            // Optional date query param (ISO), defaults to today in Colombia time
            const dateParam = req.query.date as string | undefined;

            // Build the day range (Colombia UTC-5)
            let startOfDay: Date;
            let endOfDay: Date;
            if (dateParam) {
                startOfDay = new Date(`${dateParam}T00:00:00-05:00`);
                endOfDay   = new Date(`${dateParam}T23:59:59-05:00`);
            } else {
                const now = new Date();
                const colOffset = -5 * 60 * 60 * 1000;
                const colNow = new Date(now.getTime() + colOffset);
                const dayStr = colNow.toISOString().slice(0, 10);
                startOfDay = new Date(`${dayStr}T00:00:00-05:00`);
                endOfDay   = new Date(`${dayStr}T23:59:59-05:00`);
            }

            console.log(`📜 Fetching route history for device ${deviceId} from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

            const records: any[] = await queryGeotab(
                "Get",
                "LogRecord",
                {
                    deviceSearch: { id: deviceId },
                    fromDate: startOfDay.toISOString(),
                    toDate: endOfDay.toISOString()
                },
                10000 // limit to 10k points for performance
            );

            if (!Array.isArray(records) || records.length === 0) {
                return res.json({ trail: [], stops: [] });
            }

            // Sort ascending by time
            records.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

            // Build trail: only keep points with valid coords
            const trail = records
                .filter(r => r.latitude !== 0 || r.longitude !== 0)
                .map(r => ({
                    lat: r.latitude,
                    lng: r.longitude,
                    speed: r.speed,
                    dateTime: r.dateTime
                }));

            // Derive stops: consecutive points where speed < 5 km/h lasting > 2 minutes
            const STOP_SPEED_KMH = 5;
            const MIN_STOP_DURATION_MS = 2 * 60 * 1000; // 2 minutes

            const stops: { lat: number; lng: number; startTime: string; endTime: string; durationMin: number }[] = [];
            let stopStart: number | null = null;
            let stopStartPoint: typeof trail[0] | null = null;

            for (let i = 0; i < trail.length; i++) {
                const point = trail[i];
                const isStopped = point.speed < STOP_SPEED_KMH;

                if (isStopped && stopStart === null) {
                    stopStart = new Date(point.dateTime).getTime();
                    stopStartPoint = point;
                } else if (!isStopped && stopStart !== null && stopStartPoint !== null) {
                    const prevPoint = trail[i - 1];
                    const stopEnd = new Date(prevPoint.dateTime).getTime();
                    const duration = stopEnd - stopStart;
                    if (duration >= MIN_STOP_DURATION_MS) {
                        stops.push({
                            lat: stopStartPoint.lat,
                            lng: stopStartPoint.lng,
                            startTime: stopStartPoint.dateTime,
                            endTime: prevPoint.dateTime,
                            durationMin: Math.round(duration / 60000)
                        });
                    }
                    stopStart = null;
                    stopStartPoint = null;
                }
            }

            // Close last open stop at end of trail
            if (stopStart !== null && stopStartPoint !== null && trail.length > 0) {
                const lastPoint = trail[trail.length - 1];
                const stopEnd = new Date(lastPoint.dateTime).getTime();
                const duration = stopEnd - stopStart;
                if (duration >= MIN_STOP_DURATION_MS) {
                    stops.push({
                        lat: stopStartPoint.lat,
                        lng: stopStartPoint.lng,
                        startTime: stopStartPoint.dateTime,
                        endTime: lastPoint.dateTime,
                        durationMin: Math.round(duration / 60000)
                    });
                }
            }

            res.json({ trail, stops });
        } catch (error: any) {
            console.error("Error fetching GPS route history:", error);
            res.status(500).json({ error: error.message || "Error al obtener historial de ruta" });
        }
    }
};
