IF OBJECT_ID('dbo.DailyUsage', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DailyUsage (
    tenant_id   NVARCHAR(40) NOT NULL,
    usage_date  DATE         NOT NULL,                      -- UTC day
    used_count  INT          NOT NULL CONSTRAINT DF_DU_used DEFAULT 0,
    updated_at  DATETIME2(3) NOT NULL CONSTRAINT DF_DU_upd DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DailyUsage PRIMARY KEY (tenant_id, usage_date),
    CONSTRAINT CK_DU_nonneg CHECK (used_count >= 0)
  );
END
