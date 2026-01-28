import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
    onClear: () => void;
    isLoading?: boolean;
}

export function FileUpload({ onFileSelect, selectedFile, onClear, isLoading }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            onFileSelect(file);
        }
    }, [onFileSelect]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelect(file);
        }
    }, [onFileSelect]);

    if (selectedFile) {
        return (
            <div className="card flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-500/20 rounded-lg">
                        <FileSpreadsheet className="w-8 h-8 text-primary-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-400">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClear}
                    disabled={isLoading}
                    className="p-2 hover:bg-dark-500 rounded-lg transition-colors disabled:opacity-50"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>
        );
    }

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={clsx(
                'relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer',
                isDragging
                    ? 'border-primary-500 bg-primary-500/10 glow-purple'
                    : 'border-dark-500 hover:border-primary-500/50 hover:bg-dark-700/50'
            )}
        >
            <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className={clsx(
                'w-12 h-12 mx-auto mb-4 transition-colors',
                isDragging ? 'text-primary-400' : 'text-gray-500'
            )} />
            <p className="text-lg font-medium text-white mb-2">
                Arraste o arquivo Excel aqui
            </p>
            <p className="text-gray-400">
                ou clique para selecionar (.xlsx, .xls)
            </p>
        </div>
    );
}
