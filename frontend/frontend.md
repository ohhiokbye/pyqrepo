# Frontend Engineering & Design Guidelines

## Visual Direction

This product is an academic question-bank and study platform.

Target feeling:

- serious
- technical
- academic
- focused
- information-dense
- polished
- calm

Reference the information architecture and restraint of products such as:
- GitHub
- Linear
- Notion
- modern developer tools

Do NOT copy their UI directly.

# Product Direction

CPYQ Lib is not primarily a question-bank browsing application.

The primary student experience is a conversational academic tutor.

The application should allow a student to:

1. Configure their AI provider/API key.
2. Select their course/program.
3. Select semester.
4. Select subject.
5. Select module/topic.
6. Ask questions in a ChatGPT-like interface.
7. Receive explanations grounded in the selected syllabus and
   previously asked questions from the question bank.
8. See relevant PYQs alongside explanations.
9. Use those PYQs to understand what is actually important
   for their examination.

The question bank is the underlying knowledge source.
The conversational tutor is the primary interface.

Do not design the application as a generic question database
with an AI feature attached to it.

Design it as an academic tutor whose knowledge is grounded
in the question bank.

# Primary UX Principle

The user should feel:

"I have selected what I'm studying,
and now I have a tutor that understands my syllabus
and the questions my university actually asks."

They should NOT feel:

"I am browsing a database and there happens to be an AI button."

The product should NOT look like:
- a generic AI SaaS
- a chatbot wrapper
- a marketing template
- a crypto dashboard
- a startup landing-page template

AI is a capability of the product, not its visual identity.

The academic content is the primary visual element.

## 0. Core Principle

Build the frontend like a real product, not like an AI-generated landing page.

The UI should feel:

* intentional
* restrained
* technically polished
* consistent
* fast
* easy to navigate
* designed around the actual user workflow

Avoid generic "AI startup" aesthetics unless the product genuinely requires them.

The goal is not to impress with visual effects.

The goal is to make the interface feel like someone spent weeks refining it.

---

# 1. Product-First Rule

Before creating a component, understand:

1. What does the user want to accomplish?
2. What information do they need at this point?
3. What is the primary action?
4. What can be removed?
5. What should happen when data is missing/loading/invalid?

Do not create UI merely because a component would "look nice."

Every visible element should have a purpose.

---

# 2. Anti-AI-Slop Rules

DO NOT automatically use:

* giant gradient backgrounds
* excessive glassmorphism
* floating glowing blobs
* purple/blue gradient text
* excessive rounded cards
* huge hero headings
* meaningless statistics
* fake testimonials
* "Powered by AI" everywhere
* unnecessary animations
* excessive shadows
* excessive icons
* decorative charts with no information
* 3D illustrations
* random emojis
* generic SaaS copy
* "Revolutionize your workflow"
* "Supercharge your productivity"
* "Unlock the power of..."
* excessive use of `border-radius: 9999px`

Avoid the common:

> dark background + purple gradient + glowing cards + Inter + huge heading + three feature cards

unless there is an actual product reason for it.

---

# 3. Visual Direction

Prefer:

* strong typography
* clear hierarchy
* whitespace
* subtle borders
* restrained shadows
* consistent spacing
* useful density
* meaningful alignment
* small details
* functional interactions

The interface should look good even if all gradients, shadows, and animations are removed.

Use visual hierarchy through:

```text
size
weight
spacing
alignment
contrast
grouping
```

before using decorative effects.

---

# 4. Design System

Do not invent new styles per component.

Establish a small design system first.

## Colors

Define semantic tokens:

```css
--background
--foreground
--muted
--muted-foreground
--border
--primary
--primary-foreground
--secondary
--secondary-foreground
--destructive
--success
--warning
```

Do not hardcode random colors throughout components.

Bad:

```tsx
<div className="bg-[#182348]">
```

Better:

```tsx
<div className="bg-background">
```

---

# 5. Typography

Typography should create hierarchy.

Use a limited number of weights.

Recommended hierarchy:

```text
Page title
↓
Section heading
↓
Card/title
↓
Body
↓
Secondary text
↓
Metadata
```

