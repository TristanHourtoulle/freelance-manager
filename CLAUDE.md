# Freelance Manager — Project Instructions

## Stadium-Shape Border Radius System

All interactive elements (buttons, inputs, selects, chips) follow a **stadium-shape** system based on their position in a group:

### Rules

| Group size            | Position | Border radius                      |
| --------------------- | -------- | ---------------------------------- |
| **1 element** (alone) | only     | `9999px` (full pill)               |
| **2+ elements**       | first    | `19px 12px 12px 19px` (pill-left)  |
| **2+ elements**       | middle   | `12px`                             |
| **2+ elements**       | last     | `12px 19px 19px 12px` (pill-right) |

### How to apply

- **Buttons**: Use `shape="pill"` for single buttons, `shape="pill-left"` / `shape="pill-right"` for grouped buttons.
- **Inputs**: Apply `style={{ borderRadius: "..." }}` with the appropriate value based on position. Always use `h-[38px] px-4` for consistent height and padding.
- **Selects**: Apply the same `borderRadius` style to `<SelectTrigger>`.
- **Chips**: Use the `<Chip>` component with `position` prop (`"first"`, `"middle"`, `"last"`, `"only"`).

### Examples

```tsx
{/* Single button → full pill */}
<Button variant="gradient" shape="pill" size="lg">Save</Button>

{/* Two buttons → pill-left + pill-right */}
<Button variant="outline" shape="pill-left" size="lg">Cancel</Button>
<Button variant="gradient" shape="pill-right" size="lg">Save</Button>

{/* Input + Button → stadium pair */}
<Input className="h-[38px] px-4" style={{ borderRadius: "19px 12px 12px 19px" }} />
<Button variant="gradient" size="lg" style={{ borderRadius: "12px 19px 19px 12px" }}>Save</Button>

{/* Select + Input + Button → 3 elements */}
<SelectTrigger style={{ borderRadius: "19px 12px 12px 19px" }}>...</SelectTrigger>
<Input style={{ borderRadius: "12px" }} />
<Button style={{ borderRadius: "12px 19px 19px 12px" }}>Save</Button>
```

## Design System Tokens

- Cards: `rounded-xl border border-border bg-surface p-6`
- Button sizes: Always `size="lg"` for primary actions
- Button variant: `variant="gradient"` for primary, `variant="outline"` for secondary
- Input height: `h-[38px]` with `px-4` padding
- Gap between grouped elements: `gap-2.5`
- Section spacing: `space-y-6`
- Page structure: `<PageHeader>` → content sections

## Tech Stack Notes

- Package manager: **pnpm**
- Icons: **@heroicons/react** (never use lucide-react in app code)
- All code in **English**
- Font: **Inter**
