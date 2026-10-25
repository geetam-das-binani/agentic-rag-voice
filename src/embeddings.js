import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";


export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: process.env.EMBED_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
  
});
