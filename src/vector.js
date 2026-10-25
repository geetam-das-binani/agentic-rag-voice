import "dotenv/config";
import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings } from "./embeddings.js";

export const qdrantConfig = {
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  collectionName: process.env.QDRANT_COLLECTION || "knowledge_base_lc",
};

let storePromise;


export function getVectorStore() {
  storePromise ??= QdrantVectorStore.fromExistingCollection(embeddings, qdrantConfig);
  return storePromise;
}


export async function searchKnowledgeBase(query, k = 4) {
  const store = await getVectorStore();
  const results = await store.similaritySearchWithScore(query, k);
  return results.map(([doc, score]) => ({
    score,
    text: doc.pageContent,
    source: doc.metadata?.source?.split("/").pop() ?? "unknown",
  }));
}
