const pptxgen = require('pptxgenjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function generatePresentation(slideStructure, templateInfo) {
  try {
    const pres = new pptxgen();
    
    // Set presentation properties
    pres.layout = 'LAYOUT_WIDE';
    pres.title = slideStructure.presentationTitle || 'Generated Presentation';

    // Define template-based theme
    const primaryColor = templateInfo.colors[0] || '#1F4E79';
    const secondaryColor = templateInfo.colors[1] || '#FFFFFF';
    const accentColor = templateInfo.colors[2] || '#D9E2F3';
    const textColor = templateInfo.colors[3] || '#000000';

    // Process each slide
    for (let i = 0; i < slideStructure.slides.length; i++) {
      const slideData = slideStructure.slides[i];
      const slide = pres.addSlide();

      // Determine slide type and apply layout
      if (i === 0 || slideData.layout.toLowerCase().includes('title')) {
        createTitleSlide(slide, slideData, primaryColor, secondaryColor);
      } else if (slideData.layout.toLowerCase().includes('section') || 
                 slideData.title && !slideData.content) {
        createSectionSlide(slide, slideData, primaryColor, secondaryColor);
      } else {
        createContentSlide(slide, slideData, primaryColor, textColor, templateInfo);
      }

      // Add speaker notes if provided
      if (slideData.notes) {
        slide.addNotes(slideData.notes);
      }
    }

    // Generate file
    const fileName = `presentation-${uuidv4()}.pptx`;
    const outputPath = path.join('./uploads', fileName);
    
    await pres.writeFile({ fileName: outputPath });
    return outputPath;
    
  } catch (error) {
    console.error('Presentation generation error:', error);
    throw new Error('Failed to generate presentation: ' + error.message);
  }
}

function createTitleSlide(slide, slideData, primaryColor, secondaryColor) {
  // Main title
  slide.addText(slideData.title || 'Presentation Title', {
    x: 1,
    y: 2.5,
    w: 8,
    h: 1.5,
    fontSize: 36,
    bold: true,
    color: primaryColor,
    align: 'center',
    fontFace: 'Calibri'
  });

  // Subtitle if content exists
  if (slideData.content && slideData.content.length > 0) {
    const subtitle = Array.isArray(slideData.content) ? 
      slideData.content.join(' • ') : slideData.content;
    
    slide.addText(subtitle, {
      x: 1,
      y: 4.5,
      w: 8,
      h: 1,
      fontSize: 20,
      color: primaryColor,
      align: 'center',
      fontFace: 'Calibri'
    });
  }

  // Background accent
  slide.addShape('rect', {
    x: 0,
    y: 6.5,
    w: 10,
    h: 1,
    fill: { color: primaryColor }
  });
}

function createSectionSlide(slide, slideData, primaryColor, secondaryColor) {
  // Section title
  slide.addText(slideData.title, {
    x: 1,
    y: 3,
    w: 8,
    h: 1.5,
    fontSize: 32,
    bold: true,
    color: secondaryColor,
    align: 'center',
    fontFace: 'Calibri'
  });

  // Full background
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 10,
    h: 7.5,
    fill: { color: primaryColor }
  });
}

function createContentSlide(slide, slideData, primaryColor, textColor, templateInfo) {
  // Title
  slide.addText(slideData.title || 'Slide Title', {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: primaryColor,
    fontFace: 'Calibri'
  });

  // Content
  if (slideData.content && Array.isArray(slideData.content)) {
    const bulletText = slideData.content.map(item => ({ 
      text: item, 
      options: { 
        bullet: true, 
        fontSize: 16,
        color: textColor,
        fontFace: 'Calibri',
        lineSpacing: 20
      }
    }));

    slide.addText(bulletText, {
      x: 0.5,
      y: 1.5,
      w: slideData.image ? 5.5 : 9,
      h: 5,
    });
  } else if (slideData.content) {
    // Single content block
    slide.addText(slideData.content, {
      x: 0.5,
      y: 1.5,
      w: slideData.image ? 5.5 : 9,
      h: 5,
      fontSize: 16,
      color: textColor,
      fontFace: 'Calibri',
      lineSpacing: 20
    });
  }

  // Add image if specified and available
  if (slideData.image && templateInfo.images) {
    const image = templateInfo.images.find(img => 
      img.name.toLowerCase().includes(slideData.image.toLowerCase()) ||
      slideData.image.toLowerCase().includes(img.name.toLowerCase().split('.')[0])
    );

    if (image) {
      slide.addImage({
        data: `data:image/jpeg;base64,${image.data}`,
        x: 6.5,
        y: 2,
        w: 3,
        h: 3,
        objectFit: 'cover'
      });
    }
  }

  // Add accent line
  slide.addShape('rect', {
    x: 0.5,
    y: 1.2,
    w: 2,
    h: 0.05,
    fill: { color: primaryColor }
  });
}

module.exports = { generatePresentation };
