IF OBJECT_ID('dbo.Pledges', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Pledges (
    pledge_id     NVARCHAR(40)  NOT NULL CONSTRAINT PK_Pledges PRIMARY KEY,   -- plg_...
    tenant_id     NVARCHAR(40)  NOT NULL,
    created_by    NVARCHAR(40)  NOT NULL,
    target_plan   VARCHAR(10)   NOT NULL,
    amount_minor  INT           NOT NULL,                  -- paise
    currency      CHAR(3)       NOT NULL DEFAULT 'INR',
    status        VARCHAR(10)   NOT NULL,                  -- open|held|settled|declined|expired
    receipt_no    NVARCHAR(40)  NULL,
    receipt_sig   CHAR(64)      NULL,
    created_at    DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    settled_at    DATETIME2(3)  NULL,
    expires_at    DATETIME2(3)  NOT NULL
  );
  CREATE INDEX IX_Pledges_tenant ON dbo.Pledges (tenant_id, created_at DESC);
END;
