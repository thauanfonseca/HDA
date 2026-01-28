import { motion } from 'framer-motion';

interface ProgressBarProps {
    progress: number;
    status: string;
}

export function ProgressBar({ progress, status }: ProgressBarProps) {
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="mb-2 flex justify-between text-sm">
                <span className="text-gray-400">{status}</span>
                <span className="text-primary-400 font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                />
            </div>
            <div className="mt-2 flex justify-center">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                    Processando na nuvem...
                </div>
            </div>
        </div>
    );
}
