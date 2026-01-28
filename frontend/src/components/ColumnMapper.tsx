import { ColumnMapping } from '../types';

interface ColumnMapperProps {
    columns: string[];
    mapping: ColumnMapping;
    onChange: (mapping: ColumnMapping) => void;
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
    debt_id: 'Número da Dívida *',
    taxpayer_name: 'Nome do Contribuinte *',
    cpf_cnpj: 'CPF/CNPJ',
    due_date: 'Data de Vencimento *',
    amount: 'Valor *',
    tribute_type: 'Tipo de Tributo',
};

export function ColumnMapper({ columns, mapping, onChange }: ColumnMapperProps) {
    const handleChange = (field: keyof ColumnMapping, value: string) => {
        onChange({ ...mapping, [field]: value || undefined });
    };

    const requiredFields: (keyof ColumnMapping)[] = ['debt_id', 'taxpayer_name', 'due_date', 'amount'];
    const optionalFields: (keyof ColumnMapping)[] = ['cpf_cnpj', 'tribute_type'];

    return (
        <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                Mapeamento de Colunas
            </h3>
            <p className="text-gray-400 text-sm mb-6">
                Selecione qual coluna do seu arquivo corresponde a cada campo do sistema.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requiredFields.map((field) => (
                    <div key={field}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {FIELD_LABELS[field]}
                        </label>
                        <select
                            value={mapping[field] || ''}
                            onChange={(e) => handleChange(field, e.target.value)}
                            className="select"
                        >
                            <option value="">Selecione...</option>
                            {columns.map((col) => (
                                <option key={col} value={col}>{col}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-dark-500">
                <h4 className="text-sm font-medium text-gray-400 mb-4">Campos Opcionais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {optionalFields.map((field) => (
                        <div key={field}>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {FIELD_LABELS[field]}
                            </label>
                            <select
                                value={mapping[field] || ''}
                                onChange={(e) => handleChange(field, e.target.value)}
                                className="select"
                            >
                                <option value="">Não mapear</option>
                                {columns.map((col) => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
