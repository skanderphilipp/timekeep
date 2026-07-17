#!/usr/bin/env python3
"""Generate missing translations for Arabic and French PO files."""

import re
import os
import sys

DASHBOARD_SRC = os.path.join(os.path.dirname(__file__), '..', 'dashboard', 'src')

# ── Arabic translations ──────────────────────────────────────────────────────

AR_TRANSLATIONS = {
    # Placeholder-based keys
    "{0} is now connected and active.": "{0} متصل ونشط الآن.",
    "{count, plural, one {# device} other {# devices}} in this group. Remove devices here or assign new ones via the device edit form.": "{count, plural, one {جهاز واحد} other {# أجهزة}} في هذه المجموعة. قم بإزالة الأجهزة هنا أو تعيين أجهزة جديدة عبر نموذج تعديل الجهاز.",
    "{entityType} {entityId}": "{entityType} {entityId}",
    
    # Placeholder / example values
    "1001": "1001",
    "192.168.1.0/24": "192.168.1.0/24",
    
    # Workspace / Setup
    "Acme Corp": "شركة أكما",
    "Configure Workspace": "تكوين مساحة العمل",
    "Configure your workspace and create your admin account.": "قم بتكوين مساحة العمل الخاصة بك وإنشاء حساب المسؤول.",
    "Create Workspace": "إنشاء مساحة العمل",
    "Set up your organization's workspace for timekeep.": "قم بإعداد مساحة العمل الخاصة بمؤسستك لـ timekeep.",
    "Workspace Name": "اسم مساحة العمل",
    "Workspace name is required": "اسم مساحة العمل مطلوب",
    "Workspace name must be at least 2 characters": "يجب أن يكون اسم مساحة العمل حرفين على الأقل",
    "Your company or organization name. Shown on the login screen.": "اسم شركتك أو مؤسستك. يظهر على شاشة تسجيل الدخول.",
    
    # Admin account
    "Create Admin Account": "إنشاء حساب المسؤول",
    "Set up the initial administrator credentials for timekeep.": "قم بإعداد بيانات اعتماد المسؤول الأولية لـ timekeep.",
    "Choose a secure username for the administrator account.": "اختر اسم مستخدم آمن لحساب المسؤول.",
    "Minimum 6 characters. Store this safely.": "الحد الأدنى 6 أحرف. احتفظ بها بأمان.",
    "Admin Username": "اسم المستخدم المسؤول",
    "Admin Password": "كلمة مرور المسؤول",
    
    # Dashboard
    "Attendance overview": "نظرة عامة على الحضور",
    "Attendance overview and device status.": "نظرة عامة على الحضور وحالة الأجهزة.",
    "Attendance records will appear here as employees scan in.": "ستظهر سجلات الحضور هنا عند تسجيل دخول الموظفين.",
    "Manage employee records and view attendance.": "إدارة سجلات الموظفين وعرض الحضور.",
    "Manage organizational units and work policies.": "إدارة الوحدات التنظيمية وسياسات العمل.",
    "Manage reusable work policy templates for departments.": "إدارة نماذج سياسات العمل القابلة لإعادة الاستخدام للأقسام.",
    "Create your first department to organize employees.": "أنشئ قسمك الأول لتنظيم الموظفين.",
    "Create your first device group to organize scanners.": "أنشئ مجموعة الأجهزة الأولى لتنظيم الماسحات الضوئية.",
    "Create your first work policy template to standardize schedules.": "أنشئ أول نموذج لسياسة العمل لتوحيد الجداول.",
    "Add your first device or scan the network to discover ZKTeco scanners.": "أضف جهازك الأول أو امسح الشبكة لاكتشاف ماسحات ZKTeco.",
    "Add your first employee to get started.": "أضف موظفك الأول للبدء.",
    "Add your first dashboard user to get started.": "أضف أول مستخدم للوحة التحكم للبدء.",
    "Add your first integration endpoint to get started.": "أضف أول نقطة نهاية تكامل للبدء.",
    "Open attendance reports and exports": "فتح تقارير الحضور والتصدير",
    "View Reports": "عرض التقارير",
    
    # Employees
    "Add Employee": "إضافة موظف",
    "Back to Employees": "العودة إلى الموظفين",
    "Employee not found": "الموظف غير موجود",
    "Could not load employee information.": "تعذر تحميل معلومات الموظف.",
    "This employee may have been removed.": "ربما تمت إزالة هذا الموظف.",
    "Employees": "الموظفين",
    "No employees": "لا يوجد موظفون",
    "No employees match": "لا يوجد موظفون مطابقون",
    "No attendance records found for this period.": "لم يتم العثور على سجلات حضور لهذه الفترة.",
    "Manage employee records and view attendance.": "إدارة سجلات الموظفين وعرض الحضور.",
    
    # Employee form
    "Employee PIN": "الرقم التعريفي للموظف",
    "Full Name": "الاسم الكامل",
    "External ID": "المعرف الخارجي",
    "Department": "القسم",
    "Department filter": "تصفية القسم",
    "Unique PIN, full name, and external reference for this employee.": "رقم تعريفي فريد والاسم الكامل والمرجع الخارجي لهذا الموظف.",
    "Employee's full name as displayed in reports": "الاسم الكامل للموظف كما يظهر في التقارير",
    "Numeric employee ID used on the biometric scanner (e.g., 1001)": "المعرف الرقمي للموظف المستخدم على الماسح البيومتري (مثال: 1001)",
    "Identifier from external HR/ERP system (optional)": "معرف من نظام HR/ERP خارجي (اختياري)",
    "Organizational unit (optional — leave empty if unassigned)": "الوحدة التنظيمية (اختياري — اتركه فارغاً إذا لم يتم تعيينه)",
    "Employee synced to devices successfully.": "تمت مزامنة الموظف مع الأجهزة بنجاح.",
    
    # Biometric / Enrollment
    "Biometric Types": "الأنواع البيومترية",
    "Enroll": "تسجيل",
    "Enroll Employee": "تسجيل موظف",
    "Enrollment failed. Check the PIN and try again.": "فشل التسجيل. تحقق من الرقم التعريفي وحاول مرة أخرى.",
    "Assign an employee PIN and biometric types to this device.": "تعيين رقم تعريفي للموظف وأنواع بيومترية لهذا الجهاز.",
    "e.g. 145": "مثال: 145",
    "Fingerprint": "بصمة الإصبع",
    "Face": "الوجه",
    "Card": "بطاقة",
    "Password": "كلمة المرور",
    "Fingerprints": "بصمات الأصابع",
    "Faces": "الوجوه",
    
    # Devices
    "Loading device activity…": "جارٍ تحميل نشاط الجهاز…",
    "Loading devices…": "جارٍ تحميل الأجهزة…",
    "No Activity Yet": "لا يوجد نشاط بعد",
    "Device activity will appear here once the engine starts collecting events.": "سيظهر نشاط الجهاز هنا بمجرد بدء المحرك في جمع الأحداث.",
    "No records found": "لم يتم العثور على سجلات",
    "No records match the current filters. Try adjusting or clearing them.": "لا توجد سجلات تطابق عوامل التصفية الحالية. حاول تعديلها أو مسحها.",
    "No records yet.": "لا توجد سجلات بعد.",
    "Try adjusting or clearing your search and filter.": "حاول تعديل أو مسح البحث والتصفية.",
    "Try adjusting or clearing your search.": "حاول تعديل أو مسح البحث.",
    "Try adjusting your search.": "حاول تعديل بحثك.",
    "Copy from Device": "نسخ من جهاز",
    "Copy Users": "نسخ المستخدمين",
    "Copy Users from Device": "نسخ المستخدمين من جهاز",
    "Source Device": "الجهاز المصدر",
    "Select a source device to copy its enrolled users to this device.": "حدد جهازاً مصدراً لنسخ مستخدميه المسجلين إلى هذا الجهاز.",
    "Copy failed. Check that both devices are online and try again.": "فشل النسخ. تحقق من أن كلا الجهازين متصلان وحاول مرة أخرى.",
    "No other devices available as source. Add another device first.": "لا توجد أجهزة أخرى متاحة كمصدر. أضف جهازاً آخر أولاً.",
    "Device actions": "إجراءات الجهاز",
    "Last Sync": "آخر مزامنة",
    "MAC Address": "عنوان MAC",
    "Platform": "المنصة",
    "Select a device…": "اختر جهازاً…",
    "Refresh Data": "تحديث البيانات",
    "Refresh Devices": "تحديث الأجهزة",
    "Reload device list from server": "إعادة تحميل قائمة الأجهزة من الخادم",
    
    # Device operations
    "Sync": "مزامنة",
    "Sync Now": "مزامنة الآن",
    "Sync All": "مزامنة الكل",
    "Sync to Devices": "مزامنة إلى الأجهزة",
    "Sync complete": "اكتملت المزامنة",
    "Sync failed": "فشلت المزامنة",
    "Sync failed: {err.message}": "فشلت المزامنة: {err.message}",
    "Sync started for all devices.": "بدأت المزامنة لجميع الأجهزة.",
    "Syncing…": "جارٍ المزامنة…",
    "Failed to start sync.": "فشل بدء المزامنة.",
    "Resync": "إعادة المزامنة",
    "Resync Device": "إعادة مزامنة الجهاز",
    "Restart": "إعادة التشغيل",
    "Restart Device": "إعادة تشغيل الجهاز",
    "Sync Clock": "مزامنة الساعة",
    "The device will reboot and be offline for about 30–60 seconds. Attendance records already stored on the device are safe.": "سيتم إعادة تشغيل الجهاز وسيكون غير متصل لمدة 30-60 ثانية تقريباً. سجلات الحضور المخزنة بالفعل على الجهاز آمنة.",
    "This will pull all users and attendance records from the device and push any pending changes. The device will remain online during this operation.": "سيؤدي هذا إلى سحب جميع المستخدمين وسجلات الحضور من الجهاز ودفع أي تغييرات معلقة. سيبقى الجهاز متصلاً خلال هذه العملية.",
    "This will set the device clock to match the server time. Any existing attendance records will be unaffected.": "سيؤدي هذا إلى ضبط ساعة الجهاز لتتوافق مع وقت الخادم. لن تتأثر أي سجلات حضور موجودة.",
    
    # Device form
    "All": "الكل",
    "All commands": "جميع الأوامر",
    "All Departments": "جميع الأقسام",
    "All Methods": "جميع الطرق",
    "Anomalies": "الحالات الشاذة",
    "Anomaly": "حالة شاذة",
    "Anomaly Detected": "تم اكتشاف حالة شاذة",
    "Show all": "إظهار الكل",
    "Hide all": "إخفاء الكل",
    "Options": "خيارات",
    "Push": "دفع",
    "Enabled": "ممكّن",
    "Disabled": "معطّل",
    "Default": "افتراضي",
    "Custom": "مخصص",
    "Auto": "تلقائي",
    "None": "لا شيء",
    
    # Punch records
    "Failed": "فشل",
    "Detail": "تفاصيل",
    "Failed to load {resource}. Check your network connection and try again.": "فشل تحميل {resource}. تحقق من اتصال الشبكة وحاول مرة أخرى.",
    "Could not load {entityType} information.": "تعذر تحميل معلومات {entityType}.",
    "Server Unreachable": "الخادم غير متاح",
    "Cannot reach the server. Is it running?": "لا يمكن الوصول إلى الخادم. هل هو قيد التشغيل؟",
    "Could not connect to the timekeep server. Check that the backend is running and try again.": "تعذر الاتصال بخادم timekeep. تحقق من أن الخادم قيد التشغيل وحاول مرة أخرى.",
    "Failed to load employees.": "فشل تحميل الموظفين.",
    
    # API Keys / Integrations
    "Revoke API Key": "إلغاء مفتاح API",
    "Revoke API key \\": "إلغاء مفتاح API \\",
    "Human-readable name for this API key": "اسم قابل للقراءة لمفتاح API هذا",
    "When this API key expires. Choose \"No expiry\" for permanent keys.": "موعد انتهاء صلاحية مفتاح API هذا. اختر \"بدون انتهاء\" للمفاتيح الدائمة.",
    "Generated": "تم إنشاؤه",
    "Confidential": "سري",
    "API key created successfully.": "تم إنشاء مفتاح API بنجاح.",
    "Search by title…": "بحث بالعنوان…",
    "No endpoints match": "لا توجد نقاط نهاية مطابقة",
    "Endpoints": "نقاط النهاية",
    
    # Device registration
    "Register Device": "تسجيل جهاز",
    "Register a new biometric scanner": "تسجيل ماسح بيومتري جديد",
    "Scan your network, configure, and provision a ZKTeco scanner.": "امسح شبكتك، وقم بتكوين وتجهيز ماسح ZKTeco.",
    "Register": "تسجيل",
    "Test & Register": "اختبار وتسجيل",
    "Scanning…": "جارٍ المسح…",
    "Scan failed. Check the subnet and try again.": "فشل المسح. تحقق من الشبكة الفرعية وحاول مرة أخرى.",
    "No ZKTeco devices found on this subnet.": "لم يتم العثور على أجهزة ZKTeco على هذه الشبكة الفرعية.",
    "Found {results.length} device(s). Select one to configure.": "تم العثور على {results.length} جهاز(أجهزة). اختر واحداً للتكوين.",
    "Ready to register the following device:": "جاهز لتسجيل الجهاز التالي:",
    "Configure Device": "تكوين الجهاز",
    "Connection test failed": "فشل اختبار الاتصال",
    "Connection test passed": "نجح اختبار الاتصال",
    "Provision & Test Connection": "تجهيز واختبار الاتصال",
    "Provisioning device…": "جارٍ تجهيز الجهاز…",
    "Provisioning Failed": "فشل التجهيز",
    "Device Registered": "تم تسجيل الجهاز",
    "Device registered successfully.": "تم تسجيل الجهاز بنجاح.",
    "Failed to provision device. Check the connection and try again.": "فشل تجهيز الجهاز. تحقق من الاتصال وحاول مرة أخرى.",
    "Missing device configuration. Go back and fill in all fields.": "تكوين الجهاز مفقود. عد واملأ جميع الحقول.",
    "Back to Configure": "العودة إلى التكوين",
    
    # Device detail
    "Device {sn}": "الجهاز {sn}",
    "SN: {device.serial_number}": "الرقم التسلسلي: {device.serial_number}",
    "Delete device": "حذف الجهاز",
    "Delete Device": "حذف الجهاز",
    "Are you sure you want to remove \\": "هل أنت متأكد أنك تريد إزالة \\",
    "This device may have been removed or the serial number is incorrect.": "ربما تمت إزالة هذا الجهاز أو أن الرقم التسلسلي غير صحيح.",
    "Device not found": "الجهاز غير موجود",
    "Failed to remove device.": "فشل إزالة الجهاز.",
    "Failed to update device.": "فشل تحديث الجهاز.",
    "Device updated.": "تم تحديث الجهاز.",
    "Device removed from group.": "تمت إزالة الجهاز من المجموعة.",
    "Label is required": "التسمية مطلوبة",
    "Model": "الطراز",
    "Serial": "الرقم التسلسلي",
    "Firmware": "البرنامج الثابت",
    "Host": "المضيف",
    "IP": "عنوان IP",
    "Port": "المنفذ",
    "IP address or hostname of the device.": "عنوان IP أو اسم مضيف الجهاز.",
    "Human-readable name for this scanner.": "اسم قابل للقراءة لهذا الماسح.",
    "Device communication key (default: 0).": "مفتاح اتصال الجهاز (الافتراضي: 0).",
    "Enable real-time attendance push from this device.": "تمكين دفع الحضور في الوقت الفعلي من هذا الجهاز.",
    "Default: {DEFAULT_ZKTECO_PORT}": "الافتراضي: {DEFAULT_ZKTECO_PORT}",
    "Port must be at least {MIN_PORT}": "يجب أن يكون المنفذ {MIN_PORT} على الأقل",
    "Port must be at most {MAX_PORT}": "يجب أن يكون المنفذ {MAX_PORT} على الأكثر",
    "Step \"{currentStep.step}\" not found in stepMap.": "الخطوة \"{currentStep.step}\" غير موجودة في stepMap.",
    
    # Departments
    "Add Department": "إضافة قسم",
    "Departments": "الأقسام",
    "Department Name": "اسم القسم",
    "Department Information": "معلومات القسم",
    "Department created successfully.": "تم إنشاء القسم بنجاح.",
    "Department updated successfully.": "تم تحديث القسم بنجاح.",
    "Organizational unit name (e.g., Warehouse, Office, Sales)": "اسم الوحدة التنظيمية (مثال: المستودع، المكتب، المبيعات)",
    "Give the department a clear and unique name.": "أعط القسم اسماً واضحاً وفريداً.",
    "Description": "الوصف",
    "Description must be 500 characters or fewer": "يجب أن يكون الوصف 500 حرف أو أقل",
    "Optional description of this policy's purpose": "وصف اختياري لغرض هذه السياسة",
    "This department has no employees assigned yet.": "لم يتم تعيين موظفين لهذا القسم بعد.",
    "No departments": "لا توجد أقسام",
    "No departments match": "لا توجد أقسام مطابقة",
    "Search by name…": "بحث بالاسم…",
    "Delete {deleting?.name ?? \"\"}? This cannot be undone.": "حذف {deleting?.name ?? \"\"}؟ لا يمكن التراجع عن هذا الإجراء.",
    "Name must be 100 characters or fewer": "يجب أن يكون الاسم 100 حرف أو أقل",
    "Name must be 200 characters or fewer": "يجب أن يكون الاسم 200 حرف أو أقل",
    
    # Device Groups
    "Add Device Group": "إضافة مجموعة أجهزة",
    "Add Group": "إضافة مجموعة",
    "Device Group": "مجموعة الأجهزة",
    "Device Groups": "مجموعات الأجهزة",
    "Create your first device group to organize scanners.": "أنشئ مجموعة الأجهزة الأولى لتنظيم الماسحات الضوئية.",
    "Organize scanners for department-scoped sync.": "تنظيم الماسحات الضوئية للمزامنة على نطاق القسم.",
    "No devices": "لا توجد أجهزة",
    "No devices in this group": "لا توجد أجهزة في هذه المجموعة",
    "No devices match": "لا توجد أجهزة مطابقة",
    "No device groups": "لا توجد مجموعات أجهزة",
    "No groups match": "لا توجد مجموعات مطابقة",
    "Assign devices to this group via the device edit form. Open any device and select this group in the Config tab.": "قم بتعيين الأجهزة لهذه المجموعة عبر نموذج تعديل الجهاز. افتح أي جهاز واختر هذه المجموعة في علامة تبويب التكوين.",
    "Will sync employees from: {dept}": "سيتم مزامنة الموظفين من: {dept}",
    "Sync employees to all devices in this group.": "مزامنة الموظفين مع جميع الأجهزة في هذه المجموعة.",
    "Target devices: {count}": "الأجهزة المستهدفة: {count}",
    
    # Work Policies
    "Add Work Policy": "إضافة سياسة عمل",
    "Add Policy": "إضافة سياسة",
    "Work Policies": "سياسات العمل",
    "Policy Information": "معلومات السياسة",
    "Save Work Policy": "حفظ سياسة العمل",
    "Work policy saved.": "تم حفظ سياسة العمل.",
    "Failed to save work policy: {err.message}": "فشل حفظ سياسة العمل: {err.message}",
    "A unique name for this work policy template (e.g., \"Night Shift\")": "اسم فريد لنموذج سياسة العمل هذا (مثال: \"وردية ليلية\")",
    "Give the work policy a clear, descriptive name.": "أعط سياسة العمل اسماً واضحاً ووصفياً.",
    "Night Shift": "وردية ليلية",
    "Overnight warehouse shift with extended hours": "وردية مستودع ليلية بساعات ممتدة",
    "Overnight": "ليلي",
    "Organization Default Work Policy": "سياسة العمل الافتراضية للمؤسسة",
    "This policy applies to all departments that do not have a custom work policy.": "تنطبق هذه السياسة على جميع الأقسام التي ليس لديها سياسة عمل مخصصة.",
    "Using organization default work policy.": "استخدام سياسة العمل الافتراضية للمؤسسة.",
    "No work policies": "لا توجد سياسات عمل",
    "No policies match": "لا توجد سياسات مطابقة",
    "Search by name or type…": "بحث بالاسم أو النوع…",
    
    # Work Hours & Schedule
    "Work Hours & Days": "ساعات وأيام العمل",
    "Work Start Time": "وقت بدء العمل",
    "Work End Time": "وقت انتهاء العمل",
    "Working Days": "أيام العمل",
    "Start": "بداية",
    "End": "نهاية",
    "Start of the work day in 24h format": "بداية يوم العمل بتنسيق 24 ساعة",
    "End of the work day in 24h format": "نهاية يوم العمل بتنسيق 24 ساعة",
    "Select the days of the week this policy applies to": "حدد أيام الأسبوع التي تنطبق عليها هذه السياسة",
    "Set the standard work schedule for this policy.": "تعيين جدول العمل القياسي لهذه السياسة.",
    "Schedule": "الجدول",
    "Work start time is required": "وقت بدء العمل مطلوب",
    "Work end time is required": "وقت انتهاء العمل مطلوب",
    "Time must be in HH:MM format": "يجب أن يكون الوقت بتنسيق HH:MM",
    
    # Attendance Thresholds
    "Attendance Thresholds": "حدود الحضور",
    "Configure how attendance rules are calculated.": "تكوين كيفية حساب قواعد الحضور.",
    "Thresholds": "الحدود",
    "Min Hours for Full Day": "الحد الأدنى لساعات اليوم الكامل",
    "Min hours (full day)": "الحد الأدنى للساعات (يوم كامل)",
    "Minimum worked hours to count as a full attendance day": "الحد الأدنى لساعات العمل لاحتساب يوم حضور كامل",
    "Late Threshold (minutes)": "حد التأخير (بالدقائق)",
    "Late threshold (min)": "حد التأخير (دقيقة)",
    "Minutes after work_start before employee is marked late": "عدد الدقائق بعد بدء العمل قبل تسجيل الموظف كمتأخر",
    "Overtime After (hours)": "العمل الإضافي بعد (ساعات)",
    "Overtime after (h)": "العمل الإضافي بعد (ساعة)",
    "Daily hours threshold after which overtime is calculated": "حد الساعات اليومية الذي يتم بعده احتساب العمل الإضافي",
    "Must be 0 or greater": "يجب أن يكون 0 أو أكثر",
    "Must be 24 or fewer": "يجب أن يكون 24 أو أقل",
    "Must be 120 or fewer": "يجب أن يكون 120 أو أقل",
    "Warehouse": "مستودع",
    
    # Export / Reports
    "Export Punches": "تصدير التسجيلات",
    "Attendance Report": "تقرير الحضور",
    "Download punch data as CSV": "تنزيل بيانات التسجيل كـ CSV",
    "Export failed. Please try again.": "فشل التصدير. يرجى المحاولة مرة أخرى.",
    "No records to export.": "لا توجد سجلات للتصدير.",
    "Period Summary": "ملخص الفترة",
    "Punch Log": "سجل التسجيلات",
    "Summary": "ملخص",
    "Charts": "الرسوم البيانية",
    "Timeline": "الجدول الزمني",
    "Calendar": "التقويم",
    "Daily": "يومي",
    "Weekly": "أسبوعي",
    
    # Employee attendance
    "Employee Attendance KPIs": "مؤشرات أداء حضور الموظف",
    "Employee Identity": "هوية الموظف",
    "Attendance calendar for {0} {0}": "تقويم الحضور لـ {0} {0}",
    
    # Dashboard Users
    "Manage dashboard accounts": "إدارة حسابات لوحة التحكم",
    "Set a new password for {user.display_name || user.username}": "تعيين كلمة مرور جديدة لـ {user.display_name || user.username}",
    "Are you sure you want to delete {user?.username ?? \"\"}? This action cannot be undone.": "هل أنت متأكد أنك تريد حذف {user?.username ?? \"\"}؟ لا يمكن التراجع عن هذا الإجراء.",
    "No users match": "لا يوجد مستخدمون مطابقون",
    "Search by username or display name…": "بحث باسم المستخدم أو اسم العرض…",
    
    # General UI
    "Back": "رجوع",
    "Refresh": "تحديث",
    "Retry": "إعادة المحاولة",
    "Remove": "إزالة",
    "Edit name": "تعديل الاسم",
    "Edit {field.label}": "تعديل {field.label}",
    "Remove {text}": "إزالة {text}",
    "Open in main view": "فتح في العرض الرئيسي",
    "Close sidebar": "إغلاق الشريط الجانبي",
    "Page commands": "أوامر الصفحة",
    "Search commands (Cmd+K)": "بحث في الأوامر (Cmd+K)",
    "Search (Cmd+K)": "بحث (Cmd+K)",
    "Search by label, serial, or host…": "بحث بالتسمية أو الرقم التسلسلي أو المضيف…",
    "Search by name or prefix…": "بحث بالاسم أو البادئة…",
    "Check Outs": "تسجيلات الخروج",
    "New": "جديد",
    "Title": "العنوان",
    "Title is required": "العنوان مطلوب",
    "Title must be 150 characters or fewer": "يجب أن يكون العنوان 150 حرفاً أو أقل",
    "workspace": "مساحة العمل",
    "Workspace": "مساحة العمل",
    "of {data.total_employees}": "من {data.total_employees}",
    "unreachable": "غير قابل للوصول",
    
    # Time-related
    "Loading…": "جارٍ التحميل…",
    "Updated {0}h ago": "تم التحديث منذ {0} ساعة",
    "Updated just now": "تم التحديث للتو",
    "Updated {m}m ago": "تم التحديث منذ {m} دقيقة",
    "Updated {s}s ago": "تم التحديث منذ {s} ثانية",

    # Navigation explicit IDs
    "nav.departments": "الأقسام",
    "nav.devices.groups": "مجموعات الأجهزة",
    "nav.employees": "الموظفون",
    "nav.workPolicies": "سياسات العمل",

    # Remaining keys with escaped quotes in PO
    'A unique name for this work policy template (e.g., "Night Shift")': 'اسم فريد لنموذج سياسة العمل هذا (مثال: "وردية ليلية")',

    # Placeholder keys (new format from Lingui extract)
    "Edit {0}": "تعديل {0}",
    "EMP-001": "EMP-001",
    "Failed to save work policy: {0}": "فشل حفظ سياسة العمل: {0}",
    "Found {0} device(s). Select one to configure.": "تم العثور على {0} جهاز(أجهزة). اختر واحداً للتكوين.",
    "Hide password": "إخفاء كلمة المرور",
    "Show password": "إظهار كلمة المرور",
    "PIN is required": "الرقم التعريفي مطلوب",
    "PIN must be 20 characters or fewer": "يجب أن يكون الرقم التعريفي 20 حرفاً أو أقل",
    "PIN must contain only digits": "يجب أن يحتوي الرقم التعريفي على أرقام فقط",
    'Revoke API key "{revokeTarget.name}"? This cannot be undone.': 'إلغاء مفتاح API "{revokeTarget.name}"؟ لا يمكن التراجع عن هذا الإجراء.',
    "Search by name, PIN, or department…": "بحث بالاسم أو الرقم التعريفي أو القسم…",
    'Step "{currentStep.step}" not found in stepMap.': 'الخطوة "{currentStep.step}" غير موجودة في stepMap.',
    "Sync failed: {0}": "فشلت المزامنة: {0}",
}