Do not make every heading huge.

Do not use bold text everywhere.

Do not use uppercase text unless it improves scanning.

Avoid excessive letter spacing.

---

# 6. Spacing

Use a consistent spacing scale.

Prefer:

```text
4
8
12
16
20
24
32
40
48
64
```

Avoid arbitrary values unless necessary.

For example:

```tsx
gap-4
p-6
space-y-8
```

is preferable to:

```tsx
gap-[13px]
p-[27px]
```

unless the design specifically requires it.

---

# 7. Border Radius

Use a restrained radius system.

Example:

```text
small UI elements: 6px
inputs/buttons:     8px
cards:              10–12px
large containers:   12–16px
```

Do not make everything pill-shaped.

Pills should communicate something:

* status
* category
* filter
* compact action

not simply decoration.

---

# 8. Shadows

Use shadows sparingly.

Prefer:

```text
border + subtle shadow
```

over:

```text
massive glowing shadow
```

Most cards should be distinguishable through spacing and borders.

---

# 9. Layout

Use a clear layout hierarchy.

Typical structure:

```text
Application shell
├── Sidebar / Navigation
├── Header
└── Main content
    ├── Page heading
    ├── Primary action
    ├── Main content
    └── Secondary information
```

Avoid putting everything inside cards.

Cards should represent meaningful groups of information.

---

# 10. Navigation

Navigation should answer:

> Where am I?

and:

> Where can I go?

Clearly indicate the active route.

Do not rely solely on color.

Use:

* background change
* border
* icon treatment
* typography
* position

to communicate active state.

---

# 11. Components

Components should represent actual product concepts.

Good:

```text
QuestionCard
QuestionFilters
SubjectSelector
ExamSelector
SearchResults
QuestionViewer
ProgressCard
Sidebar
TopBar
```

Bad:

```text
BeautifulCard
ModernCard
GlassCard
PremiumCard
GradientContainer
FancyButton
```

Component names should describe functionality, not aesthetics.

---

# 12. Component Size

Avoid enormous components.

If a component starts doing multiple unrelated things:

```tsx
Dashboard.tsx
```

containing:

* fetching
* filtering
* sorting
* modal logic
* navigation
* rendering
* charts

split responsibilities.

Prefer:

```text
Dashboard
├── DashboardHeader
├── Stats
├── RecentActivity
├── QuestionList
└── ActivityChart
```

But do NOT split components merely to create more files.

Extract when there is:

* reuse
* independent logic
* independent state
* meaningful conceptual identity

---

# 13. State

Make state ownership explicit.

Prefer local state when state belongs to one component.

Use shared/global state only when multiple parts of the application genuinely need it.

Avoid:

```text
global state for everything
```

Do not introduce Redux/Zustand/etc. simply because they are popular.

Use the simplest mechanism that solves the problem.

---

# 14. Loading States

Never leave the interface blank while data loads.

Provide meaningful loading states.

Prefer skeletons that resemble the final content.

Example:

```text
[████████████]
[████████]
[████████████████]
```

Avoid giant generic spinners.

Bad:

```text
Loading...
```

for an entire page when only one section is loading.

---

# 15. Empty States

Empty states should explain:

1. what is empty
2. why it might be empty
3. what the user can do next

Example:

```text
No questions found

Try changing your subject or difficulty filters.

[Clear filters]
```

Do not use:

```text
Nothing here 😭
```

unless the product's tone explicitly calls for it.

---

# 16. Error States

Errors should be actionable.

Bad:

```text
Something went wrong.
```

Better:

```text
We couldn't load your questions.

Please try again.

[Retry]
```

Do not expose raw backend errors to users.

Log useful debugging information separately.

---

# 17. Forms

Forms should be straightforward.

Rules:

* labels should be visible
* inputs should have clear purpose
* validation should happen near the field
* errors should explain how to fix the problem
* submit buttons should communicate the action

Avoid unnecessarily complicated multi-step forms.

---

# 18. Buttons

Buttons should describe actions.

Good:

