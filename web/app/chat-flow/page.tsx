import { MermaidDiagram } from "./MermaidDiagram";

const chatFlowDiagram = `
flowchart TD
  A([Visitor opens the chat]) --> B[Visitor sends a message]
  B --> C{Is the message usable?}
  C -- No --> C1[Ask for a clearer message]
  C -- Yes --> D{Are requests left this hour?}
  D -- No --> D1[Show hourly limit message]
  D -- Yes --> E{Is this chat still active?}
  E -- No --> E1[Explain that the chat is closed]
  E -- Yes --> F[Save the visitor message]
  F --> G[Review conversation history]
  G --> H[Prepare the assistant reply]
  H --> I{Did the visitor share contact details?}
  I -- Yes --> J[Save the lead details]
  I -- No --> K[Continue the conversation]
  J --> L{Should the chat close now?}
  K --> L
  L -- Yes --> M[Thank the visitor and close the chat]
  L -- No --> N[Keep the chat open]
  M --> O[Save the assistant reply]
  N --> O
  O --> P{Is the conversation getting long?}
  P -- Yes --> Q[Refresh the short conversation summary]
  P -- No --> R[No summary update needed]
  Q --> S[Show the reply to the visitor]
  R --> S
`;

const coreObjectiveDiagram = `
flowchart LR
  A([Visitor starts chat]) --> B[Build confidence]
  B --> C{Email shared?}
  C -- Yes --> D[Thank visitor]
  D --> E([Close chat: lead captured])
  C -- No --> F{"Relevant luxury<br/>interiors intent?"}
  F -- Yes --> B
  F -- No, after one redirect --> G([Close chat gracefully])
`;

const lifecycleSteps = [
  {
    title: "A visitor starts the chat",
    body: "The chat opens with a simple greeting and waits for the visitor to describe what they need.",
  },
  {
    title: "The message is checked",
    body: "The app makes sure the message is not empty, is not too large, the chat is still open, and the hourly request allowance has not been used up.",
  },
  {
    title: "The conversation context is prepared",
    body: "The assistant reviews the latest message alongside the useful parts of the previous conversation, including a short summary when the conversation has grown longer.",
  },
  {
    title: "The assistant responds",
    body: "The assistant replies in the current conversation style and may ask for more details if the visitor has not shared enough information yet.",
  },
  {
    title: "Lead details are captured",
    body: "When the visitor shares contact details, the app saves them so the team can follow up after the conversation.",
  },
  {
    title: "The chat may close",
    body: "The chat closes after a suitable handoff, when the conversation reaches its intended endpoint, or when the visitor is not a fit for the service.",
  },
];

const outcomes = [
  "The visitor gets a reply in the chat window.",
  "The team can review saved chats and lead details.",
  "Longer conversations keep a short summary for continuity.",
  "The hourly allowance protects the app from too many chat requests.",
];

const currentAiSpecs = [
  { label: "Active model", value: "gpt-5.4-nano" },
  { label: "Provider client", value: "OpenAI SDK chat completions" },
  { label: "Reply temperature", value: "0.7" },
  { label: "Reply max completion tokens", value: "120" },
  { label: "Summary temperature", value: "0.2" },
  { label: "Summary max completion tokens", value: "256" },
  { label: "Max user message tokens", value: "120" },
  { label: "Summary starts after", value: "16 chat messages" },
  { label: "Max tool-call rounds", value: "4" },
  { label: "Hourly chat request limit", value: "10" },
];

const availableAiModels = [
  {
    name: "gpt-5.4-nano",
    status: "Active from .env",
    input: "$0.20 / 1M input tokens",
    cachedInput: "$0.02 / 1M cached input tokens",
    output: "$1.25 / 1M output tokens",
  },
  {
    name: "gpt-5.4-mini",
    status: "Available",
    input: "$0.75 / 1M input tokens",
    cachedInput: "$0.075 / 1M cached input tokens",
    output: "$4.50 / 1M output tokens",
  },
];

// const corePoints = [
//   "Build enough confidence for the visitor to share their email.",
//   "Treat the email address as the most important detail to capture.",
//   "When the visitor provides an email, thank them naturally and close the chat.",
//   "If the visitor trolls, sends spam or abuse, is unrelated, explicitly not interested, or stays low intent after one natural redirect, close the chat gracefully.",
// ];

export default function ChatFlowPage() {
  return (
    <main className="flex-1 bg-[#f7f5f0] px-6 py-8 font-sans text-[#1f1b16]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="border border-[#c9a154] bg-white p-6">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#8a6b2a]">
            Core Objective
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold">
            Build client confidence and capture the email
          </h1>
          {/* <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#5d5446] md:grid-cols-2">
            {corePoints.map((point) => (
              <li className="border-l-2 border-[#c9a154] pl-3" key={point}>
                {point}
              </li>
            ))}
          </ul> */}
          <div className="mt-6">
            <MermaidDiagram chart={coreObjectiveDiagram} />
          </div>
        </section>

        <header className="border-b border-[#d8d0c2] pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#746957]">
            Chat Lifecycle
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Main Chat Flow</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[#5d5446]">
            This page explains what happens during a normal visitor chat, from
            the first message through reply, lead capture, summary updates, and
            chat closure.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#746957]">
              Visual Flow
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              How one message moves through the system
            </h2>
          </div>
          <MermaidDiagram chart={chatFlowDiagram} />
        </section>

        <section className="grid gap-4 border-t border-[#d8d0c2] pt-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
          <div>
            <h2 className="text-2xl font-semibold">TECHNICAL SPECS</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5d5446]">
              Current non-secret AI settings from the app environment and chat
              route configuration.
            </p>
            <dl className="mt-5 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              {currentAiSpecs.map((spec) => (
                <div
                  className="border-l-2 border-[#c9a154] bg-white px-4 py-3"
                  key={spec.label}
                >
                  <dt className="font-medium text-[#746957]">{spec.label}</dt>
                  <dd className="mt-1 font-semibold text-[#1f1b16]">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white p-5">
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#746957]">
              Available Models
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {availableAiModels.map((model) => (
                <article
                  className="border border-[#d8d0c2] p-4"
                  key={model.name}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{model.name}</h3>
                    <span className="border border-[#c9a154] px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-[#8a6b2a]">
                      {model.status}
                    </span>
                  </div>
                  <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-[#5d5446]">
                    <li>{model.input}</li>
                    <li>{model.cachedInput}</li>
                    <li>{model.output}</li>
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
