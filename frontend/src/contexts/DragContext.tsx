/**
 * Drag Context
 *
 * Global context for tracking drag operations across the application.
 * Prevents conflicting behaviors (like text selection or sorting) during drag operations.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface DragContextType {
    isDragging: boolean;
    dragType: string | null;
    startDrag: (type: string) => void;
    endDrag: () => void;
}

const DragContext = createContext<DragContextType | undefined>(undefined);

export function DragProvider({ children }: { children: ReactNode }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<string | null>(null);

    const startDrag = useCallback((type: string) => {
        // Apply CSS immediately (synchronously)
        document.body.style.userSelect = "none";
        document.body.style.webkitUserSelect = "none";
        // document.body.style.mozUserSelect = "none";
        // document.body.style.msUserSelect = "none";
        document.body.style.userSelect = "none";
        document.body.style.cursor = type === "column-resize" ? "col-resize" : "ew-resize";

        // Update state
        setIsDragging(true);
        setDragType(type);
    }, []);

    const endDrag = useCallback(() => {
        // Re-enable text selection
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
        // document.body.style.mozUserSelect = "none";
        // document.body.style.msUserSelect = "none";
        document.body.style.userSelect = "none";
        document.body.style.cursor = "";

        // Update state
        setIsDragging(false);
        setDragType(null);
    }, []);

    return (
        <DragContext.Provider value={{ isDragging, dragType, startDrag, endDrag }}>
            {children}
        </DragContext.Provider>
    );
}

// Disabled: Fast refresh only works when a file only exports components
// Reason: This file exports both a component (DragProvider) and a hook (useDrag). React's Fast Refresh feature doesn't support this pattern and won't hot-reload properly
// Alternative: Move useDrag hook to a separate file (e.g., hooks/useDrag.ts)
// eslint-disable-next-line react-refresh/only-export-components
export function useDrag() {
    const context = useContext(DragContext);
    if (context === undefined) {
        throw new Error("useDrag must be used within a DragProvider");
    }
    return context;
}
