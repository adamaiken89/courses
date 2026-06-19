# Module 3: Form Libraries — Formio & React Hook Form

Est. study time: 2.5h
Language: en

## Learning Objectives
- Distinguish headless form state (RHF) from schema-driven forms (Formio, JSON Forms)
- Design form abstraction that supports dynamic schema generation and static typed forms
- Implement validation abstraction (Zod, Yup, Joi) decoupled from form library
- Architect wizard/multi-step forms with shared state across steps

---

## Core Content

### Two Form Paradigms

**Headless form state**: React Hook Form, Formik — library manages form state (values, errors, touched). Consumer renders fields manually. Full control over UI.

**Schema-driven forms**: Formio, JSON Forms, React JSON Schema Form — render entire form from JSON schema. Minimal control over UI. Fast for simple forms.

| Concern | React Hook Form | Formio |
|---------|----------------|--------|
| Rendering | Manual (consumer) | Auto (from schema) |
| Bundle impact | 10KB | ~200KB (includes renderer) |
| Custom fields | Any React component | Plugin via components |
| Dynamic forms | Conditional logic in code | Conditional logic in schema |
| Versioning | Not applicable | Schema versioned in DB |
| Accessibility | Consumer responsibility | Built-in |

Wrapper pattern: abstract form interface so consumer does not know which paradigm runs:

```typescript
interface FormContext<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  setValue: (field: keyof T, value: unknown) => void
  setError: (field: keyof T, message: string) => void
  submit: () => Promise<T>
  reset: (values?: T) => void
  isValid: boolean
  isSubmitting: boolean
}
```

RHF implementation wraps `useForm` + `Controller`. Formio implementation parses schema into same interface.

> **Think**: Formio schema can be stored in DB and rendered without code changes. RHF cannot. Should abstraction expose schema capability or keep it abstract?
>
> *Answer: Expose schema as optional. FormContext abstraction = form API. Schema rendering = separate concern. If app needs DB-driven forms, the form component accepts schema prop. If app builds forms in code, it does not.*

### Validation Abstraction

Validation logic should not couple to form library:

```typescript
// Domain validation — pure functions, no form library dependency
function validateUser(data: unknown): ValidationResult<UserData> {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    age: z.number().min(18).max(120)
  })
  const result = schema.safeParse(data)
  return result.success
    ? { valid: true, data: result.data }
    : { valid: false, errors: flattenZodErrors(result.error) }
}

// Adapter: converts domain validation to form library errors
function zodToRHF<T>(schema: ZodSchema<T>) {
  return (data: T) => {
    const result = schema.safeParse(data)
    if (result.success) return {}
    return flattenZodErrors(result.error)
  }
}
```

RHF resolver adapter: `resolver: zodResolver(schema)` — one import changes with form library.

> **Think**: Formio has built-in validation engine. Should you bypass it and use Zod? When?
>
> *Answer: Use built-in validation for simple rules (required, minLength, pattern). Use Zod for complex validation (cross-field, async, business rules). Formio supports custom validation via `custom` property that calls external validator.*

### Multi-Step (Wizard) Forms

Wizard forms share state across steps. State ownership depends on paradigm:

**RHF**: Single `useForm` instance persists across wizard steps. Each step renders subset of fields. `trigger()` validates per step.

**Formio**: Each step = separate form submission. State must pass via parent component or store.

Abstraction:

```typescript
interface WizardState<T> {
  currentStep: number
  totalSteps: number
  data: Partial<T>
  errors: Partial<Record<keyof T, string>>
  goNext: () => Promise<boolean>
  goBack: () => void
  setStepData: (step: number, data: Partial<T>) => void
  submit: () => Promise<T>
}

function useAppWizard<T>(steps: WizardStep<T>[]): WizardState<T> {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Partial<T>>({})

  const goNext = useCallback(async () => {
    const valid = await steps[step].validate(data)
    if (!valid) return false
    if (step < steps.length - 1) { setStep(s => s + 1); return true }
    return false
  }, [step, data])

  const submit = useCallback(async () => {
    return steps[step].onSubmit(data)
  }, [step, data])

  return { currentStep: step, totalSteps: steps.length, data, goNext, goBack, submit }
}
```

