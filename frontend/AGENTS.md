<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend Work

When working on frontend/UI code, read `frontend.md` before making changes.

The rules in `frontend.md` are part of the project's frontend requirements.

# Project Agent Rules

## 1. Core Principle

Build this project as a real production application.

Do not optimize for:

* impressive-looking code
* excessive abstraction
* generic SaaS aesthetics
* unnecessary dependencies
* unnecessary animations
* large amounts of generated boilerplate

Optimize for:

1. correctness
2. maintainability
3. simplicity
4. performance
5. accessibility
6. consistent UX

When two implementations are reasonable, prefer the simpler one.

---

## 2. Read Before Modifying

Before changing code:

1. Inspect the existing implementation.
2. Understand the surrounding architecture.
3. Check existing components before creating new ones.
4. Check existing utilities/hooks before adding dependencies.
5. Check the relevant Next.js documentation under `node_modules/next/dist/docs/`.
6. Follow existing project conventions unless there is a concrete reason to change them.

Do not rewrite working code simply because another approach is more familiar.

---

## 3. Minimal Changes

Make the smallest change necessary to solve the problem.

Do not:

* refactor unrelated code
* rename unrelated files
* change formatting across the project
* replace working libraries
* introduce new architectural patterns without justification
* rewrite entire components for a small feature

A feature request should not become an excuse for a codebase-wide refactor.

---

## 4. Existing Architecture Has Priority

Before introducing a new pattern, determine whether the project already has one.

For example, if the project already has:

```text
components/
lib/
hooks/
services/
types/
```

use those conventions.

Do not create:

```text
utils2/
helpers/
common/
shared/
misc/
```

just because you need somewhere to put a function.

---

# Next.js

## 5. Next.js Version

The installed version of Next.js is authoritative.

Never rely on remembered Next.js APIs.

Before using an API whose behavior may have changed:

```text
node_modules/next/dist/docs/
```

must be checked.

This includes:

* routing
* layouts
* metadata
* caching
* server/client behavior
* middleware/proxy behavior
* server actions
* route handlers
* data fetching
* rendering
* configuration

---

## 6. Server vs Client Components

Default to Server Components.

Use `"use client"` only when the component actually requires:

* browser APIs
* event handlers
* client-side state
* effects
* client-only libraries

Do not add `"use client"` to large parent components merely to make one child interactive.

Prefer:

```text
Server Component
└── Client Component
```

over:

```text
Client Component
└── entire page
```

Keep client boundaries as small as practical.

---

## 7. Data Fetching

Do not fetch data in the client by default.

First determine whether the data can be fetched on the server.

Avoid unnecessary chains such as:

```text
Page
→ Client Component
→ useEffect
→ API route
→ database
```

when the server can directly access the required data.

Client fetching should have a clear reason.

---

# TypeScript

## 8. Type Safety

Use TypeScript strictly.

Avoid:

```ts
any
```

unless there is a documented reason.

Prefer domain types:

```ts
type Question = {
  id: string
  subject: string
  year: number
  difficulty: "easy" | "medium" | "hard"
}
```

Do not duplicate the same type in multiple files.

Keep shared domain types in a predictable location.

---

## 9. Avoid Premature Abstraction

Do not create generic abstractions before there is a demonstrated need.

Bad:

```ts
UniversalDataRenderer<T>
GenericEntityCard<T>
AbstractRepository<T>
BaseService<T>
```

when the project only has one use case.

Prefer straightforward code first.

Abstract only when:

* logic is genuinely reused
* the abstraction removes meaningful duplication
* the domain concept is clear

---

# Frontend

## 10. No AI-Slop UI

The frontend must not look like a generic AI-generated SaaS dashboard.

Avoid automatically using:

* purple/blue gradients
* glowing backgrounds
* glassmorphism
* giant hero headings
* excessive rounded cards
* excessive shadows
* decorative blobs
* meaningless statistics
* unnecessary icons
* excessive animations
* fake testimonials
* generic AI marketing copy

Do not add visual effects merely to make a page appear "modern."

---

## 11. Product Over Decoration

Every UI element should have a purpose.

Before adding a component, ask:

> What user problem does this solve?

Prefer:

```text
clear hierarchy
good typography
spacing
alignment
useful density
```

over:

```text
gradients
glows
animations
decorative illustrations
```

The UI should still look good if all decorative effects are removed.

---

## 12. Consistent Design System

Reuse existing:

* colors
* typography
* spacing
* buttons
* inputs
* cards
* dialogs
* navigation
* states

