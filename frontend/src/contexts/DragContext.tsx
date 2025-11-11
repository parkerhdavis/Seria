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
        setIsDragging(true);
        setDragType(type);
        // Disable text selection globally during drag
        document.body.style.userSelect = "none";
        document.body.style.cursor = type === "column-resize" ? "col-resize" : "ew-resize";
    }, []);

    const endDrag = useCallback(() => {
        setIsDragging(false);
        setDragType(null);
        // Re-enable text selection
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
    }, []);

    return (
        <DragContext.Provider value={{ isDragging, dragType, startDrag, endDrag }}>
            {children}
        </DragContext.Provider>
    );
}

export function useDrag() {
    const context = useContext(DragContext);
    if (context === undefined) {
        throw new Error("useDrag must be used within a DragProvider");
    }
    return context;
}
