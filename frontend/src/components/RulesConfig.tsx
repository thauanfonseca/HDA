import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PrescriptionRules, ImmunityRules, ExemptionRules, IncompleteRules } from '../types';
import clsx from 'clsx';

interface RulesConfigProps {
    prescription: PrescriptionRules;
    immunity: ImmunityRules;
    exemption: ExemptionRules;
    incomplete: IncompleteRules;
    onPrescriptionChange: (rules: PrescriptionRules) => void;
    onImmunityChange: (rules: ImmunityRules) => void;
    onExemptionChange: (rules: ExemptionRules) => void;
    onIncompleteChange: (rules: IncompleteRules) => void;
}

export function RulesConfig({
    prescription,
    immunity,
    exemption,
    incomplete,
    onPrescriptionChange,
    onImmunityChange,
    onExemptionChange,
    onIncompleteChange,
}: RulesConfigProps) {
    const [expandedSection, setExpandedSection] = useState<string | null>('prescription');

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    return (
        <div className="card space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-accent rounded-full"></span>
                Configuração de Regras
            </h3>

            {/* Prescrição */}
            <div className="border border-dark-500 rounded-lg overflow-hidden">
                <button
                    onClick={() => toggleSection('prescription')}
                    className="w-full flex items-center justify-between p-4 bg-dark-600 hover:bg-dark-500 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={prescription.enabled}
                            onChange={(e) => {
                                e.stopPropagation();
                                onPrescriptionChange({ ...prescription, enabled: e.target.checked });
                            }}
                            className="w-4 h-4 accent-primary-500"
                        />
                        <span className="font-medium text-white">Prescrição</span>
                    </div>
                    {expandedSection === 'prescription' ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                <div className={clsx(
                    'overflow-hidden transition-all duration-300',
                    expandedSection === 'prescription' ? 'max-h-48 p-4' : 'max-h-0'
                )}>
                    <label className="block text-sm text-gray-400 mb-2">Anos para Prescrição</label>
                    <input
                        type="number"
                        value={prescription.years}
                        onChange={(e) => onPrescriptionChange({ ...prescription, years: parseInt(e.target.value) || 5 })}
                        min={1}
                        max={20}
                        className="input w-32"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Dívidas com vencimento anterior a {prescription.years} anos serão marcadas como prescritas.
                    </p>
                </div>
            </div>

            {/* Imunidade */}
            <div className="border border-dark-500 rounded-lg overflow-hidden">
                <button
                    onClick={() => toggleSection('immunity')}
                    className="w-full flex items-center justify-between p-4 bg-dark-600 hover:bg-dark-500 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={immunity.enabled}
                            onChange={(e) => {
                                e.stopPropagation();
                                onImmunityChange({ ...immunity, enabled: e.target.checked });
                            }}
                            className="w-4 h-4 accent-primary-500"
                        />
                        <span className="font-medium text-white">Imunidade</span>
                    </div>
                    {expandedSection === 'immunity' ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                <div className={clsx(
                    'overflow-hidden transition-all duration-300',
                    expandedSection === 'immunity' ? 'max-h-48 p-4' : 'max-h-0'
                )}>
                    <label className="block text-sm text-gray-400 mb-2">Palavras-chave (separadas por vírgula)</label>
                    <input
                        type="text"
                        value={immunity.keywords.join(', ')}
                        onChange={(e) => onImmunityChange({
                            ...immunity,
                            keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                        })}
                        className="input"
                        placeholder="UNIÃO, ESTADO, TEMPLO..."
                    />
                </div>
            </div>

            {/* Isenção */}
            <div className="border border-dark-500 rounded-lg overflow-hidden">
                <button
                    onClick={() => toggleSection('exemption')}
                    className="w-full flex items-center justify-between p-4 bg-dark-600 hover:bg-dark-500 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={exemption.enabled}
                            onChange={(e) => {
                                e.stopPropagation();
                                onExemptionChange({ ...exemption, enabled: e.target.checked });
                            }}
                            className="w-4 h-4 accent-primary-500"
                        />
                        <span className="font-medium text-white">Isenção</span>
                    </div>
                    {expandedSection === 'exemption' ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                <div className={clsx(
                    'overflow-hidden transition-all duration-300',
                    expandedSection === 'exemption' ? 'max-h-48 p-4' : 'max-h-0'
                )}>
                    <label className="block text-sm text-gray-400 mb-2">Valor Mínimo (R$)</label>
                    <input
                        type="number"
                        value={exemption.amount_threshold}
                        onChange={(e) => onExemptionChange({ ...exemption, amount_threshold: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={10}
                        className="input w-40"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Dívidas abaixo deste valor serão marcadas como isentas.
                    </p>
                </div>
            </div>

            {/* Dados Incompletos */}
            <div className="border border-dark-500 rounded-lg overflow-hidden">
                <button
                    onClick={() => toggleSection('incomplete')}
                    className="w-full flex items-center justify-between p-4 bg-dark-600 hover:bg-dark-500 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={incomplete.enabled}
                            onChange={(e) => {
                                e.stopPropagation();
                                onIncompleteChange({ ...incomplete, enabled: e.target.checked });
                            }}
                            className="w-4 h-4 accent-primary-500"
                        />
                        <span className="font-medium text-white">Dados Incompletos</span>
                    </div>
                    {expandedSection === 'incomplete' ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                <div className={clsx(
                    'overflow-hidden transition-all duration-300',
                    expandedSection === 'incomplete' ? 'max-h-64 p-4' : 'max-h-0'
                )}>
                    <label className="block text-sm text-gray-400 mb-2">Palavras-chave para nomes inválidos</label>
                    <input
                        type="text"
                        value={incomplete.keywords.join(', ')}
                        onChange={(e) => onIncompleteChange({
                            ...incomplete,
                            keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                        })}
                        className="input mb-3"
                        placeholder="IGNORADO, NÃO INFORMADO..."
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={incomplete.check_cpf_cnpj}
                            onChange={(e) => onIncompleteChange({ ...incomplete, check_cpf_cnpj: e.target.checked })}
                            className="w-4 h-4 accent-primary-500"
                        />
                        Verificar CPF/CNPJ vazio
                    </label>
                </div>
            </div>
        </div>
    );
}
