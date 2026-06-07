from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CepCache(SQLModel, table=True):
    __tablename__ = "cep_cache"

    cep: str = Field(primary_key=True)  # 8 dígitos sem máscara
    cidade: str
    bairro: str
    uf: Optional[str] = None
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
