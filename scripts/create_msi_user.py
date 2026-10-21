import pyodbc, struct, os
from azure.identity import DefaultAzureCredential

SERVER = "sql-textforge-dev.database.windows.net"
DB = "textforge"
MSI = "id-textforge-dev"

print("Getting MSI token...")
cred = DefaultAzureCredential()
tok = cred.get_token("https://database.windows.net/.default")
tb = tok.token.encode("utf-16-le")
ts = struct.pack(f"=i{len(tb)}s", len(tb), tb)

print("Connecting to SQL via MSI...")
conn = pyodbc.connect(
    f"DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={SERVER};DATABASE={DB}",
    attrs_before={1256: ts}
)
conn.autocommit = True
cur = conn.cursor()
print("Connected!")

stmts = [
    f"IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name=N'{MSI}') CREATE USER [{MSI}] FROM EXTERNAL PROVIDER",
    f"ALTER ROLE db_datareader ADD MEMBER [{MSI}]",
    f"ALTER ROLE db_datawriter ADD MEMBER [{MSI}]",
    f"ALTER ROLE db_ddladmin ADD MEMBER [{MSI}]",
]
for s in stmts:
    try:
        cur.execute(s)
        print(f"  OK: {s[:60]}")
    except Exception as e:
        print(f"  WARN: {e}")

conn.close()
print("MSI USER SETUP COMPLETE")
