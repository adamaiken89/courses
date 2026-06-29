# Module 15: Capstone — Refactor a Real Tier-3 Component

Est. study time: 2.5h
Language: en
Description: Full-cycle refactor of a Tier-3 component: identify, split into testable units, test each piece, verify integration.

## Learning Objectives
- Apply all prior module patterns to a real codebase scenario
- Identify Tier 3 components by mock cost heuristic
- Apply extract + DI + compose patterns systematically
- Write tests at each tier after refactoring
- Verify the refactored component works via integration test

---

## Core Content

### 15.1 The Scenario

A "Course Dashboard" component that shows:
- User's enrolled courses with progress
- Recommended courses based on completion history
- Quick actions (resume, start, review)
- Admin controls if user is admin

```typescript
// ☠ Tier 3 — 6+ dependencies, mixed concerns
function CourseDashboard({ userId }: { userId: string }) {
  const user = useAuthStore((s) => s.user)                    // dep 1
  const courses = useCourseStore((s) => s.courses)            // dep 2
  const progress = useProgressStore((s) => s.progress)        // dep 3
  const recommendations = useRecommendStore((s) => s.items)   // dep 4
  const navigate = useNavigate()                               // dep 5
  const isAdmin = user?.role === 'admin'                       // logic mixed

  useEffect(() => {
    useCourseStore.getState().loadCourses()
    useProgressStore.getState().loadProgress(userId)
    if (isAdmin) {
      useCourseStore.getState().loadAllCourses()
    }
  }, [userId, isAdmin])

  // Inline filtering/sorting logic (hard to test)
  const inProgress = Object.values(courses)
    .filter(c => progress[c.id] && !progress[c.id].completed)
    .sort((a, b) => progress[b.id]?.updatedAt - progress[a.id]?.updatedAt)

  const completed = Object.values(courses)
    .filter(c => progress[c.id]?.completed)

  return (
    <div>
      <AdminPanel courses={courses} />
      <ProgressSection courses={inProgress} />
      <CompletedSection courses={completed} />
      <Recommendations items={recommendations} />
    </div>
  )
}
```

**Tier 3 diagnosis:**
- 5 dependencies (4 stores + navigate)
- 2 inline logic blocks (sorting, filtering)
- Mixed concerns (data fetching, admin checks, display logic)
- 3 child components rendered with inline computed data

> **Think**: What's the first step — extract logic or DI?
>
> *Answer: Extract pure logic first (Module 6). The filtering/sorting functions are Tier 1 candidates. Then apply DI (Module 7) to the remaining store dependencies.*

### 15.2 Step 1: Extract Pure Logic

```typescript
// utils/course-dashboard.ts — Tier 1, zero mocks
export function getInProgressCourses(
  courses: Record<string, Course>,
  progress: Record<string, Progress>
): Course[] {
  return Object.values(courses)
    .filter(c => progress[c.id] && !progress[c.id].completed)
    .sort((a, b) => (progress[b.id]?.updatedAt ?? 0) - (progress[a.id]?.updatedAt ?? 0))
}

export function getCompletedCourses(
  courses: Record<string, Course>,
  progress: Record<string, Progress>
): Course[] {
  return Object.values(courses).filter(c => progress[c.id]?.completed)
}

export function getQuickAction(course: Course, progress: Progress): 'resume' | 'start' | 'review' {
  if (progress.completed) return 'review'
  if (progress.lastLessonId) return 'resume'
  return 'start'
}
```

**Test these (Tier 1):**

