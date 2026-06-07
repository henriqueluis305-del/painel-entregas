"""Cliente fino para o Supabase Auth (GoTrue) via HTTP.

Não guardamos senha em lugar nenhum: o Supabase faz o bcrypt e emite o JWT.
O app só troca e-mail/senha por token e revalida o token quando necessário.
"""

import os

import httpx


def _cfg() -> tuple[str, str]:
    return os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"]


def sign_in(email: str, password: str) -> dict:
    """Login por senha. Retorna {access_token, refresh_token, user, ...}.

    Lança httpx.HTTPStatusError em credencial inválida.
    """
    url, anon = _cfg()
    r = httpx.post(
        f"{url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def get_user(access_token: str) -> dict | None:
    """Valida o token no Supabase e devolve o user, ou None se inválido."""
    url, anon = _cfg()
    r = httpx.get(
        f"{url}/auth/v1/user",
        headers={"apikey": anon, "Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    return r.json() if r.status_code == 200 else None


def sign_out(access_token: str) -> None:
    url, anon = _cfg()
    try:
        httpx.post(
            f"{url}/auth/v1/logout",
            headers={"apikey": anon, "Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        pass  # logout local sempre prossegue
