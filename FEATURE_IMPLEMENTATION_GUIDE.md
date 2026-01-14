# Feature Implementation Guide

This document provides detailed implementation plans for the UI/UX improvements identified during the codebase review.

## ✅ Completed Features

### 1. Recent Files & Session Management
**Status:** ✅ Complete

**Implementation:**
- Updated `SettingsModal.tsx` to display recent files list with click-to-open functionality
- Added Recent Files dropdown in `Header.tsx` for quick access
- Backend already supported recent files tracking via `globalConfigStore.ts`
- Files are automatically added to recent list when opened
- Users can clear recent files from settings

**Files Modified:**
- `frontend/src/components/modals/SettingsModal.tsx`
- `frontend/src/components/layout/Header.tsx`

**Keyboard Shortcuts:** None (accessible via UI)

---

### 2. Quick Navigation & "Go To" Commands
**Status:** ✅ Complete

**Implementation:**
- Created `GoToModal.tsx` component with support for:
  - Row numbers (e.g., "42")
  - Column names (e.g., "Content")
  - Excel-style cell references (e.g., "B42", "A1")
  - Quick actions for first/last row
- Added Ctrl+G keyboard shortcut to open modal
- Integrated with cell selection store for navigation

**Files Created:**
- `frontend/src/components/modals/GoToModal.tsx`

