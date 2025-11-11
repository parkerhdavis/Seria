# Wiki Organization Guide

This document defines the structure and organization of the Juniper project wiki.

## Directory Structure

```
wiki/
├── README.md                  # Wiki landing page and navigation
├── ORGANIZATION.md            # This file - wiki structure guide
├── internal/                  # Developer documentation (confidential)
│   ├── README.md             # Internal docs index
│   ├── 01-*.md               # Architecture docs (01-04)
│   ├── 10-*.md               # Feature implementation (10-19)
│   └── 20-*.md               # Quick references (20-29)
└── external/                  # User-facing documentation (shareable)
    ├── README.md             # External docs index
    ├── 01-*.md               # Getting started guides (01-04)
    ├── 10-*.md               # Feature guides (10-19)
    └── 20-*.md               # Reference materials (20-29)
```

## Numbering System

Files use a numbered prefix system for ordering and categorization:

### Internal Documentation (`internal/`)

**01-04: Architecture & Design**
- High-level architecture decisions
- System design patterns
- Technology choices and rationale
- Data flow and state management

**10-19: Feature Implementation**
- How features are implemented
- Code organization patterns
- Integration guides
- API documentation

**20-29: Quick References**
- Command reference
- API cheatsheets
- Keyboard shortcuts (dev perspective)
- Troubleshooting guides

### External Documentation (`external/`)

**01-04: Getting Started**
- Installation and setup
- First-time user guide
- Basic concepts and terminology
- Quick start tutorials

**10-19: Feature Guides**
- How to use specific features
- Step-by-step tutorials
- Best practices
- Tips and tricks

**20-29: Reference Materials**
- Keyboard shortcuts (user perspective)
- FAQ
- Troubleshooting
- Known limitations

## File Naming Convention

Format: `{number}-{descriptive-kebab-case-name}.md`

Examples:
- `01-architecture-overview.md`
- `02-state-management.md`
- `10-csv-editor-implementation.md`
- `11-print-system-design.md`
- `20-tauri-commands-reference.md`

## Documentation Guidelines

### Internal Docs

**Purpose:** Help developers understand and maintain the codebase

**Target Audience:**
- Project maintainers
- Contributing developers
- AI agents (like Claude)

**Content Should Include:**
- Technical architecture details
- Code examples and snippets
- Links to source files with line numbers
- Design decisions and trade-offs
- Implementation notes

**Style:**
- Technical language is acceptable
- Assume reader has programming knowledge
- Include diagrams where helpful
- Link to relevant code

### External Docs

**Purpose:** Help end users effectively use Juniper

**Target Audience:**
- Writers and designers (non-technical users)
- Game developers
- Anyone using Juniper for CSV editing

**Content Should Include:**
- Clear, step-by-step instructions
- Screenshots and visual guides
- Real-world examples
- Common use cases
- Solutions to common problems

**Style:**
- Plain, accessible language
- Avoid technical jargon
- Use visuals liberally
- Anticipate user questions
- Friendly, helpful tone

## Creating New Documentation

### Step-by-Step Process

1. **Determine Location:**
   - Is this for developers? → `internal/`
   - Is this for end users? → `external/`

2. **Choose Number Prefix:**
   - Architecture/Getting Started: 01-04
   - Features/Guides: 10-19
   - Reference: 20-29

3. **Create File:**
   - Use numbered prefix
   - Use descriptive kebab-case name
   - Use `.md` extension

4. **Add to Index:**
   - Update appropriate README.md
   - Add link with description
   - Maintain alphabetical or numerical order

5. **Write Content:**
   - Follow style guidelines
   - Include relevant cross-references
   - Add last updated date at bottom

6. **Review:**
   - Check for accuracy
   - Verify links work
   - Ensure appropriate audience level

## Maintaining Documentation

### Regular Reviews

- **Quarterly Review:** Check all documentation for accuracy
- **Feature Updates:** Update docs when features change
- **User Feedback:** Incorporate user questions into FAQ/guides
- **Code Changes:** Update technical docs when architecture changes

### Version Control

- Commit documentation changes with descriptive messages
- Link doc updates to feature PRs when applicable
- Keep ORGANIZATION.md synchronized with actual structure
- Update "Last Updated" dates when making changes

### Cross-Referencing

- Link between related internal and external docs
- Reference code files with line numbers: `frontend/src/App.tsx:42`
- Link to external resources (GitHub, docs sites, etc.)
- Keep a consistent link format

## Templates

### Internal Doc Template

```markdown
# {Feature Name} - {Topic}

Brief description of what this document covers.

## Overview

High-level explanation of the feature/system.

## Architecture

Technical architecture and design patterns.

## Implementation

How it's implemented, with code examples.

## API Reference

Relevant functions, components, or commands.

## Related Documentation

- [Other relevant doc](./other-doc.md)

---

**Last Updated:** YYYY-MM-DD
```

### External Doc Template

```markdown
# {Feature Name} Guide

Brief description of what users will learn.

## What You'll Learn

- Bullet point 1
- Bullet point 2

## Prerequisites

What users need before starting.

## Step-by-Step Guide

### Step 1: {Action}

Clear instructions with screenshots.

### Step 2: {Action}

More instructions.

## Tips & Tricks

Helpful hints for users.

## Common Issues

Solutions to common problems.

## Related Guides

- [Other guide](./other-guide.md)

---

**Last Updated:** YYYY-MM-DD
```

## Best Practices

1. **Be Consistent:** Follow naming and numbering conventions
2. **Be Clear:** Write for your audience
3. **Be Complete:** Don't leave steps out
4. **Be Current:** Update docs when code changes
5. **Be Helpful:** Anticipate questions and provide answers
6. **Be Visual:** Use diagrams and screenshots
7. **Be Linked:** Cross-reference related content

---

**Last Updated:** 2025-11-10
