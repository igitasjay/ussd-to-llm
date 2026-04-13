import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

(async () => {
  try {
    console.log("Fetching available models via REST API...");
    const response = await fetch(URL);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: any = await response.json();
    console.log("Available Models:");
    
    if (data.models) {
      data.models.forEach((m: any) => {
        if (m.supportedGenerationMethods.includes("generateContent")) {
          console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
        }
      });
    } else {
      console.log("No models found in response.");
    }
    
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Failed to list models:", err.message || err);
    process.exit(1);
  }
})();