```typescript
// utils/course-dashboard.test.ts
describe('getInProgressCourses', () => {
  const courses = {
    '1': { id: '1', title: 'Course A' },
    '2': { id: '2', title: 'Course B' },
    '3': { id: '3', title: 'Course C' },
  } as Record<string, Course>

  it('filters out completed courses', () => {
    const progress = {
      '1': { completed: false },
      '2': { completed: true },
    } as Record<string, Progress>

    const result = getInProgressCourses(courses, progress)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('sorts by most recent activity', () => {
    const progress = {
      '1': { completed: false, updatedAt: 100 },
      '3': { completed: false, updatedAt: 300 },
    } as Record<string, Progress>

    const result = getInProgressCourses(courses, progress)
    expect(result[0].id).toBe('3') // most recent first
    expect(result[1].id).toBe('1')
  })

  it('handles empty progress', () => {
    expect(getInProgressCourses(courses, {})).toEqual([])
  })
})

describe('getQuickAction', () => {
  it('returns "start" for new course', () => {
    expect(getQuickAction({ id: '1' } as Course, {} as Progress)).toBe('start')
  })

  it('returns "resume" for in-progress course', () => {
    expect(getQuickAction(
      { id: '1' } as Course,
      { lastLessonId: 'l1' } as Progress
    )).toBe('resume')
  })

  it('returns "review" for completed course', () => {
    expect(getQuickAction(
      { id: '1' } as Course,
      { completed: true } as Progress
    )).toBe('review')
  })
})
```

### 15.3 Step 2: Create Hook Boundary (DI)

```typescript
// hooks/useDashboardData.ts
export function useDashboardData(userId: string) {
  const user = useAuthStore((s) => s.user)
  const courses = useCourseStore((s) => s.courses)
  const progress = useProgressStore((s) => s.progress)
  const recommendations = useRecommendStore((s) => s.items)
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  const inProgress = useMemo(
    () => getInProgressCourses(courses, progress),
    [courses, progress]
  )
  const completed = useMemo(
    () => getCompletedCourses(courses, progress),
    [courses, progress]
  )

  return {
    user,
    isAdmin,
    inProgress,
    completed,
    recommendations,
    navigate,
  }
}
```

**Test the hook (Tier 2):**

```typescript
// hooks/useDashboardData.hook.test.ts
describe('useDashboardData', () => {
  beforeEach(() => {
    useAuthStore.setState(buildAuthState())
    useCourseStore.setState(buildCourseState())
    useProgressStore.setState(buildProgressState())
    useRecommendStore.setState(buildRecommendState())
  })

  test('computes in-progress and completed courses', () => {
    useCourseStore.setState({
      courses: {
        '1': { id: '1', title: 'Course A' },
        '2': { id: '2', title: 'Course B' },
      },
    })
    useProgressStore.setState({
      progress: {
        '1': { completed: false, updatedAt: 200 },
        '2': { completed: true },
      },
    })

    const { result } = renderHook(() => useDashboardData('user-1'))

    expect(result.current.inProgress).toHaveLength(1)
    expect(result.current.inProgress[0].id).toBe('1')
    expect(result.current.completed).toHaveLength(1)
    expect(result.current.completed[0].id).toBe('2')
  })
})
```

### 15.4 Step 3: Simplify the Component

```typescript
// CourseDashboard.tsx — now Tier 2
function CourseDashboard({ userId }: { userId: string }) {
  const {
    user,
    isAdmin,
    inProgress,
    completed,
    recommendations,
    navigate,
  } = useDashboardData(userId)

  if (!user) { navigate('/login'); return null }

  return (
    <div>
      {isAdmin && <AdminPanel />}
      <ProgressSection courses={inProgress} />
      <CompletedSection courses={completed} />
      {recommendations.length > 0 && (
        <Recommendations items={recommendations} />
      )}
    </div>
  )
}
```

**Test sub-components (Tier 2 — props only):**

```typescript
// ProgressSection.component.test.tsx
describe('ProgressSection', () => {
  test('shows quick action buttons', () => {
    const courses = [
      { id: '1', title: 'Course A', lastLessonId: 'l1' },
      { id: '2', title: 'Course B' },
    ] as Course[]

    render(<ProgressSection courses={courses} />)
    expect(screen.getByText(/resume/i)).toBeInTheDocument()
    expect(screen.getByText(/start/i)).toBeInTheDocument()
  })

  test('shows empty state', () => {
    render(<ProgressSection courses={[]} />)
    expect(screen.getByText(/no courses in progress/i)).toBeInTheDocument()
  })
})
```

