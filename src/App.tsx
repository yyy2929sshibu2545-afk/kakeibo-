/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ReceiptItem = {
  name: string;
  price: number;
  category: "food" | "daily";
  owner: "common" | "yoshiya" | "rin";
};

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
      setResultJson(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
      setResultJson(null);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseReceipt = async () => {
    if (!imageFile && !memo.trim()) {
      setError("レシート画像を選択するか、テキストを入力してください。");
      return;
    }

    setIsParsing(true);
    setError(null);
    setResultJson(null);
    setChatMessage(null);

    try {
      if (imageFile) {
        // Get base64 string
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          // Split data:image/png;base64,.....
          const [meta, data] = base64String.split(',');
          const mimeType = meta.split(':')[1].split(';')[0];
          await submitData(data, mimeType, memo);
        };
      } else {
        await submitData(undefined, undefined, memo);
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました。もう一度お試しください。');
      setIsParsing(false);
    }
  };

  const submitData = async (imageBase64?: string, mimeType?: string, memoText?: string) => {
    try {
      const response = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          memo: memoText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process request');
      }

      const dataJson = await response.json();
      if (dataJson.type === 'json') {
        setResultJson(JSON.stringify(dataJson.content, null, 2));
      } else {
        setChatMessage(dataJson.content);
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-slate-800 font-sans selection:bg-orange-200 selection:text-slate-900 pb-24 flex flex-col">
      <header className="bg-white border-b border-orange-100 sticky top-0 z-10 shrink-0">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-400 rounded-xl flex items-center justify-center text-white font-bold text-2xl">Y</div>
            <div className="w-10 h-10 bg-rose-400 rounded-xl flex items-center justify-center text-white font-bold text-2xl -ml-6 border-4 border-white">R</div>
            <h1 className="text-xl font-bold tracking-tight text-orange-900 ml-2">
              よしや & りんの家計簿
            </h1>
          </div>
          <div className="text-sm text-slate-500 font-medium hidden sm:block">レシート仕分けアシスタント</div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-6 mt-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-orange-100">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">
                1. レシート画像
              </h2>
              
              <div 
                className={`relative border-2 border-dashed rounded-2xl overflow-hidden transition-colors ${
                  imagePreview 
                    ? 'border-transparent bg-orange-50/50' 
                    : 'border-orange-200 bg-white hover:border-orange-300'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  ref={fileInputRef}
                  id="receipt-upload"
                />
                
                <AnimatePresence mode="wait">
                  {imagePreview ? (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative w-full aspect-[3/4] group"
                    >
                      <img 
                        src={imagePreview} 
                        alt="Receipt preview" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={clearImage}
                          className="bg-white text-red-500 rounded-full p-2 shadow-lg hover:scale-105 transition-transform"
                          title="画像を削除"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="upload-prompt"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <label 
                        htmlFor="receipt-upload"
                        className="flex flex-col items-center justify-center w-full aspect-[3/4] cursor-pointer text-center px-6"
                      >
                        <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4 text-orange-400">
                          <UploadCloud size={32} strokeWidth={1.5} />
                        </div>
                        <p className="text-slate-700 font-bold mb-2">クリックまたはドラッグ＆ドロップ</p>
                        <p className="text-xs text-slate-400 font-medium">対応形式: JPG, PNGなど</p>
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            <section className="bg-white rounded-3xl p-6 shadow-sm border border-orange-100">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4 flex items-center gap-2">
                2. 補足メモ <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded uppercase text-slate-500">任意</span>
              </h2>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例: 「お茶はりん」「洗剤はよしや」など"
                className="w-full h-32 p-4 bg-orange-50/30 border border-orange-100 rounded-2xl outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all resize-none shadow-sm text-sm"
              />
            </section>

            <button
              onClick={parseReceipt}
              disabled={(!imageFile && !memo.trim()) || isParsing}
              className={`w-full py-4 rounded-2xl font-bold tracking-wide transition-all flex justify-center items-center gap-2 ${
                (!imageFile && !memo.trim()) 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : isParsing
                    ? 'bg-orange-400 text-white opacity-90 cursor-wait'
                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-200'
              }`}
            >
              {isParsing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  処理中...
                </>
              ) : (
                '送信する'
              )}
            </button>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm shadow-sm font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="lg:col-span-3 flex flex-col h-full min-h-[600px]">
            <div className="bg-slate-800 rounded-3xl p-6 text-white h-full relative overflow-hidden flex flex-col shadow-xl border border-slate-700/50">
              <div className="relative z-10 flex-1 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6 opacity-80">
                  <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2">
                    <FileText size={16} />
                    OUTPUT
                  </h2>
                </div>

                {!resultJson && !isParsing && !chatMessage && (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <ImageIcon size={48} strokeWidth={1.5} className="opacity-50" />
                    <p className="text-sm font-medium tracking-wide">No data to display</p>
                  </div>
                )}

                {isParsing && (
                  <div className="flex-1 flex flex-col items-center justify-center text-white space-y-6">
                    <div className="w-12 h-12 border-4 border-white/10 border-t-orange-400 rounded-full animate-spin"></div>
                    <p className="text-sm font-medium tracking-wide animate-pulse text-white/70">AIが処理しています...</p>
                  </div>
                )}

                {chatMessage && !isParsing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 relative overflow-hidden"
                  >
                    <div className="bg-white/10 rounded-2xl p-6 text-white text-sm leading-relaxed border border-white/5 backdrop-blur-sm h-full overflow-y-auto">
                      {chatMessage}
                    </div>
                  </motion.div>
                )}

                {resultJson && !isParsing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 relative overflow-hidden"
                  >
                    <pre className="font-mono text-[13px] text-orange-50/90 whitespace-pre-wrap break-all leading-relaxed h-full overflow-y-auto pr-2 pb-4">
                      {resultJson}
                    </pre>
                    
                    <button 
                      onClick={() => navigator.clipboard.writeText(resultJson)}
                      className="absolute top-0 right-0 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-colors backdrop-blur-md"
                    >
                      COPY
                    </button>
                  </motion.div>
                )}
              </div>
              <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-orange-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

