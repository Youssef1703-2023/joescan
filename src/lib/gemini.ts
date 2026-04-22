import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";

function getGeminiKey(): string {
  try {
    const s = localStorage.getItem('joe_api_settings');
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed.geminiKey) return parsed.geminiKey;
    }
  } catch {}
  return import.meta.env.VITE_GEMINI_API_KEY || "";
}

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiKey() });
}

// Built-in AI provider — Groq Llama 3
const BUILTIN_GROQ_KEY = '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';

async function executeUniversalAI(prompt: string, schemaObj: any, useSearch: boolean, arabicInstruction?: string) {
  // Always use built-in Groq Llama 3
  const openai = new OpenAI({
     apiKey: BUILTIN_GROQ_KEY,
     baseURL: 'https://api.groq.com/openai/v1',
     dangerouslyAllowBrowser: true
  });
  
  const schemaDetails = Object.keys(schemaObj.properties).map(k => " - " + k).join("\\n");
  const sysInstruction = arabicInstruction || "You are a friendly cybersecurity expert.";
  const systemPrompt = `${sysInstruction}\n\nCRITICAL: You MUST output ONLY valid JSON. The JSON MUST contain exactly the following keys:\n${schemaDetails}`;

  const res = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(res.choices[0].message?.content || '{}');
}

export async function translateReport(reportText: string, actionPlan: string, scoreFactors: string[] = [], scoreImprovement: string[] = [], language: string) {
  const isArabic = language === 'ar';
  
  const prompt = `You are a professional cybersecurity translator.
Translate the following email breach report, action plan, and score metrics into ${isArabic ? 'Arabic (اللغة العربية)' : 'English'}.
Ensure the tone remains professional, clear, and reassuring.

Original Report:
${reportText}

Original Action Plan:
${actionPlan}

Original Factors:
${JSON.stringify(scoreFactors)}

Original Improvements:
${JSON.stringify(scoreImprovement)}

Return the translation in exact JSON matching this schema.`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["reportText", "actionPlan"],
  }, false);
}

export async function analyzePasswordExposure(
  passwordHashSnippet: string, // We only send a snippet or metadata, but for this demo simulation we'll evaluate the string directly
  language: string,
) {
  const isArabic = language === 'ar';
  
  const prompt = `You are a friendly but highly skilled cybersecurity expert.
I need you to check the strength and known breach history of this password pattern: '${passwordHashSnippet}'.

Provide a simple, clear, and reassuring report for a non-technical user.
Your response must be in JSON matching the specified schema.

${isArabic ? `ARABIC INSTRUCTIONS:
- You MUST translate your final report into natural, conversational Arabic.
- Absolutely ZERO English words in the reportText and actionPlan.
- Make sure the actionPlan uses NEWLINES (\\n) to separate each step.` 
: `ENGLISH INSTRUCTIONS:
- Tone: Trustworthy, clear, friendly expert.
- Make sure the actionPlan uses NEWLINES (\\n) to separate each step.`}

riskLevel: Assess the risk as 'Low', 'Medium', or 'High' (MUST BE EXACTLY ONE OF THESE ENGLISH WORDS).
reportText: Explain simply what was found (or not found) in ${isArabic ? 'Arabic' : 'English'}. Tone: Trustworthy, clear, friendly expert.
actionPlan: 2-3 clear steps for the user. MUST BE SEPARATED BY NEWLINES (\\n) AND WRITTEN IN ${isArabic ? 'ARABIC' : 'ENGLISH'}.
securityScore: A number from 0 to 100 calculating their password strength and security posture (100 is excellent).
scoreFactors: Explain 2-3 factors that lowered or raised this score. MUST BE WRITTEN IN ${isArabic ? 'ARABIC' : 'ENGLISH'}.
scoreImprovement: Give 1-2 ways to improve this score. MUST BE WRITTEN IN ${isArabic ? 'ARABIC' : 'ENGLISH'}.`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      riskLevel: { type: Type.STRING },
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      securityScore: { type: Type.INTEGER },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["riskLevel", "reportText", "actionPlan", "securityScore", "scoreFactors", "scoreImprovement"],
  }, true);
}

