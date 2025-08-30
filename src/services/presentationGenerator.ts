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

// FIXED: Extract actual layout positions and slide master info
async function extractTemplateData(templateFile: File): Promise<TemplateData> {
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(templateFile);
    
    // Default fallback
    const result: TemplateData = {
      colors: { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' },
      fonts: { title: 'Calibri', body: 'Calibri' },
      layouts: [],
      images: {},
      slideSize: { width: 10, height: 7.5 }
    };
    
    // Extract colors and fonts from theme
    const themeFile = zipContent.file('ppt/theme/theme1.xml');
    if (themeFile) {
      const themeXml = await themeFile.async('text');
      result.colors = extractColorsFromTheme(themeXml);
      result.fonts = extractFontsFromTheme(themeXml);
    }
    
    // FIXED: Extract slide master layout positions
    const masterFile = zipContent.file('ppt/slideMasters/slideMaster1.xml');
    if (masterFile) {
      const masterXml = await masterFile.async('text');
      const masterLayout = extractMasterLayout(masterXml);
      if (masterLayout) result.layouts.push(masterLayout);
    }
    
    // FIXED: Extract layout files with actual positions
    const layoutFiles = Object.keys(zipContent.files).filter(name => 
      name.startsWith('ppt/slideLayouts/') && name.endsWith('.xml')
    );
    
    for (const layoutFile of layoutFiles.slice(0, 3)) { // Limit to first 3 layouts
      const file = zipContent.file(layoutFile);
      if (file) {
        const layoutXml = await file.async('text');
        const layout = extractLayoutPositions(layoutXml);
        if (layout) result.layouts.push(layout);
      }
    }
    
    // Extract images
    const mediaFiles = Object.keys(zipContent.files).filter(name => 
      name.startsWith('ppt/media/') && /\.(png|jpg|jpeg|gif)$/i.test(name)
    );
    
    for (const mediaFile of mediaFiles.slice(0, 5)) { // Limit images
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

// FIXED: Extract actual positioning from slide master
function extractMasterLayout(masterXml: string) {
  try {
    let titleBox, contentBox;
    
    // Find title placeholder position
    const titleMatch = masterXml.match(/<p:sp[^>]*>[\s\S]*?<p:ph[^>]*type="title"[\s\S]*?<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
    if (titleMatch) {
      titleBox = {
        x: parseInt(titleMatch[1]) / 914400, // Convert EMUs to inches
        y: parseInt(titleMatch[2]) / 914400,
        w: parseInt(titleMatch[3]) / 914400,
        h: parseInt(titleMatch[4]) / 914400
      };
    }
    
    // Find content placeholder position  
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
  } catch (error) {
    return null;
  }
}

// FIXED: Extract layout positions more accurately  
function extractLayoutPositions(layoutXml: string) {
  try {
    let layoutName = 'Content Layout';
    let titleBox, contentBox;
    
    // Extract layout name
    const nameMatch = layoutXml.match(/name="([^"]+)"/);
    if (nameMatch) layoutName = nameMatch[1];
    
    // Find all shape positions in layout
    const shapeMatches = [...layoutXml.matchAll(/<p:sp[^>]*>([\s\S]*?)<\/p:sp>/g)];
    
    for (const shapeMatch of shapeMatches) {
      const shapeContent = shapeMatch[1];
      
      // Check if this shape has a placeholder
      const phMatch = shapeContent.match(/<p:ph[^>]*(?:type="([^"]+)")?[^>]*>/);
      if (!phMatch) continue;
      
      const phType = phMatch[1] || 'content';
      
      // Extract position
      const posMatch = shapeContent.match(/<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
      if (posMatch) {
        const box = {
          x: Math.max(0, parseInt(posMatch[1]) / 914400),
          y: Math.max(0, parseInt(posMatch[2]) / 914400), 
          w: Math.min(10, parseInt(posMatch[3]) / 914400),
          h: Math.min(7.5, parseInt(posMatch[4]) / 914400)
        };
        
        if (phType === 'title' || phType === 'ctrTitle') {
          titleBox = box;
        } else if (phType === 'body' || phType === 'obj' || !titleBox) {
          contentBox = box;
        }
      }
    }
    
    return {
      name: layoutName,
      titleBox: titleBox || { x: 0.5, y: 0.5, w: 9, h: 1.2 },
      contentBox: contentBox || { x: 0.5, y: 2, w: 9, h: 4.5 }
    };
  } catch (error) {
    return null;
  }
}

// FIXED: Better color extraction
function extractColorsFromTheme(themeXml: string) {
  const colors = { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' };
  
  try {
    const schemeMatch = themeXml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
    if (schemeMatch) {
      const content = schemeMatch[1];
      
      // Extract colors with fallbacks
      const dk1 = content.match(/<a:dk1>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (dk1) colors.text = `#${dk1[1].toLowerCase()}`;
      
      const lt1 = content.match(/<a:lt1>[\s\S]*?val="([A-F0-9]{6})"/i);  
      if (lt1) colors.background = `#${lt1[1].toLowerCase()}`;
      
      const accent1 = content.match(/<a:accent1>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accent1) colors.primary = `#${accent1[1].toLowerCase()}`;
      
      const accent2 = content.match(/<a:accent2>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accent2) colors.secondary = `#${accent2[1].toLowerCase()}`;
    }
  } catch (error) {
    console.log('Color extraction error:', error);
  }
  
  return colors;
}

function extractFontsFromTheme(themeXml: string) {
  const fonts = { title: 'Calibri', body: 'Calibri' };
  
  try {
    const majorFont = themeXml.match(/<a:majorFont>[\s\S]*?typeface="([^"]+)"/);
    if (majorFont) fonts.title = majorFont[1];
    
    const minorFont = themeXml.match(/<a:minorFont>[\s\S]*?typeface="([^"]+)"/);  
    if (minorFont) fonts.body = minorFont[1];
  } catch (error) {
    console.log('Font extraction error:', error);
  }
  
  return fonts;
}

// FIXED: Use extracted layout positions
async function createPresentationWithTemplate(structure: PresentationStructure, templateData: TemplateData | null) {
  const pptx = new PptxGenJS();
  
  const colors = templateData?.colors || { primary: '#2563eb', secondary: '#7c3aed', accent: '#059669', text: '#374151', background: '#ffffff' };
  const fonts = templateData?.fonts || { title: 'Calibri', body: 'Calibri' };
  const layouts = templateData?.layouts || [];
  
  // Set slide size from template
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
    
    // Choose layout based on slide type and available layouts
    let layout = layouts[0]; // Use first layout as default
    if (slideData.type === 'title' && layouts.length > 1) {
      layout = layouts.find(l => l.name.toLowerCase().includes('title')) || layouts[0];
    } else if (layouts.length > 1) {
      layout = layouts.find(l => !l.name.toLowerCase().includes('title')) || layouts[1] || layouts[0];
    }
    
    if (!layout) {
      // Fallback layout
      layout = {
        name: 'Default',
        titleBox: { x: 0.5, y: 0.5, w: 9, h: 1.2 },
        contentBox: { x: 0.5, y: 2, w: 9, h: 4.5 }
      };
    }
    
    if (slideData.type === 'title' || index === 0) {
      // Title slide with template layout
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
      // Content slide with template layout
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
    
    // Add background color if available
    if (colors.background && colors.background !== '#ffffff') {
      slide.background = { color: colors.background };
    }
  });

  // Generate filename and download
  const cleanTitle = structure.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').substring(0, 50);
  const fileName = `${cleanTitle || 'Presentation'}.pptx`;
  await pptx.writeFile({ fileName });
}

async function generatePresentationStructure(provider: 'gemini' | 'openai', apiKey: string, text: string, guidance: string): Promise<PresentationStructure> {
  const prompt = `Convert this text into a PowerPoint presentation. Respond with ONLY valid JSON.

Text: "${text.substring(0, 4000)}"${text.length > 4000 ? '...' : ''}
${guidance ? `\nGuidance: "${guidance}"` : ''}

Required JSON format:
{
  "title": "Presentation Title",
  "slides": [
    {"title": "Slide Title", "content": ["Point 1", "Point 2"], "type": "title|content|bullets"}
  ]
}

Rules:
- Create 6-12 slides based on content
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
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    }
    
    // Parse JSON response
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    
    const structure = JSON.parse(jsonMatch[0]);
    if (!structure.title || !Array.isArray(structure.slides)) {
      throw new Error('Invalid structure');
    }
    
    // Ensure first slide is title
    if (structure.slides[0]) structure.slides[0].type = 'title';
    
    return structure;
  } catch (error) {
    const message = error.message || '';
    if (message.includes('API key')) throw new Error(`Invalid ${provider} API key`);
    if (message.includes('quota')) throw new Error('API quota exceeded');
    throw new Error(`Generation failed: ${message}`);
  }
}