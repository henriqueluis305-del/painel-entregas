# Gera um dataset sintético da base de teste XPT-DEV para validar o dashboard.
# Saída: datasets/dev-test/ (backlog + 10 trackings + 3 DS + 1 SLA + LEIA-ME).
# Os formatos casam EXATAMENTE com os parsers do app.
#   uso: python scripts/gen-dev-dataset.py
import openpyxl, csv, os, random
random.seed(42)

ROOT = "datasets/dev-test"
STATION = "XPT_DEV"
N_PKG = 300            # pacotes do backlog (conjunto de stuck do dia)
N_MOMENTS = 10         # momentos de tracking (08:00 .. 21:30)
HORAS = ["08-00-00","09-30-00","11-00-00","12-30-00","14-00-00",
         "15-30-00","17-00-00","18-30-00","20-00-00","21-30-00"]
DATA = "2026-06-23"

os.makedirs(f"{ROOT}/00-backlog", exist_ok=True)
os.makedirs(f"{ROOT}/10-tracking", exist_ok=True)
os.makedirs(f"{ROOT}/20-ds", exist_ok=True)
os.makedirs(f"{ROOT}/30-sla", exist_ok=True)

NOMES = ["Joao Silva","Maria Souza","Pedro Lima","Ana Costa","Carlos Rocha",
         "Lucia Alves","Marcos Dias","Paula Nunes","Rafael Melo","Bruna Pinto",
         "Tiago Ramos","Vera Cardoso","Diego Faria","Sofia Barros","Igor Teixeira"]
DRIVERS = [(9990001+i, NOMES[i]) for i in range(len(NOMES))]
def drv_name(d): return f"[{d[0]}] {d[1]}"

STUCK_STATUSES = ["OnHold","Hub_Assigned","Hub_Received","Delivering","SOC_LHTransported","Hub_Packed"]

# ---- pacotes: codigo, motorista, momento em que é entregue (99 = nunca hoje) ----
pkgs = []
for i in range(N_PKG):
    d = random.choice(DRIVERS)
    deliver = 99 if random.random() < 0.12 else random.randint(1, N_MOMENTS)
    pkgs.append({
        "codigo": f"BRDEV{i:06d}",
        "driver": d,
        "deliver": deliver,
        "dias": round(random.uniform(1.1, 12.5), 2),
        "status0": random.choice(STUCK_STATUSES),
    })

# ---------------- BACKLOG (xlsx) ----------------
hdr = ["Agency Name","Station ID","Shipment ID","Station Name","Zone ID","Zone Name",
       "Order Account","Inbound Time","LM Leg Aging","LM Leg Days","LM Hub Aging","LM Hub Days",
       "Delivery Attempts","No. Attempts","Latest Status","Latest Operation Time","Latest User Name","Destination Station"]
wb = openpyxl.Workbook(); ws = wb.active; ws.append(hdr)
for p in pkgs:
    ws.append(["DEVSPOT", 9999, p["codigo"], STATION, "", "", "Marketplace",
               f"{DATA} 09:00:00", "[1 day, 3 days)", round(p["dias"]*0.9,2), "[1 day, 3 days)", p["dias"],
               "1 attempt", 1, p["status0"], f"{DATA} 10:00:00", drv_name(p["driver"]), STATION])
wb.save(f"{ROOT}/00-backlog/backlog_XPT-DEV.xlsx")

# ---------------- TRACKING (10 csv) ----------------
trk_hdr = ["Order ID","SLS Tracking Number","Shopee Order SN","Status","Current Station","Driver ID","Driver Name"]
def status_at(p, k):
    if p["deliver"] <= k: return "Delivered"
    if p["deliver"] == k+1: return "Delivering"
    return random.choice(["OnHold","Hub_Assigned","Hub_Received","Delivering"])
