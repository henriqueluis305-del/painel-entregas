import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Driver(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("base_id", "normalized_key", name="uq_driver_base_key"),)

    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    base_id: str = Field(foreign_key="base.id", index=True)
    name: str
    normalized_key: str  # lowercase + strip para deduplicação
    documento: Optional[str] = None
    telefone: Optional[str] = None
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
