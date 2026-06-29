# Module 7: Refactoring for Testability — Dependency Injection

Est. study time: 2h
Language: en
Description: Break Tier 3 components by applying dependency injection patterns: prop injection, hooks-as-DI, and store composition.

## Learning Objectives
- Apply prop injection to make data dependencies explicit
- Use custom hooks as dependency injection boundary
- Compose stores to avoid cross-store coupling
- Break Tier 3 components into independently testable Tier 1+2 pieces

---

## Core Content

### 7.1 The Tier 3 Problem

Tier 3 code has 3+ dependencies (multiple stores, API, routing). Testing requires mocking everything.

```typescript
// ☠ Tier 3 component
function CoursePage({ courseId }: { courseId: string }) {
  const user = useAuthStore((s) => s.user)                    // dep 1
  const course = useCourseStore((s) => s.courses[courseId])   // dep 2
  const progress = useProgressStore((s) => s.progress)        // dep 3
  const navigate = useNavigate()                               // dep 4

  useEffect(() => {
    if (!user) navigate('/login')
    useCourseStore.getState().loadCourse(courseId)
  }, [user, courseId, navigate])
  // ...
}
```

Testing this component requires: setting 3 stores + mocking router + mocking API. Setup costs exceed test value.

**Solution:** Break dependencies by injecting them. Three patterns:

1. **Prop injection** — pass data as props instead of reading from stores inside component
2. **Hooks-as-DI** — wrap store reads in a custom hook, mock the hook boundary
3. **Store composition** — combine dependent stores into a single selector

> **Think**: What's the minimum change that improves this component's testability?
>
> *Answer: Pass `user` and `course` as props instead of reading stores inside the component. The component becomes a pure rendering unit. The parent handles data fetching and store reads.*

### 7.2 Pattern 1: Prop Injection

Pass data as props instead of reading from stores inside the component.

```typescript
// ✅ Before — Tier 3
function CourseCard({ courseId }: { courseId: string }) {
  const course = useCourseStore((s) => s.courses[courseId])
  return <div>{course.title}</div>
}

// ✅ After — Tier 2
function CourseCard({ course }: { course: Course }) {
  return <div>{course.title}</div>
}
```

The parent component reads the store and passes data down:

```typescript
function CoursePage({ courseId }: { courseId: string }) {
  const course = useCourseStore((s) => s.courses[courseId])
  return <CourseCard course={course} />
}
```

**Testing benefit:** `CourseCard` now takes a plain prop — no store mocking needed. Test with any Course object.

```typescript
// CourseCard.test.tsx — Tier 2, no store mock
test('renders course title', () => {
  render(<CourseCard course={{ id: '1', title: 'Test' } as Course />)
  expect(screen.getByText('Test')).toBeInTheDocument()
})
```

**When to use prop injection:**
- Component reads from 1-2 stores for display only (no actions)
- Data can be fetched/transformed by parent
- Component is reused in multiple contexts

