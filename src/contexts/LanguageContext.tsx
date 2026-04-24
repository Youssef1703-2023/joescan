import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar' | 'fr' | 'de' | 'es' | 'tr' | 'ru';

export const translations = {
  header_title: { en: "JoeScan", ar: "جو-سكان", fr: "JoeScan", de: "JoeScan", es: "JoeScan", tr: "JoeScan", ru: "JoeScan" },
  header_tagline: { en: "Know your exposure. Own your security.", ar: "اعرف موقفك.. وخلّي أمانك في إيدك.", fr: "Connaissez votre exposition. Maîtrisez votre sécurité.", de: "Kennen Sie Ihre Gefährdung. Kontrollieren Sie Ihre Sicherheit.", es: "Conoce tu exposición. Controla tu seguridad.", tr: "Maruziyetinizi bilin. Güvenliğinizi yönetin.", ru: "Узнайте свою уязвимость. Контролируйте безопасность." },
  login_title: { en: "Sign in to JoeScan", ar: "تسجيل الدخول", fr: "Connexion à JoeScan", de: "Anmelden bei JoeScan", es: "Iniciar sesión en JoeScan", tr: "JoeScan'e Giriş", ru: "Войти в JoeScan" },
  login_button: { en: "Login with Google", ar: "دخول بحساب جوجل", fr: "Se connecter avec Google", de: "Mit Google anmelden", es: "Iniciar sesión con Google", tr: "Google ile Giriş Yap", ru: "Войти через Google" },
  logout: { en: "Logout", ar: "خروج", fr: "Déconnexion", de: "Abmelden", es: "Cerrar sesión", tr: "Çıkış Yap", ru: "Выйти" },
  email_label: { en: "Email Address", ar: "البريد الإلكتروني", fr: "Adresse e-mail", de: "E-Mail-Adresse", es: "Correo electrónico", tr: "E-posta Adresi", ru: "Электронная почта" },
  email_placeholder: { en: "Enter your email...", ar: "اكتب إيميلك هنا...", fr: "Entrez votre e-mail...", de: "E-Mail eingeben...", es: "Ingresa tu correo...", tr: "E-postanızı girin...", ru: "Введите email..." },
  analyze_button: { en: "Analyze", ar: "افحص الإيميل", fr: "Analyser", de: "Analysieren", es: "Analizar", tr: "Analiz Et", ru: "Анализировать" },
  analyzing: { en: "Analyzing...", ar: "بندور وبنحلل...", fr: "Analyse en cours...", de: "Analyse läuft...", es: "Analizando...", tr: "Analiz ediliyor...", ru: "Анализ..." },
  analyzing_desc: { en: "Scanning global databases and formulating security posture...", ar: "بنراجع قواعد البيانات العالمية وبنجهز درجة تقييم حسابك...", fr: "Analyse des bases de données mondiales en cours...", de: "Globale Datenbanken werden durchsucht...", es: "Escaneando bases de datos globales...", tr: "Küresel veritabanları taranıyor...", ru: "Сканирование глобальных баз данных..." },
  history_title: { en: "Previous Scans", ar: "عمليات الفحص السابقة", fr: "Analyses précédentes", de: "Vorherige Scans", es: "Escaneos anteriores", tr: "Önceki Taramalar", ru: "Предыдущие сканирования" },
  no_history: { en: "No previous scans found.", ar: "مفيش عمليات فحص تمت قبل كده.", fr: "Aucune analyse précédente.", de: "Keine vorherigen Scans gefunden.", es: "No se encontraron escaneos previos.", tr: "Önceki tarama bulunamadı.", ru: "Предыдущие сканирования не найдены." },
  risk_low: { en: "Low Risk", ar: "خطر ضعيف", fr: "Risque faible", de: "Geringes Risiko", es: "Riesgo bajo", tr: "Düşük Risk", ru: "Низкий риск" },
  risk_medium: { en: "Medium Risk", ar: "خطر متوسط", fr: "Risque moyen", de: "Mittleres Risiko", es: "Riesgo medio", tr: "Orta Risk", ru: "Средний риск" },
  risk_high: { en: "High Risk", ar: "في خطر", fr: "Risque élevé", de: "Hohes Risiko", es: "Riesgo alto", tr: "Yüksek Risk", ru: "Высокий риск" },
  risk_label: { en: "Risk Level", ar: "مستوى الخطر", fr: "Niveau de risque", de: "Risikostufe", es: "Nivel de riesgo", tr: "Risk Seviyesi", ru: "Уровень риска" },
  action_plan: { en: "Action Plan", ar: "إزاي تحمي نفسك", fr: "Plan d'action", de: "Maßnahmenplan", es: "Plan de acción", tr: "Eylem Planı", ru: "План действий" },
  new_scan: { en: "New Scan", ar: "فحص جديد", fr: "Nouvelle analyse", de: "Neuer Scan", es: "Nuevo escaneo", tr: "Yeni Tarama", ru: "Новое сканирование" },
  part_of: { en: "Part of JoeTech", ar: "من منتجات جو-تك", fr: "Un produit JoeTech", de: "Ein JoeTech-Produkt", es: "Un producto JoeTech", tr: "JoeTech ürünü", ru: "Продукт JoeTech" },
  footer_status: { en: "SYS_STATUS: NOMINAL", ar: "حالة_النظام: شغال تمام", fr: "ÉTAT_SYS: NOMINAL", de: "SYS_STATUS: NOMINAL", es: "ESTADO_SIS: NOMINAL", tr: "SİSTEM_DURUMU: NORMAL", ru: "СТАТУС_СИСТЕМЫ: НОМИНАЛЬНЫЙ" },
  footer_encryption: { en: "JOETECH SECURE ENCRYPTION ENABLED // AES-256", ar: "تشفير جو-تك مؤمن ومفعل // AES-256", fr: "CHIFFREMENT JOETECH ACTIVÉ // AES-256", de: "JOETECH-VERSCHLÜSSELUNG AKTIV // AES-256", es: "CIFRADO JOETECH HABILITADO // AES-256", tr: "JOETECH ŞİFRELEME AKTİF // AES-256", ru: "ШИФРОВАНИЕ JOETECH ВКЛЮЧЕНО // AES-256" },
  footer_session: { en: "SESSION_ID", ar: "رقم_الجلسة", fr: "ID_SESSION", de: "SITZUNGS_ID", es: "ID_SESIÓN", tr: "OTURUM_KİMLİĞİ", ru: "ИД_СЕССИИ" },
  no_auth: { en: "NO_AUTH", ar: "غير_مسجل", fr: "NON_AUTH", de: "NICHT_AUTH", es: "SIN_AUTH", tr: "YETKİSİZ", ru: "БЕЗ_АВТОРИЗАЦИИ" },
  hero_title: { en: "Is your email at risk?", ar: "هل إيميلك في خطر؟", fr: "Votre e-mail est-il en danger ?", de: "Ist Ihre E-Mail gefährdet?", es: "¿Tu correo está en riesgo?", tr: "E-postanız risk altında mı?", ru: "Ваш email под угрозой?" },
  hero_subtitle: { en: "Our AI-driven scanner checks global data leak repositories to see if your credentials have been compromised.", ar: "نظامنا الذكي بيراجع أضخم قواعد بيانات التسريبات العالمية عشان نتأكد إن بيناتك سليمة ومش مسربة.", fr: "Notre scanner alimenté par l'IA vérifie les bases de données mondiales de fuites pour voir si vos identifiants ont été compromis.", de: "Unser KI-Scanner überprüft globale Datenleck-Datenbanken um zu sehen, ob Ihre Zugangsdaten kompromittiert wurden.", es: "Nuestro escáner impulsado por IA verifica las bases de datos globales de filtraciones para ver si sus credenciales han sido comprometidas.", tr: "Yapay zeka destekli tarayıcımız, kimlik bilgilerinizin ele geçirilip geçirilmediğini kontrol eder.", ru: "Наш ИИ-сканер проверяет глобальные базы утечек данных, чтобы определить, были ли ваши учётные данные скомпрометированы." },
  email_placeholder_detailed: { en: "Enter your email (e.g., user@example.com)", ar: "اكتب إيميلك (مثلاً: user@example.com)", fr: "Entrez votre e-mail (ex: user@example.com)", de: "E-Mail eingeben (z.B. user@example.com)", es: "Ingresa tu correo (ej: user@example.com)", tr: "E-postanızı girin (ör: user@example.com)", ru: "Введите email (напр. user@example.com)" },
  email_format_hint: { en: "Format: user@example.com", ar: "الصيغة: user@example.com", fr: "Format: user@example.com", de: "Format: user@example.com", es: "Formato: user@example.com", tr: "Format: user@example.com", ru: "Формат: user@example.com" },
  email_invalid_format: { en: "Please enter a valid email address.", ar: "الرجاء إدخال بريد إلكتروني صحيح.", fr: "Veuillez entrer une adresse e-mail valide.", de: "Bitte geben Sie eine gültige E-Mail-Adresse ein.", es: "Por favor ingresa un correo válido.", tr: "Geçerli bir e-posta adresi girin.", ru: "Введите действительный email." },
  email_invalid_domain: { en: "This email domain does not exist.", ar: "نطاق البريد الإلكتروني هذا غير موجود.", fr: "Ce domaine e-mail n'existe pas.", de: "Diese E-Mail-Domain existiert nicht.", es: "Este dominio de correo no existe.", tr: "Bu e-posta alan adı mevcut değil.", ru: "Этот домен email не существует." },
  search_history: { en: "Search scans...", ar: "ابحث في الفحوصات...", fr: "Rechercher...", de: "Suchen...", es: "Buscar...", tr: "Ara...", ru: "Поиск..." },
  saved_emails: { en: "Important Emails", ar: "الإيميلات المهمة", fr: "E-mails importants", de: "Wichtige E-Mails", es: "Correos importantes", tr: "Önemli E-postalar", ru: "Важные письма" },
  save_email: { en: "Send to List", ar: "أرسل للقائمة", fr: "Ajouter à la liste", de: "Zur Liste hinzufügen", es: "Agregar a lista", tr: "Listeye ekle", ru: "Добавить в список" },
  unsave_email: { en: "Remove from list", ar: "إزالة من القائمة", fr: "Retirer de la liste", de: "Von Liste entfernen", es: "Quitar de la lista", tr: "Listeden kaldır", ru: "Удалить из списка" },
  saved_verb: { en: "Saved", ar: "تم الحفظ", fr: "Enregistré", de: "Gespeichert", es: "Guardado", tr: "Kaydedildi", ru: "Сохранено" },
  save_verb: { en: "Save", ar: "حفظ", fr: "Enregistrer", de: "Speichern", es: "Guardar", tr: "Kaydet", ru: "Сохранить" },
  no_report: { en: "Enter an email to generate a report.", ar: "اكتب إيميلك فوق واطمن على بياناتك.", fr: "Entrez un e-mail pour générer un rapport.", de: "E-Mail eingeben, um einen Bericht zu erstellen.", es: "Ingresa un correo para generar un informe.", tr: "Rapor oluşturmak için e-posta girin.", ru: "Введите email для создания отчёта." },
  status_secure: { en: "Secure", ar: "في السليم", fr: "Sécurisé", de: "Sicher", es: "Seguro", tr: "Güvenli", ru: "Безопасно" },
  status_warning: { en: "Warning", ar: "محتاج انتباه", fr: "Attention", de: "Warnung", es: "Advertencia", tr: "Uyarı", ru: "Внимание" },
  status_risk: { en: "At Risk", ar: "في خطر", fr: "En danger", de: "Gefährdet", es: "En riesgo", tr: "Risk altında", ru: "Под угрозой" },
  desc_secure: { en: "No recent threats detected", ar: "مفيش أي تهديد لقيناه، وضعك تمام", fr: "Aucune menace récente détectée", de: "Keine aktuellen Bedrohungen erkannt", es: "No se detectaron amenazas recientes", tr: "Yakın zamanda tehdit tespit edilmedi", ru: "Угрозы не обнаружены" },
  desc_risk: { en: "Action recommended", ar: "بننصحك تأمن حساباتك بسرعة", fr: "Action recommandée", de: "Handlung empfohlen", es: "Acción recomendada", tr: "İşlem önerilir", ru: "Рекомендуется действие" },
  report_overview: { en: "Report Overview", ar: "نظرة عامة على الفحص", fr: "Aperçu du rapport", de: "Berichtsübersicht", es: "Resumen del informe", tr: "Rapor özeti", ru: "Обзор отчёта" },
  your_plan: { en: "Your Security Action Plan", ar: "خطة الشغل عشان تحمي بياناتك", fr: "Votre plan de sécurité", de: "Ihr Sicherheitsplan", es: "Tu plan de seguridad", tr: "Güvenlik eylem planınız", ru: "Ваш план безопасности" },
  logo_1: { en: "JOE", ar: "جو", fr: "JOE", de: "JOE", es: "JOE", tr: "JOE", ru: "JOE" },
  logo_2: { en: "SCAN", ar: "سكان", fr: "SCAN", de: "SCAN", es: "SCAN", tr: "SCAN", ru: "SCAN" },
  just_now: { en: "Just now", ar: "الآن", fr: "À l'instant", de: "Gerade eben", es: "Ahora mismo", tr: "Az önce", ru: "Только что" },
  translating: { en: "Translating...", ar: "جاري الترجمة...", fr: "Traduction...", de: "Übersetzen...", es: "Traduciendo...", tr: "Çevriliyor...", ru: "Перевод..." },
  security_score_title: { en: "Security Posture Score", ar: "مؤشر الوضع الأمني", fr: "Score de sécurité", de: "Sicherheitsbewertung", es: "Puntuación de seguridad", tr: "Güvenlik puanı", ru: "Оценка безопасности" },
  security_score_tooltip: { en: "An algorithmic rating evaluating your overall breach exposure and credential safety.", ar: "تقييم خوارزمي يوضح مدى تعرضك للتسريبات وأمان بياناتك.", fr: "Évaluation algorithmique de votre exposition aux violations.", de: "Algorithmische Bewertung Ihrer Sicherheitslage.", es: "Evaluación algorítmica de su exposición a brechas.", tr: "İhlal maruziyetinizi değerlendiren algoritmik puanlama.", ru: "Алгоритмическая оценка вашей уязвимости." },
  score_factors: { en: "Score Factors", ar: "عوامل التقييم", fr: "Facteurs de score", de: "Bewertungsfaktoren", es: "Factores de puntuación", tr: "Puan faktörleri", ru: "Факторы оценки" },
  score_improvement: { en: "How to Improve", ar: "كيفية تحسين المؤشر", fr: "Comment améliorer", de: "Verbesserungsvorschläge", es: "Cómo mejorar", tr: "Nasıl iyileştirilir", ru: "Как улучшить" },
  scan_settings: { en: "Scan Settings", ar: "إعدادات الفحص", fr: "Paramètres d'analyse", de: "Scan-Einstellungen", es: "Configuración de escaneo", tr: "Tarama ayarları", ru: "Настройки сканирования" },
  scan_sensitivity: { en: "Scan Sensitivity", ar: "حساسية الفحص", fr: "Sensibilité d'analyse", de: "Scan-Empfindlichkeit", es: "Sensibilidad de escaneo", tr: "Tarama hassasiyeti", ru: "Чувствительность" },
  scan_db_selection: { en: "Database Selection", ar: "تحديد قواعد البيانات", fr: "Sélection de base de données", de: "Datenbankauswahl", es: "Selección de base de datos", tr: "Veritabanı seçimi", ru: "Выбор базы данных" },
  delete: { en: "Delete", ar: "حذف", fr: "Supprimer", de: "Löschen", es: "Eliminar", tr: "Sil", ru: "Удалить" },
  clear_all: { en: "Clear All", ar: "مسح الكل", fr: "Tout effacer", de: "Alles löschen", es: "Borrar todo", tr: "Tümünü temizle", ru: "Очистить всё" },
  pwd_tester_title: { en: "Password Strength check", ar: "فحص قوة كلمة المرور", fr: "Test de force du mot de passe", de: "Passwortstärke-Check", es: "Verificación de contraseña", tr: "Şifre güç testi", ru: "Проверка надёжности пароля" },
  pwd_tester_desc: { en: "Evaluates algorithmically and locally.", ar: "يتم تقييم قوة الكلمة محلياً فقط.", fr: "Évaluation locale et algorithmique.", de: "Algorithmische lokale Bewertung.", es: "Evaluación local y algorítmica.", tr: "Yerel algoritmik değerlendirme.", ru: "Локальная алгоритмическая оценка." },
  pwd_strength_0: { en: "Very Weak", ar: "ضعيفة جداً", fr: "Très faible", de: "Sehr schwach", es: "Muy débil", tr: "Çok zayıf", ru: "Очень слабый" },
  pwd_strength_1: { en: "Weak", ar: "ضعيفة", fr: "Faible", de: "Schwach", es: "Débil", tr: "Zayıf", ru: "Слабый" },
  pwd_strength_2: { en: "Fair", ar: "مقبولة", fr: "Moyen", de: "Mittel", es: "Regular", tr: "Orta", ru: "Средний" },
  pwd_strength_3: { en: "Good", ar: "جيدة", fr: "Bon", de: "Gut", es: "Bueno", tr: "İyi", ru: "Хороший" },
  pwd_strength_4: { en: "Strong", ar: "قوية", fr: "Fort", de: "Stark", es: "Fuerte", tr: "Güçlü", ru: "Надёжный" },
  pwd_placeholder: { en: "Type a password...", ar: "اكتب كلمة مرور...", fr: "Tapez un mot de passe...", de: "Passwort eingeben...", es: "Escribe una contraseña...", tr: "Şifre yazın...", ru: "Введите пароль..." },
  pwd_req_length: { en: "At least 8 characters", ar: "٨ أحرف على الأقل", fr: "Au moins 8 caractères", de: "Mindestens 8 Zeichen", es: "Al menos 8 caracteres", tr: "En az 8 karakter", ru: "Минимум 8 символов" },
  pwd_req_upper: { en: "Uppercase letter", ar: "حرف إنجليزي كبير", fr: "Lettre majuscule", de: "Großbuchstabe", es: "Letra mayúscula", tr: "Büyük harf", ru: "Заглавная буква" },
  pwd_req_lower: { en: "Lowercase letter", ar: "حرف إنجليزي صغير", fr: "Lettre minuscule", de: "Kleinbuchstabe", es: "Letra minúscula", tr: "Küçük harf", ru: "Строчная буква" },
  pwd_req_number: { en: "Number", ar: "رقم", fr: "Chiffre", de: "Zahl", es: "Número", tr: "Rakam", ru: "Цифра" },
  pwd_req_special: { en: "Special character", ar: "رمز خاص", fr: "Caractère spécial", de: "Sonderzeichen", es: "Carácter especial", tr: "Özel karakter", ru: "Спецсимвол" },
  pwd_req_no_patterns: { en: "No predictable patterns or words", ar: "خلوها من الأنماط والكلمات الشائعة", fr: "Pas de motifs prévisibles", de: "Keine vorhersehbaren Muster", es: "Sin patrones predecibles", tr: "Tahmin edilebilir kalıp yok", ru: "Без предсказуемых шаблонов" },
  pwd_feedback_pattern: { en: "Avoid common sequences (e.g. 123) or repeated characters.", ar: "تجنب التسلسلات الشائعة (مثل 123) أو تكرار الأحرف.", fr: "Évitez les séquences courantes (ex: 123).", de: "Vermeiden Sie gängige Sequenzen (z.B. 123).", es: "Evita secuencias comunes (ej: 123).", tr: "Yaygın dizilerden kaçının (ör: 123).", ru: "Избегайте типичных последовательностей (123)." },
  pwd_feedback_more_chars: { en: "Add more characters...", ar: "أضف المزيد من الأحرف...", fr: "Ajoutez plus de caractères...", de: "Mehr Zeichen hinzufügen...", es: "Agrega más caracteres...", tr: "Daha fazla karakter ekleyin...", ru: "Добавьте больше символов..." },
  pwd_feedback_mix_types: { en: "Mix uppercase, lowercase, numbers, and symbols.", ar: "استخدم مزيج من الأحرف الكبيرة، الصغيرة، الأرقام، والرموز.", fr: "Mélangez majuscules, minuscules, chiffres et symboles.", de: "Mischen Sie Groß-/Kleinbuchstaben, Zahlen und Symbole.", es: "Combina mayúsculas, minúsculas, números y símbolos.", tr: "Büyük/küçük harf, rakam ve sembol karıştırın.", ru: "Используйте заглавные, строчные, цифры и символы." },
  pwd_generate: { en: "Generate robust password", ar: "توليد كلمة مرور قوية", fr: "Générer un mot de passe robuste", de: "Sicheres Passwort generieren", es: "Generar contraseña robusta", tr: "Güçlü şifre oluştur", ru: "Сгенерировать надёжный пароль" },
  pwd_gen_settings: { en: "Generator Settings", ar: "إعدادات التوليد", fr: "Paramètres du générateur", de: "Generator-Einstellungen", es: "Configuración del generador", tr: "Oluşturucu ayarları", ru: "Настройки генератора" },
  pwd_gen_length: { en: "Length", ar: "طول الكلمة", fr: "Longueur", de: "Länge", es: "Longitud", tr: "Uzunluk", ru: "Длина" },
  pwd_gen_numbers: { en: "Include Numbers", ar: "تضمين أرقام", fr: "Inclure les chiffres", de: "Zahlen einschließen", es: "Incluir números", tr: "Rakam ekle", ru: "Включить цифры" },
  pwd_gen_symbols: { en: "Include Symbols", ar: "تضمين رموز", fr: "Inclure les symboles", de: "Symbole einschließen", es: "Incluir símbolos", tr: "Sembol ekle", ru: "Включить символы" },
  toggle_theme: { en: "Toggle Theme", ar: "تغيير المظهر", fr: "Changer le thème", de: "Design wechseln", es: "Cambiar tema", tr: "Tema değiştir", ru: "Сменить тему" },
  share_report: { en: "Share Report", ar: "مشاركة التقرير", fr: "Partager le rapport", de: "Bericht teilen", es: "Compartir informe", tr: "Raporu paylaş", ru: "Поделиться отчётом" },
  download_report: { en: "Download PDF", ar: "تحميل التقرير PDF", fr: "Télécharger PDF", de: "PDF herunterladen", es: "Descargar PDF", tr: "PDF indir", ru: "Скачать PDF" },
  export_csv: { en: "Export CSV", ar: "تصدير CSV", fr: "Exporter CSV", de: "CSV exportieren", es: "Exportar CSV", tr: "CSV dışa aktar", ru: "Экспорт CSV" },
  share_title: { en: "JoeScan Security Report", ar: "تقرير أمان جو-سكان", fr: "Rapport de sécurité JoeScan", de: "JoeScan Sicherheitsbericht", es: "Informe de seguridad JoeScan", tr: "JoeScan Güvenlik Raporu", ru: "Отчёт безопасности JoeScan" },
  share_copied: { en: "Copied!", ar: "تم النسخ!", fr: "Copié !", de: "Kopiert!", es: "¡Copiado!", tr: "Kopyalandı!", ru: "Скопировано!" },
  copy_link: { en: "Copy Link", ar: "نسخ الرابط", fr: "Copier le lien", de: "Link kopieren", es: "Copiar enlace", tr: "Bağlantıyı kopyala", ru: "Копировать ссылку" },
  share_twitter: { en: "Twitter", ar: "تويتر", fr: "Twitter", de: "Twitter", es: "Twitter", tr: "Twitter", ru: "Twitter" },
  share_facebook: { en: "Facebook", ar: "فيسبوك", fr: "Facebook", de: "Facebook", es: "Facebook", tr: "Facebook", ru: "Facebook" },
  
  // Navigation Tabs
  nav_dashboard: { en: "Command Center", ar: "مركز القيادة", fr: "Centre de commande", de: "Kommandozentrale", es: "Centro de mando", tr: "Komuta merkezi", ru: "Центр управления" },
  nav_email: { en: "Email Audit", ar: "فحص الإيميل", fr: "Audit e-mail", de: "E-Mail-Audit", es: "Auditoría de correo", tr: "E-posta denetimi", ru: "Аудит email" },
  nav_password: { en: "Password Vault Check", ar: "فحص كلمات المرور", fr: "Vérification des mots de passe", de: "Passwort-Tresor-Check", es: "Verificación de contraseñas", tr: "Şifre kasası kontrolü", ru: "Проверка паролей" },
  nav_phone: { en: "Phone Number", ar: "فحص أرقام الهواتف", fr: "Numéro de téléphone", de: "Telefonnummer", es: "Número de teléfono", tr: "Telefon numarası", ru: "Номер телефона" },
  nav_url: { en: "Suspicious Link", ar: "فحص الروابط المشبوهة", fr: "Lien suspect", de: "Verdächtiger Link", es: "Enlace sospechoso", tr: "Şüpheli bağlantı", ru: "Подозрительная ссылка" },
  nav_username: { en: "OSINT Username", ar: "تحري الأسماء المستعارة", fr: "Nom d'utilisateur OSINT", de: "OSINT-Benutzername", es: "Usuario OSINT", tr: "OSINT kullanıcı adı", ru: "OSINT имя пользователя" },
  nav_message: { en: "Message Phishing", ar: "فحص رسائل النصب", fr: "Hameçonnage de messages", de: "Nachrichtenphishing", es: "Phishing de mensajes", tr: "Mesaj oltalama", ru: "Фишинг сообщений" },
  nav_ip: { en: "IP Scan", ar: "فحص عناوين الـ IP", fr: "Scan IP", de: "IP-Scan", es: "Escaneo IP", tr: "IP tarama", ru: "Сканирование IP" },
  nav_domain: { en: "Domain WHOIS", ar: "فحص الدومين", fr: "WHOIS Domaine", de: "Domain-WHOIS", es: "WHOIS Dominio", tr: "Alan Adı WHOIS", ru: "WHOIS домена" },
  nav_fingerprint: { en: "Browser Fingerprint", ar: "بصمة المتصفح", fr: "Empreinte navigateur", de: "Browser-Fingerabdruck", es: "Huella del navegador", tr: "Tarayıcı parmak izi", ru: "Отпечаток браузера" },
  nav_device_security: { en: "Device Security", ar: "أمان الجهاز", fr: "Sécurité appareil", de: "Gerätesicherheit", es: "Seguridad del dispositivo", tr: "Cihaz güvenliği", ru: "Безопасность устройства" },

  // General App Actions
  audit: { en: "Audit", ar: "فحص الآن", fr: "Auditer", de: "Prüfen", es: "Auditar", tr: "Denetle", ru: "Аудит" },
  risk_assessed: { en: "Risk Assessed", ar: "تقييم الخطر", fr: "Risque évalué", de: "Risiko bewertet", es: "Riesgo evaluado", tr: "Risk değerlendirildi", ru: "Риск оценён" },
  exposure: { en: "Exposure", ar: "تسريب", fr: "Exposition", de: "Exposition", es: "Exposición", tr: "Maruziyet", ru: "Утечка" },
  select_country: { en: "Select Country...", ar: "اختر الدولة...", fr: "Sélectionner le pays...", de: "Land auswählen...", es: "Seleccionar país...", tr: "Ülke seçin...", ru: "Выберите страну..." },
  settings: { en: "Settings", ar: "الإعدادات", fr: "Paramètres", de: "Einstellungen", es: "Configuración", tr: "Ayarlar", ru: "Настройки" },
  language_label: { en: "Language", ar: "اللغة", fr: "Langue", de: "Sprache", es: "Idioma", tr: "Dil", ru: "Язык" },

  // Phone Analyzer
  phone_desc: { en: "Check if your cellular number has been exposed in public databases, telemarketing leaks, or known dark web records.", ar: "تأكد ما إذا كان رقمك مسرباً في قواعد بيانات التسويق والمكالمات المزعجة والإنترنت المظلم.", fr: "Vérifiez si votre numéro a été exposé dans des bases de données publiques.", de: "Prüfen Sie, ob Ihre Nummer in öffentlichen Datenbanken aufgetaucht ist.", es: "Verifica si tu número ha sido expuesto en bases de datos públicas.", tr: "Numaranızın herkese açık veritabanlarında ifşa edilip edilmediğini kontrol edin.", ru: "Проверьте, был ли ваш номер скомпрометирован в публичных базах." },
  phone_deep_scan: { en: "Deep Intelligence Scan (OSINT)", ar: "فحص عميق للإنترنت المفتوح (OSINT)", fr: "Scan d'intelligence profonde (OSINT)", de: "Tiefenscan (OSINT)", es: "Escaneo profundo (OSINT)", tr: "Derin istihbarat taraması (OSINT)", ru: "Глубокое сканирование (OSINT)" },
  phone_privacy_score: { en: "Number Privacy Score", ar: "مؤشر خصوصية الرقم", fr: "Score de confidentialité", de: "Datenschutzbewertung", es: "Puntuación de privacidad", tr: "Gizlilik puanı", ru: "Оценка конфиденциальности" },
  registered_name: { en: "Registered Name", ar: "الاسم المسجل علنياً", fr: "Nom enregistré", de: "Registrierter Name", es: "Nombre registrado", tr: "Kayıtlı isim", ru: "Зарегистрированное имя" },
  network_carrier: { en: "Network Carrier", ar: "شبكة الاتصالات", fr: "Opérateur réseau", de: "Netzbetreiber", es: "Operador de red", tr: "Ağ operatörü", ru: "Оператор связи" },
  origin_country: { en: "Origin Country", ar: "بلد الرقم", fr: "Pays d'origine", de: "Herkunftsland", es: "País de origen", tr: "Kaynak ülke", ru: "Страна происхождения" },
  spam_probability: { en: "Spam Probability", ar: "احتمالية الإزعاج / الاحتيال", fr: "Probabilité de spam", de: "Spam-Wahrscheinlichkeit", es: "Probabilidad de spam", tr: "Spam olasılığı", ru: "Вероятность спама" },
  platform_exposure: { en: "Platform Exposure", ar: "موجود على منصات", fr: "Exposition sur les plateformes", de: "Plattform-Exposition", es: "Exposición en plataformas", tr: "Platform maruziyeti", ru: "Присутствие на платформах" },
  private_footprint: { en: "Private footprint", ar: "بصمة خاصة (غير مسرب)", fr: "Empreinte privée", de: "Privater Fußabdruck", es: "Huella privada", tr: "Özel ayak izi", ru: "Частный след" },
  intelligence_trace: { en: "Intelligence Trace", ar: "تتبع استخباراتي لمسار الرقم", fr: "Trace de renseignement", de: "Nachrichtendienstliche Verfolgung", es: "Rastreo de inteligencia", tr: "İstihbarat izi", ru: "Разведывательный след" },

  // URL Analyzer
  url_title: { en: "Suspicious Link", ar: "روابط مشبوهة", fr: "Lien suspect", de: "Verdächtiger Link", es: "Enlace sospechoso", tr: "Şüpheli bağlantı", ru: "Подозрительная ссылка" },
  url_desc: { en: "Analyze any URL for phishing attempts, malware distribution, or deceptive domains.", ar: "افحص أي رابط لتتأكد من خلوه من محاولات الاختراق، البرمجيات الخبيثة، أو المواقع المزيفة.", fr: "Analysez toute URL pour détecter le phishing ou les logiciels malveillants.", de: "Analysieren Sie URLs auf Phishing oder Malware.", es: "Analiza cualquier URL para detectar phishing o malware.", tr: "Herhangi bir URL'yi oltalama veya kötü amaçlı yazılım için analiz edin.", ru: "Анализируйте URL на фишинг и вредоносное ПО." },
  url_placeholder: { en: "e.g. https://suspicious-site.com", ar: "مثال: https://suspicious-site.com", fr: "ex: https://site-suspect.com", de: "z.B. https://verdaechtige-seite.com", es: "ej: https://sitio-sospechoso.com", tr: "ör: https://supheli-site.com", ru: "напр. https://podozritelny-sait.com" },
  url_safety_score: { en: "URL Safety Score", ar: "مؤشر أمان الرابط", fr: "Score de sécurité URL", de: "URL-Sicherheitsbewertung", es: "Puntuación de seguridad URL", tr: "URL güvenlik puanı", ru: "Оценка безопасности URL" },
  domain_age: { en: "Domain Age", ar: "عمر النطاق (الموقع)", fr: "Âge du domaine", de: "Domain-Alter", es: "Antigüedad del dominio", tr: "Alan adı yaşı", ru: "Возраст домена" },
  blacklist_status: { en: "Blacklist Status", ar: "حالة القوائم السوداء", fr: "Statut liste noire", de: "Blacklist-Status", es: "Estado de lista negra", tr: "Kara liste durumu", ru: "Статус чёрного списка" },
  redirect_behavior: { en: "Redirect Behavior", ar: "تحليل إعادة التوجيه", fr: "Comportement de redirection", de: "Weiterleitungsverhalten", es: "Comportamiento de redirección", tr: "Yönlendirme davranışı", ru: "Поведение перенаправления" },
  blacklisted_yes: { en: "Flagged Malicious", ar: "مصنف كخبيث", fr: "Signalé malveillant", de: "Als bösartig markiert", es: "Marcado como malicioso", tr: "Kötü amaçlı olarak işaretlendi", ru: "Отмечен как вредоносный" },
  blacklisted_no: { en: "Clean (No Flags)", ar: "نظيف (غير مصنف كخبيث)", fr: "Propre (aucun signalement)", de: "Sauber (keine Markierungen)", es: "Limpio (sin marcas)", tr: "Temiz (işaret yok)", ru: "Чист (нет отметок)" },

  // Username Analyzer
  username_title: { en: "OSINT Username", ar: "بحث الأسماء (OSINT)", fr: "Nom d'utilisateur OSINT", de: "OSINT-Benutzername", es: "Usuario OSINT", tr: "OSINT kullanıcı adı", ru: "OSINT имя пользователя" },
  username_desc: { en: "Investigate digital footprints across the web for a specific handle or profile name.", ar: "ابحث عن أي اسم مستعار أو حساب عبر الإنترنت للتحقق من أثره الرقمي وبصمته.", fr: "Enquêtez sur les empreintes numériques pour un nom de profil spécifique.", de: "Untersuchen Sie digitale Fußabdrücke für einen bestimmten Benutzernamen.", es: "Investiga huellas digitales para un nombre de usuario específico.", tr: "Belirli bir kullanıcı adı için dijital ayak izlerini araştırın.", ru: "Исследуйте цифровой след конкретного имени пользователя." },
  username_placeholder: { en: "e.g. shadow_hacker_99", ar: "مثال: shadow_hacker_99", fr: "ex: shadow_hacker_99", de: "z.B. shadow_hacker_99", es: "ej: shadow_hacker_99", tr: "ör: shadow_hacker_99", ru: "напр. shadow_hacker_99" },
  username_footprint_score: { en: "Footprint Discretion", ar: "سرية التواجد الرقمي", fr: "Discrétion de l'empreinte", de: "Fußabdruck-Diskretion", es: "Discreción de huella", tr: "Ayak izi gizliliği", ru: "Скрытность следа" },
  platforms_detected: { en: "Platforms Detected", ar: "المنصات المكتشفة", fr: "Plateformes détectées", de: "Erkannte Plattformen", es: "Plataformas detectadas", tr: "Tespit edilen platformlar", ru: "Обнаруженные платформы" },
  data_breaches: { en: "Data Breaches", ar: "التسريبات", fr: "Violations de données", de: "Datenlecks", es: "Filtraciones de datos", tr: "Veri ihlalleri", ru: "Утечки данных" },
  online_reputation: { en: "Online Reputation", ar: "السمعة على الإنترنت", fr: "Réputation en ligne", de: "Online-Ruf", es: "Reputación en línea", tr: "Çevrimiçi itibar", ru: "Онлайн-репутация" },
  darkweb_mentions: { en: "Dark Web Mentions", ar: "إشارات في الإنترنت المظلم", fr: "Mentions sur le Dark Web", de: "Dark-Web-Erwähnungen", es: "Menciones en Dark Web", tr: "Dark Web'de bahsedilme", ru: "Упоминания в даркнете" },

  // Message Analyzer
  message_title: { en: "Message Phishing", ar: "فحص رسائل النصب (Phishing)", fr: "Hameçonnage de messages", de: "Nachrichtenphishing", es: "Phishing de mensajes", tr: "Mesaj oltalama", ru: "Фишинг сообщений" },
  message_desc: { en: "Paste a suspicious SMS, email body, or DM to detect social engineering and scam markers.", ar: "انسخ أي رسالة (SMS أو إيميل) مشكوك فيها هنا وسنقوم بتحليل الخدع ومحاولات التصيد بها.", fr: "Collez un SMS ou e-mail suspect pour détecter les tentatives de fraude.", de: "Fügen Sie eine verdächtige Nachricht ein, um Betrug zu erkennen.", es: "Pega un SMS o correo sospechoso para detectar intentos de fraude.", tr: "Dolandırıcılık belirteçlerini tespit etmek için şüpheli bir mesaj yapıştırın.", ru: "Вставьте подозрительное сообщение для обнаружения мошенничества." },
  message_placeholder: { en: "Paste the raw message text here...", ar: "انسخ نص الرسالة بالكامل هنا...", fr: "Collez le texte du message ici...", de: "Nachrichtentext hier einfügen...", es: "Pega el texto del mensaje aquí...", tr: "Mesaj metnini buraya yapıştırın...", ru: "Вставьте текст сообщения..." },
  message_authenticity_score: { en: "Authenticity Score", ar: "مؤشر مصداقية الرسالة", fr: "Score d'authenticité", de: "Authentizitätsbewertung", es: "Puntuación de autenticidad", tr: "Özgünlük puanı", ru: "Оценка аутентичности" },
  scam_confidence: { en: "Scam Confidence", ar: "احتمالية الاحتيال", fr: "Probabilité de fraude", de: "Betrugswahrscheinlichkeit", es: "Probabilidad de estafa", tr: "Dolandırıcılık olasılığı", ru: "Вероятность мошенничества" },
  psy_triggers: { en: "Psychological Triggers Detected", ar: "خدع نفسية وحيل مكتشفة", fr: "Déclencheurs psychologiques détectés", de: "Erkannte psychologische Auslöser", es: "Detonantes psicológicos detectados", tr: "Tespit edilen psikolojik tetikleyiciler", ru: "Обнаруженные психологические триггеры" },
  spoofing_vectors: { en: "Spoofing Vectors", ar: "مؤشرات انتحال الشخصية", fr: "Vecteurs d'usurpation", de: "Spoofing-Vektoren", es: "Vectores de suplantación", tr: "Sahtecilik vektörleri", ru: "Векторы подмены" },
  financial_requests: { en: "Financial Requests", ar: "طلبات مالية", fr: "Demandes financières", de: "Finanzielle Anfragen", es: "Solicitudes financieras", tr: "Mali talepler", ru: "Финансовые запросы" },
  suspicious_commands: { en: "Suspicious Commands", ar: "أوامر خبيثة", fr: "Commandes suspectes", de: "Verdächtige Befehle", es: "Comandos sospechosos", tr: "Şüpheli komutlar", ru: "Подозрительные команды" },
  presence_yes: { en: "Present", ar: "تم العثور عليها", fr: "Présent", de: "Vorhanden", es: "Presente", tr: "Mevcut", ru: "Обнаружено" },
  presence_no: { en: "None Detected", ar: "غير موجودة", fr: "Non détecté", de: "Nicht erkannt", es: "No detectado", tr: "Tespit edilmedi", ru: "Не обнаружено" },

  // IP Analyzer
  ip_title: { en: "IP Scan", ar: "فحص الـ IP", fr: "Scan IP", de: "IP-Scan", es: "Escaneo IP", tr: "IP tarama", ru: "Сканирование IP" },
  ip_desc: { en: "Examine an IP address for botnet activity, VPN/Tor usage, and geographical tracing.", ar: "حلل أي عنوان IP لاكتشاف استخدامه في هجمات، وجود شبكات VPN/Tor، أو موقعه الجغرافي.", fr: "Examinez une adresse IP pour détecter l'activité botnet et le traçage géographique.", de: "Untersuchen Sie eine IP-Adresse auf Botnet-Aktivität und VPN-Nutzung.", es: "Examine una dirección IP para detectar actividad botnet y rastreo geográfico.", tr: "Bir IP adresini botnet aktivitesi ve VPN kullanımı için inceleyin.", ru: "Проанализируйте IP-адрес на активность ботнета и использование VPN." },
  ip_placeholder: { en: "e.g. 192.168.1.1", ar: "مثال: 192.168.1.1", fr: "ex: 192.168.1.1", de: "z.B. 192.168.1.1", es: "ej: 192.168.1.1", tr: "ör: 192.168.1.1", ru: "напр. 192.168.1.1" },
  ip_trust_score: { en: "IP Trust Score", ar: "تقييم أمان الـ IP", fr: "Score de confiance IP", de: "IP-Vertrauensbewertung", es: "Puntuación de confianza IP", tr: "IP güven puanı", ru: "Оценка доверия IP" },
  geo_location: { en: "Geo-Location", ar: "الموقع الجغرافي", fr: "Géolocalisation", de: "Geolokalisierung", es: "Geolocalización", tr: "Konum", ru: "Геолокация" },
  isp_asn: { en: "ISP Provider", ar: "مزود الخدمة (ISP)", fr: "Fournisseur FAI", de: "ISP-Anbieter", es: "Proveedor ISP", tr: "İSS sağlayıcı", ru: "Провайдер ISP" },
  vpn_tor_proxy: { en: "VPN / Proxy", ar: "بروكسي / VPN", fr: "VPN / Proxy", de: "VPN / Proxy", es: "VPN / Proxy", tr: "VPN / Proxy", ru: "VPN / Прокси" },
  network_intel: { en: "Network Intel", ar: "استخبارات الشبكة", fr: "Renseignement réseau", de: "Netzwerk-Intelligence", es: "Inteligencia de red", tr: "Ağ istihbaratı", ru: "Сетевая разведка" },
  vpn_yes: { en: "Yes (Anonymized)", ar: "نعم (مشفر/مخفي)", fr: "Oui (anonymisé)", de: "Ja (anonymisiert)", es: "Sí (anonimizado)", tr: "Evet (anonim)", ru: "Да (анонимизирован)" },
  vpn_no: { en: "No (Direct)", ar: "لا (مباشر)", fr: "Non (direct)", de: "Nein (direkt)", es: "No (directo)", tr: "Hayır (doğrudan)", ru: "Нет (прямое)" },
  botnet_suspect: { en: "Botnet Suspect", ar: "الاشتباه كـ Botnet", fr: "Suspect de botnet", de: "Botnet-Verdacht", es: "Sospechoso de botnet", tr: "Botnet şüphesi", ru: "Подозрение на ботнет" },
  botnet_alert: { en: "ALERT (Listed)", ar: "خطر (مدرج بقوائم)", fr: "ALERTE (listé)", de: "WARNUNG (gelistet)", es: "ALERTA (listado)", tr: "UYARI (listede)", ru: "ТРЕВОГА (в списке)" },
  botnet_clear: { en: "Clear (Not Listed)", ar: "نظيف (غير مدرج)", fr: "Propre (non listé)", de: "Sauber (nicht gelistet)", es: "Limpio (no listado)", tr: "Temiz (listede değil)", ru: "Чист (не в списке)" },
  phone_invalid_format: { en: "Invalid phone number. Please select the correct country and enter a valid number.", ar: "رقم الهاتف غير صالح. يرجى اختيار الدولة الصحيحة وإدخال رقم صحيح.", fr: "Numéro invalide. Veuillez sélectionner le bon pays.", de: "Ungültige Telefonnummer. Bitte wählen Sie das richtige Land.", es: "Número inválido. Selecciona el país correcto.", tr: "Geçersiz numara. Lütfen doğru ülkeyi seçin.", ru: "Неверный номер. Выберите правильную страну." },
  // API Settings Modal
  api_settings_title: { en: "AI Provider Settings", ar: "إعدادات مزود الذكاء الاصطناعي", fr: "Paramètres du fournisseur IA", de: "KI-Anbieter-Einstellungen", es: "Configuración del proveedor IA", tr: "AI sağlayıcı ayarları", ru: "Настройки провайдера ИИ" },
  cancel: { en: "Cancel", ar: "إلغاء", fr: "Annuler", de: "Abbrechen", es: "Cancelar", tr: "İptal", ru: "Отмена" },
  api_settings_desc: { en: "Examine or switch AI providers if you're hitting limits (e.g., Groq, Grok).", ar: "هل تجاوزت الحد المسموح به؟ يمكنك التبديل لمزود ذكاء اصطناعي آخر مثل Groq أو Grok.", fr: "Changez de fournisseur IA si vous atteignez les limites.", de: "Wechseln Sie den KI-Anbieter bei Limits.", es: "Cambia de proveedor IA si alcanzas los límites.", tr: "Limitlere ulaşırsanız AI sağlayıcısını değiştirin.", ru: "Смените провайдера ИИ при достижении лимитов." },
  provider_gemini: { en: "Google Gemini (Default AI Studio)", ar: "Google Gemini (الافتراضي)", fr: "Google Gemini (Par défaut)", de: "Google Gemini (Standard)", es: "Google Gemini (Predeterminado)", tr: "Google Gemini (Varsayılan)", ru: "Google Gemini (По умолчанию)" },
  provider_gemini_desc: { en: "Uses built-in system API key. Subject to generic rate limits.", ar: "يستخدم المفتاح الافتراضي المدمج. قد يواجه قيود وحظر الاستخدام.", fr: "Utilise la clé API intégrée. Soumis aux limites.", de: "Verwendet integrierten API-Schlüssel. Ratelimits gelten.", es: "Usa clave API integrada. Sujeto a límites.", tr: "Yerleşik API anahtarı kullanır. Hız limitleri geçerlidir.", ru: "Использует встроенный ключ API. Ограничения применяются." },
  provider_groq: { en: "Groq (Llama 3)", ar: "Groq (نموذج Llama 3)", fr: "Groq (Llama 3)", de: "Groq (Llama 3)", es: "Groq (Llama 3)", tr: "Groq (Llama 3)", ru: "Groq (Llama 3)" },
  provider_grok: { en: "Grok (xAI)", ar: "Grok (منظمة xAI)", fr: "Grok (xAI)", de: "Grok (xAI)", es: "Grok (xAI)", tr: "Grok (xAI)", ru: "Grok (xAI)" },
  custom_key_label: { en: "API Key", ar: "مفتاح API", fr: "Clé API", de: "API-Schlüssel", es: "Clave API", tr: "API anahtarı", ru: "API ключ" },
  save_changes: { en: "Save Settings", ar: "حفظ الإعدادات", fr: "Enregistrer", de: "Speichern", es: "Guardar", tr: "Kaydet", ru: "Сохранить" },
  saved_successfully: { en: "Settings Saved!", ar: "تم الحفظ بنجاح!", fr: "Paramètres enregistrés !", de: "Einstellungen gespeichert!", es: "¡Configuración guardada!", tr: "Ayarlar kaydedildi!", ru: "Настройки сохранены!" },
  profile_settings: { en: "Profile Settings", ar: "إعدادات الحساب", fr: "Paramètres du profil", de: "Profileinstellungen", es: "Configuración del perfil", tr: "Profil ayarları", ru: "Настройки профиля" },
  tab_general: { en: "General", ar: "عام", fr: "Général", de: "Allgemein", es: "General", tr: "Genel", ru: "Общие" },
  tab_security: { en: "Security", ar: "الأمان", fr: "Sécurité", de: "Sicherheit", es: "Seguridad", tr: "Güvenlik", ru: "Безопасность" },
  internal_uid: { en: "Internal Uid", ar: "المعرف الداخلي", fr: "UID interne", de: "Interne UID", es: "UID interno", tr: "Dahili UID", ru: "Внутренний UID" },
  display_name: { en: "Display Name", ar: "اسم العرض", fr: "Nom d'affichage", de: "Anzeigename", es: "Nombre para mostrar", tr: "Görünen ad", ru: "Имя пользователя" },
  account_email: { en: "Account Email Address", ar: "البريد الإلكتروني", fr: "Adresse e-mail du compte", de: "Konto-E-Mail", es: "Correo de la cuenta", tr: "Hesap e-postası", ru: "Email аккаунта" },
  avatar_label: { en: "Avatar", ar: "الصورة الشخصية", fr: "Avatar", de: "Avatar", es: "Avatar", tr: "Avatar", ru: "Аватар" },
  upload_file: { en: "File", ar: "ملف", fr: "Fichier", de: "Datei", es: "Archivo", tr: "Dosya", ru: "Файл" },
  upload_url: { en: "URL", ar: "رابط", fr: "URL", de: "URL", es: "URL", tr: "URL", ru: "URL" },
  click_to_upload: { en: "Click to upload image", ar: "اضغط لرفع صورة", fr: "Cliquez pour télécharger", de: "Klicken zum Hochladen", es: "Haz clic para subir", tr: "Yüklemek için tıklayın", ru: "Нажмите для загрузки" },
  save_profile: { en: "Save Profile Changes", ar: "حفظ التغييرات", fr: "Enregistrer le profil", de: "Profil speichern", es: "Guardar perfil", tr: "Profili kaydet", ru: "Сохранить профиль" },
  old_password: { en: "Current Password", ar: "الباسورد الحالي", fr: "Mot de passe actuel", de: "Aktuelles Passwort", es: "Contraseña actual", tr: "Mevcut şifre", ru: "Текущий пароль" },
  forgot_password: { en: "Forgot Password?", ar: "نسيت الباسورد؟", fr: "Mot de passe oublié ?", de: "Passwort vergessen?", es: "¿Olvidaste tu contraseña?", tr: "Şifremi unuttum?", ru: "Забыли пароль?" },
  new_password: { en: "New Password", ar: "الباسورد الجديد", fr: "Nouveau mot de passe", de: "Neues Passwort", es: "Nueva contraseña", tr: "Yeni şifre", ru: "Новый пароль" },
  confirm_password: { en: "Confirm New Password", ar: "تأكيد الباسورد", fr: "Confirmer le mot de passe", de: "Passwort bestätigen", es: "Confirmar contraseña", tr: "Şifreyi onayla", ru: "Подтвердите пароль" },
  update_password: { en: "Update Password", ar: "تحديث الباسورد", fr: "Mettre à jour", de: "Passwort aktualisieren", es: "Actualizar contraseña", tr: "Şifreyi güncelle", ru: "Обновить пароль" },
  danger_zone: { en: "Danger Zone", ar: "منطقة الخطر", fr: "Zone de danger", de: "Gefahrenzone", es: "Zona de peligro", tr: "Tehlike bölgesi", ru: "Опасная зона" },
  delete_account: { en: "Delete Account", ar: "مسح الحساب", fr: "Supprimer le compte", de: "Konto löschen", es: "Eliminar cuenta", tr: "Hesabı sil", ru: "Удалить аккаунт" },
  global_security_posture: { en: "Global Security Posture", ar: "مؤشر الوضع الأمني العام", fr: "Posture de sécurité globale", de: "Globale Sicherheitslage", es: "Postura de seguridad global", tr: "Genel güvenlik durumu", ru: "Глобальный уровень безопасности" },
  score_high_desc: { en: "Your digital footprint indicates a strong security posture. Keep up the good habits.", ar: "بصمتك الرقمية تشير إلى وضع أمني قوي. استمر في هذه العادات الجيدة.", fr: "Votre posture de sécurité est forte. Continuez ainsi.", de: "Ihre Sicherheitslage ist stark. Weiter so.", es: "Tu postura de seguridad es fuerte. Sigue así.", tr: "Güvenlik durumunuz güçlü. Böyle devam edin.", ru: "Ваша безопасность на высоком уровне. Так держать." },
  score_medium_desc: { en: "Your accounts are at moderate risk. We recommend migrating older passwords and enabling 2FA.", ar: "حساباتك في خطر متوسط. ننصح بتغيير كلمات المرور القديمة وتفعيل المصادقة الثنائية (2FA).", fr: "Risque modéré. Changez vos anciens mots de passe et activez le 2FA.", de: "Mittleres Risiko. Ändern Sie alte Passwörter und aktivieren Sie 2FA.", es: "Riesgo moderado. Cambia contraseñas antiguas y activa 2FA.", tr: "Orta risk. Eski şifreleri değiştirin ve 2FA'yı etkinleştirin.", ru: "Средний риск. Смените старые пароли и включите 2FA." },
  score_low_desc: { en: "Critical risk exposure detected. Immediate password rotations and intelligence audits required.", ar: "تم رصد مستوى خطر حرج. يُرجى تغيير كلمات المرور حالاً وفحص أمانك فوراً.", fr: "Risque critique détecté. Changement de mots de passe immédiat requis.", de: "Kritisches Risiko erkannt. Sofortige Passwortänderung erforderlich.", es: "Riesgo crítico detectado. Cambio inmediato de contraseñas requerido.", tr: "Kritik risk tespit edildi. Acil şifre değişikliği gerekli.", ru: "Обнаружен критический риск. Немедленная смена паролей." },
  emails_label: { en: "Emails", ar: "إيميلات", fr: "E-mails", de: "E-Mails", es: "Correos", tr: "E-postalar", ru: "Письма" },
  vault_label: { en: "Vault", ar: "خزنة", fr: "Coffre", de: "Tresor", es: "Bóveda", tr: "Kasa", ru: "Хранилище" },
  phone_label: { en: "Phone", ar: "هاتف", fr: "Téléphone", de: "Telefon", es: "Teléfono", tr: "Telefon", ru: "Телефон" },
  links_label: { en: "Links", ar: "روابط", fr: "Liens", de: "Links", es: "Enlaces", tr: "Bağlantılar", ru: "Ссылки" },
  osint_label: { en: "OSINT", ar: "أسماء", fr: "OSINT", de: "OSINT", es: "OSINT", tr: "OSINT", ru: "OSINT" },
  messages_label: { en: "Messages", ar: "رسائل", fr: "Messages", de: "Nachrichten", es: "Mensajes", tr: "Mesajlar", ru: "Сообщения" },
  network_label: { en: "Network", ar: "شبكات", fr: "Réseau", de: "Netzwerk", es: "Red", tr: "Ağ", ru: "Сеть" },
  recent_recon: { en: "Recent Reconnaissance", ar: "الاستطلاعات والفحوصات الأخيرة", fr: "Reconnaissance récente", de: "Aktuelle Aufklärung", es: "Reconocimiento reciente", tr: "Son keşif", ru: "Недавняя разведка" },
  no_recon: { en: "No reconnaissance data found.", ar: "لم يتم العثور على أي نشاط فحص.", fr: "Aucune donnée de reconnaissance.", de: "Keine Aufklärungsdaten gefunden.", es: "No se encontraron datos.", tr: "Keşif verisi bulunamadı.", ru: "Данные разведки не найдены." },
  no_recon_desc: { en: "Run an audit using the tools above to populate your command center.", ar: "قم بإجراء فحص باستخدام الأدوات العلوية لمعرفة وتقييم بيانتك هنا.", fr: "Lancez un audit avec les outils ci-dessus.", de: "Führen Sie eine Prüfung durch.", es: "Ejecuta una auditoría con las herramientas.", tr: "Komuta merkezinizi doldurmak için bir denetim çalıştırın.", ru: "Запустите аудит с помощью инструментов выше." },
  score_label: { en: "Score:", ar: "التقييم:", fr: "Score :", de: "Bewertung:", es: "Puntuación:", tr: "Puan:", ru: "Оценка:" },

  // Landing Page
  landing_hero_title: { en: "Your Digital Security Command Center", ar: "مركز قيادة أمانك الرقمي", fr: "Votre centre de commande de sécurité numérique", de: "Ihr digitales Sicherheitskommandozentrum", es: "Tu centro de mando de seguridad digital", tr: "Dijital güvenlik komuta merkeziniz", ru: "Ваш центр управления цифровой безопасностью" },
  landing_hero_subtitle: { en: "AI-powered intelligence platform that scans, analyzes, and protects your digital identity across the global threat landscape.", ar: "منصة ذكاء اصطناعي متقدمة بتفحص وتحلل وتحمي هويتك الرقمية في كل مكان.", fr: "Plateforme d'intelligence IA qui analyse et protège votre identité numérique.", de: "KI-gestützte Plattform, die Ihre digitale Identität schützt.", es: "Plataforma de inteligencia IA que protege tu identidad digital.", tr: "Dijital kimliğinizi koruyan yapay zeka destekli platform.", ru: "ИИ-платформа для защиты вашей цифровой личности." },
  landing_cta: { en: "Start Secure Session", ar: "ابدأ جلسة آمنة", fr: "Démarrer une session sécurisée", de: "Sichere Sitzung starten", es: "Iniciar sesión segura", tr: "Güvenli oturum başlat", ru: "Начать безопасную сессию" },
  landing_scroll: { en: "Discover More", ar: "اكتشف المزيد", fr: "En savoir plus", de: "Mehr erfahren", es: "Descubre más", tr: "Daha fazla keşfet", ru: "Узнать больше" },
  landing_stat_tools: { en: "Security Tools", ar: "أدوات أمنية", fr: "Outils de sécurité", de: "Sicherheitstools", es: "Herramientas de seguridad", tr: "Güvenlik araçları", ru: "Инструменты безопасности" },
  landing_stat_encryption: { en: "Encryption", ar: "تشفير", fr: "Chiffrement", de: "Verschlüsselung", es: "Cifrado", tr: "Şifreleme", ru: "Шифрование" },
  landing_stat_ai: { en: "Powered Engine", ar: "محرك ذكي", fr: "Moteur IA", de: "KI-Motor", es: "Motor IA", tr: "AI motoru", ru: "ИИ-движок" },
  landing_stat_scans: { en: "Unlimited Scans", ar: "فحوصات لا محدودة", fr: "Scans illimités", de: "Unbegrenzte Scans", es: "Escaneos ilimitados", tr: "Sınırsız tarama", ru: "Безлимитные сканирования" },
  landing_features_title: { en: "Full-Spectrum Threat Intelligence", ar: "استخبارات تهديدات شاملة", fr: "Renseignement sur les menaces à spectre complet", de: "Vollspektrum-Bedrohungsintelligenz", es: "Inteligencia de amenazas de espectro completo", tr: "Tam spektrum tehdit istihbaratı", ru: "Полный спектр анализа угроз" },
  landing_features_subtitle: { en: "Seven specialized modules covering every attack vector in your digital footprint.", ar: "سبع وحدات متخصصة بتغطي كل نقطة ضعف في بصمتك الرقمية.", fr: "Sept modules spécialisés couvrant chaque vecteur d'attaque.", de: "Sieben spezialisierte Module für jeden Angriffsvektor.", es: "Siete módulos especializados para cada vector de ataque.", tr: "Her saldırı vektörünü kapsayan yedi özel modül.", ru: "Семь специализированных модулей для каждого вектора атак." },
  landing_feat_email: { en: "Deep scan email addresses against global breach databases and dark web records.", ar: "فحص عميق للإيميلات في قواعد بيانات التسريبات العالمية والإنترنت المظلم.", fr: "Analyse approfondie des e-mails dans les bases de données de fuites.", de: "Tiefenscan von E-Mails gegen globale Breach-Datenbanken.", es: "Escaneo profundo de correos contra bases de datos de filtraciones.", tr: "E-postaları küresel ihlal veritabanlarında derinlemesine tarayın.", ru: "Глубокое сканирование email по базам утечек." },
  landing_feat_password: { en: "Evaluate strength and check breach history with neural-network analysis.", ar: "تقييم قوة كلمة المرور وفحص تاريخ التسريبات بتحليل بالذكاء الاصطناعي.", fr: "Évaluez la force et l'historique des violations avec l'IA.", de: "Stärke bewerten und Breach-Historie mit KI prüfen.", es: "Evalúa la fuerza y el historial de filtraciones con IA.", tr: "Güçlülüğü değerlendirin ve ihlal geçmişini AI ile kontrol edin.", ru: "Оцените надёжность и историю утечек с помощью ИИ." },
  landing_feat_phone: { en: "OSINT intelligence scan for phone number exposure and carrier analysis.", ar: "فحص استخباراتي OSINT لتسريب أرقام الهواتف وتحليل شبكة الاتصالات.", fr: "Scan OSINT pour l'exposition des numéros de téléphone.", de: "OSINT-Scan für Telefonnummer-Exposition.", es: "Escaneo OSINT para exposición de números telefónicos.", tr: "Telefon numarası maruziyeti için OSINT taraması.", ru: "OSINT-сканирование для анализа номера телефона." },
  landing_feat_url: { en: "Detect phishing, malware domains, and deceptive redirect chains.", ar: "اكتشاف التصيد والمواقع الخبيثة وسلاسل إعادة التوجيه المشبوهة.", fr: "Détectez le phishing et les domaines malveillants.", de: "Erkennen Sie Phishing und bösartige Domains.", es: "Detecta phishing y dominios maliciosos.", tr: "Oltalama ve kötü amaçlı alan adlarını tespit edin.", ru: "Обнаружение фишинга и вредоносных доменов." },
  landing_feat_username: { en: "Cross-platform footprint investigation for handles and aliases.", ar: "تحقيق في البصمة الرقمية عبر المنصات للأسماء المستعارة.", fr: "Investigation de l'empreinte multiplateforme.", de: "Plattformübergreifende Fußabdruck-Untersuchung.", es: "Investigación de huella digital multiplataforma.", tr: "Takma adlar için platformlar arası ayak izi araştırması.", ru: "Кроссплатформенное расследование цифрового следа." },
  landing_feat_message: { en: "Anti-fraud analysis detecting psychological manipulation and scam patterns.", ar: "تحليل مكافحة الاحتيال لاكتشاف الخدع النفسية وأنماط النصب.", fr: "Analyse anti-fraude détectant la manipulation psychologique.", de: "Anti-Betrugs-Analyse psychologischer Manipulation.", es: "Análisis anti-fraude detectando manipulación psicológica.", tr: "Psikolojik manipülasyonu tespit eden dolandırıcılık analizi.", ru: "Антифрод-анализ психологических манипуляций." },
  landing_feat_ip: { en: "Network intelligence for botnet detection, VPN analysis, and geo-tracing.", ar: "استخبارات شبكية لاكتشاف البوت نت وتحليل VPN والتتبع الجغرافي.", fr: "Intelligence réseau pour la détection de botnets et le traçage géo.", de: "Netzwerk-Intelligence für Botnet-Erkennung und Geo-Tracing.", es: "Inteligencia de red para detección de botnets y rastreo geo.", tr: "Botnet tespiti ve coğrafi izleme için ağ istihbaratı.", ru: "Сетевая разведка для обнаружения ботнетов." },
  landing_how_title: { en: "How It Works", ar: "كيف يعمل؟", fr: "Comment ça marche", de: "So funktioniert's", es: "Cómo funciona", tr: "Nasıl çalışır", ru: "Как это работает" },
  landing_step1_title: { en: "Authenticate", ar: "سجّل دخولك", fr: "S'authentifier", de: "Authentifizieren", es: "Autenticarse", tr: "Giriş yapın", ru: "Авторизация" },
  landing_step1_desc: { en: "Secure login via Google OAuth. Your session is encrypted end-to-end.", ar: "دخول آمن عبر حساب جوجل. جلستك مشفرة بالكامل.", fr: "Connexion sécurisée via Google OAuth. Session chiffrée.", de: "Sichere Anmeldung via Google OAuth. Verschlüsselte Sitzung.", es: "Inicio seguro via Google OAuth. Sesión cifrada.", tr: "Google OAuth ile güvenli giriş. Şifreli oturum.", ru: "Безопасный вход через Google OAuth. Сессия зашифрована." },
  landing_step2_title: { en: "Scan & Analyze", ar: "افحص وحلّل", fr: "Scanner et analyser", de: "Scannen & analysieren", es: "Escanear y analizar", tr: "Tara ve analiz et", ru: "Сканировать и анализировать" },
  landing_step2_desc: { en: "Choose any tool, input your target, and our AI engine does the rest.", ar: "اختر أي أداة، ادخل الهدف، ومحرك الذكاء الاصطناعي هيعمل الباقي.", fr: "Choisissez un outil, entrez votre cible, notre IA fait le reste.", de: "Wählen Sie ein Tool, geben Sie Ihr Ziel ein, unsere KI erledigt den Rest.", es: "Elige una herramienta, ingresa tu objetivo, nuestra IA hace el resto.", tr: "Bir araç seçin, hedefinizi girin, AI gerisini halleder.", ru: "Выберите инструмент, введите цель — ИИ сделает остальное." },
  landing_step3_title: { en: "Act & Protect", ar: "اتصرّف واحمي", fr: "Agir et protéger", de: "Handeln & schützen", es: "Actuar y proteger", tr: "Harekete geç ve koru", ru: "Действовать и защищать" },
  landing_step3_desc: { en: "Get actionable reports with clear remediation steps to secure your digital identity.", ar: "احصل على تقارير عملية بخطوات واضحة لتأمين هويتك الرقمية.", fr: "Obtenez des rapports avec des mesures claires pour sécuriser votre identité.", de: "Erhalten Sie Berichte mit klaren Schritten zur Sicherung.", es: "Obtén informes con pasos claros para asegurar tu identidad.", tr: "Kimliğinizi güvence altına almak için net adımlar içeren raporlar alın.", ru: "Получите отчёты с чёткими шагами для защиты вашей личности." },
  landing_final_title: { en: "Ready to Secure Your Digital Identity?", ar: "مستعد تأمّن هويتك الرقمية؟", fr: "Prêt à sécuriser votre identité numérique ?", de: "Bereit, Ihre digitale Identität zu sichern?", es: "¿Listo para asegurar tu identidad digital?", tr: "Dijital kimliğinizi güvence altına almaya hazır mısınız?", ru: "Готовы защитить свою цифровую личность?" },
  landing_final_subtitle: { en: "Join thousands who trust JoeScan to monitor and protect their online presence.", ar: "انضم لآلاف المستخدمين اللي بيثقوا في جو-سكان لحماية تواجدهم الرقمي.", fr: "Rejoignez des milliers d'utilisateurs qui font confiance à JoeScan.", de: "Schließen Sie sich Tausenden an, die JoeScan vertrauen.", es: "Únete a miles que confían en JoeScan.", tr: "Çevrimiçi varlıklarını korumak için JoeScan'e güvenen binlerce kişiye katılın.", ru: "Присоединяйтесь к тысячам, доверяющим JoeScan." },
  
  // Phase 2: Enhanced Dashboard & History
  nav_history: { en: "History", ar: "السجل", fr: "Historique", de: "Verlauf", es: "Historial", tr: "Geçmiş", ru: "История" },
  dashboard_risk_dist: { en: "Risk Distribution", ar: "توزيع المخاطر", fr: "Distribution des risques", de: "Risikoverteilung", es: "Distribución de riesgos", tr: "Risk dağılımı", ru: "Распределение рисков" },
  dashboard_activity_timeline: { en: "Activity Timeline", ar: "الجدول الزمني للنشاط", fr: "Chronologie d'activité", de: "Aktivitätszeitachse", es: "Línea de tiempo", tr: "Aktivite zaman çizelgesi", ru: "Хронология активности" },
  scan_history_title: { en: "Scan History", ar: "سجل الفحوصات", fr: "Historique des scans", de: "Scan-Verlauf", es: "Historial de escaneos", tr: "Tarama geçmişi", ru: "История сканирований" },
  history_subtitle: { en: "Review and manage all your previous security audits.", ar: "راجع وأدر كل الفحوصات الأمنية السابقة.", fr: "Consultez et gérez tous vos audits précédents.", de: "Überprüfen Sie alle Ihre vorherigen Audits.", es: "Revisa y gestiona todas tus auditorías.", tr: "Tüm önceki güvenlik denetimlerinizi inceleyin.", ru: "Просмотрите все ваши предыдущие аудиты." },
  filter_all: { en: "All Types", ar: "الكل", fr: "Tous les types", de: "Alle Typen", es: "Todos los tipos", tr: "Tüm türler", ru: "Все типы" },
  filter_risk: { en: "All Risks", ar: "كل المخاطر", fr: "Tous les risques", de: "Alle Risiken", es: "Todos los riesgos", tr: "Tüm riskler", ru: "Все риски" },
  action_export: { en: "Export", ar: "تصدير", fr: "Exporter", de: "Exportieren", es: "Exportar", tr: "Dışa aktar", ru: "Экспорт" },
  status_badge_high: { en: "High", ar: "عالي", fr: "Élevé", de: "Hoch", es: "Alto", tr: "Yüksek", ru: "Высокий" },
  status_badge_medium: { en: "Medium", ar: "متوسط", fr: "Moyen", de: "Mittel", es: "Medio", tr: "Orta", ru: "Средний" },
  status_badge_low: { en: "Low", ar: "منخفض", fr: "Faible", de: "Niedrig", es: "Bajo", tr: "Düşük", ru: "Низкий" },
  status_badge_secure: { en: "Secure", ar: "آمن", fr: "Sécurisé", de: "Sicher", es: "Seguro", tr: "Güvenli", ru: "Безопасно" },
  no_history_found: { en: "No history found matching your filters.", ar: "لم يتم العثور على سجل يطابق بحثك.", fr: "Aucun historique correspondant à vos filtres.", de: "Kein Verlauf für Ihre Filter gefunden.", es: "No se encontró historial para tus filtros.", tr: "Filtrelerinize uygun geçmiş bulunamadı.", ru: "История по вашим фильтрам не найдена." },

  // Phase 4 & 5: Notifications, Gamification, and Badges
  notifications_title: { en: "Notifications", ar: "الإشعارات", fr: "Notifications", de: "Benachrichtigungen", es: "Notificaciones", tr: "Bildirimler", ru: "Уведомления" },
  mark_all_read: { en: "Mark all as read", ar: "تحديد الكل كمقروء", fr: "Tout marquer comme lu", de: "Alle als gelesen markieren", es: "Marcar todo como leído", tr: "Tümünü okundu olarak işaretle", ru: "Отметить всё как прочитанное" },
  no_notifications: { en: "No new notifications", ar: "لا توجد إشعارات جديدة", fr: "Aucune nouvelle notification", de: "Keine neuen Benachrichtigungen", es: "Sin nuevas notificaciones", tr: "Yeni bildirim yok", ru: "Новых уведомлений нет" },
  watch_enabled: { en: "Monitor: Active", ar: "المراقبة: مفعلة", fr: "Surveillance: Active", de: "Überwachung: Aktiv", es: "Monitor: Activo", tr: "İzleme: Aktif", ru: "Мониторинг: Активен" },
  watch_disabled: { en: "Monitor: Inactive", ar: "المراقبة: غير مفعلة", fr: "Surveillance: Inactive", de: "Überwachung: Inaktiv", es: "Monitor: Inactivo", tr: "İzleme: Pasif", ru: "Мониторинг: Неактивен" },
  watch_tooltip: { en: "Enable continuous monitoring. You will be notified if this target appears in future intelligence sweeps.", ar: "قم بتفعيل المراقبة المستمرة. سيتم إخطارك إذا ظهر هذا الهدف في مسوحات الاستخبارات المستقبلية.", fr: "Activez la surveillance continue. Vous serez notifié des futures détections.", de: "Aktivieren Sie die kontinuierliche Überwachung. Sie werden bei Erkennung benachrichtigt.", es: "Active el monitoreo continuo. Será notificado de futuras detecciones.", tr: "Sürekli izlemeyi etkinleştirin. Gelecekteki tespitlerde bildirim alacaksınız.", ru: "Включите мониторинг. Вы будете уведомлены при будущих обнаружениях." },
  achievements_tab: { en: "Achievements", ar: "الإنجازات", fr: "Réalisations", de: "Erfolge", es: "Logros", tr: "Başarılar", ru: "Достижения" },
  badges_earned: { en: "Badges Earned", ar: "الشارات المكتسبة", fr: "Badges obtenus", de: "Verdiente Abzeichen", es: "Insignias ganadas", tr: "Kazanılan rozetler", ru: "Полученные значки" },
  security_tier: { en: "Security Tier", ar: "مستوى الأمان", fr: "Niveau de sécurité", de: "Sicherheitsstufe", es: "Nivel de seguridad", tr: "Güvenlik seviyesi", ru: "Уровень безопасности" },
  tier_bronze: { en: "Bronze", ar: "برونزي", fr: "Bronze", de: "Bronze", es: "Bronce", tr: "Bronz", ru: "Бронза" },
  tier_silver: { en: "Silver", ar: "فضي", fr: "Argent", de: "Silber", es: "Plata", tr: "Gümüş", ru: "Серебро" },
  tier_gold: { en: "Gold", ar: "ذهبي", fr: "Or", de: "Gold", es: "Oro", tr: "Altın", ru: "Золото" },
  tier_diamond: { en: "Diamond", ar: "ماسي", fr: "Diamant", de: "Diamant", es: "Diamante", tr: "Elmas", ru: "Бриллиант" },
  progress_to_next: { en: "Progress to Next Tier", ar: "التقدم للمستوى التالي", fr: "Progression vers le prochain niveau", de: "Fortschritt zur nächsten Stufe", es: "Progreso al siguiente nivel", tr: "Sonraki seviyeye ilerleme", ru: "Прогресс до следующего уровня" },
  
  // Social OSINT Scanner
  nav_social: { en: "Social OSINT", ar: "استخبارات اجتماعية", fr: "OSINT Social", de: "Social OSINT", es: "OSINT Social", tr: "Sosyal OSINT", ru: "Социальный OSINT" },
  social_title: { en: "Social Media OSINT", ar: "استخبارات التواصل الاجتماعي", fr: "OSINT des réseaux sociaux", de: "Social-Media-OSINT", es: "OSINT de redes sociales", tr: "Sosyal medya OSINT", ru: "OSINT социальных сетей" },
  social_desc: { en: "Enter a username to scan 700+ platforms and discover all linked social media accounts, forums, and communities.", ar: "أدخل اسم المستخدم لفحص أكثر من 700 منصة واكتشاف جميع حسابات التواصل الاجتماعي والمنتديات والمجتمعات المرتبطة.", fr: "Entrez un nom d'utilisateur pour scanner 700+ plateformes.", de: "Geben Sie einen Benutzernamen ein, um 700+ Plattformen zu scannen.", es: "Ingrese un nombre de usuario para escanear 700+ plataformas.", tr: "700+ platformu taramak için bir kullanıcı adı girin.", ru: "Введите имя пользователя для сканирования 700+ платформ." },
  social_placeholder: { en: "e.g. john_doe", ar: "مثال: ahmed_123", fr: "ex: jean_dupont", de: "z.B. hans_mueller", es: "ej: juan_perez", tr: "ör: ahmet_123", ru: "напр. ivan_petrov" },
  social_scanning: { en: "Scanning platforms...", ar: "جاري فحص المنصات...", fr: "Analyse des plateformes...", de: "Plattformen werden gescannt...", es: "Escaneando plataformas...", tr: "Platformlar taranıyor...", ru: "Сканирование платформ..." },
  social_scanning_desc: { en: "Enumerating username across 700+ global platforms...", ar: "جاري البحث عن اسم المستخدم عبر أكثر من 700 منصة عالمية...", fr: "Énumération du nom d'utilisateur sur 700+ plateformes...", de: "Benutzername wird auf 700+ Plattformen geprüft...", es: "Enumerando usuario en 700+ plataformas...", tr: "700+ platformda kullanıcı adı aranıyor...", ru: "Проверка имени на 700+ платформах..." },
  social_found_on: { en: "Found on", ar: "موجود في", fr: "Trouvé sur", de: "Gefunden auf", es: "Encontrado en", tr: "Bulunan", ru: "Найдено на" },
  social_platforms: { en: "platforms", ar: "منصة", fr: "plateformes", de: "Plattformen", es: "plataformas", tr: "platform", ru: "платформах" },
  social_not_found: { en: "No accounts found for this username.", ar: "لم يتم العثور على حسابات لهذا المستخدم.", fr: "Aucun compte trouvé pour ce nom.", de: "Keine Konten für diesen Benutzernamen gefunden.", es: "No se encontraron cuentas para este usuario.", tr: "Bu kullanıcı adı için hesap bulunamadı.", ru: "Аккаунты для этого имени не найдены." },
  social_category_social: { en: "Social Media", ar: "تواصل اجتماعي", fr: "Réseaux sociaux", de: "Soziale Medien", es: "Redes sociales", tr: "Sosyal medya", ru: "Соцсети" },
  social_category_professional: { en: "Professional", ar: "مهني", fr: "Professionnel", de: "Professionell", es: "Profesional", tr: "Profesyonel", ru: "Профессиональные" },
  social_category_gaming: { en: "Gaming", ar: "ألعاب", fr: "Jeux", de: "Gaming", es: "Juegos", tr: "Oyun", ru: "Игровые" },
  social_category_forums: { en: "Forums & Communities", ar: "منتديات ومجتمعات", fr: "Forums et communautés", de: "Foren und Communities", es: "Foros y comunidades", tr: "Forumlar ve topluluklar", ru: "Форумы и сообщества" },
  social_category_other: { en: "Other", ar: "أخرى", fr: "Autre", de: "Andere", es: "Otro", tr: "Diğer", ru: "Другое" },
  social_visit_profile: { en: "Visit Profile", ar: "زيارة الحساب", fr: "Visiter le profil", de: "Profil besuchen", es: "Visitar perfil", tr: "Profili ziyaret et", ru: "Посетить профиль" },
  social_ai_analyzing: { en: "AI is analyzing your digital footprint...", ar: "الذكاء الاصطناعي يحلل بصمتك الرقمية...", fr: "L'IA analyse votre empreinte numérique...", de: "KI analysiert Ihren digitalen Fußabdruck...", es: "La IA analiza tu huella digital...", tr: "AI dijital ayak izinizi analiz ediyor...", ru: "ИИ анализирует ваш цифровой след..." },
  social_rate_limit: { en: "Rate limit reached. Please wait a few minutes and try again.", ar: "تم الوصول للحد الأقصى. يرجى الانتظار بضع دقائق والمحاولة مرة أخرى.", fr: "Limite atteinte. Veuillez patienter quelques minutes.", de: "Ratenlimit erreicht. Bitte warten Sie einige Minuten.", es: "Límite alcanzado. Espera unos minutos.", tr: "Hız limitine ulaşıldı. Birkaç dakika bekleyin.", ru: "Достигнут лимит. Подождите несколько минут." },
  social_exposure_summary: { en: "Exposure Summary", ar: "ملخص التعرض", fr: "Résumé de l'exposition", de: "Expositionszusammenfassung", es: "Resumen de exposición", tr: "Maruziyet özeti", ru: "Сводка по утечкам" },
  social_progress: { en: "Scanning", ar: "جاري الفحص", fr: "Analyse", de: "Scannen", es: "Escaneando", tr: "Taranıyor", ru: "Сканирование" },

  // Phone OSINT
  social_mode_username: { en: "Username", ar: "اسم المستخدم", fr: "Nom d'utilisateur", de: "Benutzername", es: "Nombre de usuario", tr: "Kullanıcı adı", ru: "Имя пользователя" },
  social_mode_phone: { en: "Phone Number", ar: "رقم الموبايل", fr: "Numéro de téléphone", de: "Telefonnummer", es: "Número de teléfono", tr: "Telefon numarası", ru: "Номер телефона" },
  social_phone_placeholder: { en: "e.g. +201234567890", ar: "مثال: ‪+201234567890‬", fr: "ex: +33612345678", de: "z.B. +4915123456789", es: "ej: +34612345678", tr: "ör: +905321234567", ru: "напр. +79123456789" },
  social_phone_desc: { en: "Enter a phone number to discover all linked social media accounts, messaging apps, and online services.", ar: "أدخل رقم الموبايل لاكتشاف جميع حسابات التواصل الاجتماعي وتطبيقات المراسلة والخدمات المرتبطة.", fr: "Entrez un numéro pour découvrir tous les comptes liés.", de: "Geben Sie eine Nummer ein, um alle verknüpften Konten zu entdecken.", es: "Ingrese un número para descubrir todas las cuentas vinculadas.", tr: "Bağlı tüm hesapları keşfetmek için bir numara girin.", ru: "Введите номер для обнаружения всех связанных аккаунтов." },
  social_phone_scanning: { en: "Scanning phone number across platforms...", ar: "جاري البحث عن رقم الموبايل عبر المنصات...", fr: "Analyse du numéro sur les plateformes...", de: "Telefonnummer wird überprüft...", es: "Escaneando número en plataformas...", tr: "Telefon numarası platformlarda taranıyor...", ru: "Сканирование номера телефона..." },

  // Dashboard extra translations
  dash_system_diagnosis: { en: "SYSTEM DIAGNOSIS", ar: "تشخيص النظام", fr: "DIAGNOSTIC SYSTÈME", de: "SYSTEMDIAGNOSE", es: "DIAGNÓSTICO DEL SISTEMA", tr: "SİSTEM TEŞHİSİ", ru: "ДИАГНОСТИКА СИСТЕМЫ" },
  dash_total_scans: { en: "Total Scans", ar: "إجمالي الفحوصات", fr: "Total des scans", de: "Gesamte Scans", es: "Total de escaneos", tr: "Toplam tarama", ru: "Всего сканирований" },
  dash_tier: { en: "Tier", ar: "المستوى", fr: "Niveau", de: "Stufe", es: "Nivel", tr: "Seviye", ru: "Уровень" },
  dash_high_risk: { en: "High Risk", ar: "خطر عالي", fr: "Risque élevé", de: "Hohes Risiko", es: "Alto riesgo", tr: "Yüksek risk", ru: "Высокий риск" },
  dash_tools: { en: "Tools & Instruments", ar: "الأدوات والأجهزة", fr: "Outils & Instruments", de: "Werkzeuge & Instrumente", es: "Herramientas e Instrumentos", tr: "Araçlar & Enstrümanlar", ru: "Инструменты" },
  dash_scans: { en: "Scans", ar: "فحوصات", fr: "Scans", de: "Scans", es: "Escaneos", tr: "Taramalar", ru: "Сканы" },
  dash_avg_score: { en: "Avg Score", ar: "متوسط", fr: "Score moy.", de: "Ø Score", es: "Prom.", tr: "Ort.", ru: "Ср. балл" },
  dash_last: { en: "Last", ar: "آخر", fr: "Dernier", de: "Letzte", es: "Último", tr: "Son", ru: "Посл." },
  dash_no_data: { en: "No data", ar: "لا توجد بيانات", fr: "Aucune donnée", de: "Keine Daten", es: "Sin datos", tr: "Veri yok", ru: "Нет данных" },
  dash_no_intel: { en: "No Intel Available", ar: "لا توجد بيانات استخباراتية", fr: "Aucun renseignement", de: "Keine Info verfügbar", es: "Sin inteligencia disponible", tr: "İstihbarat yok", ru: "Нет данных разведки" },
  dash_detections: { en: "DETECTIONS", ar: "اكتشافات", fr: "DÉTECTIONS", de: "ERKENNUNGEN", es: "DETECCIONES", tr: "TESPİTLER", ru: "ОБНАРУЖЕНИЯ" },
  dash_osint_timeline: { en: "OSINT Timeline", ar: "الاختراقات شهرياً", fr: "Chronologie OSINT", de: "OSINT-Zeitachse", es: "Cronología OSINT", tr: "OSINT Zaman Çizelgesi", ru: "Хронология OSINT" },
  dash_attack_radar: { en: "Attack Vectors Radar", ar: "رادار ناقلات الهجوم", fr: "Radar des vecteurs d'attaque", de: "Angriffsvektoren-Radar", es: "Radar de vectores de ataque", tr: "Saldırı vektörleri radarı", ru: "Радар векторов атак" },
  dash_total_scans_legend: { en: "Total Scans", ar: "إجمالي الفحوصات", fr: "Total des scans", de: "Gesamte Scans", es: "Total de escaneos", tr: "Toplam tarama", ru: "Всего сканирований" },
  dash_critical_detects: { en: "Critical Detects", ar: "اكتشافات حرجة", fr: "Détections critiques", de: "Kritische Erkennungen", es: "Detecciones críticas", tr: "Kritik tespitler", ru: "Критические обнаружения" },
  dash_time_m_ago: { en: "m ago", ar: "د", fr: "min", de: "Min", es: "min", tr: "dk", ru: "мин" },
  dash_time_h_ago: { en: "h ago", ar: "س", fr: "h", de: "Std", es: "h", tr: "sa", ru: "ч" },
  dash_time_d_ago: { en: "d ago", ar: "ي", fr: "j", de: "T", es: "d", tr: "gün", ru: "д" },

  // Password Vault Check 
  pwd_vault_title: { en: "Password Vault Check", ar: "فحص خزنة كلمات المرور", fr: "Vérification du coffre-fort", de: "Passwort-Tresor-Check", es: "Verificación de bóveda", tr: "Şifre kasası kontrolü", ru: "Проверка хранилища паролей" },
  pwd_vault_desc: { en: "Evaluate password strength algorithmically in real-time, then run a deep audit against neural-network breach databases to detect compromised footprints.", ar: "قيّم قوة كلمة المرور بشكل خوارزمي في الوقت الحقيقي، ثم قم بفحص عميق ضد قواعد بيانات التسريبات المبنية على الذكاء الاصطناعي لاكتشاف البصمات المخترقة.", fr: "Évaluez la force en temps réel, puis auditez contre les bases de données de fuites.", de: "Bewerten Sie die Stärke in Echtzeit und prüfen Sie gegen Breach-Datenbanken.", es: "Evalúe la fortaleza en tiempo real y audite contra bases de datos de filtraciones.", tr: "Gerçek zamanlı güç değerlendirmesi ve sızıntı veritabanlarına karşı derin denetim.", ru: "Оценка надёжности в реальном времени и глубокий аудит по базам утечек." },
  pwd_deep_audit: { en: "Deep Audit", ar: "فحص عميق", fr: "Audit profond", de: "Tiefenaudit", es: "Auditoría profunda", tr: "Derin denetim", ru: "Глубокий аудит" },
  pwd_risk_assessed: { en: "Risk Assessed", ar: "تقييم الخطر", fr: "Risque évalué", de: "Risiko bewertet", es: "Riesgo evaluado", tr: "Risk değerlendirildi", ru: "Риск оценён" },
  pwd_exposure: { en: "EXPOSURE", ar: "تعرّض", fr: "EXPOSITION", de: "EXPOSITION", es: "EXPOSICIÓN", tr: "MARUZİYET", ru: "УТЕЧКА" },
  pwd_download_report: { en: "Download Report", ar: "تحميل التقرير", fr: "Télécharger le rapport", de: "Bericht herunterladen", es: "Descargar informe", tr: "Raporu indir", ru: "Скачать отчёт" },
  pwd_remediation: { en: "Remediation Steps", ar: "خطوات العلاج", fr: "Étapes de remédiation", de: "Behebungsschritte", es: "Pasos de remediación", tr: "İyileştirme adımları", ru: "Шаги исправления" },
  pwd_resistance_score: { en: "Threat Resistance Score", ar: "مؤشر مقاومة التهديدات", fr: "Score de résistance", de: "Bedrohungswiderstand", es: "Puntuación de resistencia", tr: "Tehdit direnç puanı", ru: "Оценка устойчивости к угрозам" },
  pwd_why_score: { en: "Why this score?", ar: "لماذا هذا التقييم؟", fr: "Pourquoi ce score ?", de: "Warum dieser Score?", es: "¿Por qué esta puntuación?", tr: "Neden bu puan?", ru: "Почему такая оценка?" },

  // Device Security
  dev_terminal_title: { en: "Live Threat Operations Terminal", ar: "طرفية عمليات التهديدات المباشرة", fr: "Terminal d'opérations de menaces", de: "Live-Bedrohungs-Terminal", es: "Terminal de operaciones de amenazas", tr: "Canlı tehdit operasyonları terminali", ru: "Терминал операций по угрозам" },
  dev_start_scan: { en: "Start Security Scan", ar: "بدء الفحص الأمني", fr: "Démarrer le scan de sécurité", de: "Sicherheitsscan starten", es: "Iniciar escaneo de seguridad", tr: "Güvenlik taraması başlat", ru: "Начать проверку безопасности" },
  dev_posture_eval: { en: "Posture Evaluation", ar: "تقييم الوضع الأمني", fr: "Évaluation de la posture", de: "Haltungsbewertung", es: "Evaluación de postura", tr: "Duruş değerlendirmesi", ru: "Оценка состояния" },
  dev_target: { en: "TARGET", ar: "الهدف", fr: "CIBLE", de: "ZIEL", es: "OBJETIVO", tr: "HEDEF", ru: "ЦЕЛЬ" },
  dev_network_exposure: { en: "Network Exposure", ar: "التعرض الشبكي", fr: "Exposition réseau", de: "Netzwerk-Exposition", es: "Exposición de red", tr: "Ağ maruziyeti", ru: "Сетевое воздействие" },
  dev_browser_posture: { en: "Browser Posture", ar: "وضع المتصفح", fr: "Posture du navigateur", de: "Browser-Status", es: "Postura del navegador", tr: "Tarayıcı durumu", ru: "Состояние браузера" },
  dev_cookies: { en: "Cookies", ar: "ملفات تعريف الارتباط", fr: "Cookies", de: "Cookies", es: "Cookies", tr: "Çerezler", ru: "Куки" },
  dev_do_not_track: { en: "Do Not Track", ar: "عدم التتبع", fr: "Ne pas suivre", de: "Nicht verfolgen", es: "No rastrear", tr: "Takip etme", ru: "Не отслеживать" },
  dev_accepted: { en: "Accepted", ar: "مقبول", fr: "Accepté", de: "Akzeptiert", es: "Aceptado", tr: "Kabul edildi", ru: "Принято" },
  dev_disabled: { en: "Disabled", ar: "معطل", fr: "Désactivé", de: "Deaktiviert", es: "Deshabilitado", tr: "Devre dışı", ru: "Отключено" },
  dev_enabled: { en: "Enabled", ar: "مفعل", fr: "Activé", de: "Aktiviert", es: "Habilitado", tr: "Etkin", ru: "Включено" },
  dev_hw_threads: { en: "Hardware Threads", ar: "وحدات المعالجة", fr: "Threads matériels", de: "Hardware-Threads", es: "Hilos de hardware", tr: "Donanım iş parçacıkları", ru: "Аппаратные потоки" },
  dev_device_class: { en: "Device Class", ar: "فئة الجهاز", fr: "Classe d'appareil", de: "Geräteklasse", es: "Clase de dispositivo", tr: "Cihaz sınıfı", ru: "Класс устройства" },
  dev_mobile: { en: "Mobile", ar: "جوال", fr: "Mobile", de: "Mobil", es: "Móvil", tr: "Mobil", ru: "Мобильный" },
  dev_desktop: { en: "Desktop", ar: "سطح المكتب", fr: "Bureau", de: "Desktop", es: "Escritorio", tr: "Masaüstü", ru: "Настольный" },
  dev_safe_msg: { en: "Safe. No known exposure in Global Threat Databases.", ar: "آمن. لا يوجد تعرض معروف في قواعد بيانات التهديدات العالمية.", fr: "Sûr. Aucune exposition connue.", de: "Sicher. Keine bekannte Exposition.", es: "Seguro. Sin exposición conocida.", tr: "Güvenli. Küresel tehdit veritabanlarında bilinen maruziyet yok.", ru: "Безопасно. Нет известных угроз." },

  // SIEM & Webhooks
  siem_title: { en: "SIEM & Webhooks", ar: "الربط مع أنظمة الحماية (SIEM)", fr: "SIEM & Webhooks", de: "SIEM & Webhooks", es: "SIEM y Webhooks", tr: "SIEM ve Webhooks", ru: "SIEM и вебхуки" },
  siem_desc: { en: "Forward threat intelligence events to your security infrastructure.", ar: "أرسل أحداث الاستخبارات الأمنية إلى بنيتك التحتية.", fr: "Transmettez les événements de renseignement à votre infrastructure.", de: "Leiten Sie Bedrohungsereignisse an Ihre Infrastruktur weiter.", es: "Reenvía eventos de inteligencia a tu infraestructura.", tr: "Tehdit istihbaratı olaylarını güvenlik altyapınıza iletin.", ru: "Пересылайте события угроз в вашу инфраструктуру." },
  siem_new_endpoint: { en: "+ New Endpoint", ar: "+ نقطة نهاية جديدة", fr: "+ Nouveau point d'accès", de: "+ Neuer Endpunkt", es: "+ Nuevo endpoint", tr: "+ Yeni uç nokta", ru: "+ Новая конечная точка" },
  siem_endpoints_active: { en: "Endpoints Active", ar: "نقاط نهاية نشطة", fr: "Points actifs", de: "Aktive Endpunkte", es: "Endpoints activos", tr: "Aktif uç noktalar", ru: "Активных точек" },
  siem_no_endpoints: { en: "No endpoints configured. Forward your alerts to Slack, Discord, or your SIEM.", ar: "لم يتم تكوين نقاط نهاية. أرسل تنبيهاتك إلى Slack أو Discord أو نظام SIEM الخاص بك.", fr: "Aucun point configuré. Envoyez vos alertes à Slack, Discord ou votre SIEM.", de: "Keine Endpunkte konfiguriert. Leiten Sie Ihre Alerts weiter.", es: "Sin endpoints configurados. Envía tus alertas a Slack, Discord o tu SIEM.", tr: "Uç nokta yapılandırılmadı. Uyarılarınızı Slack, Discord veya SIEM'inize iletin.", ru: "Конечные точки не настроены. Отправляйте уведомления в Slack, Discord или SIEM." },

  // ─── Team Management ───
  team_title: { en: "Team Management", ar: "إدارة الفريق", fr: "Gestion d'équipe", de: "Teamverwaltung", es: "Gestión de equipo", tr: "Takım yönetimi", ru: "Управление командой" },
  team_desc: { en: "Manage your SOC team and assign roles.", ar: "أدِر فريق مركز العمليات الأمنية وحدد الأدوار.", fr: "Gérez votre équipe SOC et attribuez les rôles.", de: "Verwalten Sie Ihr SOC-Team und weisen Sie Rollen zu.", es: "Gestiona tu equipo SOC y asigna roles.", tr: "SOC ekibinizi yönetin ve roller atayın.", ru: "Управляйте командой SOC и назначайте роли." },
  team_invite: { en: "Invite Member", ar: "دعوة عضو", fr: "Inviter un membre", de: "Mitglied einladen", es: "Invitar miembro", tr: "Üye davet et", ru: "Пригласить участника" },
  team_slots: { en: "Team Slots", ar: "مقاعد الفريق", fr: "Places d'équipe", de: "Team-Plätze", es: "Plazas de equipo", tr: "Takım slotları", ru: "Слоты команды" },
  team_owner: { en: "Team Owner", ar: "مالك الفريق", fr: "Propriétaire", de: "Team-Eigentümer", es: "Propietario", tr: "Takım sahibi", ru: "Владелец команды" },
  team_full_access: { en: "Full Access", ar: "وصول كامل", fr: "Accès complet", de: "Voller Zugriff", es: "Acceso completo", tr: "Tam erişim", ru: "Полный доступ" },
  team_no_members: { en: "No team members yet. Invite analysts to your SOC workspace.", ar: "لا يوجد أعضاء في الفريق بعد. ادعُ محللين إلى مساحة عملك.", fr: "Pas encore de membres. Invitez des analystes à votre espace SOC.", de: "Noch keine Teammitglieder. Laden Sie Analysten ein.", es: "Sin miembros aún. Invita analistas a tu espacio SOC.", tr: "Henüz takım üyesi yok. SOC alanınıza analist davet edin.", ru: "Пока нет участников. Пригласите аналитиков в вашу рабочую область." },
  team_enterprise_feature: { en: "SOC Enterprise Feature", ar: "ميزة حصرية لحزمة المؤسسات", fr: "Fonctionnalité Enterprise SOC", de: "SOC-Enterprise-Funktion", es: "Función SOC Enterprise", tr: "SOC Kurumsal özellik", ru: "Функция SOC Enterprise" },
  team_enterprise_desc: { en: "Team management requires an Enterprise subscription. Collaborate with up to 5 analysts in your security operations center.", ar: "إدارة الفريق تتطلب اشتراك المؤسسات. تعاون مع حتى 5 محللين في مركز العمليات الأمنية.", fr: "La gestion d'équipe nécessite un abonnement Enterprise. Collaborez avec jusqu'à 5 analystes.", de: "Teamverwaltung erfordert ein Enterprise-Abonnement. Arbeiten Sie mit bis zu 5 Analysten zusammen.", es: "La gestión de equipo requiere suscripción Enterprise. Colabora con hasta 5 analistas.", tr: "Takım yönetimi Enterprise aboneliği gerektirir. 5 analiste kadar iş birliği yapın.", ru: "Управление командой требует подписки Enterprise. Работайте с до 5 аналитиками." },
  team_role_owner: { en: "Owner", ar: "مالك", fr: "Propriétaire", de: "Eigentümer", es: "Propietario", tr: "Sahip", ru: "Владелец" },
  team_role_analyst: { en: "Analyst", ar: "محلل", fr: "Analyste", de: "Analyst", es: "Analista", tr: "Analist", ru: "Аналитик" },
  team_role_viewer: { en: "Viewer", ar: "مشاهد", fr: "Observateur", de: "Betrachter", es: "Observador", tr: "Görüntüleyici", ru: "Наблюдатель" },
  team_role_owner_desc: { en: "Full access to all tools and settings", ar: "وصول كامل لجميع الأدوات والإعدادات", fr: "Accès complet à tous les outils et paramètres", de: "Voller Zugriff auf alle Tools und Einstellungen", es: "Acceso completo a todas las herramientas y ajustes", tr: "Tüm araçlara ve ayarlara tam erişim", ru: "Полный доступ ко всем инструментам и настройкам" },
  team_role_analyst_desc: { en: "Can run scans and view results", ar: "يمكنه تشغيل الفحوصات وعرض النتائج", fr: "Peut lancer des analyses et voir les résultats", de: "Kann Scans durchführen und Ergebnisse anzeigen", es: "Puede ejecutar escaneos y ver resultados", tr: "Taramaları çalıştırabilir ve sonuçları görebilir", ru: "Может запускать сканирование и просматривать результаты" },
  team_role_viewer_desc: { en: "Read-only access to reports", ar: "وصول للقراءة فقط للتقارير", fr: "Accès en lecture seule aux rapports", de: "Schreibgeschützter Zugriff auf Berichte", es: "Acceso de solo lectura a informes", tr: "Raporlara salt okunur erişim", ru: "Доступ только для чтения к отчётам" },
  team_email_label: { en: "Email Address", ar: "البريد الإلكتروني", fr: "Adresse e-mail", de: "E-Mail-Adresse", es: "Correo electrónico", tr: "E-posta adresi", ru: "Электронная почта" },
  team_role_label: { en: "Role", ar: "الدور", fr: "Rôle", de: "Rolle", es: "Rol", tr: "Rol", ru: "Роль" },
  team_send_invite: { en: "Send Invitation", ar: "إرسال الدعوة", fr: "Envoyer l'invitation", de: "Einladung senden", es: "Enviar invitación", tr: "Davet gönder", ru: "Отправить приглашение" },
  team_cancel: { en: "Cancel", ar: "إلغاء", fr: "Annuler", de: "Abbrechen", es: "Cancelar", tr: "İptal", ru: "Отмена" },
  team_pending: { en: "Pending", ar: "معلقة", fr: "En attente", de: "Ausstehend", es: "Pendiente", tr: "Bekliyor", ru: "Ожидание" },
  team_joined: { en: "Joined", ar: "انضم", fr: "Rejoint", de: "Beigetreten", es: "Unido", tr: "Katıldı", ru: "Присоединился" },

  // ─── 3D Threat Visualizer ───
  threat_title: { en: "3D Threat Visualizer", ar: "عارض التهديدات ثلاثي الأبعاد", fr: "Visualiseur de menaces 3D", de: "3D-Bedrohungsvisualisierer", es: "Visualizador de amenazas 3D", tr: "3D Tehdit Görselleştirici", ru: "3D Визуализатор угроз" },
  threat_desc: { en: "Real-time 3D globe with live cyber threat intelligence.", ar: "كرة أرضية ثلاثية الأبعاد مع استخبارات تهديدات سيبرانية حية.", fr: "Globe 3D en temps réel avec intelligence sur les cybermenaces.", de: "3D-Globus in Echtzeit mit Cyber-Bedrohungsinformationen.", es: "Globo 3D en tiempo real con inteligencia de ciberamenazas.", tr: "Canlı siber tehdit istihbaratı ile gerçek zamanlı 3D küre.", ru: "3D-глобус с данными о киберугрозах в реальном времени." },
  threat_resume: { en: "Resume", ar: "استئناف", fr: "Reprendre", de: "Fortsetzen", es: "Reanudar", tr: "Devam et", ru: "Возобновить" },
  threat_pause: { en: "Pause", ar: "إيقاف مؤقت", fr: "Pause", de: "Pause", es: "Pausar", tr: "Duraklat", ru: "Пауза" },
  threat_total_events: { en: "Total Events", ar: "إجمالي الأحداث", fr: "Total des événements", de: "Gesamtereignisse", es: "Total de eventos", tr: "Toplam olaylar", ru: "Всего событий" },
  threat_critical: { en: "Critical", ar: "حرج", fr: "Critique", de: "Kritisch", es: "Crítico", tr: "Kritik", ru: "Критический" },
  threat_high: { en: "High", ar: "عالي", fr: "Élevé", de: "Hoch", es: "Alto", tr: "Yüksek", ru: "Высокий" },
  threat_medium: { en: "Medium", ar: "متوسط", fr: "Moyen", de: "Mittel", es: "Medio", tr: "Orta", ru: "Средний" },
  threat_low: { en: "Low", ar: "منخفض", fr: "Faible", de: "Niedrig", es: "Bajo", tr: "Düşük", ru: "Низкий" },
  threat_drag_rotate: { en: "3D Threat Intelligence • Drag to Rotate", ar: "استخبارات التهديدات ثلاثية الأبعاد • اسحب للتدوير", fr: "Intelligence 3D • Glissez pour tourner", de: "3D-Bedrohungsintelligenz • Ziehen zum Drehen", es: "Inteligencia 3D • Arrastra para rotar", tr: "3D Tehdit İstihbaratı • Döndürmek için sürükle", ru: "3D-разведка угроз • Перетащите для вращения" },
  threat_live_intercepts: { en: "Live Intercepts", ar: "اعتراضات حية", fr: "Interceptions en direct", de: "Live-Abfangmeldungen", es: "Interceptaciones en vivo", tr: "Canlı kesişimler", ru: "Перехваты в реальном времени" },
  threat_attack: { en: "Attack", ar: "هجوم", fr: "Attaque", de: "Angriff", es: "Ataque", tr: "Saldırı", ru: "Атака" },
  threat_source: { en: "Source", ar: "المصدر", fr: "Source", de: "Quelle", es: "Origen", tr: "Kaynak", ru: "Источник" },
  threat_target: { en: "Target", ar: "الهدف", fr: "Cible", de: "Ziel", es: "Objetivo", tr: "Hedef", ru: "Цель" },

  // ─── Pricing ───
  pricing_title: { en: "Expand Your Arsenal", ar: "وسّع ترسانتك", fr: "Élargissez votre arsenal", de: "Erweitern Sie Ihr Arsenal", es: "Expande tu arsenal", tr: "Cephanenizi genişletin", ru: "Расширьте свой арсенал" },
  pricing_subtitle: { en: "Military-grade OSINT infrastructure built for operators. Secure a tier that matches your threat model.", ar: "بنية تحتية OSINT بمستوى عسكري مصممة للمحترفين. اختر المستوى المناسب لنموذج التهديد الخاص بك.", fr: "Infrastructure OSINT de qualité militaire pour les opérateurs. Choisissez un niveau adapté.", de: "Militärische OSINT-Infrastruktur für Operatoren. Wählen Sie die passende Stufe.", es: "Infraestructura OSINT de grado militar para operadores. Elige el nivel adecuado.", tr: "Operatörler için askeri düzeyde OSINT altyapısı. Tehdit modelinize uygun bir katman seçin.", ru: "OSINT-инфраструктура военного класса для операторов. Выберите уровень, соответствующий вашей модели угроз." },
  pricing_stealth: { en: "Stealth", ar: "التخفي", fr: "Furtif", de: "Tarnung", es: "Sigilo", tr: "Gizli", ru: "Стелс" },
  pricing_pro: { en: "Pro Analyst", ar: "المحلل المحترف", fr: "Analyste Pro", de: "Pro-Analyst", es: "Analista Pro", tr: "Pro Analist", ru: "Про-аналитик" },
  pricing_enterprise: { en: "SOC Enterprise", ar: "مؤسسات SOC", fr: "SOC Enterprise", de: "SOC Enterprise", es: "SOC Enterprise", tr: "SOC Kurumsal", ru: "SOC Enterprise" },
  pricing_stealth_desc: { en: "Core intelligence tools for basic footprinting.", ar: "أدوات استخبارات أساسية للبصمة الأولية.", fr: "Outils d'intelligence de base pour l'empreinte.", de: "Grundlegende Intelligence-Tools für Footprinting.", es: "Herramientas de inteligencia básicas para reconocimiento.", tr: "Temel iz sürme için çekirdek istihbarat araçları.", ru: "Базовые инструменты разведки для начального анализа." },
  pricing_pro_desc: { en: "Advanced automation and unrestricted manual investigations.", ar: "أتمتة متقدمة وتحقيقات يدوية بلا قيود.", fr: "Automatisation avancée et investigations manuelles illimitées.", de: "Erweiterte Automatisierung und unbeschränkte manuelle Untersuchungen.", es: "Automatización avanzada e investigaciones manuales sin restricciones.", tr: "Gelişmiş otomasyon ve sınırsız manuel araştırmalar.", ru: "Продвинутая автоматизация и неограниченные расследования." },
  pricing_enterprise_desc: { en: "God-Tier command center for large scale threat operations.", ar: "مركز قيادة من المستوى الأعلى لعمليات التهديد الكبرى.", fr: "Centre de commande ultime pour les opérations à grande échelle.", de: "Kommandozentrale der Spitzenklasse für großangelegte Operationen.", es: "Centro de mando supremo para operaciones de amenazas a gran escala.", tr: "Büyük ölçekli tehdit operasyonları için üst düzey komuta merkezi.", ru: "Командный центр высшего уровня для крупномасштабных операций." },
  pricing_most_popular: { en: "Most Popular", ar: "الأكثر شعبية", fr: "Le plus populaire", de: "Am beliebtesten", es: "Más popular", tr: "En popüler", ru: "Самый популярный" },
  pricing_off: { en: "OFF", ar: "خصم", fr: "RÉDUCTION", de: "RABATT", es: "DTO", tr: "İND", ru: "СКИДКА" },
  pricing_mo: { en: "/mo", ar: "/شهرياً", fr: "/mois", de: "/Monat", es: "/mes", tr: "/ay", ru: "/мес" },
  pricing_deploy: { en: "Deploy Arsenal", ar: "نشر الترسانة", fr: "Déployer l'arsenal", de: "Arsenal bereitstellen", es: "Desplegar arsenal", tr: "Cephaneyi konuşlandır", ru: "Развернуть арсенал" },
  pricing_current: { en: "Current Array", ar: "الحزمة الحالية", fr: "Niveau actuel", de: "Aktuelles Paket", es: "Plan actual", tr: "Mevcut plan", ru: "Текущий план" },
  pricing_access_granted: { en: "Access Granted", ar: "تم منح الوصول", fr: "Accès accordé", de: "Zugriff gewährt", es: "Acceso concedido", tr: "Erişim verildi", ru: "Доступ предоставлен" },
  pricing_upgraded: { en: "Your clearance level has been successfully upgraded.", ar: "تم ترقية مستوى تصريحك بنجاح.", fr: "Votre niveau d'accréditation a été mis à jour.", de: "Ihre Freigabestufe wurde erfolgreich aktualisiert.", es: "Tu nivel de autorización ha sido actualizado.", tr: "Yetki seviyeniz başarıyla yükseltildi.", ru: "Ваш уровень допуска успешно повышен." },
  pricing_secure_gateway: { en: "Secure Gateway", ar: "بوابة آمنة", fr: "Passerelle sécurisée", de: "Sicheres Gateway", es: "Pasarela segura", tr: "Güvenli geçit", ru: "Защищённый шлюз" },
  pricing_acquiring: { en: "Acquiring", ar: "جاري الحصول على", fr: "Acquisition de", de: "Erwerb von", es: "Adquiriendo", tr: "Alınıyor", ru: "Получение" },
  pricing_clearance: { en: "clearance", ar: "تصريح", fr: "accréditation", de: "Freigabe", es: "autorización", tr: "yetki", ru: "допуск" },
  pricing_card_stripe: { en: "Card / Stripe", ar: "بطاقة / Stripe", fr: "Carte / Stripe", de: "Karte / Stripe", es: "Tarjeta / Stripe", tr: "Kart / Stripe", ru: "Карта / Stripe" },
  pricing_promo_code: { en: "Promo Code", ar: "كود ترويجي", fr: "Code promo", de: "Promo-Code", es: "Código promocional", tr: "Promosyon kodu", ru: "Промокод" },
  pricing_secure_checkout: { en: "Secure Stripe Checkout", ar: "الدفع الآمن عبر Stripe", fr: "Paiement sécurisé Stripe", de: "Sichere Stripe-Zahlung", es: "Pago seguro con Stripe", tr: "Güvenli Stripe ödemesi", ru: "Безопасная оплата Stripe" },
  pricing_encrypted: { en: "256-bit encrypted • PCI DSS compliant", ar: "تشفير 256 بت • متوافق مع PCI DSS", fr: "Chiffrement 256 bits • Conforme PCI DSS", de: "256-Bit-verschlüsselt • PCI DSS-konform", es: "Cifrado de 256 bits • Cumple PCI DSS", tr: "256-bit şifreli • PCI DSS uyumlu", ru: "256-битное шифрование • PCI DSS" },
  pricing_stripe_desc: { en: "You'll be redirected to Stripe's secure payment page. After successful payment, your account will be automatically upgraded.", ar: "سيتم توجيهك إلى صفحة الدفع الآمنة في Stripe. بعد الدفع الناجح، سيتم ترقية حسابك تلقائياً.", fr: "Vous serez redirigé vers la page de paiement sécurisée de Stripe.", de: "Sie werden zur sicheren Stripe-Zahlungsseite weitergeleitet.", es: "Serás redirigido a la página de pago segura de Stripe.", tr: "Stripe'ın güvenli ödeme sayfasına yönlendirileceksiniz.", ru: "Вы будете перенаправлены на безопасную страницу оплаты Stripe." },
  pricing_pay_stripe: { en: "Pay with Stripe →", ar: "الدفع عبر Stripe →", fr: "Payer avec Stripe →", de: "Mit Stripe bezahlen →", es: "Pagar con Stripe →", tr: "Stripe ile öde →", ru: "Оплатить через Stripe →" },
  pricing_clearance_code: { en: "Clearance Override Code", ar: "كود تجاوز التصريح", fr: "Code de dérogation", de: "Freigabe-Überschreibungscode", es: "Código de anulación de autorización", tr: "Yetki geçersiz kılma kodu", ru: "Код переопределения допуска" },
  pricing_enter_code: { en: "ENTER CLEARANCE CODE", ar: "أدخل كود التصريح", fr: "ENTRER LE CODE", de: "CODE EINGEBEN", es: "INGRESAR CÓDIGO", tr: "YETKİ KODUNU GİRİN", ru: "ВВЕДИТЕ КОД ДОПУСКА" },
  pricing_verify: { en: "Verify", ar: "تحقق", fr: "Vérifier", de: "Prüfen", es: "Verificar", tr: "Doğrula", ru: "Проверить" },
  pricing_code_accepted: { en: "Code Accepted", ar: "تم قبول الكود", fr: "Code accepté", de: "Code akzeptiert", es: "Código aceptado", tr: "Kod kabul edildi", ru: "Код принят" },
  pricing_override_active: { en: "Override Active", ar: "التجاوز مفعل", fr: "Dérogation active", de: "Überschreibung aktiv", es: "Anulación activa", tr: "Geçersiz kılma aktif", ru: "Переопределение активно" },
  pricing_confirm: { en: "Confirm Authorization", ar: "تأكيد التفويض", fr: "Confirmer l'autorisation", de: "Autorisierung bestätigen", es: "Confirmar autorización", tr: "Yetkilendirmeyi onayla", ru: "Подтвердить авторизацию" },
  pricing_abort: { en: "Abort", ar: "إلغاء", fr: "Abandonner", de: "Abbrechen", es: "Abortar", tr: "İptal", ru: "Отмена" },
  pricing_e2e_encrypted: { en: "End-to-end encrypted", ar: "تشفير من طرف لطرف", fr: "Chiffrement de bout en bout", de: "Ende-zu-Ende-verschlüsselt", es: "Cifrado de extremo a extremo", tr: "Uçtan uca şifreli", ru: "Сквозное шифрование" },
  pricing_telemetry_upgraded: { en: "Your telemetry arrays have been successfully upgraded.", ar: "تم ترقية مصفوفات القياس عن بعد بنجاح.", fr: "Vos systèmes de télémétrie ont été mis à jour.", de: "Ihre Telemetriesysteme wurden erfolgreich aktualisiert.", es: "Tus sistemas de telemetría han sido actualizados.", tr: "Telemetri dizileriniz başarıyla yükseltildi.", ru: "Ваши системы телеметрии успешно обновлены." },
  // Pricing Features
  pricing_f_watchlist_1: { en: "1 Target on Live Watchlist", ar: "هدف واحد في قائمة المراقبة", fr: "1 cible sur la liste de surveillance", de: "1 Ziel auf der Watchlist", es: "1 objetivo en lista de vigilancia", tr: "Canlı izleme listesinde 1 hedef", ru: "1 цель в списке наблюдения" },
  pricing_f_weekly: { en: "Weekly Watchlist Scan (1 Day/Week)", ar: "فحص أسبوعي لقائمة المراقبة (يوم واحد/أسبوع)", fr: "Scan hebdomadaire (1 jour/semaine)", de: "Wöchentlicher Scan (1 Tag/Woche)", es: "Escaneo semanal (1 día/semana)", tr: "Haftalık izleme taraması (1 gün/hafta)", ru: "Еженедельное сканирование (1 день/неделя)" },
  pricing_f_scans_10: { en: "10 Manual Scans/Day", ar: "10 فحوصات يدوية/يوم", fr: "10 scans manuels/jour", de: "10 manuelle Scans/Tag", es: "10 escaneos manuales/día", tr: "Günlük 10 manuel tarama", ru: "10 ручных сканирований/день" },
  pricing_f_device_unlimited: { en: "Unlimited Device Security Checks", ar: "فحوصات أمان أجهزة غير محدودة", fr: "Vérifications de sécurité illimitées", de: "Unbegrenzte Geräte-Sicherheitschecks", es: "Verificaciones de seguridad ilimitadas", tr: "Sınırsız cihaz güvenlik kontrolleri", ru: "Неограниченные проверки безопасности устройств" },
  pricing_f_pdf_watermark: { en: "Standard PDF Reports (Watermarked)", ar: "تقارير PDF قياسية (بعلامة مائية)", fr: "Rapports PDF standard (filigranés)", de: "Standard-PDF-Berichte (Wasserzeichen)", es: "Informes PDF estándar (marca de agua)", tr: "Standart PDF raporlar (filigranlı)", ru: "Стандартные PDF-отчёты (с водяным знаком)" },
  pricing_f_watchlist_50: { en: "50 Targets on Live Watchlist", ar: "50 هدف في قائمة المراقبة", fr: "50 cibles sur la liste de surveillance", de: "50 Ziele auf der Watchlist", es: "50 objetivos en lista de vigilancia", tr: "Canlı izleme listesinde 50 hedef", ru: "50 целей в списке наблюдения" },
  pricing_f_daily: { en: "Daily Watchlist Monitoring (Today)", ar: "مراقبة يومية لقائمة المراقبة (اليوم)", fr: "Surveillance quotidienne (aujourd'hui)", de: "Tägliche Überwachung (heute)", es: "Monitoreo diario (hoy)", tr: "Günlük izleme (bugün)", ru: "Ежедневный мониторинг (сегодня)" },
  pricing_f_scans_500: { en: "500 Manual Scans/Day", ar: "500 فحص يدوي/يوم", fr: "500 scans manuels/jour", de: "500 manuelle Scans/Tag", es: "500 escaneos manuales/día", tr: "Günlük 500 manuel tarama", ru: "500 ручных сканирований/день" },
  pricing_f_whitelabel: { en: "Unbranded White-label Dossiers", ar: "ملفات بدون علامة تجارية", fr: "Dossiers en marque blanche", de: "Markenlose White-Label-Dossiers", es: "Dossiers de marca blanca", tr: "Markasız beyaz etiket dosyalar", ru: "Отчёты без бренда (White-label)" },
  pricing_f_darkweb: { en: "Dark Web Password Check Unlocked", ar: "فحص كلمات مرور الإنترنت المظلم مفتوح", fr: "Vérification Dark Web déverrouillée", de: "Dark-Web-Passwortcheck freigeschaltet", es: "Verificación Dark Web desbloqueada", tr: "Karanlık web şifre kontrolü açık", ru: "Проверка паролей в Dark Web разблокирована" },
  pricing_f_unlimited_watchlist: { en: "Unlimited Watchlist Targets", ar: "أهداف مراقبة غير محدودة", fr: "Cibles de surveillance illimitées", de: "Unbegrenzte Watchlist-Ziele", es: "Objetivos de vigilancia ilimitados", tr: "Sınırsız izleme hedefleri", ru: "Неограниченные цели наблюдения" },
  pricing_f_realtime: { en: "Continuous Real-time Sweeps (24/7)", ar: "مسح مستمر في الوقت الحقيقي (24/7)", fr: "Balayages continus 24/7", de: "Kontinuierliche Echtzeit-Scans (24/7)", es: "Barridos continuos en tiempo real (24/7)", tr: "Sürekli gerçek zamanlı tarama (7/24)", ru: "Непрерывное сканирование в реальном времени (24/7)" },
  pricing_f_siem: { en: "SIEM / Webhook Integrations", ar: "تكاملات SIEM / Webhook", fr: "Intégrations SIEM / Webhook", de: "SIEM/Webhook-Integrationen", es: "Integraciones SIEM / Webhook", tr: "SIEM / Webhook entegrasyonları", ru: "Интеграции SIEM/Webhook" },
  pricing_f_team: { en: "Team Management (5 Users)", ar: "إدارة الفريق (5 مستخدمين)", fr: "Gestion d'équipe (5 utilisateurs)", de: "Teamverwaltung (5 Benutzer)", es: "Gestión de equipo (5 usuarios)", tr: "Takım yönetimi (5 kullanıcı)", ru: "Управление командой (5 пользователей)" },
  pricing_f_threatmap: { en: "3D Threat Map Visualizer", ar: "عارض خريطة التهديدات ثلاثية الأبعاد", fr: "Visualiseur de carte de menaces 3D", de: "3D-Bedrohungskarten-Visualisierer", es: "Visualizador de mapa de amenazas 3D", tr: "3D Tehdit Haritası Görselleştirici", ru: "3D-визуализатор карты угроз" },

  // ─── Admin Dashboard ───
  admin_title: { en: "System Command Center", ar: "مركز التحكم في النظام", fr: "Centre de commande système", de: "System-Kommandozentrale", es: "Centro de mando del sistema", tr: "Sistem komuta merkezi", ru: "Центр управления системой" },
  admin_subtitle: { en: "Root Administrator Privileges Active. All systems nominal.", ar: "صلاحيات المسؤول الجذر مفعلة. جميع الأنظمة تعمل بشكل طبيعي.", fr: "Privilèges administrateur root actifs. Tous les systèmes nominaux.", de: "Root-Administratorrechte aktiv. Alle Systeme nominal.", es: "Privilegios de administrador root activos. Todos los sistemas nominales.", tr: "Kök yönetici yetkileri aktif. Tüm sistemler nominal.", ru: "Привилегии root-администратора активны. Все системы в норме." },
  admin_analytics: { en: "Analytics", ar: "التحليلات", fr: "Analytique", de: "Analytik", es: "Analíticas", tr: "Analitik", ru: "Аналитика" },
  admin_revenue: { en: "Revenue", ar: "الإيرادات", fr: "Revenus", de: "Einnahmen", es: "Ingresos", tr: "Gelir", ru: "Доход" },
  admin_growth: { en: "Growth", ar: "النمو", fr: "Croissance", de: "Wachstum", es: "Crecimiento", tr: "Büyüme", ru: "Рост" },
  admin_users: { en: "Users & Bans", ar: "المستخدمون والحظر", fr: "Utilisateurs et bans", de: "Benutzer & Sperren", es: "Usuarios y bloqueos", tr: "Kullanıcılar ve yasaklar", ru: "Пользователи и баны" },
  admin_promos: { en: "Promos", ar: "العروض", fr: "Promos", de: "Aktionen", es: "Promociones", tr: "Promosyonlar", ru: "Промоакции" },
  admin_activity: { en: "Activity", ar: "النشاط", fr: "Activité", de: "Aktivität", es: "Actividad", tr: "Etkinlik", ru: "Активность" },
  admin_system: { en: "System", ar: "النظام", fr: "Système", de: "System", es: "Sistema", tr: "Sistem", ru: "Система" },
  admin_live: { en: "Live", ar: "مباشر", fr: "En direct", de: "Live", es: "En vivo", tr: "Canlı", ru: "Онлайн" },
  admin_broadcast: { en: "Broadcast", ar: "بث", fr: "Diffusion", de: "Broadcast", es: "Difusión", tr: "Yayın", ru: "Рассылка" },
  admin_flags: { en: "Flags", ar: "الإشارات", fr: "Indicateurs", de: "Flags", es: "Banderas", tr: "Bayraklar", ru: "Флаги" },
  admin_export: { en: "Export", ar: "تصدير", fr: "Exporter", de: "Export", es: "Exportar", tr: "Dışa aktar", ru: "Экспорт" },
  admin_config: { en: "Config", ar: "الإعدادات", fr: "Config", de: "Konfiguration", es: "Configuración", tr: "Yapılandırma", ru: "Конфигурация" },

  // ─── Sidebar extras ───
  sidebar_stealth: { en: "STEALTH EDITION", ar: "الإصدار الخفي", fr: "ÉDITION FURTIVE", de: "STEALTH-EDITION", es: "EDICIÓN SIGILO", tr: "GİZLİ SÜRÜM", ru: "STEALTH ВЕРСИЯ" },
  sidebar_upgrade: { en: "Upgrade System", ar: "ترقية النظام", fr: "Mettre à niveau", de: "System upgraden", es: "Mejorar sistema", tr: "Sistemi yükselt", ru: "Обновить систему" },
  sidebar_admin_console: { en: "Admin Console", ar: "لوحة الإدارة", fr: "Console Admin", de: "Admin-Konsole", es: "Consola de Admin", tr: "Yönetici Konsolu", ru: "Консоль администратора" },
  sidebar_system_control: { en: "System Control", ar: "التحكم بالنظام", fr: "Contrôle système", de: "Systemsteuerung", es: "Control del sistema", tr: "Sistem kontrolü", ru: "Управление системой" },
  sidebar_navigation: { en: "Navigation", ar: "الأدوات", fr: "Navigation", de: "Navigation", es: "Navegación", tr: "Gezinme", ru: "Навигация" },
  sidebar_core: { en: "Core", ar: "الأساسية", fr: "Base", de: "Kern", es: "Núcleo", tr: "Çekirdek", ru: "Ядро" },
  sidebar_people: { en: "People OSINT", ar: "أبحاث الأفراد", fr: "OSINT Personnes", de: "Personen OSINT", es: "OSINT Personas", tr: "Kişi OSINT", ru: "OSINT Люди" },
  sidebar_network: { en: "Network & System", ar: "الشبكة والتقنية", fr: "Réseau & Système", de: "Netzwerk & System", es: "Red y Sistema", tr: "Ağ ve Sistem", ru: "Сеть и Система" },
  sidebar_enterprise: { en: "SOC Enterprise", ar: "المؤسسات", fr: "SOC Enterprise", de: "SOC Enterprise", es: "SOC Enterprise", tr: "SOC Kurumsal", ru: "SOC Enterprise" },
  sidebar_watchlist: { en: "Live Watchlist", ar: "المراقبة المستمرة", fr: "Liste de surveillance", de: "Live-Watchlist", es: "Lista de vigilancia", tr: "Canlı izleme", ru: "Живой наблюдательный список" },
  sidebar_team: { en: "Team Management", ar: "إدارة الفريق", fr: "Gestion d'équipe", de: "Teamverwaltung", es: "Gestión de equipo", tr: "Takım yönetimi", ru: "Управление командой" },
  sidebar_threat_3d: { en: "3D Threat Globe", ar: "خريطة 3D", fr: "Globe de menaces 3D", de: "3D-Bedrohungsglobus", es: "Globo de amenazas 3D", tr: "3D Tehdit Küresi", ru: "3D-глобус угроз" },

  // ─── Cyber Academy ───
  nav_academy: { en: "Cyber Academy", ar: "أكاديمية الأمن", fr: "Cyber Académie", de: "Cyber-Akademie", es: "Ciberacademia", tr: "Siber Akademi", ru: "Киберакадемия" },
  academy_title: { en: "JoeScan Cyber Academy", ar: "أكاديمية جو-سكان للأمن السيبراني", fr: "JoeScan Cyber Académie", de: "JoeScan Cyber-Akademie", es: "JoeScan Ciberacademia", tr: "JoeScan Siber Akademi", ru: "Киберакадемия JoeScan" },
  academy_subtitle: { en: "Enhance your digital awareness with our free cybersecurity courses.", ar: "عزز وعيك الرقمي مع دوراتنا المجانية في الأمن السيبراني.", fr: "Améliorez votre conscience numérique avec nos cours gratuits.", de: "Erweitern Sie Ihr digitales Bewusstsein mit kostenlosen Kursen.", es: "Mejora tu conciencia digital con nuestros cursos gratuitos.", tr: "Ücretsiz kurslarımızla dijital farkındalığınızı artırın.", ru: "Повысьте цифровую осведомленность с помощью бесплатных курсов." },
  academy_search: { en: "Search lessons...", ar: "ابحث عن درس...", fr: "Rechercher des leçons...", de: "Lektionen suchen...", es: "Buscar lecciones...", tr: "Ders ara...", ru: "Поиск уроков..." },
  academy_all: { en: "All Categories", ar: "الكل", fr: "Tout", de: "Alle Kategorien", es: "Todas", tr: "Tümü", ru: "Все категории" },
  academy_email: { en: "Email Security", ar: "حماية الإيميل", fr: "Sécurité E-mail", de: "E-Mail-Sicherheit", es: "Seguridad de correo", tr: "E-posta Güvenliği", ru: "Безопасность Email" },
  academy_passwords: { en: "Passwords", ar: "كلمات المرور", fr: "Mots de passe", de: "Passwörter", es: "Contraseñas", tr: "Şifreler", ru: "Пароли" },
  academy_phishing: { en: "Phishing", ar: "التصيد الاحتيالي", fr: "Hameçonnage", de: "Phishing", es: "Phishing", tr: "Oltalama", ru: "Фишинг" },
  academy_network: { en: "Network Config", ar: "الشبكات", fr: "Réseau", de: "Netzwerk", es: "Red", tr: "Ağ", ru: "Сеть" },
  academy_privacy: { en: "Privacy", ar: "الخصوصية", fr: "Confidentialité", de: "Datenschutz", es: "Privacidad", tr: "Gizlilik", ru: "Конфиденциальность" },
  academy_mobile: { en: "Mobile Security", ar: "أمان الموبايل", fr: "Sécurité Mobile", de: "Mobile Sicherheit", es: "Seguridad Móvil", tr: "Mobil Güvenliği", ru: "Безопасность Мобильных" },
  academy_beginner: { en: "Beginner", ar: "مبتدئ", fr: "Débutant", de: "Anfänger", es: "Principiante", tr: "Başlangıç", ru: "Новичок" },
  academy_intermediate: { en: "Intermediate", ar: "متوسط", fr: "Intermédiaire", de: "Mittel", es: "Intermedio", tr: "Orta", ru: "Средний" },
  academy_advanced: { en: "Advanced", ar: "متقدم", fr: "Avancé", de: "Fortgeschritten", es: "Avanzado", tr: "İleri düzey", ru: "Продвинутый" },
  academy_mark_completed: { en: "Mark as Completed", ar: "تحديد كـ مكتمل", fr: "Marquer comme terminé", de: "Als erledigt markieren", es: "Marcar como completado", tr: "Tamamlandı olarak işaretle", ru: "Отметить завершенным" },
  academy_completed: { en: "Completed", ar: "مكتمل", fr: "Terminé", de: "Erledigt", es: "Completado", tr: "Tamamlandı", ru: "Завершено" },
  academy_progress: { en: "Your Progress", ar: "نسبة إنجازك", fr: "Votre progression", de: "Ihr Fortschritt", es: "Tu progreso", tr: "İlerlemeniz", ru: "Ваш прогресс" },
  academy_lessons_completed: { en: "lessons completed", ar: "دروس مكتملة", fr: "leçons terminées", de: "Lektionen abgeschlossen", es: "lecciones completadas", tr: "Dersler tamamlandı", ru: "уроков завершено" },
  academy_no_results: { en: "No lessons found matching your search.", ar: "لم يتم العثور على دروس تطابق بحثك.", fr: "Aucune leçon trouvée.", de: "Keine Lektionen gefunden.", es: "No se encontraron lecciones.", tr: "Ders bulunamadı.", ru: "Уроки не найдены." },

  // ─── Loading / Init Screen ───
  init_loading: { en: "Initializing Security Modules", ar: "جاري تهيئة وحدات الأمان", fr: "Initialisation des modules de sécurité", de: "Sicherheitsmodule werden initialisiert", es: "Inicializando módulos de seguridad", tr: "Güvenlik modülleri başlatılıyor", ru: "Инициализация модулей безопасности" },
  init_connection: { en: "Establishing Secure Connection", ar: "جاري إنشاء اتصال آمن", fr: "Établissement d'une connexion sécurisée", de: "Sichere Verbindung wird hergestellt", es: "Estableciendo conexión segura", tr: "Güvenli bağlantı kuruluyor", ru: "Установка безопасного соединения" },

  // ─── Watchlist / Live Monitoring ───
  watchlist_command: { en: "COMMAND: ADD TARGET", ar: "أمر: إضافة هدف", fr: "COMMANDE: AJOUTER CIBLE", de: "BEFEHL: ZIEL HINZUFÜGEN", es: "COMANDO: AGREGAR OBJETIVO", tr: "KOMUT: HEDEF EKLE", ru: "КОМАНДА: ДОБАВИТЬ ЦЕЛЬ" },
  watchlist_ipv4: { en: "IPv4 Address", ar: "عنوان IPv4", fr: "Adresse IPv4", de: "IPv4-Adresse", es: "Dirección IPv4", tr: "IPv4 Adresi", ru: "IPv4 Адрес" },
  watchlist_placeholder: { en: "e.g. 192.168.1.1", ar: "مثال: 192.168.1.1", fr: "ex. 192.168.1.1", de: "z.B. 192.168.1.1", es: "ej. 192.168.1.1", tr: "ör. 192.168.1.1", ru: "напр. 192.168.1.1" },
  watchlist_empty: { en: "Deploy your first sensor by adding an asset to the watchlist.", ar: "انشر أول مستشعر لك بإضافة أصل إلى قائمة المراقبة.", fr: "Déployez votre premier capteur en ajoutant un actif.", de: "Setzen Sie Ihren ersten Sensor ein, indem Sie ein Asset hinzufügen.", es: "Despliega tu primer sensor agregando un activo a la lista.", tr: "İzleme listesine bir varlık ekleyerek ilk sensörünüzü konuşlandırın.", ru: "Разверните первый сенсор, добавив актив в список наблюдения." },
  watchlist_standby: { en: "SYSTEM STANDBY", ar: "النظام في وضع الاستعداد", fr: "SYSTÈME EN VEILLE", de: "SYSTEM STANDBY", es: "SISTEMA EN ESPERA", tr: "SİSTEM BEKLEME", ru: "СИСТЕМА В РЕЖИМЕ ОЖИДАНИЯ" },
  watchlist_awaiting: { en: "Awaiting Scan Execution", ar: "في انتظار تنفيذ الفحص", fr: "En attente d'exécution du scan", de: "Warte auf Scan-Ausführung", es: "Esperando ejecución de escaneo", tr: "Tarama yürütmesi bekleniyor", ru: "Ожидание выполнения сканирования" },

  // ─── Updates Tab ───
  tab_updates: { en: "Updates", ar: "التحديثات", fr: "Mises à jour", de: "Updates", es: "Actualizaciones", tr: "Güncellemeler", ru: "Обновления" },
  updates_up_to_date: { en: "You're up to date!", ar: "أنت محدّث!", fr: "Vous êtes à jour !", de: "Sie sind auf dem neuesten Stand!", es: "¡Estás actualizado!", tr: "Güncelsiniz!", ru: "Вы обновлены!" },
  updates_up_to_date_desc: { en: "JoeScan is running the latest version. No action needed.", ar: "جو-سكان يعمل بأحدث إصدار. مفيش حاجة محتاج تعملها.", fr: "JoeScan est à jour. Aucune action nécessaire.", de: "JoeScan läuft auf der neuesten Version.", es: "JoeScan ejecuta la última versión.", tr: "JoeScan en son sürümü çalışıyor.", ru: "JoeScan работает на последней версии." },
  updates_available: { en: "Update Available!", ar: "يوجد تحديث جديد!", fr: "Mise à jour disponible !", de: "Update verfügbar!", es: "¡Actualización disponible!", tr: "Güncelleme mevcut!", ru: "Доступно обновление!" },
  updates_available_desc: { en: "A new version of JoeScan is ready. Update now to get the latest features and fixes.", ar: "نسخة جديدة من جو-سكان جاهزة. حدّث دلوقتي عشان تاخد أحدث المميزات والإصلاحات.", fr: "Une nouvelle version est prête. Mettez à jour maintenant.", de: "Eine neue Version ist bereit. Jetzt aktualisieren.", es: "Una nueva versión está lista. Actualiza ahora.", tr: "Yeni bir sürüm hazır. Şimdi güncelleyin.", ru: "Новая версия готова. Обновите сейчас." },
  updates_install: { en: "Install Update & Restart", ar: "تثبيت التحديث وإعادة التشغيل", fr: "Installer et redémarrer", de: "Update installieren", es: "Instalar y reiniciar", tr: "Güncelle ve yeniden başlat", ru: "Установить и перезапустить" },
  updates_check: { en: "Check for Updates", ar: "التحقق من التحديثات", fr: "Vérifier les mises à jour", de: "Nach Updates suchen", es: "Buscar actualizaciones", tr: "Güncellemeleri kontrol et", ru: "Проверить обновления" },
  updates_checking: { en: "Checking...", ar: "جاري التحقق...", fr: "Vérification...", de: "Prüfe...", es: "Verificando...", tr: "Kontrol ediliyor...", ru: "Проверка..." },
  updates_last_checked: { en: "Last checked", ar: "آخر فحص", fr: "Dernière vérification", de: "Zuletzt geprüft", es: "Última verificación", tr: "Son kontrol", ru: "Последняя проверка" },
  updates_clear_cache: { en: "Clear Cache & Reload", ar: "مسح الذاكرة المؤقتة وإعادة التحميل", fr: "Vider le cache et recharger", de: "Cache leeren & neu laden", es: "Borrar caché y recargar", tr: "Önbelleği temizle ve yeniden yükle", ru: "Очистить кэш и перезагрузить" },
  updates_clear_cache_desc: { en: "Force refresh all cached files. Use this if the app behaves unexpectedly.", ar: "تحديث إجباري لكل الملفات المخزنة. استخدمها لو التطبيق بيتصرف بشكل غريب.", fr: "Actualiser de force tous les fichiers en cache.", de: "Alle zwischengespeicherten Dateien aktualisieren.", es: "Forzar actualización de archivos en caché.", tr: "Tüm önbellek dosyalarını zorla yenileyin.", ru: "Принудительно обновить все кэшированные файлы." },
  
  // ─── Referral System ───
  referral_title: { en: "Referral System", ar: "نظام الإحالة", fr: "Système de Parrainage", de: "Empfehlungssystem", es: "Sistema de Referidos", tr: "Tavsiye Sistemi", ru: "Реферальная система" },
  referral_subtitle: { en: "Invite friends and get a free Pro month", ar: "ادعِ أصحابك واحصل على شهر Pro مجاني", fr: "Invitez des amis et obtenez un mois Pro gratuit", de: "Lade Freunde ein und erhalte einen kostenlosen Pro-Monat", es: "Invita amigos y obtén un mes Pro gratis", tr: "Arkadaşlarınızı davet edin ve ücretsiz bir Pro ay kazanın", ru: "Пригласите друзей и получите бесплатный месяц Pro" },
  referral_hero_title: { en: "Invite 5 friends and get a FREE PRO month! 🎉", ar: "ادعِ 5 أصحاب واحصل على شهر PRO مجاني! 🎉", fr: "Invitez 5 amis et obtenez un mois PRO GRATUIT ! 🎉", de: "Lade 5 Freunde ein und erhalte einen KOSTENLOSEN PRO-Monat! 🎉", es: "¡Invita a 5 amigos y obtén un mes PRO GRATIS! 🎉", tr: "5 arkadaşınızı davet edin ve ÜCRETSİZ BİR PRO ay kazanın! 🎉", ru: "Пригласите 5 друзей и получите БЕСПЛАТНЫЙ месяц PRO! 🎉" },
  referral_hero_desc: { en: "Share your invite code with friends. When 5 people sign up using your code, you will automatically receive a full month of the Pro tier for free.", ar: "شارك كود الدعوة مع أصحابك. لما 5 أشخاص يسجلوا بالكود بتاعك، هتحصل على شهر كامل من باقة Pro مجاناً.", fr: "Partagez votre code d'invitation avec vos amis. Lorsque 5 personnes s'inscrivent, vous recevez un mois Pro gratuit.", de: "Teile deinen Einladungscode. Wenn sich 5 Personen anmelden, erhältst du einen kostenlosen Pro-Monat.", es: "Comparte tu código con amigos. Cuando 5 personas se registren, recibirás un mes Pro gratis.", tr: "Davet kodunuzu paylaşın. 5 kişi kaydolduğunda ücretsiz Pro ay kazanırsınız.", ru: "Поделитесь кодом с друзьями. Когда 5 человек зарегистрируются, вы получите месяц Pro бесплатно." },
  referral_code_label: { en: "Your Invite Code", ar: "كود الدعوة الخاص بك", fr: "Votre Code d'Invitation", de: "Dein Einladungscode", es: "Tu Código de Invitación", tr: "Davet Kodunuz", ru: "Ваш код приглашения" },
  share_whatsapp: { en: "Share on WhatsApp", ar: "شارك على واتساب", fr: "Partager sur WhatsApp", de: "Auf WhatsApp teilen", es: "Compartir en WhatsApp", tr: "WhatsApp'ta Paylaş", ru: "Поделиться в WhatsApp" },
  your_progress: { en: "Your Progress", ar: "تقدمك", fr: "Votre Progression", de: "Dein Fortschritt", es: "Tu Progreso", tr: "İlerlemeniz", ru: "Ваш прогресс" },
  claim_reward: { en: "Claim FREE Pro Month!", ar: "احصل على شهر Pro مجاناً!", fr: "Obtenez le mois Pro GRATUIT !", de: "Kostenlosen Pro-Monat anfordern!", es: "¡Reclama tu mes Pro GRATIS!", tr: "Ücretsiz Pro Ayı Alın!", ru: "Получить бесплатный месяц Pro!" },
  reward_claimed_msg: { en: "Free month activated! Congratulations 🎉", ar: "تم تفعيل الشهر المجاني! مبروك 🎉", fr: "Mois gratuit activé ! Félicitations 🎉", de: "Kostenloser Monat aktiviert! Glückwunsch 🎉", es: "¡Mes gratis activado! Felicidades 🎉", tr: "Ücretsiz ay aktif edildi! Tebrikler 🎉", ru: "Бесплатный месяц активирован! Поздравляем 🎉" },
  referred_friends: { en: "Friends who signed up", ar: "أصحابك اللي سجلوا", fr: "Amis inscrits", de: "Registrierte Freunde", es: "Amigos registrados", tr: "Kaydolan Arkadaşlar", ru: "Зарегистрированные друзья" },
  friend_count: { en: "Friend", ar: "صديق", fr: "Ami", de: "Freund", es: "Amigo", tr: "Arkadaş", ru: "Друг" },
  referral_default_email: { en: "Anonymous user", ar: "مستخدم مجهول", fr: "Utilisateur anonyme", de: "Anonymer Benutzer", es: "Usuario anónimo", tr: "Anonim kullanıcı", ru: "Анонимный пользователь" },
  referral_wa_msg: { en: "🛡️ Try JoeScan — AI Cybersecurity Platform!\n\nScan your emails, passwords, and phone numbers for dark web leaks.\n\nSign up for free using my invite code: ", ar: "🛡️ جرب JoeScan — منصة الأمن السيبراني بالذكاء الاصطناعي!\n\nافحص إيميلك، كلمات المرور، ورقم الموبايل لو تسربوا على الدارك ويب.\n\nسجل مجاناً بالكود: ", fr: "🛡️ Essayez JoeScan — Plateforme de cybersécurité !\n\nInscrivez-vous avec mon code : ", de: "🛡️ Teste JoeScan — KI-Cybersicherheit!\n\nMelde dich mit meinem Code an: ", es: "🛡️ Prueba JoeScan — ¡Ciberseguridad con IA!\n\nRegístrate con mi código: ", tr: "🛡️ JoeScan'ı Deneyin — Siber Güvenlik Platformu!\n\nKodumla ücretsiz kaydolun: ", ru: "🛡️ Попробуйте JoeScan — Платформу кибербезопасности ИИ!\n\nЗарегистрируйтесь по моему коду: " }
};

// Language display names for the switcher
export const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

type Theme = 'dark' | 'light';

interface PreferencesContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: keyof typeof translations) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try { const saved = localStorage.getItem('joescan-lang'); if (saved && ['en','ar','fr','de','es','tr','ru'].includes(saved)) return saved as Language; } catch {} return 'en';
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('joescan-theme'); if (saved === 'light' || saved === 'dark') return saved; } catch {} return 'dark';
  });

  const setLang = (l: Language) => { setLangState(l); try { localStorage.setItem('joescan-lang', l); } catch {} };
  const setTheme = (t: Theme) => { setThemeState(t); try { localStorage.setItem('joescan-theme', t); } catch {} };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const t = (key: keyof typeof translations) => {
    const entry = translations[key];
    if (!entry) return String(key);
    return (entry as any)[lang] || (entry as any)['en'] || String(key);
  };

  return (
    <PreferencesContext.Provider value={{ lang, setLang, dir, theme, setTheme, t }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