Underlying form library implementation is hidden inside step configs.

> **Think**: Wizard with server-side validation per step requires submitting partial data. How to design step validation that works offline and online?
>
> *Answer: Two-tier validation. Client-side: Zod schema per step (synchronous, always runs). Server-side: POST step data, return field-level errors. Merge server errors into form errors. Wizard proceeds only after client AND server validation pass.*

### Dynamic Forms (Schema-Driven)

Server returns form schema, client renders without code change. Formio excels here.

Wrapper pattern for schema-driven forms:

```typescript
interface SchemaFormProps<T> {
  schema: FormSchema  // JSON Schema / Formio schema
  data?: Partial<T>
  onSubmit: (data: T) => void
  onError?: (errors: ValidationError[]) => void
  components?: Record<string, CustomComponent<T>>
  loading?: boolean
}
```

`FormSchema` type abstracts library-specific schema format:

```typescript
interface FormSchema {
  title?: string
  type: 'object'
  properties: Record<string, FieldSchema>
  required?: string[]
  layout?: LayoutDirective[]  // rows, columns, tabs
  conditions?: ConditionalRule[]
}
```

Mapper converts app schema to Formio/RJSF format. If Formio is replaced, only mapper changes.

> **Think**: Schema-driven forms trade UI control for development speed. When does the trade-off reverse?
>
> *Answer: Trade-off reverses when: (1) designers require pixel-perfect form layouts, (2) forms have complex conditional logic cross-field, (3) form UX needs custom animations or transitions. Schema-driven forms assume procedural layout; custom UI assumes declarative layout.*

### React 19 Actions Integration

React 19 introduces form Actions, which fundamentally change how form state is managed. `useActionState` (formerly `useFormState`) replaces manual `isSubmitting`/`error` state management with a reducer-like pattern:

```typescript
function UserForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await api.createUser(formData)
      return result.success
        ? { status: 'success', message: 'User created' }
        : { status: 'error', errors: result.fieldErrors }
    },
    { status: 'idle', errors: {} }
  )

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      {state.errors.email && <ErrorText>{state.errors.email}</ErrorText>}
      <button disabled={isPending} type="submit">
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

React Hook Form adapts to Actions via `handleSubmit` wrapping the action function. The `useActionState` hook handles pending state, validation errors, and success/failure feedback — state that RHF manages manually:

```typescript
function RHFWithAction() {
  const { register, handleSubmit, formState: { errors } } = useForm<UserData>()
  const [state, formAction, isPending] = useActionState(submitUser, null)

  const onSubmit = (data: UserData) => {
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => formData.append(k, v))
    formAction(formData)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: true })} />
      {errors.email && <span>{errors.email.message}</span>}
      {state?.status === 'error' && <Alert>{state.message}</Alert>}
      <button disabled={isPending} type="submit">
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

For Server Components, form validation can run on the server via `"use server"` actions, eliminating the need for client-side Zod resolvers:

```typescript
// server action
"use server"
async function validateUserSchema(prev: unknown, data: FormData) {
  const schema = z.object({ email: z.string().email(), name: z.string().min(2) })
  const parsed = schema.safeParse(Object.fromEntries(data))
  return parsed.success ? { status: 'success' } : { status: 'error', errors: parsed.error.flatten().fieldErrors }
}
```

`useOptimistic` provides instant feedback for form submissions by assuming success and rolling back on error. This pairs with Actions to create optimistic form UIs without additional state management:

