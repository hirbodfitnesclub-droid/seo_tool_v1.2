import React from 'react';
import { Button } from './ui/Button';
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, Zap, Brain } from 'lucide-react';
import { motion } from 'motion/react';

interface QueueProgressProps {
  current: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  error: string | null;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
}

export const QueueProgress: React.FC<QueueProgressProps> = ({
  current, total, status, error, onPause, onResume, onRetry
}) => {
  const percentage = Math.round((current / total) * 100) || 0;

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gray-950 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gray-200 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full -mr-32 -mt-32 blur-[100px] opacity-20" />
      
      <div className="relative z-10 space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
             <div className={`p-4 rounded-2xl ${status === 'processing' ? 'bg-blue-600 animate-pulse' : 'bg-gray-800'}`}>
                {status === 'processing' ? <Brain size={24} /> : <Zap size={24} />}
             </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">پردازش هوشمند لینک‌های داخلی</h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                   فاز {current} از {total} — {percentage}٪ پوشش داده شده
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            {status === 'processing' && (
              <Button onClick={onPause} className="bg-white/10 hover:bg-white/20 border-white/10 rounded-2xl p-4">
                <Pause size={20} />
              </Button>
            )}
            {status === 'paused' && (
              <Button onClick={onResume} className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl p-4">
                <Play size={20} />
              </Button>
            )}
            {(status === 'failed' || status === 'completed') && (
              <Button onClick={onRetry} className="bg-white/10 hover:bg-white/20 border-white/10 rounded-2xl px-6">
                <RefreshCw size={18} className="ml-2" />
                <span className="font-bold">شروع مجدد عملیات</span>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
           <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                className={`h-full rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)] ${status === 'failed' ? 'bg-red-500 shadow-red-500/50' : 'bg-blue-500'}`}
              />
           </div>
           
           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
              <span>آماده‌سازی اولیه</span>
              <span>تحلیل یادگیری ماشین</span>
              <span>آماده بهره‌برداری سئو</span>
           </div>
        </div>

        {status === 'failed' && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-start gap-4 p-5 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-400"
          >
            <AlertCircle size={20} className="shrink-0" />
            <div>
               <p className="font-bold text-sm">خطای بحرانی در تحلیل</p>
               <p className="text-xs opacity-70 mt-1">{error || 'ارتباط با پردازشگر قطع شده است. لطفاً وضعیت اینترنت و کلید API را بررسی کنید.'}</p>
            </div>
          </motion.div>
        )}

        {status === 'completed' && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-emerald-400"
          >
            <CheckCircle size={20} className="shrink-0" />
            <div>
               <p className="font-bold text-sm">بهینه‌سازی با موفقیت پایان یافت</p>
               <p className="text-xs opacity-70 mt-1">تمام صفحات با موفقیت پردازش شدند. اکنون می‌توانید خروجی سئو را دریافت کنید.</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
