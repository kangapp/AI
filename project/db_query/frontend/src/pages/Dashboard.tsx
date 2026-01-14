/**
 * Dashboard Component
 *
 * This file exports the refactored Dashboard component.
 * The original 583-line component has been split into:
 * - Dashboard/index.tsx - Main orchestrator component
 * - Dashboard/Sidebar.tsx - Database list and schema browser
 * - Dashboard/DatabaseInfo.tsx - Database information display
 * - Dashboard/QueryTabs.tsx - Query tabs management
 * - Dashboard/hooks/useDatabases.ts - Database state management
 * - Dashboard/hooks/useMetadata.ts - Metadata state management
 * - Dashboard/hooks/useQueryExecution.ts - Query execution state management
 */

// Re-export from the refactored component
export { Dashboard } from "./Dashboard/index";
