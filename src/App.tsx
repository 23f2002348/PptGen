import React, { useState } from 'react';
import { Upload, Download, Wand2, FileText } from 'lucide-react';
import { generatePresentation } from './services/presentationGenerator';

interface FormData {
  text: string;
  guidance: string;
  apiKey: string;
  templateFile: File | null;
  provider: 'gemini' | 'openai';
}

function App() {
  const [formData, setFormData] = useState<FormData>({
    text: '',
    guidance: '',
    apiKey: '',
    templateFile: null,
    provider: 'gemini'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.text.trim() || !formData.apiKey.trim()) {
      setError('Please provide both text content and API key');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      await generatePresentation(formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate presentation';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.name.endsWith('.pptx') || file.name.endsWith('.potx')) {
      setFormData(prev => ({ ...prev, templateFile: file }));
      setError('');
    } else {
      setError('Please upload a valid PowerPoint file (.pptx or .potx)');
      e.target.value = ''; // Clear invalid file
    }
  };

  const updateFormData = (key: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-indigo-600 mr-2" />
            <h1 className="text-3xl font-bold text-gray-800">PowerPoint Generator</h1>
          </div>
          <p className="text-gray-600">Transform your text into a professional presentation</p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Content
              </label>
              <textarea
                value={formData.text}
                onChange={(e) => updateFormData('text', e.target.value)}
                placeholder="Paste your text, markdown, or prose here..."
                className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                required
              />
            </div>

            {/* Guidance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guidance (Optional)
              </label>
              <input
                type="text"
                value={formData.guidance}
                onChange={(e) => updateFormData('guidance', e.target.value)}
                placeholder="e.g., 'turn into an investor pitch deck' or 'make it technical'"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* API Provider & Key */}
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  AI Provider & API Key
                </label>
                <div className="flex space-x-2">
                  {(['gemini', 'openai'] as const).map(provider => (
                    <label key={provider} className="flex items-center">
                      <input
                        type="radio"
                        value={provider}
                        checked={formData.provider === provider}
                        onChange={(e) => updateFormData('provider', e.target.value)}
                        className="mr-1"
                      />
                      <span className="text-sm capitalize">{provider}</span>
                    </label>
                  ))}
                </div>
              </div>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => updateFormData('apiKey', e.target.value)}
                placeholder={`Your ${formData.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key (not stored)`}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            {/* Template Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PowerPoint Template (Optional)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500 text-center px-2">
                      {formData.templateFile 
                        ? `✓ ${formData.templateFile.name}`
                        : 'Upload .pptx or .potx template'
                      }
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pptx,.potx"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {isGenerating ? (
                <>
                  <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Presentation...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Generate Presentation
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Your API key is never stored. Processing happens in your browser.</p>
        </div>
      </div>
    </div>
  );
}

export default App;