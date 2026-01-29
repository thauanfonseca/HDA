import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CleansingResult, ColumnMapping } from '../types';

interface ReportConfig {
    result: CleansingResult;
    mapping: ColumnMapping;
    fileName?: string;
}

export const generatePDFReport = ({ result, mapping, fileName }: ReportConfig) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // -- Colors --
    const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo 600
    const secondaryColor: [number, number, number] = [107, 114, 128]; // Gray 500
    const successColor: [number, number, number] = [22, 163, 74]; // Green 600
    const dangerColor: [number, number, number] = [220, 38, 38]; // Red 600

    // -- Helper: Format Currency --
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('pt-BR').format(value);
    };

    const calculatePercentage = (count: number, total: number) => {
        if (total === 0) return '0%';
        return `${((count / total) * 100).toFixed(1)}%`;
    };

    // -- Header --
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Relatório de Higienização', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const dateStr = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, pageWidth / 2, 28, { align: 'center' });

    if (fileName) {
        doc.text(`Arquivo Processado: ${fileName}`, pageWidth / 2, 33, { align: 'center' });
    }

    // Draw a line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 38, pageWidth - 14, 38);

    // -- Executive Summary Section --
    let currentY = 50;

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo Executivo', 14, currentY);
    currentY += 10;

    // Small cards summary using text
    doc.setFontSize(12);

    // Total Records
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Total de Registros:', 14, currentY);
    doc.setTextColor(0, 0, 0);
    doc.text(formatNumber(result.total_records), 60, currentY);

    // Valid Records
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Registros Válidos:', 110, currentY);
    doc.setTextColor(successColor[0], successColor[1], successColor[2]);
    doc.text(formatNumber(result.valid_count), 160, currentY);

    currentY += 10;

    // Removed Records
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Registros Removidos:', 14, currentY);
    doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
    doc.text(`${formatNumber(result.total_records - result.valid_count)} (${calculatePercentage(result.total_records - result.valid_count, result.total_records)})`, 60, currentY);

    currentY += 15;

    // -- Financial Impact Section --
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Impacto Financeiro', 14, currentY);
    currentY += 10;

    const summaryData = [
        ['Categoria', 'Valor (R$)', '% do Total'],
        ['Valor Original Total', formatCurrency(result.total_amount_valid + result.total_amount_removed), '100%'],
        ['Valor Mantido (Válido)', formatCurrency(result.total_amount_valid), calculatePercentage(result.total_amount_valid, result.total_amount_valid + result.total_amount_removed)],
        ['Valor Removido', formatCurrency(result.total_amount_removed), calculatePercentage(result.total_amount_removed, result.total_amount_valid + result.total_amount_removed)],
    ];

    autoTable(doc, {
        startY: currentY,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
        },
    });

    // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 15;

    // -- Detailed Breakdown Section --
    doc.setFontSize(16);
    doc.text('Detalhamento das Remoções', 14, currentY);
    currentY += 10;

    const breakdownData = [
        ['Motivo', 'Quantidade', '% Registros'],
        ['Prescritos', formatNumber(result.prescribed_count), calculatePercentage(result.prescribed_count, result.total_records)],
        ['Imunes', formatNumber(result.immune_count), calculatePercentage(result.immune_count, result.total_records)],
        ['Isentos', formatNumber(result.exempt_count), calculatePercentage(result.exempt_count, result.total_records)],
        ['Dados Incompletos', formatNumber(result.incomplete_count), calculatePercentage(result.incomplete_count, result.total_records)],
    ];

    autoTable(doc, {
        startY: currentY,
        head: [breakdownData[0]],
        body: breakdownData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: secondaryColor, textColor: 255 },
        columnStyles: {
            0: { fontStyle: 'normal' },
            1: { halign: 'right' },
            2: { halign: 'right' },
        },
    });

    // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
    currentY = doc.lastAutoTable.finalY + 15;

    // -- Mapped Columns Section --
    if (currentY + 60 > doc.internal.pageSize.height) {
        doc.addPage();
        currentY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Configuração de Mapeamento', 14, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

    const mappingData = Object.entries(mapping)
        .filter(([_, value]) => value) // Only show mapped columns
        .map(([key, value]) => {
            // Translate keys to readable labels if needed, or just capitalize
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return [label, value];
        });

    autoTable(doc, {
        startY: currentY,
        head: [['Campo do Sistema', 'Coluna no Arquivo']],
        body: mappingData,
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 10 },
    });

    // -- Footer --
    const totalPages = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${totalPages} - Higienizador de Dívida Ativa`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save the PDF
    doc.save(`${fileName ? fileName.replace('.xlsx', '') : 'relatorio'}_higienizacao.pdf`);
};