# ── French translations ──────────────────────────────────────────────────────

FR_TRANSLATIONS = {
    # Placeholder-based keys
    "{0}": "{0}",
    "{0} anomalies detected in current view": "{0} anomalies détectées dans la vue actuelle",
    "{0} is now connected and active.": "{0} est maintenant connecté et actif.",
    "{count, plural, one {# device} other {# devices}} in this group. Remove devices here or assign new ones via the device edit form.": "{count, plural, one {# appareil} other {# appareils}} dans ce groupe. Supprimez des appareils ici ou assignez-en de nouveaux via le formulaire de modification.",
    "{entityType} {entityId}": "{entityType} {entityId}",
    "{resultCount} results": "{resultCount} résultats",
    
    # Placeholder / example values
    "1001": "1001",
    "192.168.1.0/24": "192.168.1.0/24",
    
    # Workspace / Setup
    "Acme Corp": "Acme Corp",
    "Configure Workspace": "Configurer l'espace de travail",
    "Configure your workspace and create your admin account.": "Configurez votre espace de travail et créez votre compte administrateur.",
    "Create Workspace": "Créer l'espace de travail",
    "Set up your organization's workspace for timekeep.": "Configurez l'espace de travail de votre organisation pour timekeep.",
    "Workspace Name": "Nom de l'espace de travail",
    "Workspace name is required": "Le nom de l'espace de travail est requis",
    "Workspace name must be at least 2 characters": "Le nom de l'espace de travail doit contenir au moins 2 caractères",
    "Your company or organization name. Shown on the login screen.": "Le nom de votre entreprise ou organisation. Affiché sur l'écran de connexion.",
    
    # Admin account
    "Create Admin Account": "Créer le compte administrateur",
    "Set up the initial administrator credentials for timekeep.": "Configurez les identifiants administrateur initiaux pour timekeep.",
    "Choose a secure username for the administrator account.": "Choisissez un nom d'utilisateur sécurisé pour le compte administrateur.",
    "Minimum 6 characters. Store this safely.": "Minimum 6 caractères. Conservez-le en lieu sûr.",
    "Admin Username": "Nom d'utilisateur administrateur",
    "Admin Password": "Mot de passe administrateur",
    "Setup failed. The server may already be configured.": "Échec de la configuration. Le serveur est peut-être déjà configuré.",
    
    # System / Settings
    "Version": "Version",
    "Uptime": "Disponibilité",
    "System": "Système",
    "System Health": "Santé du système",
    "System configuration, health status, and account information.": "Configuration système, état de santé et informations du compte.",
    "Healthy": "En bonne santé",
    "Degraded": "Dégradé",
    "dead": "mort",
    "Database": "Base de données",
    "Storage": "Stockage",
    "Engine Pipeline": "Pipeline du moteur",
    "SDK Poll": "Interrogation SDK",
    "Distributors": "Distributeurs",
    "queued": "en attente",
    "delivered": "livré",
    "hosts on": "hôtes sur",
    "device(s) across": "appareil(s) sur",
    "can dispatch on": "peut distribuer sur",
    "Unknown": "Inconnu",
    "None": "Aucun",
    "Last seen": "Dernière vue",
    "Last Seen": "Dernière vue",
    "No": "Non",
    "Yes": "Oui",
    
    # Dashboard
    "Attendance overview": "Aperçu des présences",
    "Attendance overview and device status.": "Aperçu des présences et état des appareils.",
    "Attendance records will appear here as employees scan in.": "Les enregistrements de présence apparaîtront ici lorsque les employés scannent.",
    "Manage employee records and view attendance.": "Gérer les dossiers des employés et voir les présences.",
    "Manage organizational units and work policies.": "Gérer les unités organisationnelles et les politiques de travail.",
    "Manage reusable work policy templates for departments.": "Gérer les modèles de politique de travail réutilisables pour les départements.",
    "Create your first department to organize employees.": "Créez votre premier département pour organiser les employés.",
    "Create your first device group to organize scanners.": "Créez votre premier groupe d'appareils pour organiser les scanners.",
    "Create your first work policy template to standardize schedules.": "Créez votre premier modèle de politique de travail pour standardiser les horaires.",
    "Add your first device or scan the network to discover ZKTeco scanners.": "Ajoutez votre premier appareil ou scannez le réseau pour découvrir les scanners ZKTeco.",
    "Add your first employee to get started.": "Ajoutez votre premier employé pour commencer.",
    "Add your first dashboard user to get started.": "Ajoutez votre premier utilisateur du tableau de bord pour commencer.",
    "Add your first integration endpoint to get started.": "Ajoutez votre premier point de terminaison d'intégration pour commencer.",
    "Open attendance reports and exports": "Ouvrir les rapports de présence et les exports",
    "View Reports": "Voir les rapports",
    "Go to Dashboard": "Aller au tableau de bord",
    "Welcome to timekeep": "Bienvenue sur timekeep",
    "Refresh dashboard": "Rafraîchir le tableau de bord",
    "Activity": "Activité",
    "View activity history": "Voir l'historique d'activité",
    
    # Punch Status
    "Check In": "Arrivée",
    "Check Out": "Départ",
    "Break Out": "Début de pause",
    "Break In": "Fin de pause",
    "OT In": "Début heures sup.",
    "OT Out": "Fin heures sup.",
    
    # Employees
    "Add Employee": "Ajouter un employé",
    "Back to Employees": "Retour aux employés",
    "Employee not found": "Employé introuvable",
    "Could not load employee information.": "Impossible de charger les informations de l'employé.",
    "This employee may have been removed.": "Cet employé a peut-être été supprimé.",
    "Employees": "Employés",
    "nav.employees": "Employés",
    "No employees": "Aucun employé",
    "No employees match": "Aucun employé ne correspond",
    "No attendance records found for this period.": "Aucun enregistrement de présence trouvé pour cette période.",
    "Manage employee records and view attendance.": "Gérer les dossiers des employés et voir les présences.",
    
    # Employee form
    "Employee PIN": "PIN de l'employé",
    "Full Name": "Nom complet",
    "External ID": "Identifiant externe",
    "Department": "Département",
    "Department filter": "Filtre de département",
    "Unique PIN, full name, and external reference for this employee.": "PIN unique, nom complet et référence externe pour cet employé.",
    "Employee's full name as displayed in reports": "Nom complet de l'employé tel qu'affiché dans les rapports",
    "Numeric employee ID used on the biometric scanner (e.g., 1001)": "Identifiant numérique de l'employé utilisé sur le scanner biométrique (ex. 1001)",
    "Identifier from external HR/ERP system (optional)": "Identifiant du système RH/ERP externe (optionnel)",
    "Organizational unit (optional — leave empty if unassigned)": "Unité organisationnelle (optionnel — laissez vide si non assigné)",
    "Employee synced to devices successfully.": "Employé synchronisé avec les appareils avec succès.",
    "EMP-001": "EMP-001",
    "Search by employee name or PIN…": "Rechercher par nom d'employé ou PIN…",
    
    # Biometric / Enrollment
    "Biometric Types": "Types biométriques",
    "Enroll": "Inscrire",
    "Enroll Employee": "Inscrire un employé",
    "Enrollment failed. Check the PIN and try again.": "Échec de l'inscription. Vérifiez le PIN et réessayez.",
    "Assign an employee PIN and biometric types to this device.": "Attribuez un PIN employé et des types biométriques à cet appareil.",
    "e.g. 145": "ex. 145",
    "Fingerprint": "Empreinte digitale",
    "Face": "Visage",
    "Card": "Carte",
    "Password": "Mot de passe",
    "Fingerprints": "Empreintes digitales",
    "Faces": "Visages",
    "Palm": "Paume",
    "RF Card": "Carte RF",
    "All Methods": "Toutes les méthodes",
    "Fingerprint": "Empreinte digitale",
    "Face": "Visage",
    
    # Devices
    "Loading device activity…": "Chargement de l'activité de l'appareil…",
    "Loading devices…": "Chargement des appareils…",
    "No Activity Yet": "Pas encore d'activité",
    "Device activity will appear here once the engine starts collecting events.": "L'activité de l'appareil apparaîtra ici une fois que le moteur commencera à collecter des événements.",
    "No records found": "Aucun enregistrement trouvé",
    "No records match the current filters. Try adjusting or clearing them.": "Aucun enregistrement ne correspond aux filtres actuels. Essayez de les ajuster ou de les effacer.",
    "No records yet.": "Pas encore d'enregistrements.",
    "Try adjusting or clearing your search and filter.": "Essayez d'ajuster ou d'effacer votre recherche et vos filtres.",
    "Try adjusting or clearing your search.": "Essayez d'ajuster ou d'effacer votre recherche.",
    "Try adjusting your search.": "Essayez d'ajuster votre recherche.",
    "Copy from Device": "Copier depuis l'appareil",
    "Copy Users": "Copier les utilisateurs",
    "Copy Users from Device": "Copier les utilisateurs depuis l'appareil",
    "Source Device": "Appareil source",
    "Select a source device to copy its enrolled users to this device.": "Sélectionnez un appareil source pour copier ses utilisateurs inscrits vers cet appareil.",
    "Copy failed. Check that both devices are online and try again.": "Échec de la copie. Vérifiez que les deux appareils sont en ligne et réessayez.",
    "No other devices available as source. Add another device first.": "Aucun autre appareil disponible comme source. Ajoutez d'abord un autre appareil.",
    "Device actions": "Actions de l'appareil",
    "Device Info": "Infos appareil",
    "Last Sync": "Dernière synchro",
    "MAC Address": "Adresse MAC",
    "Platform": "Plateforme",
    "Select a device…": "Sélectionner un appareil…",
    "Refresh Data": "Actualiser les données",
    "Refresh Devices": "Actualiser les appareils",
    "Reload device list from server": "Recharger la liste des appareils depuis le serveur",
    "Device activity will appear here once the engine starts collecting events.": "L'activité de l'appareil apparaîtra ici une fois que le moteur commencera à collecter des événements.",
    "No users have been synced from this device yet. Users are synced automatically when the engine starts.": "Aucun utilisateur n'a encore été synchronisé depuis cet appareil. Les utilisateurs sont synchronisés automatiquement au démarrage du moteur.",
    "Could not load device information.": "Impossible de charger les informations de l'appareil.",
    
    # Device operations
    "Sync": "Synchroniser",
    "Sync Now": "Synchroniser maintenant",
    "Sync All": "Tout synchroniser",
    "Sync to Devices": "Synchroniser vers les appareils",
    "Sync complete": "Synchronisation terminée",
    "Sync failed": "Échec de la synchronisation",
    "Sync failed: {err.message}": "Échec de la synchronisation : {err.message}",
    "Sync started for all devices.": "Synchronisation démarrée pour tous les appareils.",
    "Syncing…": "Synchronisation en cours…",
    "Failed to start sync.": "Échec du démarrage de la synchronisation.",
    "Resync": "Resynchroniser",
    "Resync Device": "Resynchroniser l'appareil",
    "Restart": "Redémarrer",
    "Restart Device": "Redémarrer l'appareil",
    "Sync Clock": "Synchroniser l'horloge",
    "The device will reboot and be offline for about 30–60 seconds. Attendance records already stored on the device are safe.": "L'appareil redémarrera et sera hors ligne pendant environ 30 à 60 secondes. Les enregistrements de présence déjà stockés sur l'appareil sont en sécurité.",
    "This will pull all users and attendance records from the device and push any pending changes. The device will remain online during this operation.": "Cela extraira tous les utilisateurs et enregistrements de présence de l'appareil et enverra les modifications en attente. L'appareil restera en ligne pendant cette opération.",
    "This will set the device clock to match the server time. Any existing attendance records will be unaffected.": "Cela réglera l'horloge de l'appareil pour correspondre à l'heure du serveur. Les enregistrements de présence existants ne seront pas affectés.",
    "Push": "Pousser",
    
    # Device form / Config
    "Config": "Configuration",
    "All": "Tout",
    "All commands": "Toutes les commandes",
    "All Departments": "Tous les départements",
    "All Devices": "Tous les appareils",
    "All Methods": "Toutes les méthodes",
    "All Statuses": "Tous les statuts",
    "Anomalies": "Anomalies",
    "Anomaly": "Anomalie",
    "Anomaly Detected": "Anomalie détectée",
    "Anomalies Detected": "Anomalies détectées",
    "Anomalies only": "Anomalies uniquement",
    "Show all": "Tout afficher",
    "Hide all": "Tout masquer",
    "Options": "Options",
    "Enabled": "Activé",
    "Disabled": "Désactivé",
    "Default": "Par défaut",
    "Custom": "Personnalisé",
    "Auto": "Auto",
    "None": "Aucun",
    "ADMS Active": "ADMS actif",
    "Users on Device": "Utilisateurs sur l'appareil",
    "Search users by name or PIN…": "Rechercher des utilisateurs par nom ou PIN…",
    "Add": "Ajouter",
    "Vendor": "Fournisseur",
    "Filter": "Filtrer",
    "Filter by": "Filtrer par",
    "Filter options": "Options de filtre",
    "Search": "Rechercher",
    "Records": "Enregistrements",
    "Timestamp": "Horodatage",
    "User": "Utilisateur",
    "Status": "Statut",
    "Method": "Méthode",
    "From": "De",
    "To": "À",
    
    # Punch records
    "Failed": "Échec",
    "Detail": "Détail",
    "Failed to load {resource}. Check your network connection and try again.": "Échec du chargement de {resource}. Vérifiez votre connexion réseau et réessayez.",
    "Could not load {entityType} information.": "Impossible de charger les informations de {entityType}.",
    "Server Unreachable": "Serveur inaccessible",
    "Cannot reach the server. Is it running?": "Impossible d'atteindre le serveur. Est-il en cours d'exécution ?",
    "Could not connect to the timekeep server. Check that the backend is running and try again.": "Impossible de se connecter au serveur timekeep. Vérifiez que le backend est en cours d'exécution et réessayez.",
    "Failed to load employees.": "Échec du chargement des employés.",
    "Page not found": "Page introuvable",
    "The page you are looking for doesn't exist or has been moved.": "La page que vous recherchez n'existe pas ou a été déplacée.",
    "Punch Not Found": "Pointage introuvable",
    "This punch record may have been scrolled out of view. Try searching by the punch ID.": "Cet enregistrement de pointage a peut-être défilé hors de la vue. Essayez de rechercher par l'ID de pointage.",
    "No punch records found for the selected date range. Try adjusting the filters.": "Aucun enregistrement de pointage trouvé pour la plage de dates sélectionnée. Essayez d'ajuster les filtres.",
    "No punch records match the current filters. Try adjusting or clearing them.": "Aucun enregistrement de pointage ne correspond aux filtres actuels. Essayez de les ajuster ou de les effacer.",
    
    # API Keys / Integrations
    "Revoke API Key": "Révoquer la clé API",
    "Revoke API key \\": "Révoquer la clé API \\",
    "Human-readable name for this API key": "Nom lisible pour cette clé API",
    "When this API key expires. Choose \"No expiry\" for permanent keys.": "Quand cette clé API expire. Choisissez \"Sans expiration\" pour les clés permanentes.",
    "Generated": "Générée",
    "Confidential": "Confidentiel",
    "API key created successfully.": "Clé API créée avec succès.",
    "Search by title…": "Rechercher par titre…",
    "No endpoints match": "Aucun point de terminaison ne correspond",
    "Endpoints": "Points de terminaison",
    "Manage integration keys": "Gérer les clés d'intégration",
    
    # Device registration
    "Register Device": "Enregistrer un appareil",
    "Register a new biometric scanner": "Enregistrer un nouveau scanner biométrique",
    "Scan your network, configure, and provision a ZKTeco scanner.": "Scannez votre réseau, configurez et provisionnez un scanner ZKTeco.",
    "Register": "Enregistrer",
    "Test & Register": "Tester et enregistrer",
    "Scan Network": "Scanner le réseau",
    "Scanning…": "Scan en cours…",
    "Scanning network… this may take up to 30 seconds.": "Scan du réseau en cours… cela peut prendre jusqu'à 30 secondes.",
    "Scan failed. Check the subnet and try again.": "Échec du scan. Vérifiez le sous-réseau et réessayez.",
    "No ZKTeco devices found on this subnet.": "Aucun appareil ZKTeco trouvé sur ce sous-réseau.",
    "No ZKTeco devices were discovered on this subnet. Try a different subnet or check network connectivity.": "Aucun appareil ZKTeco n'a été découvert sur ce sous-réseau. Essayez un autre sous-réseau ou vérifiez la connectivité réseau.",
    "Found {results.length} device(s). Select one to configure.": "{results.length} appareil(s) trouvé(s). Sélectionnez-en un à configurer.",
    "Ready to register the following device:": "Prêt à enregistrer l'appareil suivant :",
    "Configure Device": "Configurer l'appareil",
    "Connection test failed": "Échec du test de connexion",
    "Connection test passed": "Test de connexion réussi",
    "Provision & Test Connection": "Provisionner et tester la connexion",
    "Provisioning device…": "Provisionnement de l'appareil en cours…",
    "Provisioning Failed": "Échec du provisionnement",
    "Device Registered": "Appareil enregistré",
    "Device registered successfully.": "Appareil enregistré avec succès.",
    "Failed to provision device. Check the connection and try again.": "Échec du provisionnement de l'appareil. Vérifiez la connexion et réessayez.",
    "Missing device configuration. Go back and fill in all fields.": "Configuration de l'appareil manquante. Revenez en arrière et remplissez tous les champs.",
    "Back to Configure": "Retour à la configuration",
    "Scan your local network to find ZKTeco attendance scanners.": "Scannez votre réseau local pour trouver les scanners de présence ZKTeco.",
    "Enter a subnet or leave empty for auto-detect, then click Start Scan.": "Entrez un sous-réseau ou laissez vide pour la détection automatique, puis cliquez sur Démarrer le scan.",
    "Subnet": "Sous-réseau",
    "Start Scan": "Démarrer le scan",
    "Leave empty to auto-detect": "Laisser vide pour la détection automatique",
    "Found": "Trouvé",
    "Ready to scan": "Prêt à scanner",
    "Add All Discovered": "Ajouter tous les appareils découverts",
    "Added {bulkDone} devices": "{bulkDone} appareils ajoutés",
    "All devices are currently offline. Attendance data may be stale.": "Tous les appareils sont actuellement hors ligne. Les données de présence peuvent être obsolètes.",
    
    # Device detail
    "Device {sn}": "Appareil {sn}",
    "SN: {device.serial_number}": "SN : {device.serial_number}",
    "Delete device": "Supprimer l'appareil",
    "Delete Device": "Supprimer l'appareil",
    "Are you sure you want to remove \\": "Êtes-vous sûr de vouloir supprimer \\",
    "This device may have been removed or the serial number is incorrect.": "Cet appareil a peut-être été supprimé ou le numéro de série est incorrect.",
    "Device not found": "Appareil introuvable",
    "Failed to remove device.": "Échec de la suppression de l'appareil.",
    "Failed to update device.": "Échec de la mise à jour de l'appareil.",
    "Device updated.": "Appareil mis à jour.",
    "Device removed from group.": "Appareil retiré du groupe.",
    "Label is required": "L'étiquette est requise",
    "Model": "Modèle",
    "Serial": "Série",
    "Firmware": "Micrologiciel",
    "Host": "Hôte",
    "IP": "IP",
    "Port": "Port",
    "IP address or hostname of the device.": "Adresse IP ou nom d'hôte de l'appareil.",
    "Human-readable name for this scanner.": "Nom lisible pour ce scanner.",
    "Device communication key (default: 0).": "Clé de communication de l'appareil (par défaut : 0).",
    "Enable real-time attendance push from this device.": "Activer la poussée de présence en temps réel depuis cet appareil.",
    "Default: {DEFAULT_ZKTECO_PORT}": "Par défaut : {DEFAULT_ZKTECO_PORT}",
    "Port must be at least {MIN_PORT}": "Le port doit être au moins {MIN_PORT}",
    "Port must be at most {MAX_PORT}": "Le port doit être au maximum {MAX_PORT}",
    "Step \"{currentStep.step}\" not found in stepMap.": "Étape \"{currentStep.step}\" introuvable dans stepMap.",
    "is": "est",
    "passed": "transmis",
    "and": "et",
    "wraps every field in": "enveloppe chaque champ dans",
    "with department options loaded via": "avec les options de département chargées via",
    " +": " +",
    " /": " /",
    
    # Departments
    "Add Department": "Ajouter un département",
    "Departments": "Départements",
    "Department Name": "Nom du département",
    "Department Information": "Informations du département",
    "Department created successfully.": "Département créé avec succès.",
    "Department updated successfully.": "Département mis à jour avec succès.",
    "Organizational unit name (e.g., Warehouse, Office, Sales)": "Nom de l'unité organisationnelle (ex. Entrepôt, Bureau, Ventes)",
    "Give the department a clear and unique name.": "Donnez au département un nom clair et unique.",
    "Description": "Description",
    "Description must be 500 characters or fewer": "La description doit contenir 500 caractères ou moins",
    "Optional description of this policy's purpose": "Description optionnelle de l'objectif de cette politique",
    "This department has no employees assigned yet.": "Ce département n'a pas encore d'employés assignés.",
    "No departments": "Aucun département",
    "No departments match": "Aucun département ne correspond",
    "Search by name…": "Rechercher par nom…",
    "Delete {deleting?.name ?? \"\"}? This cannot be undone.": "Supprimer {deleting?.name ?? \"\"} ? Cette action est irréversible.",
    "Name must be 100 characters or fewer": "Le nom doit contenir 100 caractères ou moins",
    "Name must be 200 characters or fewer": "Le nom doit contenir 200 caractères ou moins",
    
    # Device Groups
    "Add Device Group": "Ajouter un groupe d'appareils",
    "Add Group": "Ajouter un groupe",
    "Device Group": "Groupe d'appareils",
    "Device Groups": "Groupes d'appareils",
    "Create your first device group to organize scanners.": "Créez votre premier groupe d'appareils pour organiser les scanners.",
    "Organize scanners for department-scoped sync.": "Organisez les scanners pour la synchronisation par département.",
    "No devices": "Aucun appareil",
    "No devices in this group": "Aucun appareil dans ce groupe",
    "No devices match": "Aucun appareil ne correspond",
    "No device groups": "Aucun groupe d'appareils",
    "No groups match": "Aucun groupe ne correspond",
    "Assign devices to this group via the device edit form. Open any device and select this group in the Config tab.": "Assignez des appareils à ce groupe via le formulaire de modification d'appareil. Ouvrez un appareil et sélectionnez ce groupe dans l'onglet Configuration.",
    "Will sync employees from: {dept}": "Synchronisera les employés depuis : {dept}",
    "Sync employees to all devices in this group.": "Synchroniser les employés vers tous les appareils de ce groupe.",
    "Target devices: {count}": "Appareils cibles : {count}",
    
    # Work Policies
    "Add Work Policy": "Ajouter une politique de travail",
    "Add Policy": "Ajouter une politique",
    "Work Policies": "Politiques de travail",
    "Policy Information": "Informations de la politique",
    "Save Work Policy": "Enregistrer la politique",
    "Work policy saved.": "Politique de travail enregistrée.",
    "Failed to save work policy: {err.message}": "Échec de l'enregistrement de la politique : {err.message}",
    "A unique name for this work policy template (e.g., \"Night Shift\")": "Un nom unique pour ce modèle de politique de travail (ex. \"Équipe de nuit\")",
    "Give the work policy a clear, descriptive name.": "Donnez à la politique de travail un nom clair et descriptif.",
    "Night Shift": "Équipe de nuit",
    "Overnight warehouse shift with extended hours": "Équipe de nuit d'entrepôt avec heures étendues",
    "Overnight": "De nuit",
    "Organization Default Work Policy": "Politique de travail par défaut de l'organisation",
    "This policy applies to all departments that do not have a custom work policy.": "Cette politique s'applique à tous les départements qui n'ont pas de politique de travail personnalisée.",
    "Using organization default work policy.": "Utilisation de la politique de travail par défaut de l'organisation.",
    "No work policies": "Aucune politique de travail",
    "No policies match": "Aucune politique ne correspond",
    "Search by name or type…": "Rechercher par nom ou type…",
    
    # Work Hours & Schedule
    "Work Hours & Days": "Heures et jours de travail",
    "Work Start Time": "Heure de début",
    "Work End Time": "Heure de fin",
    "Working Days": "Jours de travail",
    "Start": "Début",
    "End": "Fin",
    "Start of the work day in 24h format": "Début de la journée de travail au format 24h",
    "End of the work day in 24h format": "Fin de la journée de travail au format 24h",
    "Select the days of the week this policy applies to": "Sélectionnez les jours de la semaine auxquels cette politique s'applique",
    "Set the standard work schedule for this policy.": "Définissez l'horaire de travail standard pour cette politique.",
    "Schedule": "Horaire",
    "Work start time is required": "L'heure de début est requise",
    "Work end time is required": "L'heure de fin est requise",
    "Time must be in HH:MM format": "L'heure doit être au format HH:MM",
    
    # Attendance Thresholds
    "Attendance Thresholds": "Seuils de présence",
    "Configure how attendance rules are calculated.": "Configurez comment les règles de présence sont calculées.",
    "Thresholds": "Seuils",
    "Min Hours for Full Day": "Heures min. pour jour complet",
    "Min hours (full day)": "Heures min. (jour complet)",
    "Minimum worked hours to count as a full attendance day": "Heures travaillées minimum pour compter comme une journée de présence complète",
    "Late Threshold (minutes)": "Seuil de retard (minutes)",
    "Late threshold (min)": "Seuil de retard (min)",
    "Minutes after work_start before employee is marked late": "Minutes après le début du travail avant que l'employé ne soit marqué en retard",
    "Overtime After (hours)": "Heures sup. après (heures)",
    "Overtime after (h)": "Heures sup. après (h)",
    "Daily hours threshold after which overtime is calculated": "Seuil d'heures quotidiennes après lequel les heures supplémentaires sont calculées",
    "Must be 0 or greater": "Doit être 0 ou plus",
    "Must be 24 or fewer": "Doit être 24 ou moins",
    "Must be 120 or fewer": "Doit être 120 ou moins",
    "Warehouse": "Entrepôt",
    
    # Export / Reports / Charts
    "Export Punches": "Exporter les pointages",
    "Attendance Report": "Rapport de présence",
    "Download punch data as CSV": "Télécharger les données de pointage en CSV",
    "Export failed. Please try again.": "Échec de l'exportation. Veuillez réessayer.",
    "No records to export.": "Aucun enregistrement à exporter.",
    "Period Summary": "Résumé de la période",
    "Punch Log": "Journal de pointage",
    "Summary": "Résumé",
    "Charts": "Graphiques",
    "Timeline": "Chronologie",
    "Calendar": "Calendrier",
    "Daily": "Quotidien",
    "Weekly": "Hebdomadaire",
    "Custom": "Personnalisé",
    "Attendance Distribution": "Distribution des présences",
    "Hourly Arrivals": "Arrivées par heure",
    "Weekly Hours": "Heures hebdomadaires",
    "Daily Work Hours": "Heures de travail quotidiennes",
    "Attendance KPIs per employee for the selected date range.": "KPI de présence par employé pour la plage de dates sélectionnée.",
    "Full day, half day, and absent breakdown.": "Répartition jour complet, demi-journée et absent.",
    "Total hours worked per week.": "Total des heures travaillées par semaine.",
    "Regular and overtime hours per day.": "Heures régulières et supplémentaires par jour.",
    "Check-ins grouped by hour of day.": "Arrivées groupées par heure de la journée.",
    "Absence Rate": "Taux d'absence",
    "Full Day": "Jour complet",
    "Half Day": "Demi-journée",
    "Regular": "Régulier",
    "OT": "Heures sup.",
    "Hours": "Heures",
    "Work Days": "Jours travaillés",
    "Avg/Day": "Moy./Jour",
    "Avg Hours": "Heures moy.",
    "W": "S",  # Semaine
    "today": "aujourd'hui",
    "Today": "Aujourd'hui",
    "this period": "cette période",
    "Yesterday": "Hier",
    "This Week": "Cette semaine",
    "This Month": "Ce mois",
    "Last 7 days": "7 derniers jours",
    "Last 30 days": "30 derniers jours",
    "Last Month": "Le mois dernier",
    "total": "total",
    "per day": "par jour",
    "of {0}": "sur {0}",
    
    # Employee Attendance
    "Employee Attendance": "Présence de l'employé",
    "Employee Attendance KPIs": "KPI de présence de l'employé",
    "Employee Identity": "Identité de l'employé",
    "Attendance calendar for {0} {0}": "Calendrier de présence pour {0} {0}",
    "No attendance data": "Aucune donnée de présence",
    "No attendance data for this month": "Aucune donnée de présence pour ce mois",
    "No data available for this period": "Aucune donnée disponible pour cette période",
    "Failed to load calendar": "Échec du chargement du calendrier",
    "No distribution data": "Aucune donnée de distribution",
    "No weekly data": "Aucune donnée hebdomadaire",
    "No weekly breakdown available for the selected range.": "Aucune répartition hebdomadaire disponible pour la plage sélectionnée.",
    "No status distribution available for the selected range.": "Aucune distribution de statut disponible pour la plage sélectionnée.",
    "All employees have checked out for the day.": "Tous les employés ont pointé leur départ pour la journée.",
    "No one currently checked in": "Personne n'est actuellement pointé",
    "Currently Checked In": "Actuellement pointés",
    "Arrivals": "Arrivées",
    "No arrivals yet today.": "Pas encore d'arrivées aujourd'hui.",
    "Check Outs": "Départs",
    "On Time": "À l'heure",
    "Select date range…": "Sélectionner une plage de dates…",
    "Show only anomalous punches": "Afficher uniquement les pointages anormaux",
    
    # Dashboard Users
    "Manage dashboard accounts": "Gérer les comptes du tableau de bord",
    "Set a new password for {user.display_name || user.username}": "Définir un nouveau mot de passe pour {user.display_name || user.username}",
    "Set a new password for this user.": "Définir un nouveau mot de passe pour cet utilisateur.",
    "Are you sure you want to delete {user?.username ?? \"\"}? This action cannot be undone.": "Êtes-vous sûr de vouloir supprimer {user?.username ?? \"\"} ? Cette action est irréversible.",
    "No users match": "Aucun utilisateur ne correspond",
    "Search by username or display name…": "Rechercher par nom d'utilisateur ou nom d'affichage…",
    "Username": "Nom d'utilisateur",
    "Role": "Rôle",
    "Permissions": "Permissions",
    "Last used": "Dernière utilisation",
    "Expires": "Expire",
    
    # Engine / Pipeline
    "Events Processed": "Événements traités",
    "Events Dropped": "Événements abandonnés",
    "Events Distributed": "Événements distribués",
    "Events Failed": "Événements échoués",
    
    # General UI / Navigation
    "Back": "Retour",
    "Back to Devices": "Retour aux appareils",
    "Go back": "Retour",
    "Refresh": "Actualiser",
    "Retry": "Réessayer",
    "Reset": "Réinitialiser",
    "Remove": "Supprimer",
    "Remove {text}": "Supprimer {text}",
    "Edit name": "Modifier le nom",
    "Edit {field.label}": "Modifier {field.label}",
    "Open in main view": "Ouvrir dans la vue principale",
    "Close sidebar": "Fermer la barre latérale",
    "Close dialog": "Fermer la boîte de dialogue",
    "Page commands": "Commandes de page",
    "Search commands (Cmd+K)": "Rechercher des commandes (Cmd+K)",
    "Search (Cmd+K)": "Rechercher (Cmd+K)",
    "Search by label, serial, or host…": "Rechercher par étiquette, série ou hôte…",
    "Search by name or prefix…": "Rechercher par nom ou préfixe…",
    "Select date range…": "Sélectionner une plage de dates…",
    "New": "Nouveau",
    "Title": "Titre",
    "Title is required": "Le titre est requis",
    "Title must be 150 characters or fewer": "Le titre doit contenir 150 caractères ou moins",
    "Workspace": "Espace de travail",
    "of {data.total_employees}": "sur {data.total_employees}",
    "unreachable": "inaccessible",
    "Updated {0}h ago": "Mis à jour il y a {0} h",
    "Updated just now": "Mis à jour à l'instant",
    "Updated {m}m ago": "Mis à jour il y a {m} min",
    "Updated {s}s ago": "Mis à jour il y a {s} s",
    "Skip to content": "Aller au contenu",
    "Loading…": "Chargement…",
    "Hide password": "Masquer le mot de passe",
    "Show password": "Afficher le mot de passe",
    "Breadcrumb": "Fil d'Ariane",
    "No results found": "Aucun résultat trouvé",
    "Select…": "Sélectionner…",
    "Search…": "Rechercher…",
    "Refresh Page": "Actualiser la page",
    "Try Again": "Réessayer",
    "Something went wrong": "Une erreur est survenue",
    "An unexpected error occurred. Please try refreshing the page.": "Une erreur inattendue s'est produite. Veuillez essayer d'actualiser la page.",
    "Error Details": "Détails de l'erreur",
    "No expiry": "Sans expiration",
    "30 days": "30 jours",
    "60 days": "60 jours",
    "90 days": "90 jours",
    "180 days": "180 jours",
    "365 days": "365 jours",
    "Custom date": "Date personnalisée",
    "No expiration": "Sans expiration",
    "Expires": "Expire",
    "Expiry duration": "Durée d'expiration",
    "Clear expiry date": "Effacer la date d'expiration",
    "Clear date": "Effacer la date",
    "Select date…": "Sélectionner une date…",

    # Navigation explicit IDs
    "nav.departments": "Départements",
    "nav.devices.groups": "Groupes d'appareils",
    "nav.employees": "Employés",
    "nav.workPolicies": "Politiques de travail",

    # Remaining keys with escaped quotes in PO
    'A unique name for this work policy template (e.g., "Night Shift")': 'Un nom unique pour ce modèle de politique de travail (ex. "Équipe de nuit")',
    'Are you sure you want to remove "{device.label || device.serial_number}"? This action cannot be undone.': 'Êtes-vous sûr de vouloir supprimer "{device.label || device.serial_number}" ? Cette action est irréversible.',

    # Placeholder keys (new format from Lingui extract)
    "Edit {0}": "Modifier {0}",
    "Failed to save work policy: {0}": "Échec de l'enregistrement de la politique de travail : {0}",
    "Found {0} device(s). Select one to configure.": "{0} appareil(s) trouvé(s). Sélectionnez-en un à configurer.",
    "Maximum {MAX_POLL_INTERVAL_SECS} seconds": "Maximum {MAX_POLL_INTERVAL_SECS} secondes",
    "Minimum {MIN_POLL_INTERVAL_SECS} seconds": "Minimum {MIN_POLL_INTERVAL_SECS} secondes",
    "No devices found": "Aucun appareil trouvé",
    "PIN is required": "Le PIN est requis",
    "PIN must be 20 characters or fewer": "Le PIN doit contenir 20 caractères ou moins",
    "PIN must contain only digits": "Le PIN doit contenir uniquement des chiffres",
    'Revoke API key "{revokeTarget.name}"? This cannot be undone.': 'Révoquer la clé API "{revokeTarget.name}" ? Cette action est irréversible.',
    "Search by name, PIN, or department…": "Rechercher par nom, PIN ou département…",
    'Step "{currentStep.step}" not found in stepMap.': 'Étape "{currentStep.step}" introuvable dans stepMap.',
    "Sync failed: {0}": "Échec de la synchronisation : {0}",
    "Attendance calendar for {0} {1}": "Calendrier de présence pour {0} {1}",
}

