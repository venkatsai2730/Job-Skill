// ═══════════════════════════════════════════════════════════════
// Geocode Routes — Reverse geocoding via OpenStreetMap Nominatim
// ═══════════════════════════════════════════════════════════════

import { Router, Response, Request } from "express";

const router = Router();

// In-memory cache for reverse geocode results (1 hour TTL)
const geocodeCache = new Map<string, { timestamp: number; data: any }>();
const GEOCODE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// GET /api/geocode/reverse?lat=X&lon=Y
router.get("/reverse", async (req: Request, res: Response) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            res.status(400).json({ error: "lat and lon query parameters are required" });
            return;
        }

        const cacheKey = `${parseFloat(lat as string).toFixed(2)},${parseFloat(lon as string).toFixed(2)}`;
        const cached = geocodeCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
            res.json(cached.data);
            return;
        }

        // Use OpenStreetMap Nominatim API (free, no API key needed)
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "JobSkillAI/1.0 (job-search-app)",
                "Accept-Language": "en",
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            res.status(502).json({ error: "Geocoding service unavailable" });
            return;
        }

        const data = await response.json();
        const address = data.address || {};

        const result = {
            city: address.city || address.town || address.village || address.county || "",
            state: address.state || "",
            country: address.country || "",
            country_code: (address.country_code || "").toUpperCase(),
            display_name: data.display_name || "",
        };

        // Cache the result
        geocodeCache.set(cacheKey, { timestamp: Date.now(), data: result });

        res.json(result);
    } catch (err: any) {
        console.error("[Geocode] Reverse geocode error:", err.message);
        res.status(500).json({ error: "Failed to reverse geocode" });
    }
});

export default router;
