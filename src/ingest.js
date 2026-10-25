
import "dotenv/config";
import path from "node:path";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings } from "./embeddings.js";
import { qdrantConfig } from "./vector.js";

async function main() {
 
  const loader = new DirectoryLoader(path.resolve("docs"), {
    ".txt": (p) => new TextLoader(p),
    ".md": (p) => new TextLoader(p),
   
  });
  const docs = await loader.load();
  if (!docs.length) return console.log("Put .txt or .md files in ./docs first.");


  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 120 });
  const chunks = await splitter.splitDocuments(docs);
  console.log(`Loaded ${docs.length} file(s) -> ${chunks.length} chunks. Embedding...`);

  
  await QdrantVectorStore.fromDocuments(chunks, embeddings, qdrantConfig);
  console.log(`Done. Stored in Qdrant collection "${qdrantConfig.collectionName}".`);
}

main().catch((e) => { console.error(e); process.exit(1); });
