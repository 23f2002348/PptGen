# 📊 Auto PowerPoint Generator

Transform any text content into professional PowerPoint presentations using AI and your custom templates.

## 🚀 Features

- **Smart Content Analysis**: AI breaks down your text into logical slide structure
- **Template Preservation**: Maintains your uploaded template's colors, fonts, and layouts
- **Multi-LLM Support**: Works with Google Gemini and OpenAI GPT-4
- **Image Reuse**: Automatically reuses images from your template
- **Flexible Input**: Supports markdown, plain text, and structured content
- **Professional Output**: Generates downloadable .pptx files

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- pptxgenjs for PowerPoint generation
- Google Generative AI / OpenAI API
- XML parsing for template analysis

**Frontend:**
- React
- Axios for API calls
- Modern CSS with gradients

## 📋 Setup Instructions

### Backend Setup

1. **Clone and install dependencies:**
```bash
git clone <your-repo-url>
cd ppt-generator-backend
npm install
```

2. **Create uploads directory:**
```bash
mkdir uploads
```

3. **Start development server:**
```bash
npm run dev
```

The backend runs on `http://localhost:5000`

### Frontend Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Set environment variable (optional):**
```bash
# Create .env file
echo "REACT_APP_API_URL=http://localhost:5000" > .env
```

3. **Start development server:**
```bash
npm start
```

The frontend runs on `http://localhost:3000`

## 🎯 How It Works

### 1. Input Processing
- User uploads a PowerPoint template (.pptx/.potx)
- User provides text content and optional guidance
- User enters their LLM API key (Gemini or OpenAI)

### 2. Template Analysis
The system extracts from your template:
- **Color schemes** from theme files
- **Available layouts** and their placeholder types
- **Embedded images** for reuse
- **Font information**

### 3. AI Content Structuring
The LLM analyzes your content and creates:
- Optimal number of slides based on content length
- Appropriate slide titles and bullet points
- Layout recommendations for each slide
- Strategic image placement suggestions
- Speaker notes for each slide

### 4. Presentation Generation
- Maps AI-generated content to template layouts
- Applies original color schemes and fonts
- Inserts template images where relevant
- Generates downloadable .pptx file

## 📝 API Endpoints

### `POST /generate`
Generates a PowerPoint presentation from text and template.

**Parameters:**
- `text` (string, required): Content to convert
- `guidance` (string, optional): Tone/structure guidance
- `apiKey` (string, required): LLM API key
- `provider` (string): 'gemini' or 'openai'
- `template` (file, required): .pptx/.potx template file

**Response:** Binary .pptx file for download

### `GET /health`
Health check endpoint.

## 🔧 Configuration

### Environment Variables

**Backend (.env):**
```
PORT=5000
NODE_ENV=development
```

**Frontend (.env):**
```
REACT_APP_API_URL=http://localhost:5000
```

### API Key Setup

**Google Gemini:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Use with provider: 'gemini'

**OpenAI:**
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create an API key
3. Use with provider: 'openai'

## 🚀 Deployment

### Backend (Render)

1. **Connect your GitHub repo to Render**
2. **Set build command:** `npm install`
3. **Set start command:** `npm start`
4. **Add environment variables if needed**

### Frontend (Vercel)

1. **Connect your GitHub repo to Vercel**
2. **Set framework:** React
3. **Set build command:** `npm run build`
4. **Add environment variable:** `REACT_APP_API_URL=<your-backend-url>`

## 📁 Project Structure

```
ppt-generator/
├── backend/
│   ├── server.js
│   ├── services/
│   │   ├── templateAnalyzer.js
│   │   ├── llmService.js
│   │   └── presentationGenerator.js
│   ├── uploads/ (created automatically)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── public/
│   └── package.json
└── README.md
```

## 🔒 Security Notes

- API keys are never stored or logged
- Uploaded files are automatically deleted after processing
- All processing happens server-side
- File size limits prevent abuse

## 🎨 Customization

### Adding New LLM Providers
Extend `services/llmService.js` with new provider functions.

### Template Analysis Enhancement
Modify `services/templateAnalyzer.js` to extract additional template properties.

### Layout Improvements
Update `services/presentationGenerator.js` to handle more complex layouts.

## 🐛 Troubleshooting

**Common Issues:**

1. **"Template analysis failed"**
   - Ensure uploaded file is valid .pptx/.potx
   - Check file size (max 50MB)

2. **"LLM generation failed"**
   - Verify API key is correct
   - Check internet connection
   - Try different LLM provider

3. **"Download failed"**
   - Clear browser cache
   - Try different browser
   - Check console for errors

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Made with ❤️ for effortless presentation creation**
