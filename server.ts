import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints FIRST
  app.post("/api/trivia", async (req: any, res: any) => {
    const { category, difficulty, previousQuestions } = req.body;
    
    if (!category || typeof category !== "string") {
      return res.status(400).json({ 
        error: "missing_category", 
        message: "Category is required and must be a string." 
      });
    }

    const selectedDifficulty = difficulty || "fan";

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in the environment. Please add it to your secrets.");
      }

      // Lazy load Gemini API client
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // System instruction explaining the exact personality, calibration and output structure
      const systemInstruction = `You are a niche trivia generator. Your job is to make people who think they know a topic realize they don't - but fairly, not through trickery or misleading phrasing.

DIFFICULTY CALIBRATION:
- warm-up: a dedicated fan gets it; a casual viewer might hesitate but has a shot.
- fan: someone who's been into this for a year gets it.
- obsessive: deep-cuts territory, requires real time spent with the subject.
- scholar: things mostly only insiders, researchers, or original participants would know.

CORE RULES:
1. Hyper-specific only. No surface-level facts. Skip things like simple dates or main actors unless it is a hidden gem.
2. Accuracy is absolute. If you are not highly confident about a fact, do NOT use it. Never fabricate names, dates, or numbers.
3. Obscurity Check: If the category is too narrow, fictitious, nonsensical, or lacks verified documentation to generate accurate niche questions, you MUST populate the "error" field with "category_too_narrow" and provide a helpful "suggestion" for a broader related category. Do not attempt to guess or hallucinate.
4. Options: Exactly 4 options. 1 is correct, 3 are plausible wrong answers of the exact same style, unit, or category shape (not jokes, not obviously wrong, designed to make someone hesitate).
5. Variety: Vary angles: origins, behind-the-scenes, failures, firsts, numbers, people, lesser-known works, cultural impact.
6. The payoff explanation: 1-2 sentences. State why correct AND provide an extra rewarding detail that gives context or connection. No "Did you know?!" or exclamation marks.
7. Tone: confident, dry, a little playful. No exclamation marks. No cheesy greeting text.`;

      const prompt = `Generate a single niche trivia question about the category "${category}" with a difficulty level of "${selectedDifficulty}".
Avoid any of the following previous questions or very similar questions to prevent repetition:
${(previousQuestions || []).map((q: string, i: number) => `${i + 1}. "${q}"`).join("\n")}

Respond with valid JSON matching the schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              error: {
                type: Type.STRING,
                description: "Set to 'category_too_narrow' if the category is too obscure, fictional, or lacks verified facts. Otherwise, leave empty or null.",
              },
              suggestion: {
                type: Type.STRING,
                description: "If error is populated, a suggested broader or better-known related category.",
              },
              question: {
                type: Type.STRING,
                description: "The trivia question itself.",
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 4 options, containing one correct answer and three plausible wrong answers.",
              },
              answer_index: {
                type: Type.INTEGER,
                description: "Index (0 to 3) of the correct answer within the options array.",
              },
              explanation: {
                type: Type.STRING,
                description: "Explain why it is correct and add one extra context or reward fact in 1-2 dry, confident sentences. No exclamation marks.",
              },
              fun_fact_tag: {
                type: Type.STRING,
                description: "A 2-4 word category or angle tag (e.g. 'casting choice', 'box office', 'deleted scene').",
              },
            },
            required: ["error", "question", "options", "answer_index", "explanation", "fun_fact_tag"],
          },
        },
      });

      if (!response.text) {
        throw new Error("Received empty response from Gemini API.");
      }

      const responseData = JSON.parse(response.text.trim());
      return res.json(responseData);

    } catch (error: any) {
      console.error("Error generating trivia:", error);
      return res.status(500).json({ 
        error: "internal_error", 
        message: error.message || "Failed to generate trivia question due to an internal server error." 
      });
    }
  });

  // Serve static assets or run Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: any, res: any) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
