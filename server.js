import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration (allow all origins for cloud deployment or custom domain)
app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "HABIB AI backend",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString()
  });
});

// Chat endpoint with secure server-side Gemini integration
app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "মেসেজ লিখুন (Message is required)." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server-এ GEMINI_API_KEY কনফিগার করা নেই। Render ড্যাশবোর্ডে Environment Variables-এ GEMINI_API_KEY যোগ করুন।"
      });
    }

    // Prepare contents array for Gemini multi-turn format
    const contents = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-12)) {
        const role = item?.role === "assistant" || item?.role === "model" ? "model" : "user";
        const text = String(item?.text ?? item?.content ?? "").slice(0, 4000).trim();
        if (text) {
          contents.push({ role, parts: [{ text }] });
        }
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message.trim().slice(0, 4000) }]
    });

    const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const modelsToTry = [primaryModel, "gemini-1.5-flash", "gemini-pro"];

    let lastError = null;
    let replyText = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const upstream = await fetch(url, {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "You are HABIB AI (হাবি্ব এআই), a smart, warm, and highly capable personal AI assistant made for Bangladesh 🇧🇩. You are fluent in both Bengali (বাংলা) and English. If the user writes or speaks in Bengali, reply in natural, friendly, accurate Bengali script. If the user writes in English, reply in English. Format code or lists cleanly with markdown. Always be helpful, respectful, and encouraging."
              }]
            },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1500
            }
          })
        });

        const data = await upstream.json();

        if (upstream.ok) {
          const parts = data?.candidates?.[0]?.content?.parts ?? [];
          const candidateText = parts.map(p => p.text || "").join("").trim();
          if (candidateText) {
            replyText = candidateText;
            break;
          }
        } else {
          lastError = data?.error?.message || `HTTP ${upstream.status}`;
          console.error(`Gemini model ${model} failed:`, lastError);
          // If error is invalid API key or quota exceeded, trying another model won't help
          if (upstream.status === 400 || upstream.status === 403) break;
        }
      } catch (err) {
        lastError = err.message;
        console.error(`Request error with model ${model}:`, err);
      }
    }

    if (!replyText) {
      return res.status(502).json({
        error: `Gemini API থেকে উত্তর পাওয়া যায়নি (${lastError || "Unknown error"})। অনুগ্রহ করে আপনার API Key ও ইন্টারনেট সংযোগ পরীক্ষা করুন।`
      });
    }

    res.json({ reply: replyText });
  } catch (error) {
    console.error("Chat handler error:", error);
    res.status(500).json({ error: "অভ্যন্তরীণ সার্ভার ত্রুটি (Internal server error)" });
  }
});

// Fallback route: serve index.html for any unhandled GET request
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";

app.listen(port, host, () => {
  console.log(`HABIB AI server is running on http://${host}:${port}`);
});
