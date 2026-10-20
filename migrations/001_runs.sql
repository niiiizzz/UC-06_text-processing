IF OBJECT_ID('dbo.Runs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Runs (
    run_id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Runs PRIMARY KEY DEFAULT NEWID(),
    tenant_id         NVARCHAR(40)     NOT NULL,
    idempotency_key   NVARCHAR(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
    input_fingerprint CHAR(64)         NOT NULL,           -- sha256 hex of canonical {operation, records}
    operation         VARCHAR(10)      NOT NULL,
    status            VARCHAR(10)      NOT NULL,
    submitted_by      NVARCHAR(40)     NOT NULL,
    row_count         TINYINT          NOT NULL,
    valid_rows        TINYINT          NULL,
    invalid_rows      TINYINT          NULL,
    result_blob_path  NVARCHAR(300)    NULL,
    error_code        NVARCHAR(60)     NULL,
    error_message     NVARCHAR(400)    NULL,
    created_at        DATETIME2(3)     NOT NULL CONSTRAINT DF_Runs_created DEFAULT SYSUTCDATETIME(),
    finished_at       DATETIME2(3)     NULL,
    CONSTRAINT CK_Runs_operation CHECK (operation IN ('validate','process')),
    CONSTRAINT CK_Runs_status    CHECK (status IN ('Running','Succeeded','Failed')),
    CONSTRAINT CK_Runs_rows      CHECK (row_count BETWEEN 1 AND 10)
  );
  CREATE UNIQUE INDEX UX_Runs_tenant_key ON dbo.Runs (tenant_id, idempotency_key);
  CREATE INDEX IX_Runs_tenant_created ON dbo.Runs (tenant_id, created_at DESC) INCLUDE (status, operation);
END
