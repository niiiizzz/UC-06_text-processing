import pymssql, os, glob

SERVER   = "sql-textforge-dev.database.windows.net"
DATABASE = "textforge"
USER     = "textforgeadmin"
PASSWORD = "TF@Hack2026!"
MSI_NAME = "id-textforge-dev"
MIGRATIONS_DIR = r"c:\Users\Noothan\Desktop\TextForge\UC-06_text-processing\migrations"

print(f"Connecting to {SERVER}/{DATABASE}...")
conn = pymssql.connect(server=SERVER, user=USER, password=PASSWORD, database=DATABASE, tds_version="7.3")
conn.autocommit(True)
cur = conn.cursor()
print("Connected OK!")

# Run all migration SQL files
sql_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
for filepath in sql_files:
    fname = os.path.basename(filepath)
    print(f"  Applying {fname}...")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    batches = [b.strip() for b in content.split("GO") if b.strip()]
    if not batches:
        batches = [content]
    for batch in batches:
        try:
            cur.execute(batch)
            print(f"    [OK] {fname}")
        except Exception as e:
            print(f"    [WARN] {fname}: {e}")

# Create contained DB user for managed identity
print(f"\nCreating contained DB user for MSI [{MSI_NAME}]...")
stmts = [
    f"IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name=N'{MSI_NAME}') CREATE USER [{MSI_NAME}] FROM EXTERNAL PROVIDER;",
    f"ALTER ROLE db_datareader ADD MEMBER [{MSI_NAME}];",
    f"ALTER ROLE db_datawriter ADD MEMBER [{MSI_NAME}];",
    f"ALTER ROLE db_ddladmin   ADD MEMBER [{MSI_NAME}];",
]
for stmt in stmts:
    try:
        cur.execute(stmt)
        print(f"  [OK] {stmt[:60]}...")
    except Exception as e:
        print(f"  [WARN] {e}")

conn.close()
print("\nAll done! Azure SQL schema + MSI user ready.")
