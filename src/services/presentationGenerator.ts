import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';

interface TemplateData {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  fonts: {
    title: string;
    body: string;
  };
  layouts: Array<{
    name: string;
    titleBox?: { x: number; y: number; w: number; h: number };
    contentBox?: { x: number; y: number; w: number; h: number };
  }>;
  images: { [key: string]: string };
  slideSize?: { width: number; height: number };
}

interface SlideContent {
  title: string;
  content: string[];
  type: 'title' | 'content' | 'bullets';
  notes?: string;
}

interface PresentationStructure {
  title: string;
  slides: SlideContent[];
}

export async function generatePresentation(formData: {
  text: string;
  guidance: string;
  apiKey: string;
  templateFile: File | null;
  provider: 'gemini' | 'openai';
}) {
  console.log('Starting presentation generation...');
  
  let templateData: TemplateData | null = null;
  if (formData.templateFile) {
    console.log('Extracting template...');
    templateData = await extractTemplateData(formData.templateFile);
  }

  console.log('Calling AI...');
  const structure = await generatePresentationStructure(
    formData.provider,
    formData.apiKey,
    formData.text,
    formData.guidance
  );

  console.log('Creating presentation...');
  await createPresentationWithTemplate(structure, templateData);
}

// ==================== TEMPLATE EXTRACTION FUNCTIONS ==================== //

