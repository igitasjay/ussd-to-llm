import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { saveSession, getSession } from "./redis.service.js";
import { sanitizeForUssd, chunkResponse } from "../utils/ussd.utils.js";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_INSTRUCTION = `
You are a USSD-optimized AI assistant. 
Constraints:
- Output PLAIN TEXT ONLY.
- NO markdown, NO bold, NO italics.
- NO special characters like &, #, *, ₦, $, %, @.
- Use an abbreviated "SMS-style" tone to save space (e.g., 'u' for 'you', 'r' for 'are', 'pls' for 'please').
- Be extremely brief. Each chunk will be 160 chars.
- Max total response length: 600 chars.
- Only provide the answer, no conversational filler unless absolutely necessary.
`;

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: SYSTEM_INSTRUCTION,
});

/**
 * Triggers the Gemini flow asynchronously and updates Redis session when done.
 */
export const triggerGeminiQuery = async (
  sessionId: string,
  query: string,
): Promise<void> => {
  try {
    const result = await model.generateContent(query);
    const text = result.response.text();

    // Sanitize and chunk the response
    const sanitizedText = sanitizeForUssd(text);

    const session = await getSession(sessionId);
    if (session) {
      session.fullResponse = sanitizedText;
      session.status = "ready";
      session.currentChunkIndex = 0;
      await saveSession(sessionId, session);
    }
  } catch (error: any) {
    console.error("Gemini Critical Error:", error.message || error);
    if (error.response) {
      console.error(
        "Gemini Error Details:",
        JSON.stringify(error.response, null, 2),
      );
    }
    const session = await getSession(sessionId);
    if (session) {
      session.status = "failed";
      await saveSession(sessionId, session);
    }
  }
};
