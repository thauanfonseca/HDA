export interface ColumnMapping {
    debt_id: string;
    taxpayer_name: string;
    cpf_cnpj?: string;
    due_date: string;
    amount: string;
    tribute_type?: string;
    tax_year?: string;
}

export interface PrescriptionRules {
    enabled: boolean;
    years: number;
    reference_date?: string;
}

export interface ImmunityRules {
    enabled: boolean;
    keywords: string[];
}

export interface ExemptionRules {
    enabled: boolean;
    amount_threshold: number;
    tributes: string[];
}

export interface IncompleteRules {
    enabled: boolean;
    keywords: string[];
    check_cpf_cnpj: boolean;
}

export interface CleansingConfig {
    mapping: ColumnMapping;
    prescription: PrescriptionRules;
    immunity: ImmunityRules;
    exemption: ExemptionRules;
    incomplete: IncompleteRules;
}

export interface CleansingResult {
    total_records: number;
    processed_records: number;
    prescribed_count: number;
    immune_count: number;
    exempt_count: number;
    incomplete_count: number;
    valid_count: number;
    total_amount_removed: number;
    total_amount_valid: number;
}

export interface ProcessResponse {
    summary: CleansingResult;
    preview: Record<string, unknown>[];
}
