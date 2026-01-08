/**
 * API client for communicating with the backend.
 */

import type {
  DatabaseConnection,
  DatabaseCreateRequest,
  DatabaseDetail,
  DatabaseListResponse,
  ColumnMetadata,
  TableMetadata,
  ViewMetadata,
  MetadataResponse,
  QueryRequest,
  QueryResponse,
  QueryHistoryItem,
  QueryHistoryResponse,
  ErrorResponse,
} from "../types";

const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8000";

/**
 * Base API client with error handling.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      throw new Error(error.error?.message || "Request failed");
    }

    // Handle 204 No Content responses (e.g., DELETE)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Database endpoints

  async listDatabases(): Promise<DatabaseListResponse> {
    return this.request<DatabaseListResponse>("/api/v1/dbs");
  }

  async createDatabase(name: string, url: string): Promise<DatabaseDetail> {
    return this.request<DatabaseDetail>(`/api/v1/dbs/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ name, url }),
    });
  }

  async getDatabase(name: string, refresh = false): Promise<DatabaseDetail> {
    const params = new URLSearchParams({ refresh: refresh.toString() });
    return this.request<DatabaseDetail>(
      `/api/v1/dbs/${encodeURIComponent(name)}?${params}`
    );
  }

  async deleteDatabase(name: string): Promise<void> {
    return this.request<void>(`/api/v1/dbs/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  async getMetadata(name: string, refresh = false): Promise<MetadataResponse> {
    const params = new URLSearchParams({ refresh: refresh.toString() });
    return this.request<MetadataResponse>(
      `/api/v1/dbs/${encodeURIComponent(name)}/metadata?${params}`
    );
  }

  // Query endpoints

  async executeQuery(name: string, sql: string): Promise<QueryResponse> {
    return this.request<QueryResponse>(
      `/api/v1/dbs/${encodeURIComponent(name)}/query`,
      {
        method: "POST",
        body: JSON.stringify({ sql }),
      }
    );
  }

  async getQueryHistory(
    name: string,
    page = 1,
    pageSize = 20
  ): Promise<QueryHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    return this.request<QueryHistoryResponse>(
      `/api/v1/dbs/${encodeURIComponent(name)}/history?${params}`
    );
  }
}

// Export singleton instance
export const api = new ApiClient(API_URL);

// Re-export types
export type {
  DatabaseConnection,
  DatabaseCreateRequest,
  DatabaseDetail,
  DatabaseListResponse,
  ColumnMetadata,
  TableMetadata,
  ViewMetadata,
  MetadataResponse,
  QueryRequest,
  QueryResponse,
  QueryHistoryItem,
  QueryHistoryResponse,
  ErrorResponse,
} from "../types";