async function extractTemplateData(templateFile: File): Promise<TemplateData> {
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(templateFile);
    
    const result: TemplateData = {
      colors: { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' },
      fonts: { title: 'Calibri', body: 'Calibri' },
      layouts: [],
      images: {},
      slideSize: { width: 10, height: 7.5 }
    };
    
    const themeFile = zipContent.file('ppt/theme/theme1.xml');
    if (themeFile) {
      const themeXml = await themeFile.async('text');
      result.colors = extractColorsFromTheme(themeXml);
      result.fonts = extractFontsFromTheme(themeXml);
    }

    const masterFile = zipContent.file('ppt/slideMasters/slideMaster1.xml');
    if (masterFile) {
      const masterXml = await masterFile.async('text');
      const masterLayout = extractMasterLayout(masterXml);
      if (masterLayout) result.layouts.push(masterLayout);
    }

    const layoutFiles = Object.keys(zipContent.files).filter(name => 
      name.startsWith('ppt/slideLayouts/') && name.endsWith('.xml')
    );
    
    for (const layoutFile of layoutFiles.slice(0, 3)) {
      const file = zipContent.file(layoutFile);
      if (file) {
        const layoutXml = await file.async('text');
        const layout = extractLayoutPositions(layoutXml);
        if (layout) result.layouts.push(layout);
      }
    }
    
    const mediaFiles = Object.keys(zipContent.files).filter(name => 
      name.startsWith('ppt/media/') && /\.(png|jpg|jpeg|gif)$/i.test(name)
    );
    
    for (const mediaFile of mediaFiles.slice(0, 5)) {
      const file = zipContent.file(mediaFile);
      if (file) {
        const imageData = await file.async('base64');
        const fileName = mediaFile.split('/').pop() || '';
        result.images[fileName] = `data:image/png;base64,${imageData}`;
      }
    }

    console.log('Template extracted:', result);
    return result;
    
  } catch (error) {
    console.error('Template extraction failed:', error);
    return {
      colors: { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' },
      fonts: { title: 'Calibri', body: 'Calibri' },
      layouts: [],
      images: {},
      slideSize: { width: 10, height: 7.5 }
    };
  }
}

function extractMasterLayout(masterXml: string) {
  try {
    let titleBox, contentBox;
    const titleMatch = masterXml.match(/<p:sp[^>]*>[\s\S]*?<p:ph[^>]*type="title"[\s\S]*?<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
    if (titleMatch) {
      titleBox = {
        x: parseInt(titleMatch[1]) / 914400,
        y: parseInt(titleMatch[2]) / 914400,
        w: parseInt(titleMatch[3]) / 914400,
        h: parseInt(titleMatch[4]) / 914400
      };
    }
    const contentMatch = masterXml.match(/<p:sp[^>]*>[\s\S]*?<p:ph[^>]*type="body"[\s\S]*?<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
    if (contentMatch) {
      contentBox = {
        x: parseInt(contentMatch[1]) / 914400,
        y: parseInt(contentMatch[2]) / 914400,
        w: parseInt(contentMatch[3]) / 914400,
        h: parseInt(contentMatch[4]) / 914400
      };
    }
    return {
      name: 'Master Layout',
      titleBox: titleBox || { x: 0.5, y: 0.5, w: 9, h: 1.2 },
      contentBox: contentBox || { x: 0.5, y: 2, w: 9, h: 4.5 }
    };
  } catch {
    return null;
  }
}

function extractLayoutPositions(layoutXml: string) {
  try {
    let layoutName = 'Content Layout';
    let titleBox, contentBox;
    const nameMatch = layoutXml.match(/name="([^"]+)"/);
    if (nameMatch) layoutName = nameMatch[1];
    const shapeMatches = [...layoutXml.matchAll(/<p:sp[^>]*>([\s\S]*?)<\/p:sp>/g)];
    for (const shapeMatch of shapeMatches) {
      const shapeContent = shapeMatch[1];
      const phMatch = shapeContent.match(/<p:ph[^>]*(?:type="([^"]+)")?[^>]*>/);
      if (!phMatch) continue;
      const phType = phMatch[1] || 'content';
      const posMatch = shapeContent.match(/<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
      if (posMatch) {
        const box = {
          x: parseInt(posMatch[1]) / 914400,
          y: parseInt(posMatch[2]) / 914400, 
          w: parseInt(posMatch[3]) / 914400,
          h: parseInt(posMatch[4]) / 914400
        };
        if (phType === 'title' || phType === 'ctrTitle') titleBox = box;
        else if (phType === 'body' || phType === 'obj' || !titleBox) contentBox = box;
      }
    }
    return {
      name: layoutName,
      titleBox: titleBox || { x: 0.5, y: 0.5, w: 9, h: 1.2 },
      contentBox: contentBox || { x: 0.5, y: 2, w: 9, h: 4.5 }
    };
  } catch {
    return null;
  }
}

function extractColorsFromTheme(themeXml: string) {
  const colors = { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' };
  try {
    const schemeMatch = themeXml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
    if (schemeMatch) {
      const content = schemeMatch[1];
      const dk1 = content.match(/<a:dk1>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (dk1) colors.text = `#${dk1[1].toLowerCase()}`;
      const lt1 = content.match(/<a:lt1>[\s\S]*?val="([A-F0-9]{6})"/i);  
      if (lt1) colors.background = `#${lt1[1].toLowerCase()}`;
      const accent1 = content.match(/<a:accent1>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accent1) colors.primary = `#${accent1[1].toLowerCase()}`;
      const accent2 = content.match(/<a:accent2>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accent2) colors.secondary = `#${accent2[1].toLowerCase()}`;
    }
  } catch {}
  return colors;
}

function extractFontsFromTheme(themeXml: string) {
  const fonts = { title: 'Calibri', body: 'Calibri' };
  try {
    const majorFont = themeXml.match(/<a:majorFont>[\s\S]*?typeface="([^"]+)"/);
    if (majorFont) fonts.title = majorFont[1];
    const minorFont = themeXml.match(/<a:minorFont>[\s\S]*?typeface="([^"]+)"/);  
    if (minorFont) fonts.body = minorFont[1];
  } catch {}
  return fonts;
}

// ==================== PRESENTATION CREATION ==================== //

async function createPresentationWithTemplate(structure: PresentationStructure, templateData: TemplateData | null) {
  const pptx = new PptxGenJS();
  const colors = templateData?.colors || { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' };
  const fonts = templateData?.fonts || { title: 'Calibri', body: 'Calibri' };
  const layouts = templateData?.layouts || [];

  if (templateData?.slideSize) {
    pptx.defineLayout({
      name: 'CUSTOM',
      width: templateData.slideSize.width,
      height: templateData.slideSize.height
    });
    pptx.layout = 'CUSTOM';
  }

  structure.slides.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    let layout = layouts[0] || {
      name: 'Default',
      titleBox: { x: 0.5, y: 0.5, w: 9, h: 1.2 },
      contentBox: { x: 0.5, y: 2, w: 9, h: 4.5 }
    };

    if (slideData.type === 'title' || index === 0) {
      slide.addText(slideData.title, {
        x: layout.titleBox?.x || 1,
        y: layout.titleBox?.y || 2.5, 
        w: layout.titleBox?.w || 8,
        h: layout.titleBox?.h || 1.5,
        fontSize: 36,
        bold: true,
        color: colors.primary,
        fontFace: fonts.title,
        align: 'center'
      });
      if (slideData.content.length > 0) {
        slide.addText(slideData.content.join(' '), {
          x: layout.contentBox?.x || 1,
          y: (layout.titleBox?.y || 2.5) + (layout.titleBox?.h || 1.5) + 0.5,
          w: layout.contentBox?.w || 8,
          h: 1,
          fontSize: 18,
          color: colors.text,
          fontFace: fonts.body,
          align: 'center'
        });
      }
    } else {
      slide.addText(slideData.title, {
        x: layout.titleBox?.x || 0.5,
        y: layout.titleBox?.y || 0.5,
        w: layout.titleBox?.w || 9,
        h: layout.titleBox?.h || 1.2,
        fontSize: 28,
        bold: true,
        color: colors.primary,
        fontFace: fonts.title
      });
      const contentText = slideData.type === 'bullets' 
        ? slideData.content.map(item => `• ${item}`).join('\n')
        : slideData.content.join('\n\n');
      slide.addText(contentText, {
        x: layout.contentBox?.x || 0.5,
        y: layout.contentBox?.y || 2,
        w: layout.contentBox?.w || 9,
        h: layout.contentBox?.h || 4.5,
        fontSize: 16,
        color: colors.text,
        fontFace: fonts.body,
        valign: 'top'
      });
    }
    if (colors.background && colors.background !== '#ffffff') {
      slide.background = { color: colors.background };
    }
  });

  const cleanTitle = structure.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').substring(0, 50);
  const fileName = `${cleanTitle || 'Presentation'}.pptx`;
  await pptx.writeFile({ fileName });
}

// ==================== FIXED AI CALL ==================== //

async function generatePresentationStructure(provider: 'gemini' | 'openai', apiKey: string, text: string, guidance: string): Promise<PresentationStructure> {
  const prompt = `Convert this text into a PowerPoint presentation. Respond with ONLY valid JSON.

Text: "${text.substring(0, 8000)}"${text.length > 8000 ? '...' : ''}
${guidance ? `\nGuidance: "${guidance}"` : ''}

Required JSON format:
{
  "title": "Presentation Title",
  "slides": [
    {"title": "Slide Title", "content": ["Point 1", "Point 2"], "type": "title|content|bullets"}
  ]
}

Rules:
- Follow any guidance given in the contents.
- First slide type must be "title"  
- Use "bullets" for lists, "content" for paragraphs
- Keep content concise and clear`;

  try {
    let responseText = '';

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      });
      responseText = response.choices[0]?.message?.content || '';
    } else {
      // ✅ FIXED: Use free tier model (gemini-2.0-flash-exp)
      const result = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${result.status} ${errorData.error?.message || result.statusText}`);
      }

      const data = await result.json();
      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const structure = JSON.parse(jsonMatch[0]);
    if (!structure.title || !Array.isArray(structure.slides)) throw new Error('Invalid structure');
    if (structure.slides[0]) structure.slides[0].type = 'title';
    return structure;

  } catch (error: any) {
    const message = error.message || '';
    if (message.includes('API key')) throw new Error(`Invalid ${provider} API key`);
    if (message.includes('quota')) throw new Error('API quota exceeded');
    throw new Error(`Generation failed: ${message}`);
  }
}
