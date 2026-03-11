const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface ApiOptions {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getToken(): string | null {
        return localStorage.getItem("auth_token");
    }

    private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
        const { method = "GET", body, headers = {} } = options;

        const token = this.getToken();
        const requestHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            ...headers,
        };

        if (token) {
            requestHeaders["Authorization"] = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(`${this.baseUrl}${endpoint}`, {
                method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch (error: any) {
            if (error.message === "Failed to fetch") {
                throw new Error("Backend server is unreachable. Please ensure it is running.");
            }
            throw error;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("auth_token");
                window.dispatchEvent(new Event("auth_error"));
            }
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }

        return data;
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint);
    }

    async post<T>(endpoint: string, body?: any): Promise<T> {
        return this.request<T>(endpoint, { method: "POST", body });
    }

    async put<T>(endpoint: string, body?: any): Promise<T> {
        return this.request<T>(endpoint, { method: "PUT", body });
    }

    async patch<T>(endpoint: string, body?: any): Promise<T> {
        return this.request<T>(endpoint, { method: "PATCH", body });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }

    async downloadBlob(endpoint: string, defaultFileName: string): Promise<void> {
        const token = this.getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Download failed");
        }

        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition");
        let fileName = defaultFileName;
        if (disposition) {
            const match = disposition.match(/filename="?([^"]+)"?/);
            if (match) fileName = match[1];
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}

export const api = new ApiClient(API_URL);
