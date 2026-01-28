import { useState, useCallback, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { RulesConfig } from './components/RulesConfig';
import { Dashboard } from './components/Dashboard';
import { PreviewTable } from './components/PreviewTable';
import { ProgressBar } from './components/ProgressBar';
import { readExcelFile, processData, exportToExcel } from './services/excelProcessor';
import type { CleansingConfig, ColumnMapping, PrescriptionRules, ImmunityRules, ExemptionRules, IncompleteRules, CleansingResult } from './types';
import { Loader2, Download, Sparkles } from 'lucide-react';
import './index.css';

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

interface ProcessResult {
  summary: CleansingResult;
  preview: Record<string, unknown>[];
}

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
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  // Store raw data for processing/export
  const rawDataRef = useRef<Record<string, unknown>[]>([]);
  const processedDataRef = useRef<Record<string, unknown>[]>([]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setColumns([]);
    setMapping(DEFAULT_MAPPING);
    setProgress(0);
    setProgressStatus('Lendo arquivo...');
    setIsLoading(true);

    try {
      const { columns: cols, data } = await readExcelFile(selectedFile);
      setColumns(cols);
      rawDataRef.current = data;
      setProgressStatus('');
    } catch (err) {
      setError('Erro ao ler arquivo. Verifique se é um arquivo Excel válido.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setColumns([]);
    setMapping(DEFAULT_MAPPING);
    setResult(null);
    setError(null);
    rawDataRef.current = [];
    processedDataRef.current = [];
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || rawDataRef.current.length === 0) return;

    // Validate mapping
    if (!mapping.debt_id || !mapping.taxpayer_name || !mapping.due_date || !mapping.amount) {
      setError('Por favor, mapeie todos os campos obrigatórios.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setProgressStatus('Iniciando processamento...');

    try {
      const config: CleansingConfig = {
        mapping,
        prescription,
        immunity,
        exemption,
        incomplete,
      };

      // Use setTimeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 50));

      const processResult = processData(
        rawDataRef.current,
        config,
        (prog, status) => {
          setProgress(prog);
          setProgressStatus(status);
        }
      );

      processedDataRef.current = processResult.processedData;

      setResult({
        summary: processResult.summary,
        preview: processResult.preview,
      });

      await new Promise(r => setTimeout(r, 500));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar arquivo.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [file, mapping, prescription, immunity, exemption, incomplete]);

  const handleExport = useCallback(async () => {
    if (!file || processedDataRef.current.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      const filename = `higienizado_${file.name.replace(/\.[^/.]+$/, '')}.xlsx`;
      exportToExcel(processedDataRef.current, filename);
    } catch (err: unknown) {
      setError('Erro ao exportar arquivo.');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }, [file]);

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
            isLoading={isLoading && columns.length === 0}
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
