/**
 * Workspace Layout Types
 *
 * Defines the structure for saving and loading workspace layouts
 * (panel positions, sizes, recipes, zoom levels, etc.)
 */

export interface WorkspaceLayout {
    id: string;
    name: string;
    printDrawerPosition: "right" | "bottom" | null;
    printDrawerSize: number;
    sidebarOpen: boolean;
    selectedPrintRecipe: string | null;
    zoomLevel: number;
    columnWidths?: Record<string, number>;
    isDefault?: boolean;
    createdAt: number;
    lastUsed: number;
}
