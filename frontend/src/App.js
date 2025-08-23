import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [text, setText] = useState('');
  const [guidance, setGuidance] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!text || !apiKey || !template) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('guidance', guidance);
      formData.append('apiKey', apiKey);
      formData.append('provider', provider);
      formData.append('template', template);

      const response = await axios.post(`${API_URL}/generate`, formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000 // 2 minutes
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'generated-presentation.pptx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err.response?.data?.error || 'Failed to generate presentation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header>
          <h1>📊 Auto PowerPoint Generator</h1>
          <p>Transform your text into a professional presentation</p>
        </header>

        <form onSubmit={handleSubmit} className="form">
          {error && <div className="error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="text">Your Content *</label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text, markdown, or content here..."
              rows={10}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="guidance">Guidance (Optional)</label>
            <input
              type="text"
              id="guidance"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g., 'turn into an investor pitch deck'"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="provider">LLM Provider</label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI GPT-4</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="apiKey">API Key *</label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API key"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="template">PowerPoint Template *</label>
            <input
              type="file"
              id="template"
              accept=".pptx,.potx"
              onChange={(e) => setTemplate(e.target.files[0])}
              required
            />
            <small>Upload a .pptx or .potx template file</small>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="submit-btn"
          >
            {loading ? '🔄 Generating...' : '🚀 Generate Presentation'}
          </button>
        </form>

        <footer>
          <p>• API keys are never stored • Processing happens securely •</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
