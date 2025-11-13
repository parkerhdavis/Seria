# Juniper

**A cellular editor for game writers and narrative designers.** Juniper lets you work directly with primitive data files (CSV, TSV, JSON) while viewing and editing your content in writer-friendly formats like Screenplay and Corkboard, or data-friendly views like Charts and Record editors. Changes made in any view sync instantly across all views - no export step, no duplication, just your data in the format that works for what you're doing.

---

## The Problem

Game writers need primitive data sources, but the tools available force painful trade-offs:

### Spreadsheets (Excel, Google Sheets, Unreal Data Tables)

**What's great for games:**
- ✅ Primitive, text-based data formats play nicely with version control
- ✅ Easy integration into game engines and build pipelines
- ✅ Bulk editing and analysis is super simple (that's what sheets are *for*, after all)
- ✅ Team collaboration (either RTC or VCS) is built-in or easy to implement
- ✅ Makes you feel like a power user and keeps you tethered to developer-space

**What's hard for writers:**
- ❌ Working in cells (or worse, struct rows) doesn't always feel natural
- ❌ Difficult to feel pacing and flow, especially for cinematics and long conversations
- ❌ The medium is the message: cellular editing shapes your writing (sometimes in a bad way)
- ❌ Constant context-switching between "data mode" and "writer mode" can burn you out
- ❌ I mean, you know, it just feels sad sometimes

### Writing Tools (Final Draft, FadeIn, Scrivener)

**What's great for writers:**
- ✅ Rich, writer-friendly composition experience, especially for dialogue
- ✅ Much easier to read linearly for editing and proofreading
- ✅ Proper screenplay/dialogue formatting to read aloud or share with actors
- ✅ Card views and organizational tools to zoom out for plot and pacing
- ✅ Like a warm, cozy blanket to curl up and write in

**What's hard for games:**
- ❌ Proprietary or complex data sources that lock you into specific tools
- ❌ Not friendly to integration or version control
- ❌ Even tools that exporting to CSV/JSON open the door to errors and multiple points of authority
- ❌ Difficult-to-impossible to integrate directly into game engine pipelines
- ❌ You'll be happy; everyone else will be sad

---

## The Juniper Solution

Juniper sits directly on top of your data files. no import/export step, no conversion, no duplication. Your data file stays the single source of truth while you view and edit it through a rich cellular editor and multi-modal rendered views (what I call Prints) that accommodate far more ways writers actually think.

### Feature Comparison

| Feature                               | Excel/Sheets | Final Draft/Scrivener | **Juniper**      |
| ------------------------------------- | ------------ | --------------------- | ---------------- |
| Primitive data format (CSV/TSV, JSON) | ✅            | ❌                     | ✅                |
| Git-friendly / version control        | ✅            | ❌                     | ✅                |
| Screenplay formatting                 | ❌            | ✅                     | ✅                |
| Card/corkboard view                   | ❌            | ✅                     | ✅                |
| Edit directly in formatted view       | ❌            | ✅                     | ✅                |
| Bidirectional sync                    | ❌            | ❌                     | ✅                |
| Game engine integration               | ✅            | ❌                     | ✅                |
| Formulas, calculations, validations   | ✅            | ❌                     | 💡 (coming soon) |
| Real-time collaboration / cloud sync  | ✅            | Limited               | ❌ (not yet)      |
| Custom print templates                | ❌            | Limited               | ✅                |

**Juniper gives you the data discipline and flexibility of sheets with the fluid experience of dedicated writing tools.**

---

## Key Features

### Cell View (Spreadsheet Editor)
Traditional CSV editing with powerful features:
- Filter and sort to focus on specific content
- Find and replace across your data
- Multi-cell selection and bulk operations
- Column summaries (count, average, min, max, etc.)
- Drag-and-drop row/column reordering
- Full undo/redo support

→ [Complete Cell View Guide](wiki/01%20-%20Cell%20View/01.00%20-%20The%20Cell%20View.md)

### Print Views (Writer-Friendly Formats)
View and edit your CSV data in rich formats:
- **Screenplay** - Industry-standard screenplay format for cinematics
- **Dialogue** - Clean dialogue view for conversations and barks
- **Corkboard** - Card-based view for story beats and planning
- **Record Editor** - Database-style forms for detailed editing
- **Charts** - Visual data representations for relationships and flow
- **Custom Prints** - Create your own formats specific to your workflow

→ [Print View Guide](wiki/02%20-%20Print%20View/02.00%20-%20The%20Print%20View.md)

### Bidirectional Editing
The killer feature: **edit in any view, changes sync everywhere.**
- Change dialogue in Screenplay view → CSV updates instantly
- Reorder cards in Corkboard view → row order updates in CSV
- Edit a cell in spreadsheet view → Print views update
- Always working with the same data, just different views

→ [Bidirectional Editing Explained](wiki/02%20-%20Print%20View/02.01%20-%20Bidirectional%20Editing.md)

### Multi-Platform & Local-First
- **Windows, macOS, Linux** - Native desktop app for all platforms
- **Local-first** - Your data stays on your machine, works offline
- **Fast & lightweight** - Small installer (~10-15MB), native performance
- **No vendor lock-in** - Plain CSV files you own forever

→ [Installation Guide](wiki/00-Introduction/00.03%20-%20Installation.md)


---

## Installation


> [!NOTE] Coming Soon
> The first packaged release will drop later this month. Stay tuned!


Formats available on [GitLab Releases](https://gitlab.com/parkerhdavis/Juniper/-/releases):

- **Linux:** `.AppImage` (universal), `.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL)
- **Windows:** `.msi` or `_setup.exe`
- **macOS:** `.dmg`

→ [Detailed installation instructions for all platforms](wiki/00-Introduction/00.03%20-%20Installation.md)

---

## Documentation

**Getting Started:**
- [Installation](wiki/00-Introduction/00.03%20-%20Installation.md) - Install on Windows, macOS, or Linux
- [Is This App for You?](wiki/00-Introduction/00.02%20-%20Is%20This%20App%20for%20You.md) - See if Juniper fits your workflow

**Using Juniper:**
- [Cell View Guide](wiki/01%20-%20Cell%20View/01.00%20-%20The%20Cell%20View.md) - CSV editing features
- [Print View Guide](wiki/02%20-%20Print%20View/02.00%20-%20The%20Print%20View.md) - Using Print views
- [Print Recipes](wiki/02%20-%20Print%20View/02.02%20-%20Print%20Recipes.md) - Creating custom formats

**Reference:**
- [Keyboard Shortcuts](wiki/03%20-%20Customization/03.02%20-%20Keyboard%20Shortcuts.md) - All shortcuts
- [FAQ](wiki/04%20-%20FAQ%20and%20Support/04.00%20-%20FAQ.md) - Frequently asked questions
- [Current Limitations](wiki/04%20-%20FAQ%20and%20Support/04.01%20-%20Current%20Limitations.md) - Known issues and missing features

**Developer Docs:**
- [Developer Guide](wiki-internal/Developer-Guide.md) - Development setup
- [Build and Distribution](wiki-internal/Build-and-Distribution.md) - Building from source

---

## Links

- **GitLab (main repo):** [https://gitlab.com/parkerhdavis/Juniper](https://gitlab.com/parkerhdavis/Juniper)
- **GitHub (mirror repo):** [https://github.com/parkerhdavis/Juniper](https://github.com/parkerhdavis/Juniper)
- **Issues:** [GitLab Issues](https://gitlab.com/parkerhdavis/Juniper/-/issues)
- **Releases:** [GitLab Releases](https://gitlab.com/parkerhdavis/Juniper/-/releases)

---

## Technology

Tauri 2.0 + React 18 + TypeScript + Vite + TailwindCSS + daisyUI

---

## Inspiration

Juniper was inspired by tools like [Obsidian](https://obsidian.md/) that demonstrate what's possible with local-first experiences built on top of simple, portable file formats. Just as Obsidian provides a powerful editing environment while keeping notes as plain markdown files, Juniper provides rich writing views while keeping your data as plain CSV files.

---

## License

Covered under the GPL License, see [[LICENSE]]

---

## Financial Support

If you have some cash to spare and want to help out, that's very kind. I'm doing alright, so rather than sharing that kindness with me, I encourage you to share it with your charity of choice. Mine is the [GiveWell top charities fund](https://www.givewell.org/top-charities-fund) , which does excellent research to figure out which causes can save the most human lives for the money, and put their funds there.

For example: their grant to the Against Malaria Foundation was shown to save lives at a rate of just $1,700 per life saved.

```embed
title: "Top Charities Fund"
image: "https://in.getclicky.com/78566ns.gif"
description: "Published: June 2021; Last updated: November 2025 (April 2021 version)"
url: "https://www.givewell.org/top-charities-fund"
favicon: ""
aspectRatio: "100"
```
