const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { analyzeTemplate } = require('./services/templateAnalyzer');
const { generatePresentation } = require('./services/presentationGenerator');
const { callLLM } = require('./services/llmService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext === '.pptx' || ext === '.potx') {
      cb(null, true);
    } else {
      cb(new Error('Only .pptx and .potx files allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Main endpoint
app.post('/generate', upload.single('template'), async (req, res) => {
  try {
    const { text, guidance, apiKey, provider = 'gemini' } = req.body;
    const templatePath = req.file?.path;

    if (!text || !apiKey) {
      return res.status(400).json({ error: 'Text content and API key are required' });
    }

    if (!templatePath) {
      return res.status(400).json({ error: 'Template file is required' });
    }

    // 1. Analyze template
    console.log('Analyzing template...');
    const templateInfo = await analyzeTemplate(templatePath);

    // 2. Generate slide structure using LLM
    console.log('Generating slide structure...');
    const slideStructure = await callLLM(text, guidance, templateInfo, apiKey, provider);

    // 3. Generate PowerPoint
    console.log('Creating presentation...');
    const outputPath = await generatePresentation(slideStructure, templateInfo);

    // 4. Send file
    res.download(outputPath, 'generated-presentation.pptx', (err) => {
      // Cleanup files
      fs.unlinkSync(templatePath);
      fs.unlinkSync(outputPath);
      if (err) console.error('Download error:', err);
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'Server running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
