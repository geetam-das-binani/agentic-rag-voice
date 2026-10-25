import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { Serper } from "@langchain/community/tools/serper";
import { zodToJsonSchema } from "zod-to-json-schema";
import { searchKnowledgeBase } from "./vector.js";


const MIN_SCORE = 0.55;


export const searchKnowledgeBaseTool = tool(
  async ({ query }) => {
    const hits = (await searchKnowledgeBase(query, 4)).filter((h) => h.score >= MIN_SCORE);
    if (hits.length === 0) {
     
      return "NO_RELEVANT_RESULTS in the knowledge base. If the question needs facts, call search_web instead.";
    }
    return hits
      .map((h, i) => `[${i + 1}] (${h.source}, relevance ${h.score.toFixed(2)}) ${h.text}`)
      .join("\n");
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the company's private knowledge base (policies, products, FAQs, pricing, internal docs). ALWAYS try this first for questions about the business. The query may be in English or Hindi.",
    schema: z.object({
      query: z.string().describe("Standalone search query rewritten from the caller's question (any language)."),
    }),
  }
);


const serperByLang = {
  en: new Serper(process.env.SERPER_API_KEY, { gl: "in", hl: "en", num: 5 }),
  hi: new Serper(process.env.SERPER_API_KEY, { gl: "in", hl: "hi", num: 5 }),
};

export const searchWebTool = tool(
  async ({ query, language = "en" }) => String(await (serperByLang[language] ?? serperByLang.en).invoke(query)),
  {
    name: "search_web",
    description:
      "Search Google for real-time or public information: news, weather, sports scores, stock prices, current events, anything not in the knowledge base.",
    schema: z.object({
      query: z.string().describe("Concise Google search query, e.g. 'latest news India cricket'."),
      language: z
        .enum(["en", "hi"])
        .optional()
        .describe("Language of the search results: 'hi' if the caller is speaking Hindi, otherwise 'en'."),
    }),
  }
);

export const tools = [searchKnowledgeBaseTool, searchWebTool];
export const toolRegistry = Object.fromEntries(tools.map((t) => [t.name, t]));


export const toolDefinitions = tools.map((t) => {
  const { $schema, additionalProperties, ...parameters } = zodToJsonSchema(t.schema);
  return { name: t.name, description: t.description, parameters };
});
