const { GoogleGenerativeAI } = require('@google/generative-ai');

async function callLLM(text, guidance, templateInfo, apiKey, provider = 'gemini') {
  const prompt = createPrompt(text, guidance, templateInfo);
  
  if (provider === 'gemini') {
    return await callGemini(prompt, apiKey);
  } else if (provider === 'openai') {
    return await callOpenAI(prompt, apiKey);
  } else {
    throw new Error('Unsupported LLM provider');
  }
}

function createPrompt(text, guidance, templateInfo) {
  const layoutsInfo = templateInfo.layouts.map(l => 
    `${l.name}: ${l.placeholders.map(p => p.type).join(', ')}`
  ).join('\n');

  const imagesInfo = templateInfo.images.map(img => img.name).join(', ');

  return `You are a professional presentation designer. Create a PowerPoint presentation structure from the given text.

INPUT TEXT:
${text}

GUIDANCE: ${guidance || 'Create a professional presentation'}

TEMPLATE INFO:
- Available colors: ${templateInfo.colors.join(', ')}
- Available layouts: 
${layoutsInfo}
- Available images: ${imagesInfo}
- Fonts: ${templateInfo.fonts.join(', ')}

REQUIREMENTS:
1. Analyze the text and determine optimal number of slides (typically 5-15 slides)
2. Choose appropriate layouts for each slide type
3. Break content into slide-appropriate chunks
4. Use template images where relevant
5. Create engaging titles and clear content

OUTPUT FORMAT (JSON):
{
  "slides": [
    {
      "layout": "slideLayout1",
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2"],
      "image": "image1.jpg",
      "notes": "Speaker notes for this slide"
    }
  ],
  "totalSlides": 8,
  "presentationTitle": "Main Title"
}

GUIDELINES:
- First slide should be a title slide
- Use bullet points for main content slides
- Include a conclusion/thank you slide
- Match layout types to content (title for titles, content for bullets, etc.)
- Keep content concise and slide-appropriate
- Use images strategically, not on every slide

Create the presentation structure now:`;
}

async function callGemini(prompt, apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in LLM response');
    }

    const slideStructure = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (!slideStructure.slides || !Array.isArray(slideStructure.slides)) {
      throw new Error('Invalid slide structure from LLM');
    }

    return slideStructure;
    
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('LLM generation failed: ' + error.message);
  }
}

async function callOpenAI(prompt, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No valid JSON found in OpenAI response');
    }

    return JSON.parse(jsonMatch[0]);
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('OpenAI generation failed: ' + error.message);
  }
}

module.exports = { callLLM };
