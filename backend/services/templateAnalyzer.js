const JSZip = require('jszip');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

async function analyzeTemplate(templatePath) {
  try {
    const data = fs.readFileSync(templatePath);
    const zip = new JSZip();
    const contents = await zip.loadAsync(data);

    const templateInfo = {
      colors: [],
      fonts: [],
      layouts: [],
      images: [],
      slideSize: { width: 10, height: 7.5 } // Default
    };

    // Extract theme colors
    const themeFile = contents.files['ppt/theme/theme1.xml'];
    if (themeFile) {
      const themeXml = await themeFile.async('text');
      const theme = await xml2js.parseStringPromise(themeXml);
      
      // Extract colors from theme
      const colorScheme = theme?.['a:theme']?.['a:themeElements']?.[0]?.['a:clrScheme']?.[0];
      if (colorScheme) {
        for (const [colorName, colorData] of Object.entries(colorScheme)) {
          if (colorName !== '$' && colorData[0]) {
            const sysClr = colorData[0]['a:sysClr'];
            const srgbClr = colorData[0]['a:srgbClr'];
            
            if (srgbClr?.[0]?.$.val) {
              templateInfo.colors.push(`#${srgbClr[0].$.val}`);
            } else if (sysClr?.[0]?.$.val) {
              // Map system colors to hex
              const sysColorMap = {
                'windowText': '#000000',
                'window': '#FFFFFF',
                'accent1': '#4472C4',
                'accent2': '#E7E6E6'
              };
              if (sysColorMap[sysClr[0].$.val]) {
                templateInfo.colors.push(sysColorMap[sysClr[0].$.val]);
              }
            }
          }
        }
      }
    }

    // Extract slide layouts
    const slideLayoutsDir = 'ppt/slideLayouts/';
    const layoutFiles = Object.keys(contents.files).filter(f => f.startsWith(slideLayoutsDir) && f.endsWith('.xml'));
    
    for (const layoutFile of layoutFiles) {
      const layoutXml = await contents.files[layoutFile].async('text');
      const layout = await xml2js.parseStringPromise(layoutXml);
      
      const layoutName = layoutFile.replace(slideLayoutsDir, '').replace('.xml', '');
      const placeholders = extractPlaceholders(layout);
      
      templateInfo.layouts.push({
        name: layoutName,
        file: layoutFile,
        placeholders: placeholders
      });
    }

    // Extract images
    const mediaDir = 'ppt/media/';
    const imageFiles = Object.keys(contents.files).filter(f => 
      f.startsWith(mediaDir) && /\.(jpg|jpeg|png|gif|svg)$/i.test(f)
    );

    for (const imageFile of imageFiles) {
      templateInfo.images.push({
        name: path.basename(imageFile),
        path: imageFile,
        data: await contents.files[imageFile].async('base64')
      });
    }

    // Default colors if none found
    if (templateInfo.colors.length === 0) {
      templateInfo.colors = ['#1F4E79', '#FFFFFF', '#D9E2F3', '#A5A5A5'];
    }

    // Default fonts
    templateInfo.fonts = ['Calibri', 'Arial', 'Times New Roman'];

    return templateInfo;
    
  } catch (error) {
    console.error('Template analysis error:', error);
    throw new Error('Failed to analyze template: ' + error.message);
  }
}

function extractPlaceholders(layout) {
  const placeholders = [];
  
  try {
    const sldLayout = layout['p:sldLayout'];
    if (!sldLayout) return placeholders;

    const cSld = sldLayout['p:cSld'];
    if (!cSld || !cSld[0] || !cSld[0]['p:spTree']) return placeholders;

    const shapes = cSld[0]['p:spTree'][0]['p:sp'] || [];
    
    for (const shape of shapes) {
      if (shape['p:nvSpPr'] && shape['p:nvSpPr'][0]['p:nvPr']) {
        const nvPr = shape['p:nvSpPr'][0]['p:nvPr'][0];
        const ph = nvPr['p:ph'];
        
        if (ph && ph[0] && ph[0].$) {
          const type = ph[0].$.type || 'content';
          placeholders.push({
            type: type,
            idx: ph[0].$.idx || '0'
          });
        }
      }
    }
  } catch (error) {
    console.error('Placeholder extraction error:', error);
  }

  return placeholders;
}

module.exports = { analyzeTemplate };