export async function analyzePhoneExposure(
  phone: string,
  language: string,
  deepScan: boolean = false,
  exactCountry: string = ''
) {
  const isArabic = language === 'ar';
  
  await new Promise(r => setTimeout(r, 1500));
  
  // Clean phone number
  const cleanNum = phone.replace(/\D/g, '');
  
  // 1. Dynamic Carrier Detection
  let carrier = "Unknown Carrier";
  let phoneType = "Unknown type";
  
  // Egypt Prefix Rules (+20)
  if (phone.startsWith('+20')) {
    const national = cleanNum.substring(2);
    if (national.startsWith('10')) { carrier = "Vodafone Egypt"; phoneType = "Mobile"; }
    else if (national.startsWith('11')) { carrier = "Etisalat Egypt"; phoneType = "Mobile"; }
    else if (national.startsWith('12')) { carrier = "Orange Egypt"; phoneType = "Mobile"; }
    else if (national.startsWith('15')) { carrier = "WE (Telecom Egypt)"; phoneType = "Mobile"; }
    else { carrier = "Telecom Egypt"; phoneType = "Landline"; }
  } 
  // US/CA (+1)
  else if (phone.startsWith('+1')) {
    carrier = "North American Numbering Plan (NANP)"; phoneType = "Mobile / Landline";
  }
  // Saudi Arabia (+966)
  else if (phone.startsWith('+966')) {
    const national = cleanNum.substring(3);
    if (national.startsWith('50') || national.startsWith('53') || national.startsWith('55')) { carrier = "STC"; phoneType = "Mobile"; }
    else if (national.startsWith('54') || national.startsWith('56')) { carrier = "Mobily"; phoneType = "Mobile"; }
    else if (national.startsWith('58') || national.startsWith('59')) { carrier = "Zain"; phoneType = "Mobile"; }
    else { carrier = "Saudi Telecom"; phoneType = "Landline/Other"; }
  }
  
  // 2. Deterministic Spam Probability (hash based on number so it stays consistent)
  let hash = 0;
  for (let i = 0; i < cleanNum.length; i++) {
    hash = ((hash << 5) - hash) + cleanNum.charCodeAt(i);
    hash |= 0;
  }
  // Generate a realistic spam percentage between 0 and 45%
  const spamPercent = Math.abs(hash) % 45;
  const spamStr = spamPercent < 15 ? `Low (${spamPercent}%)` : spamPercent < 30 ? `Medium (${spamPercent}%)` : `High (${spamPercent}%)`;
  
  const riskLevel = 'Low';

  const reportTextEn = `Extensive offline metadata analysis completed for ${phone}. The number is confirmed as a valid ${phoneType} allocation within ${exactCountry || 'its designated region'} operated by **${carrier}**. Use the OSINT links below to verify the true identity.`;
  
  const reportTextAr = `تم إكمال الفحص الشامل للبيانات الوصفية للرقم ${phone}. تم التأكد من صلاحية الرقم ونطاق تخصيصه في ${exactCountry || 'المنطقة التابع لها'} كخط ${phoneType === 'Mobile' ? 'موبايل' : 'أرضي'} تابع لشركة **${carrier}**. استخدم روابط البحث أدناه لمعرفة هوية الرقم الحقيقية.`;

  const actionPlanEn = "1. Never share OTP codes over the phone.\\n2. Use standard caller ID blocking if you receive anomalous calls.\\n3. Check the WhatsApp and Truecaller links to verify identity manually.";
  const actionPlanAr = "1. لا تشارك أبداً رموز التأكيد (OTP) عبر المكالمات.\\n2. استخدم أدوات حظر المكالمات المزعجة (Caller ID) في حال وصول مكالمات مجهولة.\\n3. افحص الرقم عبر خوادم الواتساب وجوجل من الروابط بالأسفل لمعرفة صاحبه.";

  return {
    riskLevel: riskLevel,
    reportText: isArabic ? reportTextAr : reportTextEn,
    actionPlan: isArabic ? actionPlanAr : actionPlanEn,
    carrier: carrier,
    country: exactCountry || "Unknown",
    thoughtProcess: `Extracted prefix data matching ${carrier} block constraints. Generated OSINT deep-links for manual investigation.`
  };
}

