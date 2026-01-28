import { useState, useCallback } from 'react';
import axios from 'axios';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { RulesConfig } from './components/RulesConfig';
import { Dashboard } from './components/Dashboard';
import { PreviewTable } from './components/PreviewTable';
import { ProgressBar } from './components/ProgressBar';
import type { CleansingConfig, ColumnMapping, PrescriptionRules, ImmunityRules, ExemptionRules, IncompleteRules, ProcessResponse } from './types';
import { Loader2, Download, Sparkles } from 'lucide-react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : '/api');

const DEFAULT_MAPPING: ColumnMapping = {
  debt_id: '',
  taxpayer_name: '',
  due_date: '',
  amount: '',
};

const DEFAULT_PRESCRIPTION: PrescriptionRules = {
  enabled: true,
  years: 5,
};

const DEFAULT_IMMUNITY: ImmunityRules = {
  enabled: true,
  keywords: ['UNIÃO', 'ESTADO', 'MUNICIPIO', 'TEMPLO', 'PARTIDO', 'SINDICATO', 'AUTARQUIA', 'FUNDAÇÃO'],
};

const DEFAULT_EXEMPTION: ExemptionRules = {
  enabled: true,
  amount_threshold: 0,
  tributes: [],
};

const DEFAULT_INCOMPLETE: IncompleteRules = {
  enabled: true,
  keywords: ['IGNORADO', 'NÃO INFORMADO', 'DESCONHECIDO', 'SEM NOME'],
  check_cpf_cnpj: true,
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [prescription, setPrescription] = useState<PrescriptionRules>(DEFAULT_PRESCRIPTION);
  const [immunity, setImmunity] = useState<ImmunityRules>(DEFAULT_IMMUNITY);
  const [exemption, setExemption] = useState<ExemptionRules>(DEFAULT_EXEMPTION);
  const [incomplete, setIncomplete] = useState<IncompleteRules>(DEFAULT_INCOMPLETE);

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setColumns([]);
    setMapping(DEFAULT_MAPPING);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API_URL}/analyze-headers`, formData);
      setColumns(response.data.columns);
    } catch (err) {
      setError('Erro ao ler cabeçalhos do arquivo. Verifique se o backend está rodando.');
      console.error(err);
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setColumns([]);
    setMapping(DEFAULT_MAPPING);
    setResult(null);
    setError(null);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) return;

    // Validate mapping
    if (!mapping.debt_id || !mapping.taxpayer_name || !mapping.due_date || !mapping.amount) {
      setError('Por favor, mapeie todos os campos obrigatórios.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setProgressStatus('Enviando arquivo...');

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + 5;
        if (prev < 60) return prev + 2;
        if (prev < 85) return prev + 1;
        return prev;
      });
    }, 300);

    try {
      setProgressStatus('Processando dados...');
      const config: CleansingConfig = {
        mapping,
        prescription,
        immunity,
        exemption,
        incomplete,
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('config', JSON.stringify(config));

      const response = await axios.post<ProcessResponse>(`${API_URL}/process`, formData);
      setProgress(100);
      setProgressStatus('Concluído!');
      await new Promise(r => setTimeout(r, 500));
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao processar arquivo.');
      console.error(err);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setProgress(0);
    }
  }, [file, mapping, prescription, immunity, exemption, incomplete]);

  const handleExport = useCallback(async () => {
    if (!file) return;

    setIsExporting(true);
    setError(null);

    try {
      const config: CleansingConfig = {
        mapping,
        prescription,
        immunity,
        exemption,
        incomplete,
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('config', JSON.stringify(config));

      const response = await axios.post(`${API_URL}/export`, formData, {
        responseType: 'blob',
      });

      // Trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `higienizado_${file.name}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Erro ao exportar arquivo.');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }, [file, mapping, prescription, immunity, exemption, incomplete]);

  const isMappingValid = mapping.debt_id && mapping.taxpayer_name && mapping.due_date && mapping.amount;

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="glass border-b border-primary-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary-400" />
            <div>
              <h1 className="text-2xl font-bold gradient-text">Higienizador de Dívida Ativa</h1>
              <p className="text-sm text-gray-400">Automatize a análise e limpeza do livro da dívida ativa</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Step 1: File Upload */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">1. Carregar Arquivo</h2>
          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={file}
            onClear={handleClearFile}
            isLoading={isLoading}
          />
        </section>

        {/* Step 2: Column Mapping */}
        {columns.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">2. Mapear Colunas</h2>
            <ColumnMapper
              columns={columns}
              mapping={mapping}
              onChange={setMapping}
            />
          </section>
        )}

        {/* Step 3: Rules Configuration */}
        {columns.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">3. Configurar Regras</h2>
            <RulesConfig
              prescription={prescription}
              immunity={immunity}
              exemption={exemption}
              incomplete={incomplete}
              onPrescriptionChange={setPrescription}
              onImmunityChange={setImmunity}
              onExemptionChange={setExemption}
              onIncompleteChange={setIncomplete}
            />
          </section>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Process Button */}
        {columns.length > 0 && !result && (
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={handleProcess}
              disabled={!isMappingValid || isLoading}
              className="btn-primary flex items-center gap-2 text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Processar Higienização
                </>
              )}
            </button>
            {isLoading && (
              <ProgressBar progress={progress} status={progressStatus} />
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            <Dashboard result={result.summary} />

            <PreviewTable data={result.preview} />

            <div className="flex justify-center gap-4">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="btn-primary flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Baixar Excel Higienizado
                  </>
                )}
              </button>
              <button
                onClick={handleClearFile}
                className="btn-secondary"
              >
                Processar outro arquivo
              </button>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-600 mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          Harrison Leite Advogados Associados © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

export default App;
