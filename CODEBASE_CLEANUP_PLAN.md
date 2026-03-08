# Seria Codebase Cleanup & Optimization Plan

This document outlines a comprehensive plan for cleaning up, optimizing, and improving the Seria codebase based on a thorough code review.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Category 1: Obvious Bugfixes & Optimizations](#category-1-obvious-bugfixes--optimizations)
3. [Category 2: Optional/Subjective Improvements](#category-2-optionalsubjective-improvements)
4. [Category 3: Big Swing Opportunities](#category-3-big-swing-opportunities)
5. [Outstanding TODOs](#outstanding-todos)
6. [Implementation Prioritization](#implementation-prioritization)

---

## Executive Summary

The Seria codebase is a well-structured Tauri + React application (~17,000 LOC) with clear separation between frontend and backend. However, several areas need attention:

- **6 explicit TODOs** in the codebase
- **100+ console.log statements** that should be removed or moved to a logging system
- **2,155-line monolithic component** (CellGridVirtualized) that needs decomposition
- **Near-zero test coverage** on the frontend (Vitest configured but no tests)
- **Security concerns** in backend file operations
- **Significant code duplication** between TitleBar and Header components

---

## Category 1: Obvious Bugfixes & Optimizations

These are clear improvements with minimal risk that should be addressed.

### 1.1 Security Fixes (Backend)

#### 1.1.1 Temporary File Name Collision Risk
**File:** `backend/src/file_ops.rs:123-130`

**Problem:** Timestamp-based temp file naming can cause collisions if multiple files are created within the same second.

```rust
// Current (vulnerable):
let temp_file_name = format!("seria_temp_{}.csv", timestamp);

// Fixed:
use uuid::Uuid;
let temp_file_name = format!("seria_temp_{}_{}.csv", timestamp, Uuid::new_v4());
```

**Risk:** Data loss from file overwrites
**Effort:** 15 minutes

#### 1.1.2 Missing Path Validation in `get_file_identifiers()`
**File:** `backend/src/file_ops.rs:157-198`

**Problem:** The path parameter is used directly without validation against path traversal attacks.

```rust
// Add at beginning of function:
validate_file_path(&path)?;
```

**Risk:** Potential arbitrary filesystem access
**Effort:** 5 minutes

---

### 1.2 Error Handling Improvements

#### 1.2.1 Add User-Facing Error Notifications for Export Failures
**File:** `frontend/src/components/prints/PrintDrawer.tsx:194`

**Current:** Export errors only log to console
```typescript
} catch (error) {
    console.error("Export failed:", error);
    // TODO: Show error toast/notification to user
}
```

**Fix:** Add toast notification system and display error to user
**Effort:** 1-2 hours (need toast component)

#### 1.2.2 Explicit Error Type Annotations
**Files:** 57 catch blocks across 20+ files

**Problem:** Errors use implicit `unknown` type without proper type checking

**Example fix:**
```typescript
// Before:
catch (error) {
    console.error("Failed:", error);
}

// After:
catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed:", message);
}
```

**Effort:** 2-3 hours for full codebase

---

### 1.3 Remove Debug Console Statements

**Problem:** 100+ console.log/console.error statements throughout codebase

**Key files with excessive logging:**
| File | Console Statements |
|------|-------------------|
| `utils/pdfExport.ts` | 20+ |
| `utils/pdfExportScreenplay.ts` | 8 |
| `stores/cellStore.ts` | 7 |
| `stores/fileConfigStore.ts` | 11 |
| `components/layout/TitleBar.tsx` | 16 |
| `components/FileTree.tsx` | 8 |

**Fix Options:**
1. Remove all debug logs
2. Replace with proper logging library (recommended: `loglevel` or custom logger)

**Effort:** 2-3 hours

---

### 1.4 Remove Unused Code

#### 1.4.1 Unused State Variable
**File:** `frontend/src/components/FileTree.tsx:26-30`

```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
```

**Fix:** Remove the unused state or implement the directory expansion feature
**Effort:** 5 minutes

#### 1.4.2 Commented-Out Code Blocks
**Files:**
- `frontend/src/contexts/DragContext.tsx:27-28` (browser compatibility code)
- `frontend/src/utils/pdfExport.ts:249-264` (unused color conversion function)

**Fix:** Remove or properly implement
**Effort:** 10 minutes

#### 1.4.3 Unused serde_json Dependency
**File:** `backend/Cargo.toml:22`

**Fix:** Remove if not needed, or use for JSON validation
**Effort:** 5 minutes

---

### 1.5 Code Duplication Fix

#### 1.5.1 Duplicate File Operation Handlers
**Files:** `TitleBar.tsx` and `Header.tsx` both implement:
- `handleOpen()` (lines 85-109 vs 42-69)
- `handleSave()` (lines 111-121 vs 72-83)
- `handleSaveAs()` (lines 123-148 vs 96-120)

**Fix:** Extract to shared custom hook:
```typescript
// hooks/useFileOperations.ts
export function useFileOperations() {
    const handleOpen = async () => { /* ... */ };
    const handleSave = async () => { /* ... */ };
    const handleSaveAs = async () => { /* ... */ };
    return { handleOpen, handleSave, handleSaveAs };
}
```

**Effort:** 1-2 hours

#### 1.5.2 Duplicate Path Validation in Backend
**File:** `backend/src/file_ops.rs`

Functions `validate_file_path()` (22-53) and `validate_file_path_for_write()` (57-95) share 80% similar code.

**Fix:** Extract common validation logic to helper function
**Effort:** 30 minutes

---

### 1.6 Performance Optimizations

#### 1.6.1 Inefficient Style Inlining for PDF Export
**File:** `frontend/src/utils/pdfExport.ts:333-352`

**Problem:** O(n²) iteration through all computed styles, triggering reflow/repaint

**Fix:** Batch DOM mutations or use `element.style.cssText`
**Effort:** 1-2 hours

#### 1.6.2 Unnecessary Clones in Screenplay Converter
**File:** `backend/src/converters/screenplay.rs`

Multiple `.clone()` operations on lines 110, 334, 344, 353, 363, 374, 385

**Fix:** Use references or take ownership where possible
**Effort:** 1 hour

---

### 1.7 Backend Code Quality

#### 1.7.1 Run Cargo Fmt
**Problem:** 6+ formatting issues in `screenplay.rs`
**Fix:** `cargo fmt`
**Effort:** 1 minute

#### 1.7.2 CSV Parsing Edge Case
**File:** `backend/src/converters/screenplay.rs:487-518`

**Problem:** `parse_csv_line()` doesn't handle unclosed quotes properly

**Fix:** Return error if `in_quotes` is true after parsing completes
**Effort:** 30 minutes

---

## Category 2: Optional/Subjective Improvements

These improvements enhance code quality but are lower priority or involve trade-offs.

### 2.1 Improved Type Safety

#### 2.1.1 Explicit Return Type Annotations
**Problem:** Many callback functions lack explicit return types

**Files affected:** 10+ files including utilities and stores

**Fix:** Add explicit return type annotations for all exported functions and callbacks
**Effort:** 3-4 hours

#### 2.1.2 Safer Dialog Return Type Handling
**File:** `frontend/src/components/modals/SettingsModal.tsx:72`

```typescript
// Current (unsafe cast):
const configData = await readTextFile(filePath as string);

// Better:
if (typeof filePath === 'string') {
    const configData = await readTextFile(filePath);
}
```

**Effort:** 1 hour across affected files

---

### 2.2 Consistent Error Handling Strategy

#### 2.2.1 Centralized Tauri Error Handler
**Problem:** Inconsistent error handling for Tauri API calls across multiple files

**Fix:** Create centralized error handler:
```typescript
// utils/tauriErrorHandler.ts
export async function invokeSafe<T>(cmd: string, args?: object): Promise<Result<T>> {
    try {
        const result = await invoke<T>(cmd, args);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: formatTauriError(error) };
    }
}
```

**Effort:** 2-3 hours

#### 2.2.2 Standardize Backend Error Message Format
**File:** `backend/src/file_ops.rs`

**Problem:** Mix of plain strings and formatted strings for errors

**Fix:** Use consistent `format!()` pattern with context
**Effort:** 1 hour

---

### 2.3 Component Organization

#### 2.3.1 Extract Keyboard Handlers to Custom Hooks
**Files:** App.tsx, CellGridVirtualized.tsx, ScreenplayPrint.tsx

**Problem:** Keyboard handlers scattered across multiple components

**Fix:** Create `useKeyboardCommands()` hook with command registry
**Effort:** 3-4 hours

#### 2.3.2 Implement Selection Custom Hook
**Problem:** Selection logic duplicated in CellGrid, ScreenplayPrint, CardPrint

**Fix:** Create reusable `useSelection<T>()` hook
**Effort:** 2-3 hours

---

### 2.4 Configuration & State Management

#### 2.4.1 Create ConfigurationService Abstraction
**Problem:** Direct store access scattered across components

**Fix:** Create service layer to coordinate between fileConfigStore/globalConfigStore
**Effort:** 2-3 hours

#### 2.4.2 Implement Store Selectors
**Problem:** Components subscribe to entire stores, causing unnecessary re-renders

**Fix:** Create memoized selectors:
```typescript
const selectFilteredData = (state) => /* memoized filter logic */;
const filteredData = useCellStore(selectFilteredData);
```

**Effort:** 3-4 hours

---

### 2.5 Code Organization

#### 2.5.1 Split Large Utility Files
| File | Lines | Recommendation |
|------|-------|----------------|
| `pdfExportScreenplay.ts` | 929 | Extract shared progress tracking |
| `screenplayPrint.worker.ts` | 870 | Split into parser, formatter, paginator |

**Effort:** 4-6 hours total

#### 2.5.2 Create FileSystemAdapter
**Problem:** Tauri API calls directly in stores/components

**Fix:** Create abstraction layer for easier testing/mocking
**Effort:** 2-3 hours

---

### 2.6 Documentation Improvements

#### 2.6.1 Update WIP Marker in Changelog
**File:** `wiki/05_Development/05.08_PendingChangelog.md:24`

Virtualization Architecture is marked as WIP but appears complete.

**Fix:** Update status or add completion notes
**Effort:** 10 minutes

---

## Category 3: Big Swing Opportunities

These are high-risk, high-reward refactoring opportunities that would significantly improve the codebase but require substantial effort.

### 3.1 Decompose CellGridVirtualized Component

**Current State:** 2,155 lines, 44 store subscriptions, 12+ useState hooks

**Problem:** Monolithic component handling virtualization, selection, keyboard navigation, column resizing, drag-and-drop, filtering, summaries, and context menus.

**Proposed Architecture:**
```
CellGrid (orchestrator)
├── CellGridVirtualizer (virtualization only)
├── CellGridRenderer (cell display)
├── CellGridColumnHeader (column UI + resizing)
├── CellGridSelection (selection logic - custom hook)
├── CellGridKeyboard (keyboard handling - custom hook)
├── CellGridDragDrop (drag-drop - custom hook)
├── CellGridSummaryRow (summary display)
└── CellGridContextMenu (menu logic)
```

**Benefits:**
- Each piece becomes testable in isolation
- Easier to modify single concerns
- Reduced re-render scope
- Better code reuse

**Risk:** High - touches core functionality
**Effort:** 3-5 days
**Recommendation:** Do incrementally, extract one concern at a time

---

### 3.2 Decompose cellStore

**Current State:** 1,338 lines, 32 action methods, dependencies on 4 other stores

**Problem:** Single store handling file operations, import/export, cell operations, column operations, row operations, editing, selection, filtering, summaries, and undo/redo.

**Proposed Architecture:**
```
useCellDataStore      - Core data (headers, data, dirty flag, loading)
useCellEditStore      - Cell editing (editingCell, editingValue, editingSource)
useCellSelectionStore - Selection (selectedCell, selectedRange, clipboard)
useCellColumnStore    - Column operations (widths, order, reordering)
useCellFilterStore    - Filtering and summaries
useCellHistoryStore   - Undo/redo (separate stacks)
useCellFileService    - Higher-level service coordinating file I/O
```

**Benefits:**
- Clear single responsibility
- Easier to understand and modify
- Better testability
- Reduced cognitive load

**Risk:** High - central to all data operations
**Effort:** 2-3 days
**Recommendation:** Start with extracting history (undo/redo) as it's most isolated

---

### 3.3 Comprehensive Test Suite

**Current State:**
- Frontend: 0 test files (Vitest configured but unused)
- Backend: 7 tests (screenplay conversion only)

**Critical Missing Tests:**
1. `cellParser.ts` - CSV/TSV/JSON parsing edge cases
2. `summaryCalculations.ts` - Math functions for count, average, etc.
3. `file_ops.rs` - Path validation security tests
4. `storage.rs` - Persistence operations
5. `cellStore.ts` - State management, undo/redo

**Proposed Test Infrastructure:**
```
frontend/
├── src/
│   ├── __tests__/
│   │   ├── utils/
│   │   │   ├── cellParser.test.ts
│   │   │   └── summaryCalculations.test.ts
│   │   ├── stores/
│   │   │   └── cellStore.test.ts
│   │   └── components/
│   │       └── (component tests)
│   └── test-utils/
│       └── testHelpers.ts
├── vitest.config.ts
└── vitest.setup.ts
```

**Benefits:**
- Catch regressions early
- Enable confident refactoring
- Document expected behavior

**Risk:** Medium - time investment with ongoing maintenance
**Effort:** 5-7 days for critical coverage
**Recommendation:** Start with pure utility functions, easiest to test

---

### 3.4 Extract Pure Logic from Print Components

**Current State:**
- `ScreenplayPrint.tsx`: 1,322 lines mixing rendering + logic
- `CardPrint.tsx`: 975 lines mixing rendering + logic

**Problem:** Business logic tightly coupled to React rendering, making it untestable.

**Proposed Architecture:**
```
Pure Logic Layer (testable without React):
├── screenplayTransformer.ts  - CSV → screenplay elements
├── screenplayLayout.ts       - Page layout, element positioning
├── cardTransformer.ts        - CSV → card data
└── cardLayout.ts             - Card grid layout logic

React Layer (thin rendering):
├── ScreenplayPrint.tsx       - Orchestrator only
├── ScreenplayElement.tsx     - Single element renderer
├── CardPrint.tsx             - Orchestrator only
└── CardItem.tsx              - Single card renderer
```

**Benefits:**
- Logic becomes unit testable
- Easier to modify layout without touching UI
- Better separation of concerns

**Risk:** Medium - significant restructuring
**Effort:** 3-4 days
**Recommendation:** Extract transformer functions first, then layout

---

### 3.5 Implement Logging System

**Current State:** 100+ console.log statements with no log levels or filtering

**Proposed Solution:**
```typescript
// utils/logger.ts
import log from 'loglevel';

// Development: show all logs
// Production: show only warnings and errors
if (import.meta.env.DEV) {
    log.setLevel('debug');
} else {
    log.setLevel('warn');
}

export const logger = {
    debug: log.debug,
    info: log.info,
    warn: log.warn,
    error: log.error,
};
```

**Benefits:**
- Conditional logging based on environment
- Log levels for filtering
- Consistent logging interface
- Easier to disable for production

**Risk:** Low
**Effort:** 1 day to implement, 2-3 hours to migrate existing logs
**Recommendation:** Good candidate for early implementation

---

### 3.6 Create Data Transformation Pipeline

**Current State:** Data transforms scattered across:
- `cellParser.ts` - CSV parsing
- `screenplayPrint.worker.ts` - CSV to screenplay
- `cardPrint.tsx` - CSV to card data
- `printRecipeMapper.ts` - Generic field mapping

**Proposed Architecture:**
```typescript
// dataTransformationService.ts
interface DataTransformationService {
    parse(content: string, format: FileFormat): ParsedData;
    transform(data: CellData, recipe: PrintRecipe): TransformedData;
    serialize(data: TransformedData, format: OutputFormat): string;
}

// Unified pipeline:
content → parse() → transform() → serialize() → output
```

**Benefits:**
- Single place for all data transformations
- Composable and testable
- Easier to add new formats

**Risk:** Medium - affects data flow throughout app
**Effort:** 3-4 days
**Recommendation:** Implement after store decomposition

---

## Outstanding TODOs

### Explicit TODOs in Code

| Location | TODO | Priority |
|----------|------|----------|
| `TitleBar.tsx:209` | Implement Fountain import | Medium |
| `TitleBar.tsx:214` | Implement PDF screenplay import | Medium |
| `TitleBar.tsx:257` | Implement Fountain export | Medium |
| `PrintDrawer.tsx:81,103` | Get actual file size if needed | Low |
| `PrintDrawer.tsx:194` | Show error toast/notification to user | High |
| `PrintDrawer.tsx:585` | Pass totalPages from Print component | Low |

### Implicit Improvements Needed

| Area | Issue | Priority |
|------|-------|----------|
| Backend | Windows file ID uses path hash instead of actual file ID | Low |
| Backend | Large file buffer always allocates 1MB | Low |
| Frontend | No toast/notification system exists | Medium |
| Frontend | Event listener cleanup may have stale closure issues | Low |

---

## Implementation Prioritization

### Phase 1: Quick Wins (1-2 days) — COMPLETE

1. ✅ Temp file collision fix in `backend/src/file_ops.rs` (atomic counter + PID)
2. ✅ Removed unused `serde_json` dependency from `backend/Cargo.toml`
3. ✅ Run `cargo fmt` on backend

### Phase 2: Code Quality (3-5 days) — COMPLETE

1. ✅ Migrated 62 `console.*` statements to `logger` across 13 files
2. ✅ Wired `useFileOperations` hook into TitleBar and Header (~270 lines duplicate removed)
3. ✅ Added `catch (error: unknown)` with explicit type annotation to all 55 untyped catch blocks across 20 files
4. ✅ Adopted `formatError()` from `@utils/tauriErrorHandler` for user-facing error strings
5. ✅ Fixed multiple pre-existing lint warnings

### Phase 3: Architecture (1-2 weeks) — COMPLETE

#### 3.1 Decompose cellStore — COMPLETE
- Created `cellColumnStore.ts` (143 lines) — column widths, order, autocomplete cache
- Created `cellFilterStore.ts` (122 lines) — column filters, summaries
- cellStore reduced from 1,338 → 1,139 lines (focused on core data + file operations)
- Note: `cellEditStore`, `cellHistoryStore`, `cellSelectionStore` already existed pre-cleanup
- Note: Extracting file I/O into `cellFileService` was cancelled — load/save operations are deeply intertwined with cellStore state mutations

#### 3.2 Decompose CellGridVirtualized — COMPLETE (2,349 → 1,360 lines, 42% reduction)
10 hooks extracted:
1. `useFilteredData.ts` (52 lines) — column filter logic
2. `useColumnWidths.ts` (157 lines) — container width, pixel width computation, ResizeObserver, auto-fit
3. `useColumnResize.ts` (202 lines) — resize state vars, handlers, mousemove/mouseup effect
4. `useRowDragAndDrop.ts` (101 lines) — row drag state + handlers
5. `useColumnDragAndDrop.ts` (101 lines) — column drag state + handlers
6. `useClipboard.ts` (222 lines) — cutCells state, copy/cut/paste handlers
7. `useContextMenu.ts` (103 lines) — context menu state, right-click handler, click-outside close
8. `useAutocomplete.ts` (148 lines) — suggestion state, keyboard nav, dropdown control
9. `useCellSelection.ts` (203 lines) — drag selection, hover column, RAF batching, global mouseup
10. `usePrintSelectionSync.ts` (112 lines) — shared selection-clearing effects for print views

4 components extracted:
1. `SummaryRow.tsx` (189 lines) — fixed bottom summary row with scroll sync
2. `ContextMenu.tsx` (102 lines) — right-click context menu UI
3. `FillDialog.tsx` (105 lines) — multi-cell fill modal
4. `PopoutEditBox.tsx` (92 lines) — floating multi-line edit textarea

#### 3.3 Extract pure logic from print components — COMPLETE
- Created `screenplayUtils.ts` (40 lines) — shared `getElementStyle` + `isMultiLineElement`
- Created `usePrintSelectionSync.ts` (112 lines) — shared selection-clearing effects (used by both ScreenplayPrint and CardPrint)
- Fixed real bug: `getElementStyle` had inconsistent margin property names (`leftMargin` vs `xMargin`)
- Fixed type duplication: ScreenplayPrint now imports from `workerMessages.ts`
- ScreenplayPrint: 1,328 → 1,240 lines; CardPrint: 981 → 928 lines
- Note: Full transformer extraction was unnecessary — print component data transformers already exist as web workers
- Note: Keyboard handler extraction (260 lines in Screenplay, 52 in Card) was not worth it — 10+ state dependencies each means extracting as hooks just moves code without simplifying

#### 3.4 Create comprehensive test suite — COMPLETE
- Created `frontend/vitest.config.ts` with path aliases
- 86 tests across 3 files, all passing:
  - `summaryCalculations.test.ts` — 47 tests (all 7 summary types + edge cases)
  - `cellParser.test.ts` — 30 tests (parse/serialize/validate/delimiter/stats)
  - `screenplayUtils.test.ts` — 9 tests (shared screenplay utilities)

#### Post-Phase 3 bugfix
- ✅ Fixed infinite update loop in `usePrintSelectionSync` — inline arrow functions passed by callers created new references every render, causing effects to re-trigger infinitely. Fixed with `useRef` pattern to decouple effect dependencies from callback identity.

### Phase 4: Future Enhancements (not started)
When resources allow:

1. Implement Fountain import/export
2. Implement PDF screenplay import
3. Create data transformation pipeline
4. Add toast notification system

---

## Metrics — Actual Results

| Metric | Before Cleanup | After Phase 3 |
|--------|----------------|---------------|
| Console statements | 100+ | 0 (62 migrated to logger) |
| CellGridVirtualized size | 2,349 lines | 1,360 lines (42% reduction) |
| cellStore size | 1,338 lines | 1,139 lines (2 sub-stores extracted) |
| ScreenplayPrint size | 1,328 lines | 1,240 lines |
| CardPrint size | 981 lines | 928 lines |
| Frontend test count | 0 | 86 (3 test files) |
| Backend test count | 7 | 7 (6 active, 1 ignored) |
| Untyped catch blocks | 55 | 0 |
| Duplicate file op code | ~270 lines | 0 (shared hook) |
| New hooks created | 0 | 11 |
| New components extracted | 0 | 4 |
| New utility modules | 0 | 1 (screenplayUtils.ts) |
| New stores created | 0 | 2 (cellColumnStore, cellFilterStore) |

---

*Plan created: January 2026*
*Last updated: March 2026*
