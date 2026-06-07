import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Snapshot(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("base_id", "data_pt_br", name="uq_snapshot_base_dia"),)

    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    base_id: str = Field(foreign_key="base.id", index=True)
    user_id: Optional[str] = Field(default=None, foreign_key="app_user.id")
    ts: datetime
    data_pt_br: str   # '22/05/2026'
    hora: Optional[str] = None
    sla_pct: Optional[float] = None
    ds_pct: Optional[float] = None
    total: int = Field(default=0)
    entregues: int = Field(default=0)
    em_rota: int = Field(default=0)
    ocorrencias: int = Field(default=0)
    faltantes: int = Field(default=0)
    devolvidos: int = Field(default=0)
    outros: int = Field(default=0)
    upload_csv_id: Optional[str] = Field(default=None, foreign_key="upload.id")
    upload_xlsx_id: Optional[str] = Field(default=None, foreign_key="upload.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SnapshotDriver(SQLModel, table=True):
    __tablename__ = "snapshot_driver"

    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    snapshot_id: str = Field(foreign_key="snapshot.id", index=True)
    driver_id: Optional[str] = Field(default=None, foreign_key="driver.id")
    driver_name: str  # congelado no momento do snapshot para histórico
    saiu: int = Field(default=0)
    entregues: int = Field(default=0)
    em_rota: int = Field(default=0)
    ocorrencias: int = Field(default=0)