**When NOT to use:**
- Component is the top-level page (can't avoid store reads there)
- Component modifies store state (needs access to actions)
- Prop drilling becomes excessive (more than 3 levels, consider other patterns)

> **Think**: How do you handle store actions (not just state) with prop injection?
>
> *Answer: Pass action callbacks as props too: `<CourseCard onComplete={() => useCourseStore.getState().complete(courseId)} />`. The component calls the callback without knowing about the store.*

### 7.3 Pattern 2: Hooks-as-DI Boundary

Wrap store reads in a custom hook. The hook becomes the dependency boundary — mock it in component tests, test the hook separately.

```typescript
// hooks/useCoursePage.ts
export function useCoursePageData(courseId: string) {
  const user = useAuthStore((s) => s.user)
  const course = useCourseStore((s) => s.courses[courseId])
  const progress = useProgressStore((s) => s.progress)
  const navigate = useNavigate()

  return { user, course, progress, navigate }
}
```

Now the component reads from the hook, not stores directly:

```typescript
// Before — Tier 3, stores scattered in component
function CoursePage({ courseId }: { courseId: string }) {
  const user = useAuthStore((s) => s.user)
  const course = useCourseStore((s) => s.courses[courseId])
  const progress = useProgressStore((s) => s.progress)
  // ...
}

// After — Tier 2, data comes from one hook
function CoursePage({ courseId }: { courseId: string }) {
  const { user, course, progress } = useCoursePageData(courseId)
  // ...
}
```

**Testing the hook:** Use `renderHook` with store setup.

```typescript
// useCoursePageData.hook.test.ts — Tier 2
test('returns course data when logged in', () => {
  useAuthStore.setState({ user: { id: '1', name: 'Alice' } })
  useCourseStore.setState({
    courses: { 'c1': { id: 'c1', title: 'Test Course' } }
  })

  const { result } = renderHook(() => useCoursePageData('c1'))

  expect(result.current.user.name).toBe('Alice')
  expect(result.current.course.title).toBe('Test Course')
})
```

**Testing the component:** Mock the hook at the module boundary.

```typescript
// CoursePage.component.test.tsx
void mock.module('./useCoursePageData', () => ({
  useCoursePageData: () => ({
    user: { id: '1', name: 'Alice' },
    course: { id: 'c1', title: 'Test Course' },
    progress: { completed: ['m1'] },
    navigate: mock(() => {}),
  }),
}))

// Now CoursePage is Tier 2 — mock the hook, test rendering
```

**Important:** The hook mock is only safe because `useCoursePageData` is imported by exactly one test file (CoursePage test). Module-level hooks that are shared across many test files should NOT be mocked this way.

> **Think**: What's the risk of using mock.module on custom hooks?
>
> *Answer: Same as any mock.module — process-global pollution. Only safe if the hook module is imported by exactly one test file. If useCoursePageData is also used by other tests, the mock leaks.*

### 7.4 Pattern 3: Store Composition

Instead of cross-store reads inside components, compose store selectors into a single selector.

```typescript
// stores/composed.ts
import { useAuthStore } from './authStore'
import { useCourseStore } from './courseStore'

export function useCoursePermissions(courseId: string) {
  return useAuthStore((s) => ({
    isAdmin: s.user?.role === 'admin',
    isOwner: s.user?.id === useCourseStore.getState().courses[courseId]?.ownerId,
  }))
}
```

Testing the composed selector:

```typescript
test('isAdmin is true for admin users', () => {
  useAuthStore.setState({ user: { id: '1', role: 'admin' } })
  useCourseStore.setState({
    courses: { 'c1': { id: 'c1', ownerId: '2' } }
  })

  const { result } = renderHook(() => useCoursePermissions('c1'))
  expect(result.current.isAdmin).toBe(true)
  expect(result.current.isOwner).toBe(false)
})
```

**When to compose:**
- Multiple stores are always read together
- The combination represents a single domain concept (permissions, progress)
- You want to test the composition independently

> **Think**: What's the difference between hook-as-DI and store composition?
>
> *Answer: Hook-as-DI sits between stores and component, designed to be mocked at the import boundary. Store composition merges stores into selectors, designed to be tested directly (never mocked). Composition avoids mock.module pollution.*

### 7.5 Breaking a Tier 3 Component — Complete Example

```typescript
// ☠ Before — Tier 3
function QuizPage({ lessonId }: { lessonId: string }) {
  const user = useAuthStore((s) => s.user)
  const lesson = useLessonStore((s) => s.lessons[lessonId])
  const quiz = useQuizStore((s) => s.quiz)
  const { startQuiz, submitAnswer } = useQuizEngine(lessonId)
  const navigate = useNavigate()

  if (!user) { navigate('/login'); return null }
  if (!quiz) return <Spinner />

  return <QuizView quiz={quiz} onSubmit={submitAnswer} />
}
```

**Step 1:** Extract pure logic (Module 6).
- `hasAccess(user, lesson)`: checks if user can access lesson
- `isComplete(quiz, lesson)`: checks if quiz is done

**Step 2:** Create hook-as-DI boundary.

```typescript
// hooks/useQuizPage.ts
export function useQuizPageData(lessonId: string) {
  const user = useAuthStore((s) => s.user)
  const lesson = useLessonStore((s) => s.lessons[lessonId])
  const quiz = useQuizStore((s) => s.quiz)
  const { startQuiz, submitAnswer } = useQuizEngine(lessonId)
  const navigate = useNavigate()

  return { user, lesson, quiz, startQuiz, submitAnswer, navigate }
}
```

**Step 3:** Simplify component.

```typescript
function QuizPage({ lessonId }: { lessonId: string }) {
  const { user, lesson, quiz, startQuiz, submitAnswer, navigate } = useQuizPageData(lessonId)

  if (!user) { navigate('/login'); return null }
  if (!quiz) return <Spinner />

  return <QuizView quiz={quiz} onSubmit={submitAnswer} />
}
```

**Result:** 3 testable units instead of 1:
- `hasAccess` + `isComplete` — Tier 1, zero mocks
- `useQuizPageData` — Tier 2, store mocks only, tested with renderHook
- `QuizPage` — Tier 2, mock the hook, test rendering + navigation

---

## Why This Matters

Dependency injection converts Tier 3 (untestable, high cost) into Tier 1+2 (easily testable, low cost). The upfront refactoring pays for itself when you write tests that actually find bugs.

---

## Common Questions

**Q: Isn't prop injection just prop drilling?**
A: Prop injection is intentional — one level of explicit passing for testability. Prop drilling through 5+ levels is different; use composition or hooks-as-DI for deep trees.

**Q: Does React.Context solve this?**
A: Context swaps one global (import) for another (Context). Both are global state. Context still needs wrapping in tests. Prop injection or hooks-as-DI are more explicit.

**Q: Should I always use hooks-as-DI?**
A: No. Start with prop injection — simplest. Use hooks-as-DI only when prop injection causes excessive drilling. Use store composition when multiple stores are always read together.

---

## Key Takeaways

- Three DI patterns: prop injection, hooks-as-DI, store composition
- Prop injection: pass data as props, simple and explicit
- Hooks-as-DI: wrap store reads in custom hook, mock at boundary
- Store composition: merge cross-store reads into single selector
- Breaking Tier 3 → Tier 1+2 is the highest-leverage testing improvement
- Prefer patterns that avoid mock.module pollution (prop injection first)

---

## Common Misconception

**"Dependency injection means I need a DI container library."**

React makes DI straightforward: pass props, wrap in hooks, compose selectors. No library needed. The patterns in this module are DI — they make dependencies explicit and replaceable.

---

## Feynman Explain

(Explain how you'd break a component that reads from useAuthStore, useCourseStore, and useProgressStore into testable pieces. Walk through prop injection vs hooks-as-DI.)

---

## Drill

Run: `learn.sh quiz testing 7`