**Test the full dashboard (integration — mock hook):**

```typescript
// CourseDashboard.component.test.tsx
void mock.module('./useDashboardData', () => ({
  useDashboardData: () => ({
    user: { id: '1', name: 'Alice' },
    isAdmin: false,
    inProgress: [{ id: '1', title: 'React Testing', quickAction: 'resume' }],
    completed: [],
    recommendations: [],
    navigate: mock(() => {}),
  }),
}))

describe('CourseDashboard', () => {
  test('renders dashboard for regular user', () => {
    render(<CourseDashboard userId="1" />)
    expect(screen.getByText('React Testing')).toBeInTheDocument()
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
  })

  test('shows admin panel for admin users', () => {
    mock.module('./useDashboardData', () => ({
      useDashboardData: () => ({
        user: { id: '2', role: 'admin' },
        isAdmin: true,
        inProgress: [],
        completed: [],
        recommendations: [],
        navigate: mock(() => {}),
      }),
    }))

    render(<CourseDashboard userId="2" />)
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })
})
```

### 15.5 Final Test Inventory

After refactoring, the test suite looks like:

| Test | Tier | Lines | Mocks |
|---|---|---|---|
| `getInProgressCourses` | 1 | 40 | 0 |
| `getCompletedCourses` | 1 | 15 | 0 |
| `getQuickAction` | 1 | 20 | 0 |
| `useDashboardData` | 2 | 45 | store.setState |
| `ProgressSection` | 2 | 30 | 0 (props only) |
| `CompletedSection` | 2 | 25 | 0 (props only) |
| `Recommendations` | 2 | 25 | 0 (props only) |
| `CourseDashboard` | 2 | 35 | mock hook |
| **Total** | | **235** | **minimal** |

Before refactoring: one untestable Tier 3 component.
After refactoring: 8 testable units, 3 Tier 1 (no mocks), 5 Tier 2 (minimal mocks).

---

## Why This Matters

This capstone brings together every pattern from the course. The result is not just testable code — it's better architected code. Extracted functions are reusable. DI hooks are composable. The component is simpler and more maintainable.

---

## Common Questions

**Q: Is the dashboard easier to maintain after refactoring?**
A: Yes. Each file has one responsibility. Changes to filtering logic go in `utils/course-dashboard.ts`. Changes to data fetching go in the hook. The component only handles layout.

**Q: Did we over-engineer a simple component?**
A: The original had 6 dependencies + 2 inline logic blocks + 3 child component integrations. That's not simple. This refactoring matches the actual complexity.

**Q: What if the component has to stay Tier 3 due to time constraints?**
A: Write integration tests for the most critical user flows and plan the refactoring for the next sprint. Never leave Tier 3 untested in production.

---

## Key Takeaways

1. **Identify** Tier 3 by mock cost heuristic (setup > assertions)
2. **Extract** pure logic into Tier 1 functions — test exhaustively
3. **Create hook boundary** to contain store/router dependencies
4. **Simplify component** to receive computed data as props
5. **Test piece by piece** — Tier 1 pure functions, Tier 2 hook, Tier 2 sub-components, Tier 2 integration
6. **Verify integration** with minimal mocks (mock hook only, test layout and conditional rendering)

---

## Common Misconception

**"Refactoring for testability means rewriting production code."**

Refactoring for testability improves architecture. Extract pure logic (separate concerns), create hook boundaries (single responsibility), simplify components (less prop drilling). The code becomes better designed AND testable. No compromise needed.

---

## Feynman Explain

(Walk through the full capstone scenario: given a Tier 3 component with 4 stores, 2 inline logic blocks, and 3 child components — explain the step-by-step refactoring process. What gets extracted first? What becomes a hook? Which tests do you write at each step?)

---

## Drill

Run: `learn.sh quiz testing 15`
