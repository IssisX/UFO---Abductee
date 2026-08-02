const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const streamEndpoint = `
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

      const styleHint = styleScheme ? \`Primary Color & Style Theme: \${styleScheme}.\` : '';
      const coreHint = energyCore ? \`Energy Core Type: \${energyCore}.\` : '';
      const complexityHint = complexity ? \`Complexity target: \${complexity}.\` : '';

      const ai = getGeminiClient();
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: \`You are an Extraterrestrial Matter Synthesizer AI. Synthesize an intricate multi-material 3D voxel structure for: "\${prompt}".
\${styleHint} \${coreHint} \${complexityHint}
Represent the 3D object as a collection of 3D voxels centered around (0,0,0).

CRITICAL: You MUST perform semantic analysis on "\${prompt}" to accurately classify its physical reality:
1. "placementDomain": MUST be "ground" for land animals/creatures, "air" for aircraft/fliers, or "high_sky" for sky/space elements.
2. "recommendedSpawnHeightMeters": number of meters above ground.
3. "locomotionType": MUST be "walk", "flight", "hover_drift", or "stationary".
4. "baseSpeed": number from 5 to 100.
5. "abilities": array of 2-3 unique sci-fi abilities.

Return JSON matching this exact structure:
{
  "name": "Synthesized Object Name",
  "description": "Alien telemetry & scanner readout describing the object",
  "animationType": "float",
  "physicsType": "rigid",
  "placementDomain": "ground",
  "recommendedSpawnHeightMeters": 0,
  "locomotionType": "walk",
  "baseSpeed": 20,
  "abilities": ["Sonic Stomp", "Earthquake Charge"],
  "canBePossessed": true,
  "styleScheme": "Neon Cyber",
  "energyOutput": "3.8 Gigawatts",
  "massKg": 240,
  "threatLevel": "Tactical",
  "composition": [
    {"element": "Zero-Point Crystal", "percentage": 60}
  ],
  "voxels": [
    {"x": 0, "y": 0, "z": 0, "color": "#00f0ff", "mat": "emissive", "part": "core"}
  ]
}

Guidelines:
- Provide between 50 and 300 voxels forming a recognizable 3D shape.
- Coordinates x, y, z must be integers ranging from -15 to 15.
- Colors must be valid hex strings.
- "mat" MUST be one of: "emissive", "metallic", "glass", "standard".
- "part" describes the sub-component.\`,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(\`data: \${JSON.stringify({ text: chunk.text })}\n\n\`);
        }
      }
      res.write(\`data: [DONE]\n\n\`);
      res.end();
    } catch (err) {
      console.error("Gemini Voxel Stream Error:", err);
      res.write(\`data: \${JSON.stringify({ error: err.message || "Failed to synthesize 3D voxel object" })}\n\n\`);
      res.end();
    }
  });
`;

const updated = content.replace('  app.post("/api/gemini/synthesize-object", handleVoxelGeneration);', '  app.post("/api/gemini/synthesize-object", handleVoxelGeneration);\n' + streamEndpoint);
fs.writeFileSync('server.ts', updated);
