# Juniper Testing Files

This directory contains sample CSV files for testing the Juniper CSV editor.

## Test Files

### screenplay_example.csv

A sample screenplay formatted as CSV, demonstrating a typical use case for game writers and narrative designers.

**Columns:**
- **Scene** - Scene headings (e.g., "INT. COFFEE SHOP - DAY")
- **Action** - Action lines and scene descriptions
- **Character** - Character names (who is speaking)
- **Parenthetical** - Acting directions in parentheses
- **Dialogue** - What the character says
- **Transition** - Scene transitions (FADE IN, CUT TO, etc.)

**Content:** A short conversation between Sarah (a software engineer) and Alex (a barista) that serves as the origin story for Juniper itself. Meta!

**Test Coverage:**
- Mixed empty and populated cells
- Multi-line text in cells
- Various screenplay elements (scene headings, dialogue, action)
- ~20 rows - good for testing basic editing
- Good candidate for Print preview testing

## Testing Checklist

### Phase 3 - CSV Editor Core

**File Operations:**
- [ ] Open screenplay_example.csv via file dialog
- [ ] Verify all columns display correctly
- [ ] Check that scene headings and dialogue are readable
- [ ] Verify row and column counts (20 rows × 6 columns)

**Editing:**
- [ ] Double-click a dialogue cell and edit the text
- [ ] Press Enter to save and move to next row
- [ ] Press Tab to move to next column
- [ ] Edit multiple cells
- [ ] Verify "Unsaved" badge appears in header

**Saving:**
- [ ] Click Save button
- [ ] Verify "Unsaved" badge disappears
- [ ] Close and reopen file
- [ ] Verify edits were saved

**Row Operations:**
- [ ] Click "Add Row" button
- [ ] Verify new empty row appears at bottom
- [ ] Edit cells in the new row

**Performance:**
- [ ] Scroll through the grid smoothly
- [ ] Edit cells without lag
- [ ] No console errors

### Future Testing (Phase 4+)

**Filtering:**
- [ ] Filter by Character = "SARAH"
- [ ] Filter by Scene contains "COFFEE SHOP"
- [ ] Combine multiple filters

**Sorting:**
- [ ] Sort by Character column
- [ ] Sort by Scene column

**Print Preview:**
- [ ] Switch to Print Preview view
- [ ] Select Screenplay print template
- [ ] Verify dialogue is formatted correctly
- [ ] Verify scene headings are styled properly

## Creating More Test Files

To create additional test files:

```bash
# Small file (< 100 rows) - for basic testing
# Medium file (100-1000 rows) - for performance testing
# Large file (1000+ rows) - for virtualization testing
```

Use the screenplay format or adapt for other use cases:
- Game dialogue (Character, Line, EmotionTag, AudioFile)
- Game items (Name, Type, Rarity, Stats, Description)
- Quest data (QuestID, Title, Description, Objectives, Rewards)

## Notes

- All test files should be checked into git for consistent testing
- Add more examples as we build out Print templates
- Consider adding invalid CSV files to test error handling
