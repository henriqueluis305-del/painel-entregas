import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Liberacao(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(foreign_key="app_user.id")
    base_id: str = Field(foreign_key="base.id", index=True)
    status: str  # LiberacaoStatus: OK | NOK
    observacao: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
