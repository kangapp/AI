/**
 * Custom hook for managing database query state and execution.
 */

import { useState, useCallback } from "react";
import { message } from "antd";
import type { QueryResponse } from "../services/api";
import { api } from "../services/api";

export interface UseDatabaseQueryResult {
  sql: string;
  setSql: (sql: string) => void;
  result: QueryResponse | null;
  loading: boolean;
  error: string | null;
  executeQuery: () => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

export function useDatabaseQuery(databaseName: string): UseDatabaseQueryResult {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = useCallback(async () => {
    if (!sql.trim()) {
      message.warning("请输入 SQL 查询");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const queryResult = await api.executeQuery(databaseName, sql);
      setResult(queryResult);
      message.success(`查询返回 ${queryResult.rowCount} 行，耗时 ${queryResult.executionTimeMs}ms`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "查询执行失败";
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [databaseName, sql]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    sql,
    setSql,
    result,
    loading,
    error,
    executeQuery,
    clearError,
    clearResult,
  };
}