**Files Modified:**
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+G` - Open Go To dialog

---

### 3. Column Manager & Batch Column Operations
**Status:** ✅ Complete

**Implementation:**
- Created `ColumnManagerModal.tsx` with comprehensive column management:
  - View all columns with statistics (unique values, empty cells)
  - Drag-and-drop column reordering
  - Rename columns inline
  - Delete columns (with confirmation)
  - Duplicate columns
  - Add new columns
- Added Ctrl+M keyboard shortcut to open modal

**Files Created:**
- `frontend/src/components/modals/ColumnManagerModal.tsx`

**Files Modified:**
- `frontend/src/App.tsx`

**Keyboard Shortcuts:** `Ctrl+M` - Open Column Manager

---

## 🚧 Remaining Features to Implement

### 4. Smart Autocomplete & Data Entry Assistance
**Status:** 🔄 Not Started

**Priority:** HIGH (Very High Impact)

**Implementation Plan:**

#### Backend Requirements:
1. Add column value caching to `cellStore.ts`:
   ```typescript
   interface ColumnCache {
     [columnIndex: number]: {
       uniqueValues: Set<string>;
       recentValues: string[]; // Most recently used
       lastUpdated: number;
     };
   }
   ```

2. Create autocomplete utility function:
   ```typescript
   // frontend/src/utils/autocomplete.ts
   export function getSuggestions(
     columnIndex: number,
     inputValue: string,
     columnCache: Map<number, Set<string>>,
     maxSuggestions: number = 10
   ): string[] {
     // Fuzzy matching logic
     // Prioritize exact prefix matches
     // Then fuzzy matches
   }
   ```

#### Frontend Requirements:
1. Modify cell editing in `CellGridVirtualized.tsx`:
   - Add autocomplete dropdown component
   - Position dropdown below/above input based on available space
   - Handle keyboard navigation (Arrow Up/Down, Enter, Escape)
   - Filter suggestions as user types

2. Create `AutocompleteDropdown.tsx` component:
   ```tsx
   interface AutocompleteDropdownProps {
     suggestions: string[];
     onSelect: (value: string) => void;
     onClose: () => void;
     position: { top: number; left: number };
   }
   ```

#### Settings Integration:
- Add toggle in Settings: "Enable autocomplete suggestions"
- Add setting: "Minimum characters before showing suggestions" (default: 1)
- Add setting: "Restrict to existing values only" (boolean)

**Estimated Complexity:** Medium
**Estimated Time:** 4-6 hours

---

### 5. Print View Search & Editing Enhancements
**Status:** 🔄 Not Started

**Priority:** HIGH (Very High Impact for Writers)

**Implementation Plan:**

#### Requirements:
1. Extend `FindReplaceModal.tsx` to support Print view search:
   - Add "Search in:" dropdown with options:
     - Cell View (current)
     - Current Print View
     - All Views

2. For Print View search:
   - Search rendered/formatted content (not just raw cell values)
   - Highlight matches in Print view
   - Navigate between matches visually
   - Support replace in Print view

#### Technical Approach:
1. Add search context to `findReplaceStore.ts`:
   ```typescript
   interface FindReplaceState {
     searchContext: 'cell' | 'print' | 'all';
     printMatches: Array<{
       rowIndex: number;
       element: string; // For screenplay: element type
       matchText: string;
     }>;
   }
   ```

2. Modify Print components (`ScreenplayPrint.tsx`, `CardPrint.tsx`):
   - Add highlight wrapper for search matches
   - Subscribe to findReplaceStore for current search term
   - Implement scrollIntoView for match navigation

3. Create unified search function:
   ```typescript
   // Searches both cell data and rendered Print content
   function searchAllViews(term: string, options: SearchOptions): SearchResults
   ```

**Estimated Complexity:** High
**Estimated Time:** 8-12 hours

---

### 6. Workspace Layouts & Panel Presets
**Status:** 🔄 Not Started

**Priority:** MEDIUM-HIGH

**Implementation Plan:**

#### Data Structure:
```typescript
// frontend/src/types/workspace.ts
export interface WorkspaceLayout {
  id: string;
  name: string;
  printDrawerPosition: 'right' | 'bottom' | null;
  printDrawerSize: number;
  sidebarOpen: boolean;
  selectedPrintRecipe: string | null;
  zoomLevel: number;
  columnWidths?: Record<string, number>;
  isDefault?: boolean;
}
```

#### Backend Requirements:
1. Create `workspaceStore.ts`:
   ```typescript
   interface WorkspaceStore {
     layouts: WorkspaceLayout[];
     currentLayoutId: string | null;

     saveLayout: (name: string) => void;
     loadLayout: (id: string) => void;
     deleteLayout: (id: string) => void;
     setDefaultLayout: (id: string) => void;
   }
   ```

2. Persist layouts to backend via Tauri:
   ```rust
   // backend/src/workspace.rs
   pub async fn save_workspace_layout(layout: WorkspaceLayout) -> Result<()>
   pub async fn load_workspace_layouts() -> Result<Vec<WorkspaceLayout>>
   ```

#### Frontend Requirements:
1. Create `WorkspaceManager.tsx` modal:
   - List all saved layouts
   - Save current layout with custom name
   - Load/delete/rename layouts
   - Set default layout

2. Add workspace switcher to toolbar:
   - Dropdown showing all layouts
   - Quick-switch between layouts

3. Keyboard shortcuts:
   - `Ctrl+1` through `Ctrl+9` for layout presets 1-9

**Estimated Complexity:** Medium
**Estimated Time:** 6-8 hours

---

### 7. Comparison & Diff View for CSV Files
**Status:** 🔄 Not Started

**Priority:** HIGH (Critical for Git Workflows)

**Implementation Plan:**

#### Data Structure:
```typescript
interface DiffResult {
  addedRows: number[];
  deletedRows: number[];
  modifiedCells: Array<{
    row: number;
    col: number;
    oldValue: string;
    newValue: string;
  }>;
  columnChanges: {
    added: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
  };
}
```

#### Backend Requirements:
1. Create diff utility in Rust:
   ```rust
   // backend/src/diff.rs
   pub fn compare_csv_files(
     file1_path: String,
     file2_path: String
   ) -> Result<DiffResult>
   ```

2. Implement LCS (Longest Common Subsequence) algorithm for row matching
3. Handle column reordering detection

#### Frontend Requirements:
1. Create `DiffViewModal.tsx`:
   - Two-panel layout showing both files side-by-side
   - Color-coded diff:
     - Green: Added rows/cells
     - Red: Deleted rows/cells
     - Yellow: Modified cells
   - Synchronized scrolling
   - Navigation between changes

2. Add "Compare with..." command:
   - File menu option
   - Keyboard shortcut: `Ctrl+Shift+D`

3. Integration with git:
   - "Compare with last commit" option
   - Uses `git show HEAD:file.csv` to get previous version

**Estimated Complexity:** High
**Estimated Time:** 12-16 hours

---

### 8. Export Templates & Custom Export Formats
**Status:** 🔄 Not Started

**Priority:** VERY HIGH (Core Value Proposition)

**Implementation Plan:**

#### Data Structure:
```typescript
interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  outputFormat: 'json' | 'yaml' | 'xml' | 'custom';

  // Field mapping
  fieldMappings: Array<{
    csvColumn: string;
    exportField: string;
    transform?: TransformFunction;
  }>;

  // Template strings
  headerTemplate?: string;
  rowTemplate: string;
  footerTemplate?: string;

  // Options
  options: {
    prettyPrint?: boolean;
    indentation?: number;
    encoding?: string;
  };
}

