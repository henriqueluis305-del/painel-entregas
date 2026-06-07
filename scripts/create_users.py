"""Script one-shot para criar usuários no Supabase Auth + app_user."""

import os
import sys
from pathlib import Path

# garante que o .env é carregado
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlmodel import Session, create_engine, select
from painel.models.user import AppUser

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

USERS = [
    {
        "email": "pedro.antunes.ha@gmail.com",
        "password": "pph1112003",
        "empresa": "Pedro Antunes",
        "role": "ADMIN",
        "is_admin": True,
        "base_scope": "ALL",
    },
    {
        "email": "luiz.henrique@gmail.com",
        "password": "QueSaudadeDaMinhaEx_40k",
        "empresa": "Luiz Henrique",
        "role": "ADMIN",
        "is_admin": True,
        "base_scope": "ALL",
    },
    {
        "email": "user.teste@gmail.com",
        "password": "1234567890",
        "empresa": "User Teste",
        "role": "SUPERVISOR",
        "is_admin": False,
        "base_scope": "SINGLE",
    },
]

engine = create_engine(DATABASE_URL)


def create_auth_user(email: str, password: str) -> str | None:
    """Cria usuário no Supabase Auth e devolve o UUID gerado."""
    r = httpx.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=HEADERS,
        json={"email": email, "password": password, "email_confirm": True},
    )
    if r.status_code in (200, 201):
        uid = r.json()["id"]
        print(f"  OK Auth criado: {email} -> {uid}")
        return uid
    # usuário já existe?
    if r.status_code == 422 and "already" in r.text.lower():
        # busca o id existente
        users_r = httpx.get(
            f"{SUPABASE_URL}/auth/v1/admin/users?email={email}",
            headers=HEADERS,
        )
        if users_r.status_code == 200:
            data = users_r.json()
            users = data.get("users", data) if isinstance(data, dict) else data
            if users:
                uid = users[0]["id"]
                print(f"  ~ Auth ja existe: {email} -> {uid}")
                return uid
    print(f"  ERRO ao criar {email}: {r.status_code} {r.text}")
    return None


def upsert_app_user(uid: str, u: dict):
    """Insere ou atualiza o registro em app_user."""
    with Session(engine) as session:
        existing = session.exec(select(AppUser).where(AppUser.id == uid)).first()
        if existing:
            existing.email      = u["email"]
            existing.empresa    = u["empresa"]
            existing.role       = u["role"]
            existing.is_admin   = u["is_admin"]
            existing.base_scope = u["base_scope"]
            session.add(existing)
            print(f"  ~ app_user atualizado: {u['email']}")
        else:
            session.add(AppUser(
                id=uid,
                email=u["email"],
                empresa=u["empresa"],
                role=u["role"],
                is_admin=u["is_admin"],
                base_scope=u["base_scope"],
            ))
            print(f"  OK app_user inserido: {u['email']}")
        session.commit()


if __name__ == "__main__":
    print("Criando usuários...\n")
    for u in USERS:
        print(f">> {u['empresa']} ({u['email']})")
        uid = create_auth_user(u["email"], u["password"])
        if uid:
            upsert_app_user(uid, u)
        print()
    print("Concluído.")
