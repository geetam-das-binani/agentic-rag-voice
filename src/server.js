import "dotenv/config";
import express from "express";
import { toolRegistry } from "./tools.js";

const app = express();
app.use(express.json({ limit: "2mb" }));


function verifyVapi(req, res, next) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret && req.headers["x-vapi-secret"] !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/", (_req, res) => res.send("Vapi agentic RAG server is running"));


app.post("/vapi/webhook", verifyVapi, async (req, res) => {
  const message = req.body?.message;
  if (!message) return res.status(400).json({ error: "no message" });


  if (message.type === "tool-calls") {
    const calls =
      message.toolCallList ||
      (message.toolWithToolCallList || []).map((t) => t.toolCall) ||
      [];

    const results = await Promise.all(
      calls.map(async (call) => {
        const name = call.name || call.function?.name;
        let args = call.parameters ?? call.function?.arguments ?? {};
        if (typeof args === "string") {
          try { args = JSON.parse(args); } catch { args = {}; }
        }

        const lcTool = toolRegistry[name];
        if (!lcTool) return { toolCallId: call.id, result: `Unknown tool ${name}` };

        try {
          console.log(`[tool] ${name}`, args);
          const result = await lcTool.invoke(args);
         
          return { toolCallId: call.id, result: String(result).replace(/\s*\n\s*/g, " | ").slice(0, 3500) };
        } catch (err) {
          console.error(`[tool error] ${name}`, err);
          return { toolCallId: call.id, result: "Tool failed. Apologize briefly and answer from general knowledge if possible." };
        }
      })
    );

    return res.json({ results });
  }

  
  if (message.type === "end-of-call-report") {
    console.log("[call ended]", message.endedReason, "|", message.summary || "");
  } else if (message.type === "status-update") {
    console.log("[status]", message.status);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