```text
Search
Upload Paper
Generate Questions
Save Question
Clear Filters
Retry
```

Bad:

```text
Let's Go
Magic
Continue Journey
Make It Happen
```

unless the product's branding genuinely requires it.

Use button hierarchy:

```text
Primary
Secondary
Tertiary
Destructive
```

Do not make every button primary.

---

# 19. Icons

Use one icon library consistently.

Do not mix:

```text
Lucide
Font Awesome
Heroicons
random SVGs
```

unless there is a genuine reason.

Icons should communicate meaning.

Do not place an icon beside every piece of text.

Avoid decorative icons that add no information.

---

# 20. Animations

Animation should communicate state or improve perception.

Good:

* modal entrance
* dropdown opening
* button feedback
* page transition
* skeleton shimmer
* expanding/collapsing content

Avoid:

* constant floating animations
* excessive hover movement
* huge entrance animations
* animation on every component
* distracting background effects

Default animation duration:

```text
150–250ms
```

Use easing consistently.

Respect:

```css
prefers-reduced-motion
```

---

# 21. Responsive Design

Design mobile layouts intentionally.

Do not simply shrink desktop UI.

Check:

```text
320px
375px
768px
1024px
1280px
1440px+
```

Ask:

> What is the most important information on this screen?

On mobile, remove or collapse secondary information instead of squeezing everything.

---

# 22. Accessibility

Every interactive element must be usable with keyboard navigation.

Ensure:

* semantic HTML
* visible focus states
* proper labels
* sufficient contrast
* alt text where needed
* buttons for actions
* links for navigation
* ARIA only when semantic HTML isn't sufficient

Do not use:

```html
<div onClick={...}>
```

when a button should be used.

---

# 23. Data-Driven UI

Do not hardcode UI that should come from the backend.

Bad:

```tsx
const questions = [
  { title: "Question 1" },
  { title: "Question 2" },
];
```

when these are real application entities.

Use API data and define proper types.

Example:

```ts
type Question = {
  id: string;
  title: string;
  subject: string;
  year: number;
  difficulty: "easy" | "medium" | "hard";
};
```

---

# 24. TypeScript

Use strict typing.

Avoid:

```ts
any
```

unless there is a documented reason.

Prefer explicit domain types.

API responses should have types.

Props should have types.

State should have meaningful types.

---

# 25. API Layer

Do not scatter API calls throughout random components.

Prefer a structured API layer:

```text
lib/
├── api/
│   ├── questions.ts
│   ├── subjects.ts
│   └── auth.ts
```

Example:

```ts
export async function getQuestions(params: QuestionFilters) {
  ...
}
```

Components should primarily care about:

```text
data
loading
error
interaction
```

rather than HTTP implementation details.

---

# 26. URL State

If a state affects:

* search
* filtering
* sorting
* pagination
* selected subject
* selected year

consider putting it in the URL.

Example:

```text
/questions?subject=dsa&year=2025&difficulty=medium
```

This makes pages:

* shareable
* bookmarkable
* refresh-safe
* easier to debug

---

# 27. Performance

Do not optimize blindly.

First make the architecture correct.

Then address:

* unnecessary renders
* huge client components
* excessive JavaScript
* unnecessary API requests
* image sizes
* bundle size
* expensive calculations

Prefer server rendering where appropriate.

Avoid turning the entire application into a client component.

---

# 28. Images

Optimize images.

Use:

* responsive sizing
* modern formats
* lazy loading when appropriate
* meaningful alt text

Never load a 4 MB image when a 100 KB version is sufficient.

---

# 29. Tables

Tables should be used for structured comparison.

Do not convert every list into cards.

For example:

```text
Question | Subject | Year | Difficulty | Status
```

is often better as a table on desktop.

On mobile, transform it into a readable stacked layout if necessary.

---

# 30. Search

Search should feel immediate.

Recommended flow:

```text
User types
    ↓
Debounce
    ↓
Request
    ↓
Results
```

Do not make users press unnecessary buttons for obvious searches.

Always handle:

```text
loading
no results
error
clear search
```

---

# 31. Filtering

Filters should be understandable.

