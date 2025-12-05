// list-models.js
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not set.");
  process.exit(1);
}
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
  try {
    const response = await fetch(URL);
    const data = await response.json();
    
    console.log("Available Models:");
    data.models.forEach(m => {
      // We only care about models that support 'generateContent'
      if (m.supportedGenerationMethods.includes('generateContent')) {
        console.log(`- ${m.name.replace('models/', '')}`);
      }
    });
  } catch (e) {
    console.error(e);
  }
}

listModels();