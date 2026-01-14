import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import type { DatabaseConnection, DatabaseCreateRequest } from "../../../types";
import { api } from "../../../services/api";

/**
 * Query key factory for database operations
 */
const databaseKeys = {
  all: ["databases"] as const,
  lists: () => [...databaseKeys.all, "list"] as const,
  list: () => [...databaseKeys.lists()] as const,
  details: () => [...databaseKeys.all, "detail"] as const,
  detail: (name: string) => [...databaseKeys.details(), name] as const,
};

/**
 * Custom hook for managing database list state using React Query.
 * Provides automatic caching, refetching, and background updates.
 */
export function useDatabases() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: databaseKeys.list(),
    queryFn: async () => {
      const response = await api.listDatabases();
      return response.databases;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const createDatabaseMutation = useMutation({
    mutationFn: async (request: DatabaseCreateRequest) => {
      return await api.createDatabase(request.name, request.url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      message.success("数据库创建成功");
    },
    onError: (error: Error) => {
      message.error(error.message || "创建数据库失败");
    },
  });

  const deleteDatabaseMutation = useMutation({
    mutationFn: async (name: string) => {
      return await api.deleteDatabase(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      message.success("数据库删除成功");
    },
    onError: (error: Error) => {
      message.error(error.message || "删除数据库失败");
    },
  });

  const updateDatabaseMutation = useMutation({
    mutationFn: async ({ name, request }: { name: string; request: { name?: string; url?: string } }) => {
      return await api.updateDatabase(name, request);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      queryClient.invalidateQueries({ queryKey: databaseKeys.detail(variables.name) });
      message.success("数据库更新成功");
    },
    onError: (error: Error) => {
      message.error(error.message || "更新数据库失败");
    },
  });

  const refreshDatabases = () => {
    queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
  };

  return {
    databases: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    createDatabase: createDatabaseMutation.mutateAsync,
    deleteDatabase: deleteDatabaseMutation.mutateAsync,
    updateDatabase: updateDatabaseMutation.mutateAsync,
    refreshDatabases,
    isCreating: createDatabaseMutation.isPending,
    isDeleting: deleteDatabaseMutation.isPending,
    isUpdating: updateDatabaseMutation.isPending,
  };
}

export type { DatabaseConnection, DatabaseCreateRequest };
