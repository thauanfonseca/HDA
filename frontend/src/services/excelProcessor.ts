import * as XLSX from 'xlsx';
import type { CleansingConfig, CleansingResult, ColumnMapping } from '../types';

export interface ProcessResult {
    summary: CleansingResult;
    preview: Record<string, unknown>[];
    processedData: Record<string, unknown>[];
}

// Parse date from various formats
function parseDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) return value;

    // Handle 4-digit year as number (e.g., 2019)
    if (typeof value === 'number') {
        if (value >= 1900 && value <= 2100) {
            // Assume it's a year, return Jan 1st
            return new Date(value, 0, 1);
        }

        // Excel serial date
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            return new Date(date.y, date.m - 1, date.d);
        }
    }

    if (typeof value === 'string') {
        const cleaned = value.trim();

        // Handle 4-digit year as string (e.g., "2019")
        if (/^\d{4}$/.test(cleaned)) {
            const year = parseInt(cleaned);
            if (year >= 1900 && year <= 2100) {
                return new Date(year, 0, 1);
            }
        }

        // Try common formats
        const formats = [
            /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
            /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
            /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
        ];

        for (const format of formats) {
            const match = cleaned.match(format);
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

            // Only check CPF/CNPJ if column is mapped AND rule is enabled
            const isBadDoc = config.incomplete.check_cpf_cnpj && mapping.cpf_cnpj && tempDoc === '';

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
        // Safe check for status key
        if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }

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

// Helper to format currency
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Export processed data to Excel with multiple sheets
export function exportToExcel(data: Record<string, unknown>[], filename: string, mapping: ColumnMapping): void {
    const workbook = XLSX.utils.book_new();

    // 1. Dívida Ativa (Todos os dados originais + colunas de status)
    // User requested "Dívida Ativa" as the raw input essentially, but since we are tagging it, keeping the tags is useful.
    // Actually, the user showed "Dívida Ativa" tab and "Dívida Ativa após higienização".
    // "Dívida Ativa" tab likely contains everything.
    const fullSheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, fullSheet, 'Dívida Ativa');

    // 2. Imunes e Isentos
    const immuneData = data.filter(r => r.Status_Higienizacao === 'Imune' || r.Status_Higienizacao === 'Isento');
    const immuneSheet = XLSX.utils.json_to_sheet(immuneData);
    XLSX.utils.book_append_sheet(workbook, immuneSheet, 'Imunes e Isentos');

    // 3. Prescritos
    const prescribedData = data.filter(r => r.Status_Higienizacao === 'Prescrito');
    const prescribedSheet = XLSX.utils.json_to_sheet(prescribedData);
    XLSX.utils.book_append_sheet(workbook, prescribedSheet, 'Prescritos');

    // 4. Ignorados (Dados Incompletos)
    const incompleteData = data.filter(r => r.Status_Higienizacao === 'Dados Incompletos');
    const incompleteSheet = XLSX.utils.json_to_sheet(incompleteData);
    XLSX.utils.book_append_sheet(workbook, incompleteSheet, 'Ignorados');

    // 5. Dívida Ativa após higienização (Válidos)
    const validData = data.filter(r => r.Status_Higienizacao === 'Válido');
    const validSheet = XLSX.utils.json_to_sheet(validData);
    XLSX.utils.book_append_sheet(workbook, validSheet, 'Dívida Ativa após higienização');

    // 6. Resumo
    // Build the summary table
    const summaryRows: any[] = [];

    // Calculate total before cleansing
    const totalAmount = data.reduce((acc, row) => acc + parseAmount(row[mapping.amount]), 0);

    // Header Row for Total
    summaryRows.push({
        'Resumo': 'Total antes de higienização',
        'Valor': formatCurrency(totalAmount)
    });
    summaryRows.push({}); // Empty row

    // Group by Year
    const yearStats: Record<string, { valid: number, immune: number, incomplete: number, prescribed: number }> = {};

    data.forEach(row => {
        let year = 'N/A';
        if (mapping.tax_year && row[mapping.tax_year]) {
            year = String(row[mapping.tax_year]);
        } else if (mapping.due_date) {
            const date = parseDate(row[mapping.due_date]);
            if (date) {
                year = date.getFullYear().toString();
            }
        }

        if (!yearStats[year]) {
            yearStats[year] = { valid: 0, immune: 0, incomplete: 0, prescribed: 0 };
        }

        const amount = parseAmount(row[mapping.amount]);
        const status = row.Status_Higienizacao;

        if (status === 'Válido') yearStats[year].valid += amount;
        else if (status === 'Imune' || status === 'Isento') yearStats[year].immune += amount;
        else if (status === 'Dados Incompletos') yearStats[year].incomplete += amount;
        else if (status === 'Prescrito') yearStats[year].prescribed += amount;
    });

    // Create table rows
    const sortedYears = Object.keys(yearStats).sort();

    // Table Headers (simulated in data)
    const tableData = sortedYears.map(year => ({
        'Ano': year,
        'Dívida Ativa': formatCurrency(yearStats[year].valid),
        'Imunes': formatCurrency(yearStats[year].immune),
        'Ignorados': formatCurrency(yearStats[year].incomplete),
        'Prescritos': formatCurrency(yearStats[year].prescribed)
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true });
    XLSX.utils.sheet_add_json(summarySheet, tableData, { origin: 'A4' }); // Start table at A4

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    XLSX.writeFile(workbook, filename);
}
