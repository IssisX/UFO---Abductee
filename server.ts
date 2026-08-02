import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  const PORT = 3000;

  // Initialize Gemini AI lazily
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      aiClient = new GoogleGenAI({
        apiKey: apiKey || "dummy-key-for-initialization",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // Health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 3D Voxel Summoner Endpoint
  const handleVoxelGeneration = async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, styleScheme, energyCore, complexity } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt string is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets.",
        });
      }

      const styleHint = styleScheme ? `Primary Color & Style Theme: ${styleScheme}.` : '';
      const coreHint = energyCore ? `Energy Core Type: ${energyCore}.` : '';
      const complexityHint = complexity ? `Complexity target: ${complexity}.` : '';

      const ai = getGeminiClient();
      let modelName = "gemini-3.6-flash";
      let response;
      const promptText = `You are a Master Extraterrestrial 3D Voxel Synthesizer AI. Synthesize an intricate, highly detailed, expressive 3D voxel sculpture for: "${prompt}".
${styleHint} ${coreHint} ${complexityHint}

CRITICAL 3D ARTISTRY & SHAPE QUALITY GUIDELINES:
1. High Fidelity 3D Form: Do NOT create a flat box or simple block. Build a rich, recognizable 3D voxel sculpture centered around (0,0,0) with 100 to 350 voxels.
2. Anatomical & Mechanical Detail:
   - For Creatures/Dragons/Animals: Build a clear head with glowing eyes, elongated neck & body, articulated legs/claws, a tail, and sweeping wing membranes if it flies.
   - For Aircraft/Jets/UFOs: Build a sleek cockpit/canopy ("glass"), main hull ("metallic"), wings with weapons, and glowing thrusters ("emissive").
   - For Mechs/Vehicles: Build a chassis, wheels/legs, torso, cockpit, and weapon hardpoints.
3. Symmetry & Shading:
   - Use lateral symmetry (X-axis mirroring for left/right wings, arms, legs, eyes, engines).
   - Use color gradients & material contrasts: "emissive" for eyes/thrusters/power core, "metallic" for armor/metal, "glass" for canopies/windshields, "standard" for body/skin/scales.

CRITICAL SEMANTIC REASONING:
Analyze "${prompt}" to determine its physics & locomotion attributes:
- "placementDomain": "ground" (land creatures/vehicles/mechs), "air" (aircraft/dragons/jets/birds), or "high_sky" (clouds/satellites/nebulae/stars).
- "recommendedSpawnHeightMeters": height in meters (e.g. 0 for ground, 25 for aircraft/dragons, 45 for sky/cloud objects).
- "locomotionType": "walk" (land), "flight" (air), "hover_drift" (floating/sky), or "stationary" (structures).
- "baseSpeed": speed value between 10 and 90.
- "abilities": 2-3 unique thematic sci-fi abilities for player control.

Return JSON matching this exact structure:
{
  "name": "Synthesized Object Name",
  "description": "Alien scanner readout describing the object",
  "animationType": "float",
  "physicsType": "rigid",
  "placementDomain": "ground",
  "recommendedSpawnHeightMeters": 0,
  "locomotionType": "walk",
  "baseSpeed": 25,
  "abilities": ["Primary Ability", "Secondary Shockwave"],
  "canBePossessed": true,
  "styleScheme": "Neon Cyber",
  "energyOutput": "3.8 Gigawatts",
  "massKg": 320,
  "threatLevel": "Tactical",
  "composition": [
    {"element": "Hyper-Alloy", "percentage": 70},
    {"element": "Plasma Core", "percentage": 30}
  ],
  "voxels": [
    {"x": 0, "y": 0, "z": 0, "color": "#00f0ff", "mat": "emissive", "part": "core"}
  ]
}`;

      const configObj = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            animationType: { type: Type.STRING },
            physicsType: { type: Type.STRING },
            placementDomain: { type: Type.STRING },
            recommendedSpawnHeightMeters: { type: Type.NUMBER },
            locomotionType: { type: Type.STRING },
            baseSpeed: { type: Type.NUMBER },
            abilities: { type: Type.ARRAY, items: { type: Type.STRING } },
            canBePossessed: { type: Type.BOOLEAN },
            styleScheme: { type: Type.STRING },
            energyOutput: { type: Type.STRING },
            massKg: { type: Type.NUMBER },
            threatLevel: { type: Type.STRING },
            composition: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  element: { type: Type.STRING },
                  percentage: { type: Type.NUMBER },
                },
                required: ["element", "percentage"],
              },
            },
            voxels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER },
                  z: { type: Type.INTEGER },
                  color: { type: Type.STRING },
                  mat: { type: Type.STRING },
                  part: { type: Type.STRING },
                },
                required: ["x", "y", "z", "color"],
              },
            },
          },
          required: ["name", "description", "animationType", "physicsType", "voxels"],
        },
      };

      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: configObj,
        });
      } catch (e) {
        modelName = "gemini-2.5-flash";
        response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: configObj,
        });
      }

      let cleanText = response.text || "";
      cleanText = cleanText.replace(/```json/gi, "").replace(/```/g, "").trim();
      if (!cleanText) {
        throw new Error("No response received from Gemini model.");
      }

      const parsed = JSON.parse(cleanText);
      return res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.error("Gemini Voxel Generation Error:", err);
      return res.status(500).json({
        error: err.message || "Failed to synthesize 3D voxel object",
      });
    }
  };

  app.post("/api/gemini/generate-voxel", handleVoxelGeneration);
  app.post("/api/gemini/synthesize-object", handleVoxelGeneration);

  app.post("/api/gemini/synthesize-object-stream", async (req, res) => {
    try {
      const { prompt, styleScheme, energyCore, complexity } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt string is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets.",
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const styleHint = styleScheme ? `Primary Color & Style Theme: ${styleScheme}.` : '';
      const coreHint = energyCore ? `Energy Core Type: ${energyCore}.` : '';
      const complexityHint = complexity ? `Complexity target: ${complexity}.` : '';

      const ai = getGeminiClient();
      const promptText = `You are a Master Extraterrestrial 3D Voxel Synthesizer AI. Synthesize an intricate, highly detailed, expressive 3D voxel sculpture for: "${prompt}".
${styleHint} ${coreHint} ${complexityHint}

CRITICAL 3D ARTISTRY & SHAPE QUALITY GUIDELINES:
1. High Fidelity 3D Form: Do NOT create a flat box or simple block. Build a rich, recognizable 3D voxel sculpture centered around (0,0,0) with 100 to 350 voxels.
2. Anatomical & Mechanical Detail:
   - For Creatures/Dragons/Animals: Build a clear head with glowing eyes, elongated neck & body, articulated legs/claws, a tail, and sweeping wing membranes if it flies.
   - For Aircraft/Jets/UFOs: Build a sleek cockpit/canopy ("glass"), main hull ("metallic"), wings with weapons, and glowing thrusters ("emissive").
   - For Mechs/Vehicles: Build a chassis, wheels/legs, torso, cockpit, and weapon hardpoints.
3. Symmetry & Shading:
   - Use lateral symmetry (X-axis mirroring for left/right wings, arms, legs, eyes, engines).
   - Use color gradients & material contrasts: "emissive" for eyes/thrusters/power core, "metallic" for armor/metal, "glass" for canopies/windshields, "standard" for body/skin/scales.

CRITICAL SEMANTIC REASONING:
Analyze "${prompt}" to determine its physics & locomotion attributes:
- "placementDomain": "ground" (land creatures/vehicles/mechs), "air" (aircraft/dragons/jets/birds), or "high_sky" (clouds/satellites/nebulae/stars).
- "recommendedSpawnHeightMeters": height in meters (e.g. 0 for ground, 25 for aircraft/dragons, 45 for sky/cloud objects).
- "locomotionType": "walk" (land), "flight" (air), "hover_drift" (floating/sky), or "stationary" (structures).
- "baseSpeed": speed value between 10 and 90.
- "abilities": 2-3 unique thematic sci-fi abilities for player control (e.g. ["Plasma Flame Breath", "Supersonic Wing Slice", "Thermal Flare Decoy"]).

Return JSON matching this exact structure:
{
  "name": "Synthesized Object Name",
  "description": "Alien scanner readout describing the object's origin & capabilities",
  "animationType": "float",
  "physicsType": "rigid",
  "placementDomain": "ground",
  "recommendedSpawnHeightMeters": 0,
  "locomotionType": "walk",
  "baseSpeed": 25,
  "abilities": ["Primary Ability", "Secondary Shockwave"],
  "canBePossessed": true,
  "styleScheme": "Neon Cyber",
  "energyOutput": "3.8 Gigawatts",
  "massKg": 320,
  "threatLevel": "Tactical",
  "composition": [
    {"element": "Hyper-Alloy", "percentage": 70},
    {"element": "Plasma Core", "percentage": 30}
  ],
  "voxels": [
    {"x": 0, "y": 0, "z": 0, "color": "#00f0ff", "mat": "emissive", "part": "core"}
  ]
}`;

      let modelName = "gemini-3.6-flash";
      let responseStream;
      try {
        responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents: promptText,
        });
      } catch (e) {
        console.warn("gemini-3.6-flash failed, falling back to gemini-2.5-flash:", e);
        modelName = "gemini-2.5-flash";
        responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents: promptText,
        });
      }

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}

`);
        }
      }
      res.write(`data: [DONE]

`);
      res.end();
    } catch (err) {
      console.error("Gemini Voxel Stream Error:", err);
      res.write(`data: ${JSON.stringify({ error: err.message || "Failed to synthesize 3D voxel object" })}

`);
      res.end();
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
