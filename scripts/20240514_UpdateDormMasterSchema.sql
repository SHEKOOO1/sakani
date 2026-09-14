-- استخدام قاعدة بيانات DormMaster
USE [DormMaster];
GO

-- 1. تحديث جدول الطلاب بالحقول الجديدة
ALTER TABLE Students ADD 
    governorate NVARCHAR(100),
    village NVARCHAR(100),
    church NVARCHAR(200),
    confession_priest NVARCHAR(200),
    is_servant BIT DEFAULT 0,
    servant_services NVARCHAR(MAX), -- تخزين أنواع الخدمة كنص أو JSON
    is_deacon BIT DEFAULT 0,
    deacon_rank NVARCHAR(100);
GO

-- ملاحظة: في SQL Server لا يفضل حذف الأعمدة مباشرة إذا كانت مرتبطة بقيود، 
-- ولكن برمجياً سنتوقف عن استخدام عمود religion.

-- 2. إنشاء جدول التليفونات المتعددة
CREATE TABLE StudentPhones (
    id INT PRIMARY KEY IDENTITY(1,1),
    student_id UNIQUEIDENTIFIER NOT NULL,
    phone_type NVARCHAR(50), -- محمول، واتساب، إلخ
    label NVARCHAR(100),      -- وصف الرقم (رقم الأب، رقم العمل)
    phone_number NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_StudentPhones_Students FOREIGN KEY (student_id) 
        REFERENCES Students(id) ON DELETE CASCADE
);
GO

-- 3. إنشاء جدول الوثائق والملفات المرفوعة
CREATE TABLE StudentDocuments (
    id INT PRIMARY KEY IDENTITY(1,1),
    student_id UNIQUEIDENTIFIER NOT NULL,
    doc_type NVARCHAR(100), -- بطاقة وجه، بطاقة ظهر، تزكية، إلخ
    file_path NVARCHAR(MAX) NOT NULL,
    file_name NVARCHAR(255),
    upload_date DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_StudentDocuments_Students FOREIGN KEY (student_id) 
        REFERENCES Students(id) ON DELETE CASCADE
);
GO

-- 4. جدول وسيط لإدارة الطلاب للأنشطة (الخطوة 7.2)
CREATE TABLE ItemManagers (
    user_id UNIQUEIDENTIFIER NOT NULL,
    item_id UNIQUEIDENTIFIER NOT NULL,
    item_type NVARCHAR(50), -- activity, competition, event
    PRIMARY KEY (user_id, item_id)
);
GO