type TransformFunction =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'parseNumber'
  | 'parseBoolean'
  | { custom: string }; // JavaScript expression
```

#### Backend Requirements:
1. Create export engine:
   ```rust
   // backend/src/exporters/
   pub mod json_exporter;
   pub mod yaml_exporter;
   pub mod xml_exporter;
   pub mod template_exporter;

   pub trait Exporter {
     fn export(&self, data: &CsvData, template: &ExportTemplate) -> Result<String>;
   }
   ```

2. Template storage:
   ```rust
   pub async fn save_export_template(template: ExportTemplate) -> Result<()>
   pub async fn load_export_templates() -> Result<Vec<ExportTemplate>>
   ```

#### Frontend Requirements:
1. Create `ExportTemplateEditor.tsx`:
   - Visual template builder
   - Field mapping drag-and-drop
   - Live preview of output
   - Test export with sample rows

2. Bundled templates for common engines:
   - Unity ScriptableObject JSON
   - Unreal DataTable JSON
   - Godot Resource format
   - Ink/Yarn dialogue format
   - Generic JSON/YAML

3. Export workflow:
   - "Export As..." menu option
   - Select template
   - Preview output
   - Save to file

**Example Unity Template:**
```json
{
  "id": "unity-scriptable-object",
  "name": "Unity ScriptableObject",
  "outputFormat": "json",
  "rowTemplate": "  {\n    \"id\": \"{id}\",\n    \"displayName\": \"{name}\",\n    \"description\": \"{description}\",\n    \"value\": {value}\n  }",
  "headerTemplate": "{\n  \"items\": [\n",
  "footerTemplate": "\n  ]\n}"
}
```

**Estimated Complexity:** High
**Estimated Time:** 16-20 hours

---

### 9. Multi-Cursor & Multi-Cell Editing
**Status:** 🔄 Not Started

**Priority:** MEDIUM

**Implementation Plan:**

#### Data Structure:
```typescript
// Add to cellSelectionStore.ts
interface CellSelectionStore {
  multiCursors: Array<{ row: number; col: number }>;

  addCursor: (row: number, col: number) => void;
  removeCursor: (row: number, col: number) => void;
  clearCursors: () => void;
  hasMultipleCursors: () => boolean;
}
```

#### Frontend Requirements:
1. Modify `CellGridVirtualized.tsx`:
   - Handle Ctrl+Click to add cursors
   - Render multiple cursors visually
   - Sync typing across all cursors

2. Multi-cursor operations:
   - Type to update all cells simultaneously
   - Paste to update all cells
   - Delete to clear all cells
   - Undo/redo for multi-cursor edits

3. Visual feedback:
   - Primary cursor: solid outline
   - Secondary cursors: dashed outline or different color

**Estimated Complexity:** Medium
**Estimated Time:** 6-8 hours

---

### 10. Cell Edit History & Audit Trail
**Status:** 🔄 Not Started

**Priority:** MEDIUM-LOW

**Implementation Plan:**

#### Data Structure:
```typescript
interface CellEdit {
  timestamp: number;
  row: number;
  col: number;
  oldValue: string;
  newValue: string;
  user?: string; // For future multi-user support
  commitHash?: string; // Git integration
}

