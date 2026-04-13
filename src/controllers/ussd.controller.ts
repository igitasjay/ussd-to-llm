import type { Request, Response } from "express";
import {
  getSession,
  saveSession,
  checkRateLimit,
  updateChunkIndex,
} from "../services/redis.service.js";
import type { SessionState } from "../services/redis.service.js";
import { triggerGeminiQuery } from "../services/gemini.service.js";
import {
  getLatestInput,
  parseBreadcrumbs,
  chunkResponse,
} from "../utils/ussd.utils.js";

export const handleUssd = async (req: Request, res: Response) => {
  const { sessionId, phoneNumber, text } = req.body;

  if (!sessionId || !phoneNumber) {
    return res.status(200).send("END Invalid request.");
  }

  const steps = parseBreadcrumbs(text);
  const latestInput = getLatestInput(text);

  // 1. Welcome Menu
  if (steps.length === 0) {
    let response = "CON Welcome to Offline AI\n";
    response += "What is your question?";
    return res.send(response);
  }

  // 2. Check Existing Session
  let session = await getSession(sessionId);

  // 3. Handle Multipage Navigation (Next)
  if (latestInput === "1" && session && session.status === "ready") {
    const chunks = chunkResponse(session.fullResponse);
    const currentChunk = chunks[session.currentChunkIndex];

    if (currentChunk) {
      // Prepare for the next potential "1" (Next) click
      await updateChunkIndex(sessionId, session.currentChunkIndex + 1);
      return res.send(`CON ${currentChunk}`);
    } else {
      return res.send("END End of response. Thank you!");
    }
  }

  // 4. Handle "Refresh" or Polling
  if (latestInput === "1" && session) {
    if (session.status === "processing") {
      return res.send("CON Still processing your query...\n1. Refresh");
    }
    if (session.status === "failed") {
      return res.send(
        "END Error processing your query. Please try again later.",
      );
    }
  }

  // 5. New Query Logic
  // If it's the first step after welcome, or a new query
  // For simplicity, we assume any input after welcome that isn't '1' is a query
  // Power users can skip: *code*1*query# results in steps=["1", "query"]

  // Rate limiting
  const canProceed = await checkRateLimit(phoneNumber);
  if (!canProceed) {
    return res.send("END Rate limit exceeded. Try again in an hour.");
  }

  // Initialize new session state
  const newState: SessionState = {
    fullResponse: "",
    currentChunkIndex: 0,
    status: "processing",
    lastQuery: latestInput,
    createdAt: Date.now(),
  };

  await saveSession(sessionId, newState);

  // Trigger Gemini in background
  triggerGeminiQuery(sessionId, latestInput).catch(console.error);

  // Return immediately to avoid AT timeout
  let response = "CON Processing your query...\n";
  response += "Please wait a few seconds.\n";
  response += "1. Check Result";

  return res.send(response);
};