Do not create a slightly different version of an existing component.

Before creating a UI primitive, search the codebase.

---

## 13. Components

Components should represent product concepts.

Prefer:

```text
QuestionCard
QuestionFilters
QuestionViewer
SearchResults
SubjectSelector
ExamSelector
```

over:

```text
FancyCard
ModernCard
GradientCard
BeautifulContainer
```

Component names should describe what something **does**, not how it looks.

---

## 14. Component Boundaries

Do not create a component for every `<div>`.

Extract components when they have:

* meaningful domain identity
* independent state
* reusable behavior
* significant complexity

Avoid both extremes:

```text
one 1000-line component
```

and:

```text
50 components containing 5 lines each
```

---

## 15. UI States

Every data-driven interface should consider:

```text
loading
success
empty
error
```

Do not leave blank screens.

Do not use generic:

```text
Loading...
```

for entire pages when only a section is loading.

Empty states should tell the user what happened and what they can do next.

---

# UX

## 16. Copy

Use concrete language.

Prefer:

```text
Upload question paper
Generate questions
Save question
Clear filters
Retry
```

Avoid:

```text
Unlock intelligent learning
Supercharge your preparation
Experience the future
Magic
```

Do not write marketing copy unless the page is actually a marketing page.

---

## 17. Forms

Forms must have:

* visible labels
* validation
* useful error messages
* loading/submitting state
* disabled state when appropriate
* clear action labels

Do not rely only on placeholder text as a label.

---

## 18. Search and Filters

Search/filter state should be predictable.

If appropriate, keep:

* search query
* filters
* sorting
* pagination

in the URL so that pages can be:

* refreshed
* bookmarked
* shared
* navigated with browser history

---

# Accessibility

## 19. Semantic HTML

Prefer semantic HTML.

Use:

```html
button
a
nav
main
header
section
form
label
```

appropriately.

Do not use:

```html
<div onClick={...}>
```

when the element represents a button.

Keyboard navigation must work.

Focus states must remain visible.

---

# Performance

## 20. Performance Rules

Do not optimize prematurely.

But avoid obvious problems:

* unnecessary client components
* unnecessary API requests
* unnecessary dependencies
* huge client-side bundles
* duplicated fetching
* unoptimized images
* expensive calculations during render

Prefer server rendering when appropriate.

---

# Dependencies

## 21. Before Installing Anything

Before adding a dependency:

1. Check whether the project already has an equivalent.
2. Check whether the functionality can reasonably be implemented with existing APIs.
3. Check whether the dependency is actually necessary.

Do not install libraries simply because they are popular.

---

# Error Handling

## 22. Errors

User-facing errors must be understandable.

Do not expose:

```text
PrismaClientKnownRequestError
TypeError: Cannot read properties of undefined
500 Internal Server Error
```

directly to users.

Convert technical failures into useful UI messages.

Keep debugging information in logs.

---

# Security

## 23. Never Trust Client Input

Validate data at the server boundary.

Never assume:

* client-side validation is sufficient
* hidden fields are trustworthy
* user IDs supplied by the client are valid
* permissions checked only in the UI are secure

Authorization must be enforced server-side.

Never expose secrets to client components.

---

# Database / API

## 24. Keep Boundaries Clear

UI components should not contain database logic.

Prefer:

```text
UI
 ↓
server action / route handler / server function
 ↓
service/domain logic
 ↓
database
```

rather than putting database operations directly into presentation components.

Use the architecture already established by the project.

---

# Git / Changes

## 25. Keep Diffs Clean

Do not modify unrelated files.

Do not:

* reformat the entire project
* reorder imports everywhere
* rename unrelated variables
* delete seemingly unused code without checking
* modify generated files unnecessarily

Generated files should only be modified when the toolchain expects it.

---

# Verification

## 26. Before Declaring a Task Complete

Run the appropriate checks.

At minimum, when available:

```text
typecheck
lint
build
tests
```

For UI changes, also verify:

```text
desktop
mobile
loading state
empty state
error state
```

Do not claim a feature works without actually verifying it.

---

# Decision Rule

When uncertain:

1. inspect existing code
2. inspect project configuration
3. inspect installed package documentation
4. follow established conventions
5. choose the simplest correct solution

Do not guess when the repository can answer the question.

---

# Final Rule

Write code that another engineer can understand six months from now.

Do not optimize for the code looking sophisticated.

Do not optimize for the UI looking flashy.

Optimize for the project being:

**correct, boring where it should be boring, polished where it matters, and easy to maintain.**

