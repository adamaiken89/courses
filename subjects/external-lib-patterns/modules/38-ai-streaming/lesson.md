# Module 38: AI Streaming — Vercel AI SDK

Est. study time: 2h
Language: en

## Learning Objectives
- Integrate Vercel AI SDK useChat hook for streaming conversation
- Implement Server Action chat endpoint with streamText
- Build generative UI pattern where tool calls render React components
- Handle streaming Markdown rendering with react-markdown
- Manage abort, regenerate, and error states
- Apply React 19 patterns: useActionState, Suspense, use()
---

## Core Content

### Vercel AI SDK Architecture

Vercel AI SDK layers:

```
React Component
  └─ useChat / useCompletion / useAssistant hook
       └─ AI SDK Core (streamText, generateText)
            └─ Provider SDK (OpenAI, Anthropic, Google, etc.)
```

Three main hooks:

| Hook | Use case |
|---|---|
| useChat | Multi-turn chat with message history |
| useCompletion | Single-turn text completion |
| useAssistant | OpenAI Assistants API |

```
npm install ai @ai-sdk/openai
```

### useChat Integration

```typescript
"use client";

import { useChat } from "ai/react";

export function ChatWindow() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, stop, reload } =
    useChat({
      api: "/api/chat",
    });

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "user-msg" : "assistant-msg"}>
            <strong>{m.role === "user" ? "You" : "AI"}:</strong>
            <div>{m.content}</div>
          </div>
        ))}
        {isLoading && <div className="typing-indicator">Typing...</div>}
      </div>
      {error && (
        <div className="error-bar">
          {error.message}
          <button className="inline-button" onClick={reload}>Retry</button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="input-row">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything..."
          disabled={isLoading}
        />
        {isLoading ? (
          <button type="button" className="secondary-button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" className="primary-button">Send</button>
        )}
      </form>
    </div>
  );
}
```

### Server Action Chat Endpoint

```typescript
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createAI } from "ai/rsc";

const AI = createAI({
  initialAIState: [],
  initialUIState: [],
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: "You are a helpful assistant.",
    temperature: 0.7,
    maxTokens: 4096,
  });

  return result.toDataStreamResponse();
}
```

With React 19 Server Actions:

```typescript
// app/chat/actions.ts
"use server";

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createStreamableValue } from "ai/rsc";

export async function continueConversation(history: Message[]) {
  const stream = createStreamableValue("");

  (async () => {
    const { textStream } = streamText({
      model: openai("gpt-4o"),
      messages: history,
    });

    for await (const chunk of textStream) {
      stream.update(chunk);
    }
    stream.done();
  })();

  return { stream: stream.value };
}
```

### Streaming Markdown Rendering

```typescript
"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useChat } from "ai/react";

export function ChatWithMarkdown() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "assistant" ? (
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <SyntaxHighlighter language={match[1]} PreTag="div">
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {m.content}
            </ReactMarkdown>
          ) : (
            <p>{m.content}</p>
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

Streaming renders progressively. Each new chunk updates Markdown tree. react-markdown re-renders on content change.

### Generative UI Pattern

AI SDK supports tool calls that render React components:

```typescript
// weather tool definition
const tools = {
  getWeather: {
    description: "Get weather for a location",
    parameters: z.object({
      location: z.string(),
    }),
    execute: async ({ location }: { location: string }) => {
      const res = await fetch(`https://api.weather.com/${location}`);
      return res.json();
    },
  },
};

// Server action with tool rendering
"use server";

import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";

