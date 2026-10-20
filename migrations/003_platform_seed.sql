IF OBJECT_ID('dbo.Tenants', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Tenants (
    tenant_id            NVARCHAR(40)  NOT NULL CONSTRAINT PK_Tenants PRIMARY KEY,
    display_name         NVARCHAR(80)  NOT NULL,
    plan                 VARCHAR(10)   NOT NULL,                 -- Basic | Pro
    subscription_status  VARCHAR(10)   NOT NULL,                 -- Active | Suspended
    period_end           DATE          NULL,                     -- cosmetic, shown in UI
    CONSTRAINT CK_Tenants_plan   CHECK (plan IN ('Basic','Pro')),
    CONSTRAINT CK_Tenants_status CHECK (subscription_status IN ('Active','Suspended'))
  );
END;

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    user_id        NVARCHAR(40)  NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    tenant_id      NVARCHAR(40)  NOT NULL CONSTRAINT FK_Users_Tenant REFERENCES dbo.Tenants(tenant_id),
    email          NVARCHAR(160) NOT NULL,
    display_name   NVARCHAR(80)  NOT NULL,
    role           VARCHAR(10)   NOT NULL,                       -- Operator | Viewer
    password_hash  NVARCHAR(200) NOT NULL,                       -- argon2id
    is_active      BIT           NOT NULL DEFAULT 1,
    CONSTRAINT CK_Users_role CHECK (role IN ('Operator','Viewer')),
    CONSTRAINT UX_Users_email UNIQUE (email)
  );
END;
