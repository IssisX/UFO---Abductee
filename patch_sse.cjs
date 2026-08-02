const fs = require('fs');
const content = fs.readFileSync('services/gamemode/PossessionManager.ts', 'utf8');

const oldParse = `      let accumulatedText = '';
      let processedVoxels = 0;
      const allVoxels: any[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.replace('data: ', '').trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {`;

const newParse = `      let accumulatedText = '';
      let processedVoxels = 0;
      const allVoxels: any[] = [];
      let sseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        
        const lines = sseBuffer.split('\\n\\n');
        sseBuffer = lines.pop() || ''; // Keep the incomplete part in the buffer
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const data = line.replace(/^\\s*data:\\s*/, '').trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {`;

const updated = content.replace(oldParse, newParse);
fs.writeFileSync('services/gamemode/PossessionManager.ts', updated);
