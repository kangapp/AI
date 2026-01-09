/**
 * TypeScript types matching backend Pydantic models.
 */

// Database types
export type DatabaseType = "mysql" | "postgresql" | "sqlite";

export interface DatabaseConnection {
  id: number;
  name: string;
  url: string;
  dbType: DatabaseType;
  createdAt: string;
  lastConnectedAt: string | null;
  isActive: boolean;
}

export interface DatabaseCreateRequest {
  name: string;
  url: string;
}

export interface DatabaseUpdateRequest {
  name?: string;
  url?: string;
}

export interface ColumnMetadata {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface TableMetadata {
  name: string;
  schema: string | null;
  columns: ColumnMetadata[];
  rowCountEstimate: number | null;
  description: string | null;
}

export interface ViewMetadata {
  name: string;
  schema: string | null;
  columns: ColumnMetadata[];
  definition: string | null;
  description: string | null;
}

export interface DatabaseDetail extends DatabaseConnection {
  tables: TableMetadata[];
  views: ViewMetadata[];
  metadataUpdatedAt: string | null;
}

export interface DatabaseListResponse {
  databases: DatabaseConnection[];
  totalCount: number;
}

export interface MetadataResponse {
  databaseName: string;
  dbType: string;
  tables: TableMetadata[];
  views: ViewMetadata[];
  updatedAt: string;
}

// Query types
export interface QueryRequest {
  sql: string;
}

export interface NaturalQueryRequest {
  prompt: string;
  executeImmediately: boolean;
}

export interface NaturalQueryResponse {
  success: boolean;
  generatedSql: string;
  explanation: string | null;
  isValid: boolean;
  validationMessage: string | null;
}

export interface QueryResponse {
  success: boolean;
  executedSql: string;
  rowCount: number;
  executionTimeMs: number;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  hasLimit: boolean;
  limitValue: number | null;
}

export interface QueryHistoryItem {
  id: number;
  databaseId: number;
  databaseName: string;
  queryType: string;
  inputText: string;
  executedSql: string;
  rowCount: number | null;
  executionTimeMs: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface QueryHistoryResponse {
  items: QueryHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// Export types
export interface ExportRequest {
  format: "csv" | "json";
  includeHeaders?: boolean;
}

export interface ExportResponse {
  content: string;
  contentType: string;
  filename: string;
}

// Error types
export interface ErrorDetail {
  code: string;
  message: string;
  details: string | null;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}
