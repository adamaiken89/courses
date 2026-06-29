---
name: scroll-invariant
description: Prevents scroll regression when editing PageContent or LessonSection. Trigger on any edit to PageContent.tsx, LessonSection.tsx, or PageLayout.tsx.
---

# PageContent scroll invariant

**PageContent MUST have `flex flex-col` classes.** Without them:

1. `div.flex.flex-1.overflow-hidden` inside `LessonSection` gets unbounded height
2. Inner `contentRef` (`overflow-y-auto`) never overflows
3. `scrollToSection` calls on `contentRef.scrollTop` silently do nothing

## Symptoms

- Sections always at scrollTop 0
- Real scrollbar lives on `contentRef` only when `PageContent` is a flex container

## Files involved

- `src/mainview/layouts/PageContent.tsx` — must preserve `flex flex-col`
- `src/mainview/sections/LessonSection.tsx` — depends on this layout

## Verification

```tsx
it('maintains scroll container layout', () => {
  const { container } = render(<PageContent><div /></PageContent>);
  expect(container.firstChild).toHaveClass('flex', 'flex-col');
});
```

Do not remove or modify `flex flex-col` from `PageContent` for any reason. If layout needs adjustment, add wrappers inside `PageContent` instead.
