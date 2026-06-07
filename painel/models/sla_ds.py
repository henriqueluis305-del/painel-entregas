import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class SlaDsRecord(SQLModel, table=True):
    __tablename__ = "sla_ds_record"
    __table_args__ = (UniqueConstraint("base_id", "data_pt_br", name="uq_sla_ds_base_dia"),)

    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    base_id: str = Field(foreign_key="base.id", index=True)
    upload_id: Optional[str] = Field(default=None, foreign_key="upload.id")
    user_id: Optional[str] = Field(default=None, foreign_key="app_user.id")
    ts: datetime
    data_pt_br: str
    sla_pct: Optional[float] = None
    sla_rec: Optional[int] = None
    sla_ent: Optional[int] = None
    ds_pct: Optional[float] = None
    ds_rec: Optional[int] = None
    ds_ent: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
