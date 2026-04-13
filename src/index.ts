import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { handleUssd } from "./controllers/ussd.controller.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Africa's Talking sends USSD callbacks as application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// USSD Header Middleware (Critical for Africa's Talking)
app.use("/ussd", (req, res, next) => {
  res.set("Content-Type", "text/plain");
  next();
});

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === "POST") {
    console.log("Body:", req.body);
  }

  // Log outgoing response for debugging
  const oldSend = res.send;
  res.send = function (data) {
    console.log(`[${new Date().toISOString()}] Response sent to AT:`, data);
    return oldSend.apply(res, arguments as any);
  };

  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Main USSD endpoint
app.post("/ussd", handleUssd);

// Global error handler for Africa's Talking (Graceful Failure)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Critical System Error:", err.message || err);
  console.error("Stack Trace:", err.stack);
  res.status(200).send("END Service busy, try again in a few seconds.");
});

app.listen(PORT, () => {
  console.log(`USSD Gateway listening on port ${PORT}`);
});
