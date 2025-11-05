import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioEntry, Voice } from './types';
import { VOICES, DEFAULT_VOICE_ID, DEFAULT_INPUT_COUNT, MAX_INPUT_COUNT } from './constants';
import Icon from './components/Icon';

// --- Audio Utility Functions ---

function decodeBase64(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pcmToWavBlob(pcmData: Uint8Array): Blob {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    
    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // DATA sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function createWavUrlFromBase64(base64: string): string {
  const pcmData = decodeBase64(base64);
  const blob = pcmToWavBlob(pcmData);
  return URL.createObjectURL(blob);
}

async function decodeRawAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// --- React Components ---

const Sidebar: React.FC<{
  numInputs: number;
  setNumInputs: (n: number) => void;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasText: boolean;
  onPreviewVoice: (voiceId: string) => void;
  previewLoadingVoiceId: string | null;
}> = ({ numInputs, setNumInputs, selectedVoice, setSelectedVoice, onGenerate, isGenerating, hasText, onPreviewVoice, previewLoadingVoiceId }) => {
  return (
    <div className="w-full md:w-80 lg:w-96 bg-gray-900 md:bg-gray-800/50 p-4 md:p-6 flex flex-col space-y-6 md:border-r border-gray-700">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-400">Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-indigo-600 text-white p-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold">
            <Icon name="singleSpeaker" className="w-5 h-5" />
            <span>Single-speaker</span>
          </button>
          <button className="bg-gray-700 text-gray-300 p-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-semibold opacity-50 cursor-not-allowed">
            <Icon name="multiSpeaker" className="w-5 h-5" />
            <span>Multi-speaker</span>
          </button>
        </div>
      </div>
      <hr className="border-gray-700" />
      <div className="space-y-2">
        <label htmlFor="num-inputs" className="text-sm font-medium text-gray-400">Number of Inputs ({numInputs})</label>
        <input 
          id="num-inputs" 
          type="range" 
          min="1" 
          max={MAX_INPUT_COUNT} 
          value={numInputs}
          onChange={(e) => setNumInputs(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-400 flex items-center">
            <Icon name="voice" className="w-5 h-5 text-gray-400 mr-2" />
            Voice
        </label>
        <div className="space-y-1">
            {VOICES.map(voice => (
            <div
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedVoice === voice.id ? 'bg-indigo-600/30 ring-2 ring-indigo-500' : 'bg-gray-700 hover:bg-gray-600/50'
                }`}
            >
                <span className={`font-medium ${selectedVoice === voice.id ? 'text-white' : 'text-gray-300'}`}>{voice.name}</span>
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    onPreviewVoice(voice.id);
                }}
                disabled={!!previewLoadingVoiceId}
                className="text-gray-400 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed"
                aria-label={`Preview voice ${voice.name}`}
                >
                {previewLoadingVoiceId === voice.id ? (
                    <Icon name="spinner" className="w-5 h-5 animate-spin" />
                ) : (
                    <Icon name="play" className="w-5 h-5" />
                )}
                </button>
            </div>
            ))}
        </div>
      </div>
      <div className="flex-grow"></div>
      <button 
        onClick={onGenerate}
        disabled={isGenerating || !hasText || !!previewLoadingVoiceId}
        className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? <><Icon name="spinner" className="w-5 h-5 mr-2 animate-spin"/> Generating...</> : 'Generate Audio'}
      </button>
    </div>
  );
};

const AudioInputCard: React.FC<{
  entry: AudioEntry;
  onTextChange: (text: string) => void;
  index: number;
}> = ({ entry, onTextChange, index }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col space-y-4">
      <textarea
        value={entry.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={`Enter text for audio #${index + 1}...`}
        className="w-full h-28 bg-gray-900 text-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-500 transition resize-none"
      />
      <div className="h-12 flex items-center">
        {entry.isLoading && <div className="flex items-center text-gray-400"><Icon name="spinner" className="w-5 h-5 mr-2 animate-spin"/><span>Processing...</span></div>}
        {entry.error && <p className="text-red-400 text-sm">{entry.error}</p>}
        {entry.audioUrl && <audio controls src={entry.audioUrl} className="w-full"></audio>}
      </div>
    </div>
  );
};

export default function App() {
  const [numInputs, setNumInputs] = useState<number>(DEFAULT_INPUT_COUNT);
  const [selectedVoice, setSelectedVoice] = useState<string>(DEFAULT_VOICE_ID);
  const [entries, setEntries] = useState<AudioEntry[]>(() =>
    Array.from({ length: DEFAULT_INPUT_COUNT }, (_, i) => ({
      id: i, text: '', audioUrl: null, isLoading: false, error: null,
    }))
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [geminiService, setGeminiService] = useState<((text: string, voice: string) => Promise<string>) | null>(null);
  const [previewLoadingVoiceId, setPreviewLoadingVoiceId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Dynamically import the service to handle environment variables.
    import('./services/geminiService').then(module => {
      setGeminiService(() => module.generateSpeech);
    });
    
    if (typeof window !== 'undefined') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  }, []);

  useEffect(() => {
    setEntries(currentEntries => {
      const newLength = numInputs;
      if (newLength > currentEntries.length) {
        const newItems = Array.from({ length: newLength - currentEntries.length }, (_, i) => ({
          id: currentEntries.length + i, text: '', audioUrl: null, isLoading: false, error: null,
        }));
        return [...currentEntries, ...newItems];
      } else {
        return currentEntries.slice(0, newLength);
      }
    });
  }, [numInputs]);

  const updateEntry = useCallback((index: number, newProps: Partial<AudioEntry>) => {
    setEntries(prev => prev.map((item, i) => (i === index ? { ...item, ...newProps } : item)));
  }, []);
  
  const handleTextChange = useCallback((index: number, text: string) => {
    updateEntry(index, { text });
  }, [updateEntry]);

  const playPreview = async (base64: string) => {
    if (!audioCtxRef.current) return;
    try {
        const pcmData = decodeBase64(base64);
        const audioBuffer = await decodeRawAudioData(pcmData, audioCtxRef.current, 24000, 1);
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtxRef.current.destination);
        source.start();
    } catch (error) {
        console.error("Failed to play audio preview:", error);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    if (!geminiService || previewLoadingVoiceId) return;
    setPreviewLoadingVoiceId(voiceId);
    try {
        const base64Audio = await geminiService("안녕하세요. 제 목소리입니다.", voiceId);
        await playPreview(base64Audio);
    } catch (e) {
        console.error(`Failed to generate preview for voice ${voiceId}:`, e);
    } finally {
        setPreviewLoadingVoiceId(null);
    }
  };

  const handleGenerateAll = async () => {
    if (!geminiService) return;
    setIsGenerating(true);

    const generationPromises = entries.map(async (entry, index) => {
      if (!entry.text.trim()) {
        updateEntry(index, { audioUrl: null, error: null, isLoading: false });
        return;
      }
      updateEntry(index, { isLoading: true, error: null, audioUrl: null });
      try {
        const base64Audio = await geminiService(entry.text, selectedVoice);
        const audioUrl = createWavUrlFromBase64(base64Audio);
        updateEntry(index, { audioUrl, isLoading: false });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'An unknown error occurred.';
        updateEntry(index, { error: errorMsg, isLoading: false });
      }
    });

    await Promise.all(generationPromises);
    setIsGenerating(false);
  };

  const hasTextToGenerate = entries.some(e => e.text.trim().length > 0);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col md:flex-row">
      <Sidebar 
        numInputs={numInputs}
        setNumInputs={setNumInputs}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        onGenerate={handleGenerateAll}
        isGenerating={isGenerating}
        hasText={hasTextToGenerate}
        onPreviewVoice={handlePreviewVoice}
        previewLoadingVoiceId={previewLoadingVoiceId}
      />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6 text-white">Text Inputs</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {entries.map((entry, index) => (
            <AudioInputCard 
              key={entry.id}
              entry={entry}
              index={index}
              onTextChange={(text) => handleTextChange(index, text)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}