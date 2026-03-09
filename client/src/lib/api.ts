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

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
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

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }
}

export const api = new ApiClient(API_URL);
