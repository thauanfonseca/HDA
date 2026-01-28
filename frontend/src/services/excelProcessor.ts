import * as XLSX from 'xlsx';
import type { CleansingConfig, CleansingResult } from '../types';

export interface ProcessResult {
    summary: CleansingResult;
    preview: Record<string, unknown>[];
    processedData: Record<string, unknown>[];
}

// Parse date from various formats
function parseDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) return value;

    if (typeof value === 'number') {
        // Excel serial date
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            return new Date(date.y, date.m - 1, date.d);
        }
    }

    if (typeof value === 'string') {
        // Try common formats
        const formats = [
            /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
            /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
            /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
        ];

        for (const format of formats) {
            const match = value.match(format);
            if (match) {
                if (format === formats[0] || format === formats[2]) {
                    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                } else {
                    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                }
            }
        }
    }

    return null;
}

// Parse amount from various formats
function parseAmount(value: unknown): number {
    if (!value) return 0;

    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
        let cleaned = value.replace(/R\$\s*/g, '').trim();

        // Handle Brazilian format: 1.234,56
        if (cleaned.includes(',') && cleaned.includes('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (cleaned.includes(',')) {
            cleaned = cleaned.replace(',', '.');
        }

        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }

    return 0;
}

// Read Excel file and return data
export async function readExcelFile(file: File): Promise<{ columns: string[]; data: Record<string, unknown>[] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

                const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

                resolve({ columns, data: jsonData });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsArrayBuffer(file);
    });
}

// Process the data with cleansing rules
export function processData(
    data: Record<string, unknown>[],
    config: CleansingConfig,
    onProgress?: (progress: number, status: string) => void
): ProcessResult {
    const mapping = config.mapping;
    const totalRows = data.length;

    // Validate required columns
    const requiredCols = [mapping.debt_id, mapping.taxpayer_name, mapping.due_date, mapping.amount];
    const missingCols = requiredCols.filter(col => col && !data[0]?.hasOwnProperty(col));
    if (missingCols.length > 0) {
        throw new Error(`Colunas não encontradas: ${missingCols.join(', ')}`);
    }

    onProgress?.(10, 'Preparando dados...');

    // Process each row
    const processedData = data.map((row, index) => {
        // Parse values
        const tempDate = parseDate(row[mapping.due_date]);
        const tempAmount = parseAmount(row[mapping.amount]);
        const tempName = String(row[mapping.taxpayer_name] || '').toUpperCase();
        const tempDoc = mapping.cpf_cnpj
            ? String(row[mapping.cpf_cnpj] || '').replace(/[^0-9]/g, '')
            : '';
        const tempTribute = mapping.tribute_type
            ? String(row[mapping.tribute_type] || '').toUpperCase()
            : '';

        let status = 'Válido';
        let motivo = '';

        // 1. Prescription check
        if (config.prescription.enabled && status === 'Válido') {
            const refDate = config.prescription.reference_date
                ? new Date(config.prescription.reference_date)
                : new Date();
            const cutoffDate = new Date(refDate);
            cutoffDate.setFullYear(cutoffDate.getFullYear() - config.prescription.years);

            if (tempDate && tempDate < cutoffDate) {
                status = 'Prescrito';
                motivo = `Vencimento anterior a ${cutoffDate.toLocaleDateString('pt-BR')}`;
            }
        }

        // 2. Immunity check
        if (config.immunity.enabled && status === 'Válido') {
            const keywords = config.immunity.keywords.map(k => k.toUpperCase());
            const hasKeyword = keywords.some(keyword => tempName.includes(keyword));
            if (hasKeyword) {
                status = 'Imune';
                motivo = 'Entidade Imune identificada por palavra-chave';
            }
        }

        // 3. Exemption check
        if (config.exemption.enabled && status === 'Válido') {
            if (config.exemption.amount_threshold > 0 && tempAmount < config.exemption.amount_threshold) {
                status = 'Isento';
                motivo = `Valor abaixo de R$ ${config.exemption.amount_threshold}`;
            }

            if (config.exemption.tributes.length > 0) {
                const tributes = config.exemption.tributes.map(t => t.toUpperCase());
                if (tributes.includes(tempTribute)) {
                    status = 'Isento';
                    motivo = 'Tributo Isento';
                }
            }
        }

        // 4. Incomplete check
        if (config.incomplete.enabled && status === 'Válido') {
            const keywords = config.incomplete.keywords.map(k => k.toUpperCase());
            const hasBadKeyword = keywords.some(keyword => tempName.includes(keyword));
            const isBadName = hasBadKeyword || tempName.length < 3;
            const isBadDoc = config.incomplete.check_cpf_cnpj && tempDoc === '';

            if (isBadName || isBadDoc) {
                status = 'Dados Incompletos';
                motivo = 'Nome ou CPF/CNPJ inválido/genérico';
            }
        }

        // Update progress every 10%
        if (index % Math.ceil(totalRows / 10) === 0) {
            const progress = Math.min(10 + (index / totalRows) * 80, 90);
            onProgress?.(progress, 'Processando registros...');
        }

        return {
            ...row,
            Status_Higienizacao: status,
            Motivo_Higienizacao: motivo,
        };
    });

    onProgress?.(95, 'Calculando resumo...');

    // Calculate summary
    const statusCounts = {
        Prescrito: 0,
        Imune: 0,
        Isento: 0,
        'Dados Incompletos': 0,
        Válido: 0,
    };

    let totalRemoved = 0;
    let totalValid = 0;

    for (const row of processedData) {
        const status = row.Status_Higienizacao as keyof typeof statusCounts;
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        const amount = parseAmount(row[mapping.amount]);
        if (status !== 'Válido') {
            totalRemoved += amount;
        } else {
            totalValid += amount;
        }
    }

    const summary: CleansingResult = {
        total_records: totalRows,
        processed_records: totalRows,
        prescribed_count: statusCounts['Prescrito'],
        immune_count: statusCounts['Imune'],
        exempt_count: statusCounts['Isento'],
        incomplete_count: statusCounts['Dados Incompletos'],
        valid_count: statusCounts['Válido'],
        total_amount_removed: totalRemoved,
        total_amount_valid: totalValid,
    };

    onProgress?.(100, 'Concluído!');

    return {
        summary,
        preview: processedData.slice(0, 100),
        processedData,
    };
}

// Export processed data to Excel
export function exportToExcel(data: Record<string, unknown>[], filename: string): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Higienizado');
    XLSX.writeFile(workbook, filename);
}
