import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, message } from "antd";
import type { DatabaseDetail } from "../../../types";
import { api } from "../../../services/api";

/**
 * Query key factory for database metadata operations
 */
const metadataKeys = {
  all: ["metadata"] as const,
  details: () => [...metadataKeys.all, "detail"] as const,
  detail: (name: string) => [...metadataKeys.details(), name] as const,
};

/**
 * Custom hook for managing database metadata state using React Query.
 * Provides automatic caching and background updates for metadata.
 */
export function useMetadata() {
  const queryClient = useQueryClient();
  const [selectedDatabaseName, setSelectedDatabaseName] = useState<string | null>(null);

  // Query for fetching database metadata
  const metadataQuery = useQuery({
    queryKey: selectedDatabaseName ? metadataKeys.detail(selectedDatabaseName) : ["metadata", "none"],
    queryFn: async () => {
      if (!selectedDatabaseName) {
        throw new Error("No database selected");
      }
      return await api.getDatabase(selectedDatabaseName);
    },
    enabled: !!selectedDatabaseName,
    staleTime: 10 * 60 * 1000, // 10 minutes - metadata changes less frequently
    retry: 1,
  });

  const selectDatabase = useCallback(async (name: string) => {
    setSelectedDatabaseName(name);
  }, []);

  const clearDatabase = useCallback(() => {
    setSelectedDatabaseName(null);
  }, []);

  const deleteDatabaseMutation = useMutation({
    mutationFn: async (name: string) => {
      return await api.deleteDatabase(name);
    },
    onMutate: async (name) => {
      // Cancel related queries
      await queryClient.cancelQueries({ queryKey: metadataKeys.detail(name) });

      // Snapshot previous value
      const previousDatabase = queryClient.getQueryData(metadataKeys.detail(name));

      return { previousDatabase };
    },
    onSuccess: (_, name) => {
      // Invalidate metadata queries
      queryClient.invalidateQueries({ queryKey: metadataKeys.detail(name) });

      // Invalidate database list to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["databases", "list"] });

      // Clear selected database if it was the deleted one
      if (selectedDatabaseName === name) {
        setSelectedDatabaseName(null);
      }

      message.success("数据库删除成功");
    },
    onError: (error: Error, _, context) => {
      // Restore previous data on error
      if (context?.previousDatabase) {
        queryClient.setQueryData(metadataKeys.detail(selectedDatabaseName || ""), context.previousDatabase);
      }
      message.error(error.message || "删除数据库失败");
    },
  });

  const deleteDatabase = useCallback(async (name: string, _currentDatabaseName: string | null) => {
    return new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title: "删除数据库",
        content: `确定要删除 "${name}" 吗？`,
        okText: "删除",
        okType: "danger",
        onOk: async () => {
          try {
            await deleteDatabaseMutation.mutateAsync(name);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        onCancel: () => reject(new Error("删除操作已取消")),
      });
    });
  }, [deleteDatabaseMutation]);

  const refreshMetadata = useCallback(() => {
    if (selectedDatabaseName) {
      queryClient.invalidateQueries({ queryKey: metadataKeys.detail(selectedDatabaseName) });
    }
  }, [queryClient, selectedDatabaseName]);

  return {
    selectedDatabase: metadataQuery.data ?? null,
    selectedDatabaseName,
    loading: metadataQuery.isLoading,
    error: metadataQuery.error ? (metadataQuery.error as Error).message : null,
    selectDatabase,
    clearDatabase,
    deleteDatabase,
    loadDatabaseMetadata: selectDatabase, // Alias for backward compatibility
    refreshMetadata,
    isDeleting: deleteDatabaseMutation.isPending,
  };
}

export type { DatabaseDetail };