Prefer:

```text
Subject
Year
Difficulty
Topic
```

over an enormous filter panel containing every possible option.

Show active filters.

Provide an easy way to clear them.

---

# 32. Dashboard Design

Do not create a dashboard simply because dashboards are common.

Only show metrics that help users make decisions.

Bad:

```text
Total Questions: 1234
AI Usage: 92%
Productivity Score: 87%
Learning Velocity: 74%
```

if these metrics don't actually help the user.

Good dashboard information should answer questions such as:

```text
What should I study next?
What have I completed?
Where am I weak?
What changed recently?
```

---

# 33. AI Features

AI should be treated as a product capability, not a visual theme.

Do not put:

```text
✨ AI-powered
```

on every screen.

The UI should make the AI's output useful.

For generated content, show:

* source/context
* generated result
* confidence/limitations when relevant
* actions
* regeneration
* editing
* feedback

Do not pretend AI output is authoritative.

---

# 34. Academic / Question Bank UI

For question-bank interfaces, prioritize information density.

A question should make these immediately visible:

```text
Question
Subject
Topic
Year
Exam
Difficulty
Source
```

The user should be able to:

```text
Search
Filter
Open
Save
Attempt
Review
```

without navigating through unnecessary screens.

---

# 35. Content Hierarchy

For question pages:

```text
Breadcrumb
        ↓
Question metadata
        ↓
Question
        ↓
Answer / Solution
        ↓
Explanation
        ↓
Related questions
```

Do not put secondary metadata above the actual question if it pushes the question too far down.

---

# 36. Copywriting

Write like a product team, not an AI assistant.

Prefer:

```text
Upload question paper
```

over:

```text
✨ Unlock intelligent question paper analysis
```

Prefer:

```text
Generate practice questions
```

over:

```text
Supercharge your preparation with AI
```

Prefer concrete language.

---

# 37. Microcopy

Small pieces of text matter.

Examples:

```text
No results for "operating systems"

Try:
• removing a filter
• checking the spelling
```

rather than:

```text
Oops! We couldn't find anything! 😅
```

Keep the tone consistent.

---

# 38. Dark Mode

If the application uses dark mode:

Do NOT make everything pure black.

Prefer layered surfaces:

```text
background
surface
surface-elevated
border
```

Use contrast to create hierarchy.

Avoid:

```text
#000000
#111111
#222222
```

for every element without a system.

---

# 39. Visual Noise

Before shipping a page, ask:

> Can I remove 20% of the visual elements without reducing functionality?

If yes, remove them.

A polished interface often has fewer elements, not more.

---

# 40. "AI Slop" Review

Before considering a page finished, inspect it specifically for:

* unnecessary gradients
* excessive rounded corners
* excessive cards
* generic copy
* meaningless metrics
* decorative icons
* excessive animations
* excessive whitespace
* inconsistent spacing
* inconsistent typography
* unnecessary shadows
* repeated visual patterns
* components that look copied from a template

If the page looks like it could be generated from a generic "modern SaaS dashboard" prompt, redesign it.

---

# 41. Engineering Review

Before finishing a feature, verify:

### Functionality

* [ ] happy path works
* [ ] loading state works
* [ ] empty state works
* [ ] error state works
* [ ] refresh works
* [ ] navigation works
* [ ] back button works

### Responsive

* [ ] mobile
* [ ] tablet
* [ ] desktop
* [ ] wide desktop

### Accessibility

* [ ] keyboard navigation
* [ ] focus states
* [ ] semantic HTML
* [ ] labels
* [ ] contrast

### Code

* [ ] no unnecessary `any`
* [ ] no duplicated logic
* [ ] no dead components
* [ ] no random magic values
* [ ] no unnecessary dependencies
* [ ] no console errors
* [ ] no API calls hidden inside presentation components

---

# 42. Final Rule

Do not optimize for:

> "Wow, this looks AI-generated."

Optimize for:

> "I can immediately understand how this product works."

The frontend should feel like a real engineering project built around a real user problem.

**Function first.
Hierarchy second.
Aesthetics third.
Effects last.**


