import "dotenv/config";
import { toolDefinitions } from "../src/tools.js";

const {
  VAPI_PRIVATE_KEY,
  PUBLIC_URL,
  VAPI_WEBHOOK_SECRET,
  LLM_PROVIDER = "groq",
  LLM_MODEL = "llama-3.3-70b-versatile",
  AGENT_LANGUAGE = "multi",
} = process.env;

if (!VAPI_PRIVATE_KEY || !PUBLIC_URL) {
  console.error("Set VAPI_PRIVATE_KEY and PUBLIC_URL in .env first.");
  process.exit(1);
}

const PRESETS = {
  en: {
    stt: { model: "nova-2", language: "en" },
    voice: { provider: "vapi", voiceId: "Elliot" },
    firstMessage: "Hi, this is Aria. How can I help you today?",
    endCallMessage: "Thanks for calling. Goodbye!",
    waitMessage: "One moment while I look that up.",
    languageRules: "Speak English.",
  },
  hi: {
    stt: { model: "nova-2", language: "hi" },
    voice: { provider: "azure", voiceId: "hi-IN-SwaraNeural" },
    firstMessage:
      "नमस्ते, मैं आरिया बोल रही हूँ। मैं आपकी कैसे मदद कर सकती हूँ?",
    endCallMessage: "कॉल करने के लिए धन्यवाद। नमस्ते!",
    waitMessage: "एक क्षण रुकिए, मैं देखती हूँ।",
    languageRules:
      "Always speak Hindi, written in Devanagari script (not romanized), so the voice pronounces it correctly.",
  },
  multi: {
    stt: { model: "nova-3", language: "multi" },

    voice: {
      provider: "vapi",
      voiceId: "Elliot",
      version: 2,
      language: "auto",
    },
    firstMessage:
      "नमस्ते! Hi, मैं आरिया बोल रही हूँ। How can I help you? आप हिंदी या English में बात कर सकते हैं।",
    endCallMessage: "धन्यवाद! Thanks for calling. नमस्ते!",
    waitMessage: "एक क्षण रुकिए, let me check that for you.",
    languageRules:
      "Detect the language the caller is using and reply in the same language. If they speak Hindi, reply in Hindi written in Devanagari script (not romanized). If they speak English, reply in English. If they mix both (Hinglish), reply in natural Hinglish using Devanagari for Hindi words and Latin for English words.",
  },
};

const preset = PRESETS[AGENT_LANGUAGE];
if (!preset) {
  console.error(
    `AGENT_LANGUAGE must be one of: ${Object.keys(PRESETS).join(", ")}`,
  );
  process.exit(1);
}

const systemPrompt = `You are "Aria", a friendly phone assistant. You are speaking on a phone call.

LANGUAGE
- ${preset.languageRules}
- Tool results may be in English; always translate/explain them in the caller's language.
- When calling search_web, set language to "hi" if the caller speaks Hindi, otherwise "en". Knowledge base queries can stay in the caller's language.

VOICE STYLE
- Keep answers short: 1-3 sentences. No lists, markdown, emojis, or URLs. Say numbers and dates naturally.
- Ask only one question at a time. If you did not catch something, politely ask the caller to repeat.

HOW TO ANSWER (agentic RAG)
1. Questions about the business (products, pricing, policies, FAQs) -> call search_knowledge_base first.
2. If it returns NO_RELEVANT_RESULTS, or the question is about current/public info (news, weather, scores, prices, events) -> call search_web.
3. You may call tools more than once, e.g. rephrase the query, or combine knowledge base + web.
4. Answer ONLY from tool results. If nothing useful is found, say you don't know rather than guessing.`;

const body = {
  name: `Aria - Agentic RAG Voice Agent (${AGENT_LANGUAGE})`,
  firstMessage: preset.firstMessage,
  endCallMessage: preset.endCallMessage,
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 600,
  backgroundDenoisingEnabled: true,

  transcriber: {
    provider: "deepgram",
    model: process.env.STT_MODEL || preset.stt.model,
    language: process.env.STT_LANGUAGE || preset.stt.language,
  },

  model: {
    provider: LLM_PROVIDER,
    model: LLM_MODEL,
    temperature: 0.3,
    messages: [{ role: "system", content: systemPrompt }],
    tools: toolDefinitions.map((def) => ({
      type: "function",
      async: false,
      function: def,
      messages: [{ type: "request-start", content: preset.waitMessage }],
      server: {
        url: `${PUBLIC_URL}/vapi/webhook`,
        secret: VAPI_WEBHOOK_SECRET,
      },
    })),
  },

  voice: {
    ...preset.voice,
    ...(process.env.VOICE_PROVIDER && { provider: process.env.VOICE_PROVIDER }),
    ...(process.env.VOICE_ID && { voiceId: process.env.VOICE_ID }),
  },

  server: { url: `${PUBLIC_URL}/vapi/webhook`, secret: VAPI_WEBHOOK_SECRET },
  serverMessages: ["end-of-call-report", "status-update"],
};

const res = await fetch("https://api.vapi.ai/assistant", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
const data = await res.json();
if (!res.ok) {
  console.error("Vapi error:", JSON.stringify(data, null, 2));
  process.exit(1);
}
// console.log(`Assistant created (${AGENT_LANGUAGE})! ID:`, data.id);
