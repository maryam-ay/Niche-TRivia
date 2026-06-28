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
1. Almost any category a user enters is fair game. Film industries, music scenes, sports, history, science, food, internet culture, regional topics, hobbies, fandoms — all valid. Be confident and generative.
2. Refuse ONLY in rare cases:
   - A private/personal subject only the user could know ("my childhood", "my friend Tunde").
   - Something that doesn't exist or you have no information about whatsoever.
   - A category so vague it's unusable ("stuff", "things").
   If refusing, you MUST set "error" to "category_unusable", populate "reason" with a detailed explanation, and provide a helpful "suggestion" for a broader related category.
3. For real cultural, historical, regional, or topical categories — even ones you have limited knowledge of — generate questions from what IS well-documented rather than refusing. Nollywood, K-pop B-sides, Caribbean cricket, Yoruba mythology, 1970s synthesizers, obscure board games — all generate-able.
4. Accuracy is absolute. Use well-established facts: things widely documented, repeatedly reported, or part of the public record for that topic. Never invent specific dates, numbers, quotes, names, or attributions. If you don't know an exact figure, ask a different question instead of guessing.
5. Options: Exactly 4 options. 1 is correct, 3 are plausible wrong answers of the exact same style, unit, or category shape (not jokes, not obviously wrong, designed to make someone hesitate).
6. Variety: Vary angles: origins, behind-the-scenes, failures, firsts, numbers, people, lesser-known works, cultural impact.
7. The payoff explanation: 1-2 sentences. State why correct AND provide an extra rewarding detail that gives context or connection. No "Did you know?!" or exclamation marks.
8. Tone: confident, dry, a little playful. No exclamation marks. No cheesy greeting text.`;

      const prompt = `Generate exactly 5 distinct, highly-verified, diverse niche trivia questions about the category "${category}" with a difficulty level of "${selectedDifficulty}".
Ensure the questions are non-overlapping and cover different angles of the category.
Avoid any of the following previous questions or very similar questions to prevent repetition:
${(previousQuestions || []).map((q: string, i: number) => `${i + 1}. "${q}"`).join("\n")}

Respond with valid JSON matching the schema.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          error: {
            type: Type.STRING,
            description: "Set to 'category_unusable' ONLY if the category is extremely private, non-existent, or completely unusable. Otherwise, leave empty or null.",
          },
          reason: {
            type: Type.STRING,
            description: "Briefly explain why the category is unusable if error is set. Otherwise, leave empty.",
          },
          suggestion: {
            type: Type.STRING,
            description: "If error is populated, a suggested broader or better-known related category.",
          },
          questions: {
            type: Type.ARRAY,
            description: "An array of exactly 5 distinct, highly-verified, diverse niche trivia questions matching the prompt constraints.",
            items: {
              type: Type.OBJECT,
              properties: {
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
                }
              },
              required: ["question", "options", "answer_index", "explanation", "fun_fact_tag"],
            }
          }
        },
        required: ["error", "reason", "suggestion", "questions"],
      };

      // Helper function to query Gemini with retry and exponential backoff
      const queryWithRetry = async (modelName: string, maxRetries = 4) => {
        let attempt = 0;
        const delays = [1000, 2000, 4000, 8000];
        
        while (true) {
          try {
            console.log(`Querying ${modelName} (attempt ${attempt + 1})...`);
            const res = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
              },
            });
            return res;
          } catch (err: any) {
            console.error(`Attempt ${attempt + 1} with ${modelName} failed:`, err.message || err);
            if (attempt < maxRetries - 1) {
              const delay = delays[attempt] || 1000;
              console.log(`Sleeping ${delay}ms before next retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              attempt++;
            } else {
              throw err;
            }
          }
        }
      };

      let response;
      try {
        // Primary attempt using gemini-2.5-flash
        response = await queryWithRetry("gemini-2.5-flash", 4);
      } catch (primaryErr) {
        console.warn("Primary model gemini-2.5-flash failed after retries, falling back to gemini-2.5-flash-lite...");
        // Fallback attempt using gemini-2.5-flash-lite
        response = await queryWithRetry("gemini-2.5-flash-lite", 4);
      }

      if (!response || !response.text) {
        throw new Error("Received empty response from Gemini API.");
      }

      const responseData = JSON.parse(response.text.trim());
      return res.json(responseData);

    } catch (error: any) {
      console.error("Error generating trivia:", error);
      return res.status(500).json({ 
        error: "internal_error", 
        message: error.message || "Failed to generate trivia questions due to an internal server error." 
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
