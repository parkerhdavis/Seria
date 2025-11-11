# Juniper Testing Guide

Quick guide for testing Juniper's CSV editor functionality.

## Setup

1. **Install dependencies:**
   ```bash
   cd ~/Juniper
   make setup
   ```

2. **Start the app:**
   ```bash
   make dev
   ```

   The Tauri window should open with the Juniper interface.

## Test Files Overview

| File | Rows | Purpose |
|------|------|---------|
| `simple_test.csv` | 5 | Quick sanity checks, basic editing |
| `screenplay_example.csv` | 20 | Screenplay format testing, mixed content |
| `game_items.csv` | 15 | Game design use case, numeric data |
| `dialogue_large.csv` | 200+ | Performance testing, virtualization |

## Testing Workflows

### 1. Basic File Operations (5 minutes)

**Open File:**
1. Click "Open" button in header
2. Navigate to `testing/simple_test.csv`
3. Click "Open"

**Expected Results:**
- ✅ File loads and displays in grid
- ✅ Header shows file name "simple_test.csv"
- ✅ Shows "5 rows × 4 columns"
- ✅ All data visible in grid

**Edit Cells:**
1. Double-click on "Alice" in the Name column
2. Change to "Alicia"
3. Press Enter

**Expected Results:**
- ✅ Cell enters edit mode with input field
- ✅ Can type new value
- ✅ Enter saves and moves to next row
- ✅ "Unsaved" badge appears in header

**Save File:**
1. Click "Save" button
2. Wait for save to complete

**Expected Results:**
- ✅ "Unsaved" badge disappears
- ✅ No errors in console
- ✅ File is saved to disk

**Verify Save:**
1. Click "Close File" in dropdown menu
2. Click "Open" and reopen `simple_test.csv`

**Expected Results:**
- ✅ "Alicia" is still there (edit persisted)

### 2. Screenplay Editing (10 minutes)

**Open Screenplay:**
1. Open `testing/screenplay_example.csv`

**Expected Results:**
- ✅ 20 rows × 6 columns
- ✅ Scene headings visible
- ✅ Dialogue text readable
- ✅ Empty cells show as empty (not errors)

**Test Navigation:**
1. Double-click dialogue cell in row 3
2. Press Tab to move to next column
3. Press Enter to move to next row
4. Press Escape to cancel editing

**Expected Results:**
- ✅ Tab moves to next cell
- ✅ Enter moves down one row
- ✅ Escape cancels edit without saving

**Add New Row:**
1. Click "Add Row" button
2. Double-click first cell in new row
3. Type "INT. PARK - SUNSET"
4. Press Tab and add more content

**Expected Results:**
- ✅ New empty row appears at bottom
- ✅ Can edit new row cells
- ✅ "Unsaved" badge appears

### 3. Game Data Editing (5 minutes)

**Open Game Items:**
1. Open `testing/game_items.csv`

**Expected Results:**
- ✅ 15 items display correctly
- ✅ All columns visible (Item, Type, Rarity, etc.)
- ✅ Numeric values display correctly

**Test Editing:**
1. Edit "Rusty Sword" damage from 5 to 7
2. Edit "Health Potion" value from 15 to 20
3. Save file

**Expected Results:**
- ✅ Edits work smoothly
- ✅ Numbers can be edited like text
- ✅ Save completes successfully

### 4. Performance Testing (5 minutes)

**Open Large File:**
1. Open `testing/dialogue_large.csv`

**Expected Results:**
- ✅ File loads (may take 1-2 seconds for 200+ rows)
- ✅ Shows "200+ rows × 6 columns"
- ✅ Grid renders smoothly

**Virtualization Check:**
1. Scroll down through the list
2. Look at bottom of grid (in dev mode, should see "Virtualized: Rendering X of 200 rows")

**Expected Results:**
- ✅ Smooth scrolling even with 200+ rows
- ✅ Only visible rows are rendered (virtualization working)
- ✅ No lag when scrolling
- ✅ Can still edit cells normally

**Stress Test:**
1. Edit a cell near the top
2. Scroll to bottom
3. Edit a cell near the bottom
4. Scroll back to top

**Expected Results:**
- ✅ Edits work at any scroll position
- ✅ No visual glitches
- ✅ "Unsaved" badge updates correctly

### 5. Edge Cases (5 minutes)

**Empty Cells:**
1. Open `screenplay_example.csv`
2. Find cells with empty content
3. Double-click empty cell
4. Type something, then delete it all
5. Press Enter

**Expected Results:**
- ✅ Empty cells are editable
- ✅ Can leave cells empty after editing
- ✅ No errors with empty content

**Multi-line Content:**
1. Look at Action column with longer descriptions
2. Edit a multi-line action cell

**Expected Results:**
- ✅ Multi-line content displays (may be truncated)
- ✅ Can edit without breaking

**Close Without Saving:**
1. Make some edits
2. Click "Close File" in dropdown
3. Confirm you want to close without saving

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Choosing "OK" closes file
- ✅ Reopening shows original data (edits not saved)

## Known Limitations (Phase 3)

These are expected and will be addressed in future phases:

- ⚠️ No filtering or sorting yet (Phase 4)
- ⚠️ No Print preview yet (Phase 5)
- ⚠️ No column operations (add, delete, rename) in UI yet
- ⚠️ No multi-cell selection or bulk operations
- ⚠️ No undo/redo
- ⚠️ Cell content may be truncated if very long
- ⚠️ Uses browser confirm() for unsaved changes (will be replaced with modal)

## Reporting Issues

If you find bugs or unexpected behavior:

1. Note the exact steps to reproduce
2. Check browser console for errors (F12)
3. Note which test file you were using
4. Note your operating system

**Common Issues:**

- **File won't open:** Check that Rust is installed (`rustc --version`)
- **App won't start:** Run `make setup` again
- **Changes not saving:** Check file permissions on the CSV file
- **Grid not displaying:** Check browser console for JavaScript errors

## Next Steps

After Phase 3 testing is complete:
- **Phase 4:** Add filtering and sorting
- **Phase 5:** Implement Print preview system
- **Phase 6:** Polish and settings persistence

## Success Criteria

Phase 3 is successful if:
- ✅ All test files open correctly
- ✅ Cell editing works smoothly
- ✅ Keyboard navigation functions
- ✅ File saves persist changes
- ✅ Large files (200+ rows) perform well
- ✅ No critical bugs or crashes