for k in range(1, N_MOMENTS+1):
    fn = f"{ROOT}/10-tracking/export_return_order_{DATA}_{HORAS[k-1]}.csv"
    with open(fn, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(trk_hdr)
        for p in pkgs:
            st = status_at(p, k)
            w.writerow([p["codigo"], p["codigo"], p["codigo"], st, STATION, p["driver"][0], p["driver"][1]])

# ---------------- DS (3 xlsx em momentos diferentes) ----------------
ds_hdr = ["Driver Name","Agency","Driver Station","Contract Type","Vehicle Type","Assigned",
          "Delivery Progress","Handed Over","Delivered (#)","Delivered (%)","Delivering (#)","Delivering (%)",
          "Failed Delivery (#)","Failed Delivery (%)","Stuck at Delivering","On-hold","Assigned Time",
          "Time Since Last Delivery","Idle Tag","Expected Delivered Percentage (%)","Delayed Flags"]
assigned = {d[0]: random.randint(22, 45) for d in DRIVERS}   # saiu por motorista (fixo no dia)
ds_moments = [("08-00-00", 0.50), ("14-00-00", 0.75), ("20-00-00", 0.92)]
for hora, prog in ds_moments:
    wb = openpyxl.Workbook(); ws = wb.active; ws.append(ds_hdr)
    for d in DRIVERS:
        a = assigned[d[0]]
        ent = round(a * prog * random.uniform(0.95, 1.03)); ent = min(ent, a)
        resto = a - ent
        rota = round(resto * 0.5); falha = resto - rota
        pctd = f"{ent/a*100:.2f}%"
        ws.append([drv_name(d), "DEVSPOT", STATION, "Agency", "4WH", a, f"{prog*100:.0f}%", a,
                   ent, pctd, rota, "0%", falha, "0%", 0, falha, f"{DATA} 08:00:00", "1:00", "Working", "90%", "Normal"])
    wb.save(f"{ROOT}/20-ds/fleets_{DATA}_{hora}.xlsx")

# ---------------- SLA (1 csv) ----------------
sla_hdr = trk_hdr
N_SLA = 500
sla_mix = (["Delivered"]*460 + ["OnHold"]*15 + ["Delivering"]*5 +
           ["SOC_LHTransported"]*8 + ["Hub_LHArrived"]*4 + ["Hub_Received"]*5 + ["Hub_Assigned"]*3)
random.shuffle(sla_mix)
with open(f"{ROOT}/30-sla/export_return_order_{DATA}_22-00-00.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(sla_hdr)
    for i in range(N_SLA):
        d = random.choice(DRIVERS)
        w.writerow([f"BRDEVSLA{i:05d}", "", "", sla_mix[i % len(sla_mix)], STATION, d[0], d[1]])

# ---------------- LEIA-ME ----------------
ainda = [sum(1 for p in pkgs if p["deliver"] > k) for k in range(0, N_MOMENTS+1)]
with open(f"{ROOT}/LEIA-ME.txt", "w", encoding="utf-8") as f:
    f.write("DATASET DE TESTE — base XPT-DEV (Teste)\n")
    f.write("="*50 + "\n\n")
    f.write("ORDEM DE UPLOAD (subtab Uploads, como ADM):\n\n")
    f.write("1) BACKLOG  -> 00-backlog/backlog_XPT-DEV.xlsx\n")
    f.write(f"   {N_PKG} pacotes, todos stuck.\n\n")
    f.write("2) TRACKING -> 10-tracking/*.csv  (suba UM POR VEZ, na ordem do horario)\n")
    f.write("   Cada um = 1 ponto no burn-down. Sequencia de 'ainda stuck':\n")
    f.write("   " + " -> ".join(f"{a}" for a in ainda) + "\n")
    f.write(f"   (de {ainda[0]} no backlog ate ~{ainda[-1]} no fim do dia)\n\n")
    f.write("3) DS       -> 20-ds/*.xlsx  (3 momentos: 08h/14h/20h, um por vez)\n")
    f.write("   DS% sobe ~50% -> ~75% -> ~92%.\n\n")
    f.write("4) SLA      -> 30-sla/*.csv  (escolha a base XPT-DEV no uploader)\n")
    f.write("   ~92% entregue.\n")

print("OK -> datasets/dev-test/")
print(f"  backlog: {N_PKG} pacotes")
print(f"  tracking: {N_MOMENTS} arquivos | ainda-stuck por momento: {ainda}")
print(f"  ds: {len(ds_moments)} momentos | sla: {N_SLA} pacotes")
