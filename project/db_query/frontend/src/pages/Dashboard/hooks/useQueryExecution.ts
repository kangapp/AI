import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import type { QueryResponse, NaturalQueryResponse } from "../../../services/api";
import { api } from "../../../services/api";

/**
 * Query key factory for query execution operations
 */
const queryKeys = {
  all: ["queries"] as const,
  history: (databaseName: string) => [...queryKeys.all, "history", databaseName] as const,
};

/**
 * Custom hook for managing query execution state.
 * Uses React Query for mutations while keeping local state for UI-specific data.
 */
export function useQueryExecution() {
  const queryClient = useQueryClient();
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sql");

  // Mutation for executing SQL queries
  const executeQueryMutation = useMutation({
    mutationFn: async ({ databaseName, sql }: { databaseName: string; sql: string }) => {
      return await api.executeQuery(databaseName, sql);
    },
    onMutate: () => {
      setError(null);
      setQueryResult(null);
    },
    onSuccess: (result) => {
      setQueryResult(result);
      message.success(`查询返回 ${result.rowCount} 行，耗时 ${result.executionTimeMs}ms`);
    },
    onError: (err: Error) => {
      const errorMsg = err.message || "查询执行失败";
      setError(errorMsg);
      message.error(errorMsg);
    },
  });

  // Mutation for natural language queries
  const naturalQueryMutation = useMutation({
    mutationFn: async ({ databaseName, prompt }: { databaseName: string; prompt: string }) => {
      return await api.naturalQuery(databaseName, prompt);
    },
    onSuccess: (response) => {
      if (response.generatedSql) {
        setSql(response.generatedSql);
        setActiveTab("sql");

        // If query results are available, update the query result state
        if (
          response.rowCount !== null &&
          response.rowCount !== undefined &&
          response.columns &&
          response.rows
        ) {
          setQueryResult({
            success: true,
            executedSql: response.generatedSql,
            rowCount: response.rowCount,
            executionTimeMs: response.executionTimeMs || 0,
            columns: response.columns,
            rows: response.rows,
            hasLimit: false,
            limitValue: null,
          });
          setError(null);
          message.success(
            `AI 查询返回 ${response.rowCount} 行，耗时 ${response.executionTimeMs || 0}ms`
          );
        } else {
          message.success("AI 查询执行成功");
        }
      }
    },
    onError: (err: Error) => {
      message.error(err.message || "AI 查询失败");
    },
  });

  const executeQuery = useCallback(async (databaseName: string) => {
    if (!sql.trim()) {
      message.warning("请输入 SQL 查询");
      return;
    }

    await executeQueryMutation.mutateAsync({ databaseName, sql });
  }, [sql, executeQueryMutation]);

  const handleQueryGenerated = useCallback((generatedSql: string) => {
    setSql(generatedSql);
    setActiveTab("sql");
  }, []);

  const handleNaturalQueryExecuted = useCallback((response: NaturalQueryResponse) => {
    // This is now handled by the mutation, but keep for backward compatibility
    if (response.generatedSql) {
      setSql(response.generatedSql);
      setActiveTab("sql");

      if (
        response.rowCount !== null &&
        response.rowCount !== undefined &&
        response.columns &&
        response.rows
      ) {
        setQueryResult({
          success: true,
          executedSql: response.generatedSql,
          rowCount: response.rowCount,
          executionTimeMs: response.executionTimeMs || 0,
          columns: response.columns,
          rows: response.rows,
          hasLimit: false,
          limitValue: null,
        });
        setError(null);
        message.success(
          `AI 查询返回 ${response.rowCount} 行，耗时 ${response.executionTimeMs || 0}ms`
        );
      } else {
        message.success("AI 查询执行成功");
      }
    }
  }, []);

  const clearQuery = useCallback(() => {
    setSql("");
    setQueryResult(null);
    setError(null);
  }, []);

  const invalidateQueryHistory = useCallback((databaseName: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.history(databaseName) });
  }, [queryClient]);

  return {
    sql,
    setSql,
    queryResult,
    setQueryResult,
    loading: executeQueryMutation.isPending || naturalQueryMutation.isPending,
    error,
    activeTab,
    setActiveTab,
    executeQuery,
    handleQueryGenerated,
    handleNaturalQueryExecuted,
    clearQuery,
    invalidateQueryHistory,
    isExecuting: executeQueryMutation.isPending,
    isNaturalQuerying: naturalQueryMutation.isPending,
  };
}

export type { QueryResponse, NaturalQueryResponse };