```typescript
function OptimisticForm() {
  const [state, formAction, isPending] = useActionState(submitData, null)
  const [optimisticData, addOptimistic] = useOptimistic(
    currentData,
    (state, newData: FormData) => ({ ...state, ...Object.fromEntries(newData) })
  )

  return (
    <form action={formAction}>
      <p>Name: {optimisticData.name}</p>
      <input name="name" />
      <button type="submit" disabled={isPending}>Save</button>
      {state?.status === 'error' && <ErrorText>Failed: {state.message}</ErrorText>}
    </form>
  )
}
```

Compared to traditional RHF approach, React 19 Actions reduce boilerplate for form submission state, integrate natively with HTML forms (progressive enhancement), and move validation to the server when using Server Components.

---

### Why This Matters

Forms are the highest-churn UI in most apps. Every feature adds form fields. Every design iteration tweaks layout. Form library choice affects how fast you iterate, how much code you write, and how hard migration hurts. Abstraction lets you start with RHF (lightweight, flexible) and adopt Formio where dynamic schemas help, without rewriting all forms.

---

### Common Questions

**Q: Should all forms use the same form library?**
A: No. Use RHF for hand-crafted forms (complex layout, custom inputs). Use Formio for admin panels, survey tools, and user-configurable forms. Abstraction lets you mix both.

**Q: How to handle file uploads?**
A: Abstract behind `FileUploader` interface. RHF: `Controller` with custom dropzone. Formio: built-in file component with storage provider config. Wrapper: `accept`, `maxSize`, `multiple` props map to both.

---

## Examples

### Example 1: Multi-Vendor Checkout Form

**Problem**: Checkout form must support Stripe Elements (RHF integration) and a legacy Formio-generated form for custom fields.

**Solution**: Both implement `FormContext<CheckoutData>`. Checkout page uses context interface, not library directly:

```typescript
function CheckoutPage() {
  const paymentForm = useStripeRHF()
  const customForm = useFormio('checkout-extras')

  const handleSubmit = async () => {
    const paymentValid = await paymentForm.trigger()
    const customValid = await customForm.trigger()
    if (!paymentValid || !customValid) return
    await api.submitCheckout({
      ...paymentForm.getValues(),
      ...customForm.getValues()
    })
  }

  return (
    <div>
      <RHFWrapper context={paymentForm}>
        <StripeCardElement />
      </RHFWrapper>
      <FormioWrapper context={customForm} />
    </div>
  )
}
```

### Example 2: Admin Form Builder

**Problem**: Admin builds forms via drag-drop UI, saved as JSON schema, rendered on customer-facing site.

**Solution**: Formio for builder and renderer. Abstraction layer captures schema format. If Formio is replaced, builder and renderer both implement the same `FormSchema` interface.

---

## Key Takeaways
- Headless (RHF) vs schema-driven (Formio): different paradigms, same form context interface possible
- Validate with Zod/Yup — adapt to form library via resolver/adapter pattern
- Wizard forms: single state shared across steps, library-hidden inside step configs
- Dynamic forms: abstract schema type so library-specific format lives inside wrapper
- Mix paradigms: RHF for complex UIs, Formio for admin/survey forms, both behind same FormContext

## Common Misconception

**"React Hook Form works best with uncontrolled inputs."**

RHF uses uncontrolled inputs internally for performance, but `Controller` wrapper makes controlled components (MUI TextField, AntD Input) work correctly. The controlled/uncontrolled distinction matters for library wiring, not for form abstraction. Consumers should not know whether a field is controlled or uncontrolled.

---

## Feynman Explain
(Explain the difference between "building forms with code" and "building forms with a schema" to a product manager. Use recipe analogy: cooking from recipe vs assembling from IKEA instructions.)

---

## Reframe
(Pause. Schema-driven forms reduce developer effort but increase designer frustration. When does Formio's schema renderer create more work than hand-building forms? Consider: pixel-perfect designs, complex animations, accessibility customization.)

---

## Drill
Take the quiz. MCQs test paradigm selection, validation abstraction, wizard state patterns, and schema-driven vs code-driven form trade-offs.

Run: `learn.sh quiz external-lib-patterns 03-form-libraries`
