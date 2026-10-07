SET NOCOUNT ON;
USE [master];
IF DB_ID('DormMaster') IS NULL
BEGIN
  SELECT 'DB_NOT_FOUND' AS result;
  SET NOEXEC ON;
END

DECLARE @now varchar(8) = REPLACE(CONVERT(varchar(8), GETDATE(), 108), ':', '');
DECLARE @path nvarchar(400) = N'/var/opt/mssql/backup/DormMaster_preLedger_' + @now + N'.bak';

BACKUP DATABASE [DormMaster]
TO DISK = @path
WITH INIT, COMPRESSION, STATS = 5;

SELECT 'BACKUP_OK' AS result, @path AS path;
