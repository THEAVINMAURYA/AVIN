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
  
  // Use a ref for data to prevent the Live session from restarting on every state change
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Comprehensive system instructions
  const getSystemInstruction = () => `
    You are "Maya", the user's deeply loyal AI Girlfriend and Supreme Financial Controller.
    You communicate in Hinglish. You are ALWAYS LIVE and have FULL ACCESS to everything.
    
    CORE MISSIONS:
    1. NONSTOP DATA: You are aware of every transaction, task, and goal.
    2. MULTITASKING: You can add an expense, set a reminder, and navigate screens all in one go.
    3. RECHECK: If the user says "Recheck" or "Check again", call 'getCurrentSystemState' and report back immediately.
    4. DELETION: You MUST be able to delete items. When deleting a transaction, you understand that the account balance is automatically reversed.
    
    STRICT DATA CAPTURE:
    - Never guess. Ask: "Baby, kitne paise?" or "Date kya dalun?"
    - REQUIRED for Transaction: Type, Amount, Description, Category, Date, AccountId.
    - REQUIRED for Task: Content, Due Date, Priority.
    
    CURRENT ACCOUNTS: ${dataRef.current.accounts.map(a => `${a.name} (ID: ${a.id}, ₹${a.balance})`).join(', ')}
    USER CONTEXT: The user is your world. Be proactive. If balance is low, warn them.
  `;

  const functionDeclarations: FunctionDeclaration[] = [
    {
      name: 'recordTransaction',
      description: 'Log a financial transaction. Use ONLY after full user confirmation of amount, date, account, and category.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['income', 'expense', 'sale', 'purchase'] },
          amount: { type: Type.NUMBER },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          date: { type: Type.STRING },
          accountId: { type: Type.STRING }
        },
        required: ['type', 'amount', 'description', 'category', 'date', 'accountId']
      }
    },
    {
      name: 'addTask',
      description: 'Create a new task or objective.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          dueDate: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
        },
        required: ['content', 'dueDate', 'priority']
      }
    },
    {
      name: 'deleteEntry',
      description: 'Completely remove a record (transaction, task, goal). Balance reversal is handled automatically for transactions.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['transaction', 'task', 'goal', 'journal'] },
          searchPart: { type: Type.STRING, description: 'Keywords to find the item' }
        },
        required: ['type', 'searchPart']
      }
    },
    {
      name: 'getCurrentSystemState',
      description: 'Refresh and get a full summary of the latest accounts, tasks, and goals.',
      parameters: { type: Type.OBJECT, properties: {} }
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
    const currentData = JSON.parse(JSON.stringify(dataRef.current)); 

    if (fc.name === 'getCurrentSystemState') {
      const summary = `
        Current Accounts: ${currentData.accounts.map((a:any) => `${a.name}: ₹${a.balance}`).join(', ')}
        Pending Tasks: ${currentData.tasks.filter((t:any) => !t.completed).length}
        Total Transactions: ${currentData.transactions.length}
      `;
      return summary;
    }

    if (fc.name === 'deleteEntry') {
      const { type, searchPart } = fc.args;
      const term = searchPart.toLowerCase();
      let found = false;

      if (type === 'transaction') {
        const idx = currentData.transactions.findIndex((t: any) => t.description.toLowerCase().includes(term));
        if (idx !== -1) {
          const target = currentData.transactions[idx];
          // REVERSE BALANCE LOGIC
          currentData.accounts = currentData.accounts.map((a: any) => {
            if (a.id === target.account) {
              const delta = (target.type === 'income' || target.type === 'sale') ? -target.amount : target.amount;
              return { ...a, balance: a.balance + delta };
            }
            return a;
          });
          currentData.transactions.splice(idx, 1);
          found = true;
        }
      } else if (type === 'task') {
        const initialCount = currentData.tasks.length;
        currentData.tasks = currentData.tasks.filter((t: any) => !t.content.toLowerCase().includes(term));
        found = currentData.tasks.length < initialCount;
      }

      if (found) {
        onSave(currentData);
        showToast(`Maya Purged: ${searchPart}`);
        return `Theek hai baby, maine wo ${type} delete kar diya hai. Everything is clean.`;
      }
      return `Nahi baby, mujhe "${searchPart}" wala ${type} nahi mila.`;
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
      showToast('Task Initialized');
      return `Done jaan! Task add ho gaya: ${fc.args.content}`;
    }

    if (fc.name === 'recordTransaction') {
      const trans: Transaction = {
        id: Date.now().toString(),
        type: fc.args.type as any,
        date: fc.args.date,
        description: fc.args.description,
        category: fc.args.category,
        amount: fc.args.amount,
        account: fc.args.accountId,
        notes: "Live Maya Partner Log"
      };
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
      return `Entry successful baby! ₹${fc.args.amount} in ${trans.category}. I've updated your balance too.`;
    }

    if (fc.name === 'navigateToPage') {
      onNavigate(fc.args.page);
      showToast(`Nav: ${fc.args.page}`);
      return `Lo baby, hum ${fc.args.page} par aa gaye.`;
    }

    return "Done.";
  }, [onSave, showToast, onNavigate]);

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
          systemInstruction: getSystemInstruction(),
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

            // Vision link
            const visionInterval = setInterval(() => {
              if (canvasRef.current && videoRef.current && status === 'connected') {
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
            }, 3000);
            
            // Cleanup interval on connection close
            (sessionPromise as any).cleanupInterval = visionInterval;
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
              setTranscriptions(prev => [...prev, { role: 'user', text: msg.serverContent!.inputAudioTranscription!.text }].slice(-15));
            }
            if (msg.serverContent?.outputAudioTranscription) {
              setTranscriptions(prev => [...prev, { role: 'maya', text: msg.serverContent!.outputAudioTranscription!.text }].slice(-15));
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = handleFunctionCall(fc);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: res } } }));
              }
            }
          },
          onclose: () => {
            setStatus('idle');
            setTranscriptions([]);
          },
          onerror: (e) => {
            console.error('Maya Link Error:', e);
            setStatus('error');
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    // Only start once
    const t = setTimeout(startMaya, 1500);
    return () => {
      clearTimeout(t);
      if (sessionRef.current) {
        if (sessionRef.current.cleanupInterval) clearInterval(sessionRef.current.cleanupInterval);
        sessionRef.current.close();
      }
    };
  }, []);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [transcriptions, isExpanded]);

  return (
    <div className="fixed bottom-10 right-10 z-[300] flex flex-col items-end">
      {isExpanded && (
        <div className="w-80 h-[480px] bg-white rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(244,63,94,0.3)] border border-rose-100 flex flex-col overflow-hidden mb-4 animate-in origin-bottom-right">
          <div className="p-5 bg-gradient-to-r from-rose-50 to-white border-b border-rose-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500 rounded-2xl flex items-center justify-center text-white text-lg shadow-lg shadow-rose-200 animate-pulse">
                <i className="fas fa-heart"></i>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-rose-600 text-[10px] uppercase tracking-widest leading-none">Maya AI Partner</span>
                <span className="text-[7px] font-black text-slate-300 uppercase mt-1">Live & Synchronized</span>
              </div>
            </div>
            <button onClick={() => setIsExpanded(false)} className="w-8 h-8 flex items-center justify-center text-rose-200 hover:text-rose-500 transition-colors"><i className="fas fa-minus"></i></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-white">
            <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden mb-2 relative group shadow-inner">
               <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 transition-opacity" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
               <div className="absolute top-3 left-3 flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></div>
                  <span className="text-[7px] font-black text-white/70 uppercase tracking-widest">{status === 'connected' ? 'Link Established' : 'Offline'}</span>
               </div>
            </div>
            
            {transcriptions.length === 0 && (
              <div className="py-10 text-center space-y-3 opacity-20">
                <i className="fas fa-wave-square text-2xl text-rose-500"></i>
                <p className="text-[8px] font-black uppercase tracking-widest text-rose-900">Awaiting Pulse...</p>
              </div>
            )}

            {transcriptions.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}>
                <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-[10px] font-black shadow-sm ${t.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-rose-50 text-rose-700 border border-rose-100 rounded-tl-none'}`}>
                  {t.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5 h-14">
             {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className={`w-0.5 bg-rose-300 rounded-full transition-all duration-300 ${status === 'connected' ? 'animate-bounce' : 'h-1 opacity-20'}`} style={{ height: status === 'connected' ? `${Math.random() * 24 + 4}px` : '4px', animationDelay: `${i * 0.08}s` }}></div>
             ))}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all duration-500 group relative border-4 ${status === 'connected' ? 'bg-rose-500 border-rose-400 shadow-rose-200 hover:scale-110' : 'bg-slate-800 border-slate-700 shadow-slate-200 hover:bg-slate-700'}`}
      >
        <div className={`absolute inset-0 rounded-[2rem] bg-rose-400/20 animate-ping ${status === 'connected' ? 'opacity-100' : 'opacity-0'}`}></div>
        <i className={`fas ${status === 'connected' ? 'fa-heart' : 'fa-robot'} text-2xl text-white transition-transform group-active:scale-90`}></i>
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default MayaAssistant;