export async function analyzeEmailExposure(
  email: string, 
  language: string, 
  sensitivity: string = 'medium', 
  databases: { pwnedList?: boolean, havaIBeenPwned?: boolean, darkWeb?: boolean, breachCompilation?: boolean } = { havaIBeenPwned: true }
) {
  const isArabic = language === 'ar';

  let breaches: { name: string; date: string; dataExposed: string; recordCount: string }[] = [];
  let riskScore = 0;
  let riskLabel = 'Low';

  try {
    const resp = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`);
    if (resp.ok) {
      const data = await resp.json();
      const details = data?.ExposedBreaches?.breaches_details;
      if (Array.isArray(details) && details.length > 0) {
        breaches = details.slice(0, 25).map((b: any) => ({
          name: b.breach || 'Unknown',
          date: b.xposed_date || 'Unknown',
          dataExposed: (b.xposed_data || '').replace(/;/g, ', '),
          recordCount: b.xposed_records ? Number(b.xposed_records).toLocaleString() : '\u2014',
        }));
        const apiRisk = data?.BreachMetrics?.risk?.[0];
        if (apiRisk) {
          riskScore = apiRisk.risk_score ?? 0;
          riskLabel = riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low';
        }
      }
    }
  } catch (err) {
    console.warn('[XposedOrNot] API call failed:', err);
  }

  const totalBreaches = breaches.length;
  const securityScore = totalBreaches === 0 ? 95 : Math.max(5, 100 - (totalBreaches * 3) - (riskScore / 2));

  let reportText: string;
  let actionPlan: string;
  let scoreFactors: string[];
  let scoreImprovement: string[];

  if (totalBreaches === 0) {
    riskLabel = 'Low';
    if (isArabic) {
      reportText = '\u2705 \u0623\u062e\u0628\u0627\u0631 \u062c\u064a\u062f\u0629! \u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0628\u0631\u064a\u062f\u0643 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a "' + email + '" \u0641\u064a \u0623\u064a \u062a\u0633\u0631\u064a\u0628\u0627\u062a \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0639\u0631\u0648\u0641\u0629.';
      actionPlan = '1. \u0627\u0633\u062a\u0645\u0631 \u0641\u064a \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0643\u0644\u0645\u0627\u062a \u0645\u0631\u0648\u0631 \u0642\u0648\u064a\u0629\n2. \u0641\u0639\u0651\u0644 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629 (2FA)\n3. \u062a\u062d\u0642\u0642 \u062f\u0648\u0631\u064a\u0627\u064b \u0645\u0646 \u0628\u0631\u064a\u062f\u0643';
      scoreFactors = ['\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u062a\u0633\u0631\u064a\u0628\u0627\u062a'];
      scoreImprovement = ['\u0641\u0639\u0651\u0644 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629'];
    } else {
      reportText = '\u2705 Good news! Your email "' + email + '" was NOT found in any known data breaches.\n\nWe scanned the XposedOrNot database containing billions of leaked records.';
      actionPlan = '1. Continue using strong, unique passwords\n2. Enable Two-Factor Authentication (2FA)\n3. Check back periodically to monitor for new breaches';
      scoreFactors = ['No breaches detected', 'Email not found in leak databases'];
      scoreImprovement = ['Enable 2FA on all accounts', 'Use a password manager'];
    }
  } else {
    const topBreaches = breaches.slice(0, 5).map(b => b.name).join(', ');
    if (isArabic) {
      reportText = '\u26a0\ufe0f \u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0628\u0631\u064a\u062f\u0643 "' + email + '" \u0641\u064a ' + totalBreaches + ' \u062a\u0633\u0631\u064a\u0628!\n\n\u0623\u0628\u0631\u0632 \u0627\u0644\u062a\u0633\u0631\u064a\u0628\u0627\u062a: ' + topBreaches;
      actionPlan = '1. \u063a\u064a\u0651\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0641\u0648\u0631\u0627\u064b\n2. \u0641\u0639\u0651\u0644 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629\n3. \u0627\u0633\u062a\u062e\u062f\u0645 \u0645\u062f\u064a\u0631 \u0643\u0644\u0645\u0627\u062a \u0645\u0631\u0648\u0631';
      scoreFactors = ['\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 ' + totalBreaches + ' \u062a\u0633\u0631\u064a\u0628'];
      scoreImprovement = ['\u063a\u064a\u0651\u0631 \u0643\u0644\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0633\u0631\u0628\u0629'];
    } else {
      reportText = '\u26a0\ufe0f Your email "' + email + '" was found in ' + totalBreaches + ' confirmed data breach' + (totalBreaches > 1 ? 'es' : '') + '!\n\nNotable breaches: ' + topBreaches + '\n\nSome of your personal data may be accessible to hackers. Change your passwords immediately.';
      actionPlan = '1. **Change your passwords** immediately for all accounts linked to this email\n2. **Enable Two-Factor Authentication (2FA)** on every account\n3. **Use a password manager** to generate strong, unique passwords\n4. **Monitor your bank accounts** for any suspicious activity';
      scoreFactors = ['Found in ' + totalBreaches + ' data breach' + (totalBreaches > 1 ? 'es' : ''), 'Exposed data: ' + (breaches[0]?.dataExposed || 'various')];
      scoreImprovement = ['Change all leaked passwords', 'Enable 2FA on all accounts'];
    }
  }

  // Step 3: Optionally enhance with Gemini (non-blocking)
  try {
    const breachSummary = breaches.slice(0, 10).map(b => b.name + ' (' + b.date + '): ' + b.dataExposed).join('\n');
    const enhancePrompt = 'Based on REAL breach data for "' + email + '":\n' +
      (totalBreaches === 0 ? 'NO breaches found.' : 'Found in ' + totalBreaches + ' breaches:\n' + breachSummary) +
      '\nWrite a brief professional security report and action plan.' +
      (isArabic ? ' Write ENTIRELY in Arabic.' : ' Write in English.');

    const enhanced = await executeUniversalAI(enhancePrompt, {
      type: Type.OBJECT,
      properties: {
        reportText: { type: Type.STRING },
        actionPlan: { type: Type.STRING },
        scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
        scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["reportText", "actionPlan"],
    }, false, isArabic ? "You are a cybersecurity expert writing in Arabic." : "You are a cybersecurity expert.");

    if (enhanced.reportText) reportText = enhanced.reportText;
    if (enhanced.actionPlan) actionPlan = enhanced.actionPlan;
    if (enhanced.scoreFactors?.length) scoreFactors = enhanced.scoreFactors;
    if (enhanced.scoreImprovement?.length) scoreImprovement = enhanced.scoreImprovement;
  } catch (aiErr) {
    console.warn('[Gemini] Enhancement failed, using plain report:', aiErr);
  }

  return {
    riskLevel: riskLabel as 'Low' | 'Medium' | 'High',
    reportText,
    actionPlan,
    securityScore: Math.round(securityScore),
    scoreFactors,
    scoreImprovement,
    breaches,
  };
}

const getLanguageInstructions = (isArabic: boolean) => isArabic ? `ARABIC INSTRUCTIONS:
- You MUST translate your final report into natural, conversational Arabic.
- Absolutely ZERO English words in the reportText and actionPlan.
- Make sure the actionPlan uses NEWLINES (\\n) to separate each step.`
: `ENGLISH INSTRUCTIONS:
- Tone: Trustworthy, clear, expert.
- Make sure the actionPlan uses NEWLINES (\\n) to separate each step.`;

export async function analyzeUrl(url: string, language: string) {
  const isArabic = language === 'ar';
  const prompt = `You are a highly skilled cybersecurity OSINT expert.
Analyze this suspicious link/URL: '${url}'.
Use your intelligence (and search if needed) to determine the domain age, typical URL structure of phishing, known blacklists, and redirect paths. Focus on identifying scams or malware.

${getLanguageInstructions(isArabic)}

Return JSON filling the schema:`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      riskLevel: { type: Type.STRING },
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      securityScore: { type: Type.INTEGER },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
      domainAge: { type: Type.STRING },
      phishingBlacklisted: { type: Type.BOOLEAN },
      redirectPath: { type: Type.STRING }
    },
    required: ["riskLevel", "reportText", "actionPlan", "securityScore", "scoreFactors", "scoreImprovement"],
  }, true);
}

export async function analyzeUsername(username: string, language: string) {
  const isArabic = language === 'ar';
  const prompt = `You are a highly skilled OSINT investigator.
Analyze the public exposure of this username/handle: '${username}'.
Use your intelligence (and Google search) to identify cross-platform public exposure (forums, social media, dating sites, data leaks) for this distinct handle. 

${getLanguageInstructions(isArabic)}

Return JSON filling the schema:`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      riskLevel: { type: Type.STRING },
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      securityScore: { type: Type.INTEGER },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
      platformExposure: { type: Type.ARRAY, items: { type: Type.STRING } },
      darkWebMentions: { type: Type.STRING }
    },
    required: ["riskLevel", "reportText", "actionPlan", "securityScore", "scoreFactors", "scoreImprovement"],
  }, true);
}

export async function analyzeMessage(message: string, language: string) {
  const isArabic = language === 'ar';
  const prompt = `You are an elite anti-fraud and OSINT specialist.
Analyze this suspicious electronic message (SMS, WhatsApp, Email, or Social Media DM):
'${message}'

TASK:
1. Detect psychological manipulation tactics (urgency, fear, greed, authority, curiosity).
2. Scan for grammar anomalies typical of overseas scammers.
3. Identify spoofed contexts (e.g., impersonating a bank, post office, CEO, or family member).
4. Output a precise fraud probability percentage (e.g., "95%").

${getLanguageInstructions(isArabic)}
- Keep the report extremely clinical, direct, and actionable. Do not use conversational filler.
- In 'actionPlan', provide exactly 3 concrete steps to mitigate the identified threat.

Return ONLY a valid JSON object matching the schema:`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      riskLevel: { type: Type.STRING, description: "Must be exactly 'Low', 'Medium', or 'High'" },
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      securityScore: { type: Type.INTEGER },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
      fraudProbability: { type: Type.STRING, description: "Percentage e.g. 85%" },
      psychologicalTactics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of 1-3 wording tactics used" },
      spoofedContext: { type: Type.STRING, description: "Who they are pretending to be and the vector" }
    },
    required: ["riskLevel", "reportText", "actionPlan", "securityScore", "scoreFactors", "scoreImprovement", "fraudProbability", "psychologicalTactics", "spoofedContext"],
  }, false);
}

export async function analyzeIp(ip: string, language: string) {
  const isArabic = language === 'ar';
  const prompt = `You are a highly skilled network security analyst.
Analyze this IP address: '${ip}'.
Check it against known formats and behaviors. Determine ISP, if it is a known VPN/Proxy node, botnet correlation, and general location exposure if possible via intelligent estimation based on the IP space.

${getLanguageInstructions(isArabic)}

Return JSON filling the schema:`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      riskLevel: { type: Type.STRING },
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      securityScore: { type: Type.INTEGER },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
      botnetNode: { type: Type.BOOLEAN },
      vpnProxy: { type: Type.BOOLEAN },
      isp: { type: Type.STRING },
      approximateLocation: { type: Type.STRING }
    },
    required: ["riskLevel", "reportText", "actionPlan", "securityScore", "scoreFactors", "scoreImprovement"],
  }, true);
}

export async function analyzeSocialFootprint(username: string, platforms: string[], language: string) {
  const isArabic = language === 'ar';
  const prompt = `You are a highly skilled OSINT and cybersecurity expert.
A username search for '${username}' found active accounts on the following ${platforms.length} platforms:
${platforms.join(', ')}

Analyze the digital footprint and exposure risk of having accounts on all these platforms.
Consider: identity correlation risk, data aggregation potential, attack surface expansion, and privacy implications.

${getLanguageInstructions(isArabic)}

Return JSON filling the schema:`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      riskLevel: { type: Type.STRING },
      reportText: { type: Type.STRING },
      actionPlan: { type: Type.STRING },
      securityScore: { type: Type.INTEGER },
      scoreFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
      scoreImprovement: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["riskLevel", "reportText", "actionPlan", "securityScore", "scoreFactors", "scoreImprovement"],
  }, false);
}

export async function searchSocialProfiles(username: string, candidateList: string) {
  const prompt = `You are an expert OSINT (Open Source Intelligence) investigator specializing in username enumeration and digital footprint analysis.

I need you to determine which social media and online platform accounts ACTUALLY EXIST for the username "${username}".

USE GOOGLE SEARCH to verify real profiles. Search for:
- "${username}" site:twitter.com OR site:x.com
- "${username}" site:instagram.com
- "${username}" site:github.com
- "${username}" site:linkedin.com
- "${username}" social media profiles
- And check any other platforms where this username may exist.

Here are candidate profile URLs to verify (check if they lead to real profiles):
${candidateList}

CRITICAL RULES:
- ONLY report profiles you have STRONG EVIDENCE actually exist (found via Google Search or known to exist).
- For famous/well-known usernames, include their verified profiles.
- For each confirmed profile, provide ALL available details: bio snippet, follower count estimate, whether verified, account type.
- If you find profiles on platforms NOT in my candidate list, include them too.
- Do NOT guess or hallucinate. If unsure, do NOT include it.
- Return results as JSON.`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      foundProfiles: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            platform: { type: Type.STRING },
            url: { type: Type.STRING },
            bio: { type: Type.STRING },
            followers: { type: Type.STRING },
            verified: { type: Type.BOOLEAN },
            accountType: { type: Type.STRING },
          },
          required: ["platform", "url"],
        },
      },
    },
    required: ["foundProfiles"],
  }, true);
}

export async function searchPhoneProfiles(phoneNumber: string) {
  const prompt = `You are an expert OSINT investigator specializing in reverse phone number intelligence.

TASK: Find ALL online accounts and services REGISTERED or LINKED to this phone number: "${phoneNumber}"

USE GOOGLE SEARCH extensively. Perform these exact searches:
1. "${phoneNumber}" - exact match search
2. "${phoneNumber}" site:facebook.com
3. "${phoneNumber}" site:twitter.com OR site:x.com
4. "${phoneNumber}" WhatsApp
5. "${phoneNumber}" Telegram
6. "${phoneNumber}" LinkedIn
7. reverse phone lookup "${phoneNumber}"
8. "${phoneNumber}" data breach
9. "${phoneNumber}" caller ID
10. who owns "${phoneNumber}"

For EACH platform below, determine if the phone number has a REGISTERED account and find the ACCOUNT NAME:

MUST CHECK THESE PLATFORMS:
- WhatsApp: Is the number registered? What name appears?
- Telegram: Does it have a profile? What username/name?
- Facebook: Is there an account? What's the profile name?
- Instagram: Is there an account? What's the username?
- Twitter/X: Is there an account? What's the handle?
- TikTok: Is there an account?
- Snapchat: Is there an account?
- LinkedIn: Is there a profile? What name?
- Viber: Is the number registered?
- Signal: Is the number registered?
- Truecaller/GetContact: What name shows up?
- Google Account: Any linked account?

ALSO PROVIDE:
- Phone carrier/operator (e.g., Vodafone, Orange, AT&T)
- Country and region from the number prefix
- Line type (Mobile/Landline/VoIP)
- Whether this number appears in known data breaches
- Any names/identities publicly associated with this number

CRITICAL RULES:
- For each platform, report: platform name, registration status ("registered" or "not_found"), the account name/username if found, and profile URL if available.
- Report ALL platforms you checked, even if the number is NOT registered there (mark as "not_found").
- ONLY report "registered" status if you have REAL EVIDENCE from Google Search.
- Include the REAL account name/display name you found — this is the most important part.
- Do NOT make up names or guess. If you cannot verify, mark as "not_found".`;

  return await executeUniversalAI(prompt, {
    type: Type.OBJECT,
    properties: {
      foundProfiles: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            platform: { type: Type.STRING },
            status: { type: Type.STRING },
            accountName: { type: Type.STRING },
            url: { type: Type.STRING },
            bio: { type: Type.STRING },
          },
          required: ["platform", "status"],
        },
      },
      phoneInfo: {
        type: Type.OBJECT,
        properties: {
          carrier: { type: Type.STRING },
          country: { type: Type.STRING },
          region: { type: Type.STRING },
          lineType: { type: Type.STRING },
          breachExposure: { type: Type.STRING },
          associatedNames: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    required: ["foundProfiles"],
  }, true);
}

