interface PreviewTableProps {
    data: Record<string, unknown>[];
}

export function PreviewTable({ data }: PreviewTableProps) {
    if (!data.length) return null;

    const columns = Object.keys(data[0]);

    return (
        <div className="card overflow-hidden">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-accent rounded-full"></span>
                Prévia dos Dados (100 primeiros registros)
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="bg-dark-600 sticky top-0">
                        <tr>
                            {columns.map((col) => (
                                <th key={col} className="px-4 py-3 text-left text-gray-400 font-medium whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-600">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-dark-600/50 transition-colors">
                                {columns.map((col) => {
                                    const value = row[col];
                                    const isStatus = col === 'Status_Higienizacao';

                                    let statusClass = '';
                                    if (isStatus) {
                                        switch (value) {
                                            case 'Válido': statusClass = 'text-green-400'; break;
                                            case 'Prescrito': statusClass = 'text-orange-400'; break;
                                            case 'Imune': statusClass = 'text-blue-400'; break;
                                            case 'Isento': statusClass = 'text-purple-400'; break;
                                            case 'Dados Incompletos': statusClass = 'text-red-400'; break;
                                        }
                                    }

                                    return (
                                        <td key={col} className={`px-4 py-2 whitespace-nowrap ${statusClass}`}>
                                            {String(value ?? '')}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
