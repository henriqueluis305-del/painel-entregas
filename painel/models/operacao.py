import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Operacao(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    slug: str = Field(unique=True)
    label: str
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Base(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("operacao_id", "slug", name="uq_base_op_slug"),)

    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    operacao_id: str = Field(foreign_key="operacao.id", index=True)
    slug: str
    label: str
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
