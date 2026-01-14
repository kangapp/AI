/**
 * API client for communicating with the backend.
 */

import type {
  DatabaseUpdateRequest,
  DatabaseDetail,
  DatabaseListResponse,
  MetadataResponse,
  QueryResponse,
  NaturalQueryResponse,
  QueryHistoryResponse,
  ExportRequest,
  ErrorResponse,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
      const error = (await response.json()) as { detail?: { message?: string } } & ErrorResponse;
      // Support both old format (error.error.message) and new format (detail.message)
      const errorMessage = error.detail?.message || error.error?.message || "Request failed";
      throw new Error(errorMessage);
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

  async updateDatabase(name: string, data: DatabaseUpdateRequest): Promise<DatabaseDetail> {
    return this.request<DatabaseDetail>(`/api/v1/dbs/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
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

  async naturalQuery(
    name: string,
    prompt: string,
    executeImmediately = false
  ): Promise<NaturalQueryResponse> {
    return this.request<NaturalQueryResponse>(
      `/api/v1/dbs/${encodeURIComponent(name)}/query/natural`,
      {
        method: "POST",
        body: JSON.stringify({ prompt, executeImmediately }),
      }
    );
  }

  async getSuggestedQueries(
    name: string,
    limit = 6,
    options?: { seed?: number; exclude?: string[] }
  ): Promise<{ suggestions: string[] }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (options?.seed !== undefined) {
      params.set("seed", options.seed.toString());
    }
    if (options?.exclude && options.exclude.length > 0) {
      params.set("exclude", options.exclude.join(","));
    }
    return this.request<{ suggestions: string[] }>(
      `/api/v1/dbs/${encodeURIComponent(name)}/suggested-queries?${params}`
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

  async deleteQueryHistory(name: string, ids?: number[]): Promise<void> {
    const url = `${this.baseUrl}/api/v1/dbs/${encodeURIComponent(name)}/history`;
    const body = ids === undefined ? {} : { ids };
    const response = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      throw new Error(error.error?.message || "Delete failed");
    }
  }

  async getHistorySummary(name: string): Promise<{
    total_count: number;
    recent_success_count: number;
    recent_error_count: number;
  }> {
    return this.request<{ total_count: number; recent_success_count: number; recent_error_count: number }>(
      `/api/v1/dbs/${encodeURIComponent(name)}/history/summary`
    );
  }

  async exportQueryResults(
    name: string,
    sql: string,
    format: "csv" | "json",
    includeHeaders = true
  ): Promise<void> {
    const url = `${this.baseUrl}/api/v1/dbs/${encodeURIComponent(name)}/query/export`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        format,
        includeHeaders,
      } satisfies ExportRequest),
    });

    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      throw new Error(error.error?.message || "Export failed");
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `query_export_${Date.now()}.${format}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download the file
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }
}

// Export singleton instance
export const api = new ApiClient(API_URL);

// Re-export types from source module
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
  NaturalQueryRequest,
  NaturalQueryResponse,
  QueryHistoryItem,
  QueryHistoryResponse,
  ErrorResponse,
} from "../types";
