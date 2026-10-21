import pymssql, os, glob

SERVER   = "sql-textforge-dev.database.windows.net"
DATABASE = "textforge"
USER     = "textforgeadmin"
PASSWORD = "TF@Hack2026!"
MIGRATIONS_DIR = r"c:\Users\Noothan\Desktop\TextForge\UC-06_text-processing\migrations"

conn = pymssql.connect(server=SERVER, user=USER, password=PASSWORD, database=DATABASE, tds_version="7.3")
conn.autocommit(True)
cur = conn.cursor()
print("Connected!")

# Only run 003 (others already applied)
filepath = os.path.join(MIGRATIONS_DIR, "003_platform_seed.sql")
print(f"Re-applying 003_platform_seed.sql...")
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()
batches = [b.strip() for b in content.split("GO") if b.strip()]
if not batches:
    batches = [content]
for batch in batches:
    try:
        cur.execute(batch)
        print("  [OK]")
    except Exception as e:
        print(f"  [WARN] {e}")

conn.close()
print("Migration 003 done.")
