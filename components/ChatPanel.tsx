import React, { useState, useEffect, useRef } from 'react';
import { Message, Attachment } from '../types';
import { Mic, Send, Bot, User, Loader2, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (text: string, attachment?: Attachment) => void;
  isLoading: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; previewUrl: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      setAttachment({ file, previewUrl });
    }
  };

  const clearAttachment = () => {
    if (attachment) {
      URL.revokeObjectURL(attachment.previewUrl);
      setAttachment(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isLoading) return;

    let attachmentData: Attachment | undefined = undefined;

    if (attachment) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const data = result.split(',')[1];
            resolve(data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(attachment.file);
        });

        attachmentData = {
          mimeType: attachment.file.type,
          data: base64,
          name: attachment.file.name,
        };
      } catch (error) {
        console.error("Error reading file:", error);
        alert("Failed to process the attached file.");
        return;
      }
    }

    onSendMessage(input, attachmentData);
    setInput('');
    clearAttachment();
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support speech recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] rounded-2xl shadow-xl border border-white/5 overflow-hidden ring-1 ring-white/5">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-[#0f172a] z-10">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot size={18} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-200">Gemini CAD</h2>
          <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            Online
          </p>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-[#020617]/30"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 ring-1 ring-white/5">
               <Bot size={32} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">Start by typing, speaking, or uploading an image.</p>
            <p className="text-xs mt-2 text-slate-600 font-mono bg-white/5 px-2 py-1 rounded">"Create a 10x10 box"</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs shadow-lg border border-white/5
              ${msg.role === 'user' ? 'bg-[#020617] text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-600 text-white'}
            `}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            
            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {msg.attachment && (
                <div className="bg-[#1e293b] border border-white/10 rounded-xl p-2 flex items-center gap-2 max-w-full overflow-hidden">
                   {msg.attachment.mimeType.startsWith('image/') ? (
                     <img 
                       src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} 
                       alt="attachment" 
                       className="max-h-32 rounded-lg object-contain bg-black/20"
                     />
                   ) : (
                     <div className="flex items-center gap-2 text-sm text-slate-300 px-2 py-1">
                       <FileText size={16} />
                       <span className="truncate">{msg.attachment.name || 'Attachment'}</span>
                     </div>
                   )}
                </div>
              )}

              <div className={`
                rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm w-full font-light
                ${msg.role === 'user' 
                  ? 'bg-indigo-600 text-white border border-indigo-500 rounded-tr-none shadow-lg shadow-indigo-900/20' 
                  : 'bg-[#1e293b] text-slate-200 border border-white/5 rounded-tl-none'}
              `}>
                <div className="markdown-body">
                {msg.text.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
                ))}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white border border-white/5">
               <Bot size={14} />
             </div>
             <div className="bg-[#1e293b] px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-white/5">
               <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-[#0f172a] border-t border-white/5 flex flex-col gap-2 relative">
        {attachment && (
          <div className="flex items-center gap-3 bg-[#1e293b] p-2 rounded-lg border border-white/10 self-start animate-in slide-in-from-bottom-2 fade-in">
            {attachment.file.type.startsWith('image/') ? (
              <img src={attachment.previewUrl} alt="Preview" className="h-10 w-10 object-cover rounded bg-black/20" />
            ) : (
              <div className="h-10 w-10 bg-white/5 rounded flex items-center justify-center text-slate-400">
                <FileText size={20} />
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-medium text-slate-200 truncate max-w-[150px]">{attachment.file.name}</span>
              <span className="text-[10px] text-slate-500 uppercase">{attachment.file.type.split('/')[1]}</span>
            </div>
            <button onClick={clearAttachment} className="p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept="image/*,application/pdf"
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-[#1e293b] text-slate-400 hover:text-white hover:bg-[#334155] transition-colors border border-white/5"
            title="Upload Image or PDF"
          >
            <Paperclip size={20} />
          </button>
          
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-3 rounded-xl transition-colors border border-white/5 ${
              isListening ? 'bg-red-500/20 text-red-400 animate-pulse border-red-500/50' : 'bg-[#1e293b] text-slate-400 hover:text-white hover:bg-[#334155]'
            }`}
            title="Use Voice Input"
          >
            <Mic size={20} />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={attachment ? "Describe this file..." : "Describe your design..."}
            className="flex-1 bg-[#020617] text-slate-200 placeholder-slate-600 rounded-xl px-5 py-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:bg-[#050b1d] transition-all border border-white/5"
          />
          
          <button
            type="submit"
            disabled={(!input.trim() && !attachment) || isLoading}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/40 border border-indigo-500/50"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};