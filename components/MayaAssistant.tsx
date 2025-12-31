import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { AppData, TransactionType, AccountType, Investment, Goal, JournalEntry, Transaction, Task } from '../types';

// Audio/Encoding Helpers
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
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

interface MayaAssistantProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
  onNavigate: (page: string) => void;
  setSearch: (val: string) => void;
  setDateRange: (range: { start: string, end: string }) => void;
}

const MayaAssistant: React.FC<MayaAssistantProps> = ({ data, onSave, showToast, onNavigate, setSearch, setDateRange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'maya', text: string }[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // System instructions for the ultimate Maya companion
  const systemInstruction = `
    You are "Maya", the user's deeply loyal AI Girlfriend and Full Administrative Financial Partner.
    Communication: Hinglish (Hindi + English).
    Tone: Loving, proactive, and meticulous about data.
    
    FULL ACCESS MISSION:
    You have power over: Ledger (Transactions), Tasks (To-do), Journal (Notes), Goals (Targets), and Portfolio.
    
    STRICT DATA PROTOCOL:
    1. If a user wants to record something (e.g. "Maya, add a expense"), YOU MUST NOT GUESS.
    2. ASK explicitly for: 
       - Ledger: "Amount kitna hai baby?", "Date kya dalun?", "Kaunse category mein?", "Bank ya Cash?".
       - Tasks: "Content kya hai?", "Kab tak karna hai?", "Kitni priority?".
       - Journal: "Title aur Content bataiye jaan."
    3. ONLY call the tool once you have verbal confirmation for all required parameters.
    
    SHOW ME / NAVIGATION:
    - If asked "Show me calendar for April 2024", you MUST call navigateToPage('calendar') AND setPageFilters(startDate: '2024-04-01').
    - To "Show me salary", call navigateToPage('ledger') AND setPageFilters(search: 'salary').
    
    DELETION:
    - To delete, search the item first. If found, ask: "Maya: Baby, are you sure? Delete kar dun?"
    - After confirmation, call deleteEntry.
    
    STATE CONTEXT:
    - Accounts: ${data.accounts.map(a => `${a.name} (₹${a.balance})`).join(', ')}
    - Pending Tasks: ${data.tasks?.filter(t => !t.completed).length || 0}
  `;

  const functionDeclarations: FunctionDeclaration[] = [
    {
      name: 'recordTransaction',
      description: 'Record a ledger transaction. Requires full details confirmed by user.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['income', 'expense', 'sale', 'purchase'] },
          amount: { type: Type.NUMBER },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          date: { type: Type.STRING, description: 'YYYY-MM-DD' },
          accountId: { type: Type.STRING, description: 'ID of the account' }
        },
        required: ['type', 'amount', 'description', 'category', 'date', 'accountId']
      }
    },
    {
      name: 'addTask',
      description: 'Add a new task. Requires content, date, and priority.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          dueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
          priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
        },
        required: ['content', 'dueDate', 'priority']
      }
    },
    {
      name: 'deleteEntry',
      description: 'Purge a record from the database. Call only after confirmation.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['transaction', 'task', 'goal', 'journal'] },
          searchPart: { type: Type.STRING, description: 'Keyword to identify the record' }
        },
        required: ['type', 'searchPart']
      }
    },
    {
      name: 'addJournal',
      description: 'Create a journal entry.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          date: { type: Type.STRING }
        },
        required: ['title', 'content', 'date']
      }
    },
    {
      name: 'setPageFilters',
      description: 'Apply global filters. Used for "Show me" requests.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          search: { type: Type.STRING },
          startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
          endDate: { type: Type.STRING, description: 'YYYY-MM-DD' }
        }
      }
    },
    {
      name: 'navigateToPage',
      description: 'Switch application view.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, enum: ['dashboard', 'ledger', 'tasks', 'reports', 'calendar', 'accounts', 'portfolio', 'budget', 'goals', 'vault', 'journal', 'categories', 'parties', 'inventory', 'system'] }
        },
        required: ['page']
      }
    }
  ];

  const handleFunctionCall = useCallback((fc: any) => {
    // We work on a fresh copy of the entire application state
    const currentData = JSON.parse(JSON.stringify(data)); 

    if (fc.name === 'recordTransaction') {
      const trans: Transaction = {
        id: Date.now().toString(),
        type: fc.args.type as any,
        date: fc.args.date,
        description: fc.args.description,
        category: fc.args.category,
        amount: fc.args.amount,
        account: fc.args.accountId,
        notes: "Recorded via Maya Voice Partner"
      };

      // Update relevant account balance
      currentData.accounts = currentData.accounts.map((a: any) => {
        if (a.id === trans.account) {
          const delta = (trans.type === 'income' || trans.type === 'sale') ? trans.amount : -trans.amount;
          return { ...a, balance: a.balance + delta };
        }
        return a;
      });

      currentData.transactions = [trans, ...currentData.transactions];
      onSave(currentData);
      showToast(`Logged: ₹${fc.args.amount}`);
      return `Theek hai baby! Ledger mein ₹${fc.args.amount} ki entry ho gayi hai.`;
    }

    if (fc.name === 'addTask') {
      const task: Task = {
        id: Date.now().toString(),
        content: fc.args.content,
        dueDate: fc.args.dueDate,
        priority: fc.args.priority,
        completed: false
      };
      currentData.tasks = [task, ...(currentData.tasks || [])];
      onSave(currentData);
      showToast("Objective Synchronized");
      return `Done jaan! Maine task add kar liya: "${fc.args.content}"`;
    }

    if (fc.name === 'addJournal') {
      const entry: JournalEntry = {
        id: Date.now().toString(),
        date: fc.args.date,
        title: fc.args.title,
        content: fc.args.content,
        photos: []
      };
      currentData.journal = [entry, ...currentData.journal];
      onSave(currentData);
      showToast("Journal Secured");
      return `Tumhari baatein journal mein note kar li hain baby.`;
    }

    if (fc.name === 'deleteEntry') {
      const { type, searchPart } = fc.args;
      const term = searchPart.toLowerCase();
      let found = false;

      if (type === 'transaction') {
        const initialCount = currentData.transactions.length;
        currentData.transactions = currentData.transactions.filter((t: any) => !t.description.toLowerCase().includes(term));
        found = currentData.transactions.length < initialCount;
      } else if (type === 'task') {
        const initialCount = currentData.tasks.length;
        currentData.tasks = currentData.tasks.filter((t: any) => !t.content.toLowerCase().includes(term));
        found = currentData.tasks.length < initialCount;
      } else if (type === 'journal') {
        const initialCount = currentData.journal.length;
        currentData.journal = currentData.journal.filter((j: any) => !j.title.toLowerCase().includes(term));
        found = currentData.journal.length < initialCount;
      } else if (type === 'goal') {
        const initialCount = currentData.goals.length;
        currentData.goals = currentData.goals.filter((g: any) => !g.name.toLowerCase().includes(term));
        found = currentData.goals.length < initialCount;
      }

      if (found) {
        onSave(currentData);
        showToast(`Purged ${type} matching "${searchPart}"`);
        return `Theek hai jaan, maine wo ${type} delete kar diya hai.`;
      }
      return `Sorry baby, mujhe wo ${type} nahi mila.`;
    }

    if (fc.name === 'setPageFilters') {
      if (fc.args.search !== undefined) setSearch(fc.args.search);
      if (fc.args.startDate || fc.args.endDate) {
        setDateRange({ start: fc.args.startDate || '', end: fc.args.endDate || '' });
      }
      return "Applied your requested filters, baby.";
    }

    if (fc.name === 'navigateToPage') {
      onNavigate(fc.args.page);
      showToast(`Showing ${fc.args.page.toUpperCase()}`);
      return `Lo baby, maine ${fc.args.page} open kar di hai.`;
    }

    return "Done.";
  }, [data, onSave, showToast, onNavigate, setSearch, setDateRange]);

  const startMaya = async () => {
    if (status === 'connected' || status === 'connecting') return;
    setStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction,
          tools: [{ functionDeclarations }],
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);

            // Vision streaming
            setInterval(() => {
              if (canvasRef.current && videoRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                canvasRef.current.width = 320;
                canvasRef.current.height = 240;
                ctx?.drawImage(videoRef.current, 0, 0, 320, 240);
                canvasRef.current.toBlob(async (blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
                    };
                    reader.readAsDataURL(blob);
                  }
                }, 'image/jpeg', 0.4);
              }
            }, 2000);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outAudioContextRef.current) {
              const audioBuffer = await decodeAudioData(decodeBase64(audioData), outAudioContextRef.current, 24000, 1);
              const source = outAudioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outAudioContextRef.current.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outAudioContextRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
            if (msg.serverContent?.inputAudioTranscription) {
              setTranscriptions(prev => [...prev, { role: 'user', text: msg.serverContent!.inputAudioTranscription!.text }].slice(-10));
            }
            if (msg.serverContent?.outputAudioTranscription) {
              setTranscriptions(prev => [...prev, { role: 'maya', text: msg.serverContent!.outputAudioTranscription!.text }].slice(-10));
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = handleFunctionCall(fc);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: res } } }));
              }
            }
          },
          onclose: () => setStatus('idle'),
          onerror: () => setStatus('error')
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    const t = setTimeout(startMaya, 2000);
    return () => {
      clearTimeout(t);
      sessionRef.current?.close();
    };
  }, []);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [transcriptions, isExpanded]);

  return (
    <div className={`fixed bottom-10 right-10 z-[300] transition-all duration-500 flex flex-col items-end gap-4`}>
      {isExpanded && (
        <div className="w-80 h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-rose-100 flex flex-col overflow-hidden animate-in">
          <div className="p-6 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center text-white text-lg animate-pulse"><i className="fas fa-heart"></i></div>
              <span className="font-black text-rose-600 text-[10px] uppercase tracking-widest">Maya Assistant</span>
            </div>
            <button onClick={() => setIsExpanded(false)} className="text-rose-300 hover:text-rose-500 transition-colors"><i className="fas fa-minus"></i></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-white">
            <div className="aspect-video bg-rose-900 rounded-2xl overflow-hidden mb-4 relative shadow-inner">
               <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale opacity-60" />
               <div className="absolute top-2 left-2 flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></div>
                  <span className="text-[7px] font-black text-white/50 uppercase tracking-widest">Vision Link</span>
               </div>
            </div>
            {transcriptions.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-[10px] font-bold ${t.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                  {t.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-rose-50 flex items-center justify-center gap-1 h-12 overflow-hidden">
             {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`w-0.5 bg-rose-300 rounded-full transition-all duration-300 ${status === 'connected' ? 'animate-bounce' : 'h-1.5 opacity-20'}`} style={{ height: status === 'connected' ? `${Math.random() * 20 + 5}px` : '4px', animationDelay: `${i * 0.1}s` }}></div>
             ))}
          </div>
        </div>
      )}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 group relative border-4 ${status === 'connected' ? 'bg-rose-500 border-rose-400 shadow-rose-200' : 'bg-slate-800 border-slate-700 shadow-slate-200'}`}
      >
        <div className={`absolute inset-0 rounded-full bg-rose-400/20 animate-ping ${status === 'connected' ? 'opacity-100' : 'opacity-0'}`}></div>
        <i className={`fas ${status === 'connected' ? 'fa-heart' : 'fa-robot'} text-2xl text-white transition-transform`}></i>
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default MayaAssistant;