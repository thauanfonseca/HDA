import { useState } from 'react';
import type { CleansingResult, ColumnMapping } from '../types';
import { FileCheck, AlertTriangle, Shield, Ban, XCircle, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { generatePDFReport } from '../services/reportGenerator';

interface DashboardProps {
    result: CleansingResult;
    mapping: ColumnMapping;
    fileName?: string;
}

export function Dashboard({ result, mapping, fileName }: DashboardProps) {
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            // Small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 500));
            generatePDFReport({ result, mapping, fileName });
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('pt-BR').format(value);
    };

    const stats = [
        {
            label: 'Total de Registros',
            value: formatNumber(result.total_records),
            icon: FileCheck,
            color: 'text-gray-400',
            bg: 'bg-dark-600',
        },
        {
            label: 'Prescritos',
            value: formatNumber(result.prescribed_count),
            icon: AlertTriangle,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
        },
        {
            label: 'Imunes',
            value: formatNumber(result.immune_count),
            icon: Shield,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Isentos',
            value: formatNumber(result.exempt_count),
            icon: Ban,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
        },
        {
            label: 'Dados Incompletos',
            value: formatNumber(result.incomplete_count),
            icon: XCircle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
        },
        {
            label: 'Válidos',
            value: formatNumber(result.valid_count),
            icon: CheckCircle2,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
        },
    ];

    const removedPercentage = ((result.total_records - result.valid_count) / result.total_records * 100).toFixed(1);

    return (
        <div className="space-y-6">
            <div className="card glow-purple">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></span>
                        Resultado da Higienização
                    </h3>
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGeneratingReport}
                        className="btn-secondary text-sm py-2 px-3 flex items-center gap-2"
                        title="Baixar Relatório em PDF"
                    >
                        {isGeneratingReport ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                Relatório PDF
                            </>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {stats.map((stat) => (
                        <div key={stat.label} className={`p-4 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-xs text-gray-400">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Valor Removido</h4>
                    <p className="text-3xl font-bold text-red-400">{formatCurrency(result.total_amount_removed)}</p>
                    <p className="text-sm text-gray-500 mt-1">{removedPercentage}% do total</p>
                </div>
                <div className="card">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Valor Válido</h4>
                    <p className="text-3xl font-bold text-green-400">{formatCurrency(result.total_amount_valid)}</p>
                    <p className="text-sm text-gray-500 mt-1">Após higienização</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="card">
                <h4 className="text-sm font-medium text-gray-400 mb-4">Distribuição</h4>
                <div className="flex h-4 rounded-full overflow-hidden bg-dark-600">
                    <div
                        className="bg-green-500 transition-all duration-500"
                        style={{ width: `${(result.valid_count / result.total_records) * 100}%` }}
                        title={`Válidos: ${result.valid_count}`}
                    />
                    <div
                        className="bg-orange-500 transition-all duration-500"
                        style={{ width: `${(result.prescribed_count / result.total_records) * 100}%` }}
                        title={`Prescritos: ${result.prescribed_count}`}
                    />
                    <div
                        className="bg-blue-500 transition-all duration-500"
                        style={{ width: `${(result.immune_count / result.total_records) * 100}%` }}
                        title={`Imunes: ${result.immune_count}`}
                    />
                    <div
                        className="bg-purple-500 transition-all duration-500"
                        style={{ width: `${(result.exempt_count / result.total_records) * 100}%` }}
                        title={`Isentos: ${result.exempt_count}`}
                    />
                    <div
                        className="bg-red-500 transition-all duration-500"
                        style={{ width: `${(result.incomplete_count / result.total_records) * 100}%` }}
                        title={`Incompletos: ${result.incomplete_count}`}
                    />
                </div>
                <div className="flex flex-wrap gap-4 mt-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Válidos</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded"></span> Prescritos</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Imunes</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded"></span> Isentos</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded"></span> Incompletos</span>
                </div>
            </div>
        </div>
    );
}