# ── Translation writer ───────────────────────────────────────────────────────

def get_empty_active_entries(filepath):
    """Return list of (msgid, block_start, block_end) for empty non-obsolete entries."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    blocks = re.split(r'\n\n+', content)
    result = []
    pos = 0
    
    for block in blocks:
        block_stripped = block.strip()
        if not block_stripped:
            pos = content.find(block, pos) + len(block)
            continue
        if 'msgid ""' in block:
            pos = content.find(block, pos) + len(block)
            continue
        
        lines = block_stripped.split('\n')
        if any(line.strip().startswith('#~') for line in lines):
            pos = content.find(block, pos) + len(block)
            continue
        
        m_id = re.search(r'msgid "(.+?)"', block)
        if not m_id:
            pos = content.find(block, pos) + len(block)
            continue
        
        msgid = m_id.group(1)
        
        m_str = re.search(r'msgstr "(.+?)"', block)
        if m_str and m_str.group(1):
            pos = content.find(block, pos) + len(block)
            continue
        
        has_continuation = False
        found_msgstr = False
        for i, line in enumerate(lines):
            if line.startswith('msgstr ""'):
                found_msgstr = True
                if i + 1 < len(lines) and lines[i + 1].startswith('"'):
                    has_continuation = True
                    break
            elif found_msgstr and line.startswith('"'):
                has_continuation = True
                break
        
        if not has_continuation:
            result.append((msgid, block))
        
        pos = content.find(block, pos) + len(block)
    
    return result


def apply_translations(filepath, translations, lang_code):
    """Apply translations to empty entries in the PO file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    empty_entries = get_empty_active_entries(filepath)
    translated = 0
    
    for msgid, block in empty_entries:
        if msgid in translations:
            translation = translations[msgid]
            # Escape any double quotes in the translation
            escaped = translation.replace('\\', '\\\\').replace('"', '\\"')
            
            # Find the msgstr line and replace it
            old_str = f'msgid "{msgid}"\nmsgstr ""'
            new_str = f'msgid "{msgid}"\nmsgstr "{escaped}"'
            
            if old_str in content:
                content = content.replace(old_str, new_str)
                translated += 1
            else:
                # Try with different whitespace
                old_pattern = re.compile(
                    re.escape(f'msgid "{msgid}"') + r'\s*\n\s*msgstr ""',
                    re.MULTILINE
                )
                match = old_pattern.search(content)
                if match:
                    content = content[:match.start()] + f'msgid "{msgid}"\nmsgstr "{escaped}"' + content[match.end():]
                    translated += 1
                else:
                    print(f"  WARNING: Could not find block for msgid: {msgid[:60]}")
    
    if translated > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return translated


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    locales = {
        'ar': AR_TRANSLATIONS,
        'fr': FR_TRANSLATIONS,
    }
    
    for lang_code, translations in locales.items():
        filepath = os.path.join(DASHBOARD_SRC, 'locales', f'{lang_code}.po')
        print(f'Applying {lang_code.upper()} translations...')
        count = apply_translations(filepath, translations, lang_code)
        print(f'  Translated: {count} entries')
    
    print('\nDone! Run "lingui compile" to compile catalogs.')