interface CellHistory {
  [cellKey: string]: CellEdit[]; // cellKey = "row:col"
}
```

#### Backend Requirements:
1. Create history tracking:
   ```typescript
   // frontend/src/stores/cellHistoryStore.ts
   interface CellHistoryStore {
     history: CellHistory;

     recordEdit: (edit: CellEdit) => void;
     getCellHistory: (row: number, col: number) => CellEdit[];
     clearHistory: () => void;
   }
   ```

2. Optional: Git integration
   ```rust
   // backend/src/git.rs
   pub async fn get_cell_history_from_git(
     file_path: String,
     row: usize,
     col: usize
   ) -> Result<Vec<GitCommit>>
   ```

#### Frontend Requirements:
1. Create `CellHistoryModal.tsx`:
   - Timeline view of cell changes
   - Show old → new values
   - Git commit attribution (if available)
   - Restore previous value option

2. Context menu integration:
   - Right-click cell → "View History"

3. History persistence:
   - Store in-session history
   - Optional: Persist to file for long-term tracking

**Estimated Complexity:** Medium-High
**Estimated Time:** 8-10 hours

---

## Implementation Priority Recommendations

### Phase 1: High-Impact, Medium Complexity (Next Sprint)
1. ✅ Recent Files (Completed)
2. ✅ Quick Navigation (Completed)
3. ✅ Column Manager (Completed)
4. **Smart Autocomplete** - 4-6 hours
5. **Workspace Layouts** - 6-8 hours

**Total Time:** 10-14 hours

### Phase 2: High-Impact, High Complexity (Following Sprint)
6. **Print View Search** - 8-12 hours
7. **Export Templates** - 16-20 hours
8. **Diff View** - 12-16 hours

**Total Time:** 36-48 hours

### Phase 3: Power User Features (Future)
9. **Multi-Cursor** - 6-8 hours
10. **Cell History** - 8-10 hours

**Total Time:** 14-18 hours

---

## Testing Requirements

### For Each Feature:
1. **Unit Tests:**
   - Test core logic in isolation
   - Mock dependencies

2. **Integration Tests:**
   - Test feature with real data
   - Test edge cases (empty files, large files, etc.)

3. **E2E Tests:**
   - Test complete user workflows
   - Test keyboard shortcuts
   - Test persistence

### Test Files to Create:
```
frontend/src/__tests__/
  ├── GoToModal.test.tsx
  ├── ColumnManager.test.tsx
  ├── Autocomplete.test.tsx
  ├── WorkspaceLayouts.test.tsx
  ├── ExportTemplates.test.tsx
  └── DiffView.test.tsx
```

---

## Documentation Requirements

### For Each Feature, Update:
1. **User Documentation:**
   - `wiki/02_Cell View/` - For cell-related features
   - `wiki/03_Print View/` - For print-related features
   - `wiki/04_Customization/03.02_Keyboard Shortcuts.md` - Add new shortcuts

2. **Developer Documentation:**
   - Architecture decisions
   - API documentation
   - Code examples

3. **Changelog:**
   - `CHANGELOG.md` - User-facing changes
   - `wiki/05_Development/05.08_PendingChangelog.md` - Development notes

---

## Performance Considerations

### For Large Files (10,000+ rows):
1. **Smart Autocomplete:**
   - Debounce suggestion calculation (300ms)
   - Limit unique value cache size (max 1000 per column)
   - Use Web Worker for fuzzy matching

2. **Diff View:**
   - Progressive diff calculation
   - Virtual scrolling for large diffs
   - Limit visible context (±10 rows from changes)

3. **Cell History:**
   - Cap history per cell (max 100 edits)
   - Periodic cleanup of old history
   - Optional feature (can be disabled)

---

## Breaking Changes

### None Expected
All features are additive and don't modify existing APIs or data formats.

### Migration Plan (If Needed):
- Workspace layouts: New feature, no migration
- Export templates: New feature, no migration
- Cell history: Optional feature, no migration

---

## Future Enhancements

### Smart Autocomplete:
- Machine learning for better suggestions
- Context-aware suggestions (based on other columns)
- Multi-language support

### Export Templates:
- Community template marketplace
- Template versioning
- Template inheritance

### Diff View:
- Three-way merge for conflict resolution
- Git blame integration
- Visual merge tool

### Workspace Layouts:
- Cloud sync (optional)
- Team-shared layouts
- Layout templates

---

## Questions & Decisions

### Smart Autocomplete:
- **Q:** Should autocomplete be enabled by default?
- **A:** Yes, but with opt-out in settings

### Export Templates:
- **Q:** Should templates be stored per-file or globally?
- **A:** Global templates, but can be overridden per-file

### Diff View:
- **Q:** Should we integrate with Git directly or just compare files?
- **A:** Start with file comparison, add Git integration in Phase 2

---

## Summary

**Completed:** 3 features (Recent Files, Quick Navigation, Column Manager)
**Remaining:** 7 features
**Total Estimated Time:** 60-80 hours for all remaining features

**Recommended Next Steps:**
1. Implement Smart Autocomplete (highest ROI)
2. Implement Workspace Layouts (good UX improvement)
3. Implement Print View Search (critical for writers)
4. Implement Export Templates (core value prop)

**All features align with Seria's vision:**
- Writer-friendly workflows ✅
- Game development pipeline integration ✅
- Local-first, privacy-focused ✅
- Power user features ✅
