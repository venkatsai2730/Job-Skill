// ═══════════════════════════════════════════════════════════════
// Qdrant Client — Singleton connection to Qdrant vector DB
//
// Uses @qdrant/js-client-rest. All operations are no-ops when
// USE_QDRANT_RAG is false.
// ═══════════════════════════════════════════════════════════════

import { USE_QDRANT_RAG } from "../config/featureFlags.js";

let qdrantClient: any = null;

/** Get or create the singleton Qdrant client */
export function getQdrantClient(): any | null {
    if (!USE_QDRANT_RAG) return null;
    if (qdrantClient) return qdrantClient;

    try {
        const { QdrantClient } = require("@qdrant/js-client-rest");

        const url = process.env.QDRANT_URL || "http://localhost:6333";
        const apiKey = process.env.QDRANT_API_KEY || undefined;

        qdrantClient = new QdrantClient({
            url,
            apiKey,
            timeout: 10000,
        });

        console.log(`[Qdrant] Client initialized → ${url}`);
        return qdrantClient;
    } catch (err: any) {
        console.warn("[Qdrant] Failed to initialize:", err.message);
        return null;
    }
}

/** Health check — verify connection to Qdrant */
export async function checkQdrantHealth(): Promise<boolean> {
    const client = getQdrantClient();
    if (!client) return false;

    try {
        const collections = await client.getCollections();
        console.log(`[Qdrant] Health OK — ${collections.collections?.length || 0} collections`);
        return true;
    } catch (err: any) {
        console.warn("[Qdrant] Health check failed:", err.message);
        return false;
    }
}
