from pydantic import BaseModel
from typing import List, Optional, Dict

class ColumnMapping(BaseModel):
    debt_id: str
    taxpayer_name: str
    cpf_cnpj: Optional[str] = None
    due_date: str
    amount: str
    tribute_type: Optional[str] = None

class PrescriptionRules(BaseModel):
    enabled: bool = True
    years: int = 5
    # Optional: Date from which to count (defaults to today if None)
    reference_date: Optional[str] = None 

class ImmunityRules(BaseModel):
    enabled: bool = True
    keywords: List[str] = ["UNIÃO", "ESTADO", "MUNICIPIO", "TEMPLO", "PARTIDO", "SINDICATO", "AUTARQUIA", "FUNDAÇÃO"]

class ExemptionRules(BaseModel):
    enabled: bool = True
    amount_threshold: float = 0.0
    tributes: List[str] = [] # List of exempted tributes

class IncompleteRules(BaseModel):
    enabled: bool = True
    keywords: List[str] = ["IGNORADO", "NÃO INFORMADO", "DESCONHECIDO", "SEM NOME"]
    check_cpf_cnpj: bool = True

class CleansingConfig(BaseModel):
    mapping: ColumnMapping
    prescription: PrescriptionRules
    immunity: ImmunityRules
    exemption: ExemptionRules
    incomplete: IncompleteRules

class CleansingResult(BaseModel):
    total_records: int
    processed_records: int
    prescribed_count: int
    immune_count: int
    exempt_count: int
    incomplete_count: int
    valid_count: int
    total_amount_removed: float
    total_amount_valid: float
