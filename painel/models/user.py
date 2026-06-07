from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class AppUser(SQLModel, table=True):
    __tablename__ = "app_user"

    # id == auth.users.id do Supabase — definido externamente, sem default
    id: str = Field(primary_key=True)
    email: str = Field(unique=True)
    empresa: Optional[str] = None
    role: str = Field(default="SUPERVISOR")
    operacao_id: Optional[str] = Field(default=None, foreign_key="operacao.id")
    base_scope: str = Field(default="SINGLE")
    extra_perms: List[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
    )
    denied_perms: List[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
    )
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None


class UserBase(SQLModel, table=True):
    __tablename__ = "user_base"

    user_id: str = Field(foreign_key="app_user.id", primary_key=True)
    base_id: str = Field(foreign_key="base.id", primary_key=True)