export async function chatWithTools(history: Message[]) {
  const result = streamText({
    model: openai("gpt-4o"),
    messages: history,
    tools: {
      getWeather: tool({
        description: "Get weather for a location",
        parameters: z.object({ location: z.string() }),
        execute: async ({ location }) => {
          return { temperature: 72, condition: "sunny", location };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

Client renders tool call results as React components:

```typescript
"use client";

import { useChat } from "ai/react";

function WeatherCard({ temperature, condition, location }: {
  temperature: number;
  condition: string;
  location: string;
}) {
  return (
    <div className="weather-card">
      <h3>{location}</h3>
      <p>{temperature}F — {condition}</p>
    </div>
  );
}

export function GenerativeChat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "assistant" && m.toolInvocations?.map((inv) => {
            if (inv.toolName === "getWeather" && inv.state === "result") {
              return <WeatherCard key={inv.id} {...inv.result} />;
            }
            return null;
          })}
          {m.content && <ReactMarkdown>{m.content}</ReactMarkdown>}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Abort and Regenerate

```typescript
const { stop, reload } = useChat();

// Stop current generation
<button onClick={stop}>Stop</button>

// Regenerate last response
<button onClick={reload}>Regenerate</button>
```

useChat handles AbortController internally. `stop` aborts the fetch. `reload` re-sends last user message minus the failed assistant response.

### Error Handling

```typescript
const { error, reload } = useChat({
  onError: (err) => {
    console.error("Chat error:", err);
  },
});

// Rate limit, token limit, network errors
if (error) {
  const message = error.message.includes("429")
    ? "Rate limited. Wait a moment."
    : error.message.includes("tok")
    ? "Token limit reached. Start new conversation."
    : "Connection error.";
}
```

### React 19: useActionState for Chat Form

```typescript
"use client";

import { useActionState } from "react";
import { continueConversation } from "./actions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ActionStateChat() {
  const [messages, submitAction, isPending] = useActionState(
    async (prev: Message[], formData: FormData) => {
      const input = formData.get("input") as string;
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input };
      const updated = [...prev, userMsg];
      const { stream } = await continueConversation(updated);
      let full = "";
      for await (const chunk of stream) {
        full += chunk;
      }
      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: full };
      return [...updated, aiMsg];
    },
    []
  );

  return (
    <div>
      {messages.map((m) => (
        <p key={m.id}><strong>{m.role}:</strong> {m.content}</p>
      ))}
      <form action={submitAction}>
        <input name="input" required />
        <button type="submit" disabled={isPending}>
          {isPending ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

### React 19: Suspense for Streaming

```typescript
import { Suspense } from "react";

async function StreamingResponse({ prompt }: { prompt: string }) {
  const { textStream } = streamText({
    model: openai("gpt-4o"),
    messages: [{ role: "user", content: prompt }],
  });

  let text = "";
  for await (const chunk of textStream) {
    text += chunk;
  }
  return <div>{text}</div>;
}

export function StreamingPage({ prompt }: { prompt: string }) {
  return (
    <Suspense fallback={<div className="loading">Generating...</div>}>
      <StreamingResponse prompt={prompt} />
    </Suspense>
  );
}
```

### React 19: use() Hook for Async Model Response

```typescript
"use client";

import { use } from "react";

function ModelResponse({ responsePromise }: { responsePromise: Promise<string> }) {
  const text = use(responsePromise);
  return <div>{text}</div>;
}

export function ChatWithUse({ prompt }: { prompt: string }) {
  const responsePromise = generateResponse(prompt);
  return (
    <Suspense fallback={<div>Thinking...</div>}>
      <ModelResponse responsePromise={responsePromise} />
    </Suspense>
  );
}
```

---

### Why This Matters

AI streaming is the dominant UI pattern for 2025+ apps. Vercel AI SDK abstracts away streaming protocol, abort logic, tool call serialization. Understanding useChat, generative UI, and Server Action integration lets you build ChatGPT-like interfaces in minutes. React 19 Server Actions + Suspense make streaming declarative.

---

### Common Questions

**Q: useChat vs useCompletion?**
A: useChat maintains message history array. useCompletion is single prompt-response. Use useChat for conversational UI, useCompletion for one-shot generate.

**Q: How to stream from non-OpenAI models?**
A: AI SDK provider abstraction. Use `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/mistral`. API identical.

**Q: Does generative UI work with all models?**
A: Only models supporting tool calls (function calling): GPT-4o, Claude 3.5+, Gemini 2.0+. Basic models skip tool execution.

---

## Examples

### Example 1: Full Chat with Markdown + Syntax Highlighting

```typescript
// app/chat/page.tsx
"use client";

import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ChatPage() {
  const {
    messages, input, handleInputChange, handleSubmit,
    isLoading, error, stop, reload,
  } = useChat();

  return (
    <div className="chat-layout">
      <div className="message-list">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            {m.role === "assistant" ? (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  },
                }}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}
        {isLoading && <div className="cursor-blink" />}
        {error && (
          <div className="error">
            {error.message}
            <button onClick={reload}>Retry</button>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="input-area">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
        />
        {isLoading ? (
          <button type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit">Send</button>
        )}
      </form>
    </div>
  );
}
```

### Example 2: Generative UI — Tool Call Renders Component

```typescript
// app/weather/actions.ts
"use server";

import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { createStreamableUI } from "ai/rsc";

export async function askWeather(query: string) {
  const ui = createStreamableUI();

  (async () => {
    const { textStream, toolCalls } = streamText({
      model: openai("gpt-4o"),
      messages: [{ role: "user", content: query }],
      tools: {
        getWeather: tool({
          description: "Get current weather",
          parameters: z.object({ location: z.string() }),
          execute: async ({ location }) => {
            return { temp: 72, condition: "Sunny", location };
          },
        }),
      },
    });

    let text = "";
    for await (const chunk of textStream) {
      text += chunk;
      ui.update(<div>{text}</div>);
    }

    for await (const call of toolCalls) {
      if (call.toolName === "getWeather") {
        ui.done(<WeatherCard {...call.args} />);
      }
    }
  })();

  return ui.value;
}
```

### Example 3: Server Action Chat with useActionState

```typescript
// app/chat-actions/page.tsx
"use client";

import { useActionState } from "react";
import { continueConversation } from "./actions";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function ActionStateChatPage() {
  const [history, formAction, isPending] = useActionState(
    async (prev: Msg[], fd: FormData) => {
      const input = fd.get("msg") as string;
      const updated = [...prev, { role: "user" as const, content: input }];
      const { stream } = await continueConversation(updated);
      let reply = "";
      for await (const chunk of stream) {
        reply += chunk;
      }
      return [...updated, { role: "assistant" as const, content: reply }];
    },
    []
  );

  return (
    <div>
      {history.map((m, i) => (
        <p key={i}><strong>{m.role}:</strong> {m.content}</p>
      ))}
      <form action={formAction}>
        <input name="msg" required />
        <button type="submit" disabled={isPending}>
          {isPending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

---

## Key Takeaways
- useChat: streaming multi-turn chat with built-in abort/regenerate
- Server Actions + createStreamableValue for server-side streaming
- react-markdown renders streaming Markdown progressively
- Generative UI: tool calls on server render React components on client
- Error states: rate limit, token limit, network — handle with onError
- React 19: useActionState for form-driven chat, Suspense for streaming, use() for async
- AI SDK provider abstraction: swap OpenAI/Anthropic/Google without code change

## Common Misconception

"**Generative UI requires the AI model to generate JSX code.**"

Generative UI does not mean the model writes JSX. The model calls a tool (function). The tool execution returns data. The client maps that data to a React component. The model never sees the component code; it only sees the tool signature and description.

## Feynman Explain

useChat = useState for messages + fetch to API + streaming reader. Server Action with streamText = generator that yields tokens one by one. react-markdown = Markdown parser that converts text to React elements. Generative UI = model calls function (getWeather), function returns data, React renders component from data. Each piece is independent; AI SDK wires them together.

## Reframe

AI SDK is RPC framework for LLM. useChat = client RPC stub. Server Action = server RPC handler. streamText = streaming deserialization. Tool calls = typed RPC methods the model discovers via schema. Generative UI = RPC return value drives component tree. React 19 Suspense + use() = async/await for components.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 38-ai-streaming`
