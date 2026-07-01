// Helper compartilhado: grava um checkpoint de Stuck por base (burn-down).
import type pg from "pg"

export function dataPtBrHoje(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}

export function horaHoje(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())
}

/** Checkpoint de DS por base (soma os totais atuais de shopee_ds_driver do dia). */
export async function recordDsCheckpoints(
  client: pg.Client,
  baseIds: string[],
  label: string,
  dataPtBr: string,
): Promise<void> {
  for (const baseId of baseIds) {
    const seqRes = await client.query(
      "select coalesce(max(seq),-1)+1 as seq from shopee_ds_checkpoint where base_id=$1 and data_pt_br=$2",
      [baseId, dataPtBr],
    )
    const seq = seqRes.rows[0].seq
    await client.query(
      `insert into shopee_ds_checkpoint (base_id, seq, data_pt_br, label, saiu, entregues, em_rota, ocorrencias)
       select $1::varchar, $2::integer, $3::varchar, $4::varchar,
         coalesce(sum(saiu),0), coalesce(sum(entregues),0),
         coalesce(sum(em_rota),0), coalesce(sum(ocorrencias),0)
       from shopee_ds_driver where base_id=$1::varchar and data_pt_br=$3::varchar
       on conflict (base_id, data_pt_br, seq) do update set
         saiu=excluded.saiu, entregues=excluded.entregues,
         em_rota=excluded.em_rota, ocorrencias=excluded.ocorrencias, ts=now()`,
      [baseId, seq, dataPtBr, label],
    )
  }
}

/** Grava 1 checkpoint por base (seq incremental no dia) com total/ainda/resolvidos atuais. */
export async function recordCheckpoints(
  client: pg.Client,
  baseIds: string[],
  label: string,
  dataPtBr: string,
): Promise<void> {
  for (const baseId of baseIds) {
    const seqRes = await client.query(
      "select coalesce(max(seq),-1)+1 as seq from shopee_stuck_checkpoint where base_id=$1 and data_pt_br=$2",
      [baseId, dataPtBr],
    )
    const seq = seqRes.rows[0].seq
    await client.query(
      `insert into shopee_stuck_checkpoint (base_id, seq, data_pt_br, label, total, ainda_stuck, resolvidos)
       select $1::varchar, $2::integer, $3::varchar, $4::varchar,
         count(*),
         count(*) filter (where delivered_at is null and status not in ('Delivering','SP_Collection_Collected','SP_Ready_Collection','Delivered')),
         count(*) filter (where delivered_at is not null or status in ('Delivering','SP_Collection_Collected','SP_Ready_Collection','Delivered'))
       from shopee_package where base_id=$1::varchar
       on conflict (base_id, data_pt_br, seq) do update set
         total=excluded.total, ainda_stuck=excluded.ainda_stuck,
         resolvidos=excluded.resolvidos, ts=now()`,
      [baseId, seq, dataPtBr, label],
    )
  }
}
