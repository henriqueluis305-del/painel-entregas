import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


class Upload(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="app_user.id")
    base_id: str = Field(foreign_key="base.id", index=True)
    kind: str  # UploadKind: CSV_SLA | XLSX_DS | XLSX_SLA_DS_HISTORY
    filename: str
    size_bytes: int = Field(default=0)
    rows_parsed: int = Field(default=0)
    rows_kept: int = Field(default=0)
    rows_rejected: int = Field(default=0)
    error_log: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Package(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("base_id", "codigo", name="uq_package_base_codigo"),)

    id: Optional[str] = Field(default_factory=_uuid, primary_key=True)
    upload_id: str = Field(foreign_key="upload.id")
    base_id: str = Field(foreign_key="base.id", index=True)
    driver_id: Optional[str] = Field(default=None, foreign_key="driver.id")
    codigo: str
    status: str  # PackageStatus enum
    finalizado_at: Optional[datetime] = None
    imported_at: datetime = Field(default_factory=datetime.utcnow)
