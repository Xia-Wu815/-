/**
 * holidays.ts — Region-aware holiday & workday utility
 * Provides holiday info and workday/holiday/调休 status for major regions.
 * 
 * Supported regions: CN, TW, JP, KR, US, UK, HK
 */




// ============= CHINA (CN) =============

// Fixed holidays (every year)
const CN_FIXED_HOLIDAYS = [
    { name: "元旦", nameEn: "New Year", date: "01-01" },
    { name: "妇女节", nameEn: "Women's Day", date: "03-08" },
    { name: "植树节", nameEn: "Arbor Day", date: "03-12" },
    { name: "劳动节", nameEn: "Labor Day", date: "05-01" },
    { name: "青年节", nameEn: "Youth Day", date: "05-04" },
    { name: "儿童节", nameEn: "Children's Day", date: "06-01" },
    { name: "建军节", nameEn: "Army Day", date: "08-01" },
    { name: "教师节", nameEn: "Teachers' Day", date: "09-10" },
    { name: "国庆节", nameEn: "National Day", date: "10-01" },
    { name: "国庆节", nameEn: "National Day", date: "10-02" },
    { name: "国庆节", nameEn: "National Day", date: "10-03" },
];

// China 调休 calendar — official holiday dates and makeup workdays
// Key: "YYYY-MM-DD", Value: "holiday" | "调休上班"
const CN_SPECIAL_DAYS = {
    "2025": {
        // 元旦 (Jan 1)
        "2025-01-01": "holiday",
        // 春节 (Jan 28–Feb 4)
        "2025-01-26": "调休上班", // Sun makeup
        "2025-01-28": "调休放假",
        "2025-01-29": "调休放假",
        "2025-01-30": "调休放假",
        "2025-01-31": "调休放假",
        "2025-02-01": "调休放假",
        "2025-02-02": "调休放假",
        "2025-02-03": "调休放假",
        "2025-02-04": "调休放假",
        "2025-02-08": "调休上班", // Sat makeup
        // 清明节 (Apr 4–6)
        "2025-04-04": "holiday",
        "2025-04-05": "holiday",
        "2025-04-06": "holiday",
        // 劳动节 (May 1–5)
        "2025-04-27": "调休上班", // Sun makeup
        "2025-05-01": "holiday",
        "2025-05-02": "调休放假",
        "2025-05-03": "调休放假",
        "2025-05-04": "调休放假",
        "2025-05-05": "调休放假",
        // 端午节 (May 31–Jun 2)
        "2025-05-31": "holiday",
        "2025-06-01": "holiday",
        "2025-06-02": "holiday",
        // 中秋节+国庆节 (Oct 1–8)
        "2025-09-28": "调休上班", // Sun makeup
        "2025-10-01": "holiday",
        "2025-10-02": "holiday",
        "2025-10-03": "holiday",
        "2025-10-04": "holiday",
        "2025-10-05": "holiday",
        "2025-10-06": "调休放假",
        "2025-10-07": "调休放假",
        "2025-10-08": "调休放假",
        "2025-10-11": "调休上班", // Sat makeup
    },
    "2026": {
        // 元旦 (Jan 1–3, Thu–Sat, Sun Jan 4 makeup)
        "2026-01-01": "holiday",
        "2026-01-02": "调休放假",
        "2026-01-03": "调休放假",
        "2026-01-04": "调休上班",
        // 春节 (Feb 17–23, Tue–Mon, Feb 14 Sat & Feb 15 Sun makeup)
        "2026-02-14": "调休上班",
        "2026-02-15": "调休上班",
        "2026-02-17": "调休放假",
        "2026-02-18": "调休放假",
        "2026-02-19": "调休放假",
        "2026-02-20": "调休放假",
        "2026-02-21": "调休放假",
        "2026-02-22": "调休放假",
        "2026-02-23": "调休放假",
        // 清明节 (Apr 5 Sun — Apr 5–6 off, Apr 7 Tue off -> Apr 4 Sat makeup?)
        "2026-04-04": "调休上班",
        "2026-04-05": "holiday",
        "2026-04-06": "调休放假",
        "2026-04-07": "调休放假",
        // 劳动节 (May 1 Fri — May 1–5, Apr 26 Sun makeup)
        "2026-04-26": "调休上班",
        "2026-05-01": "holiday",
        "2026-05-02": "调休放假",
        "2026-05-03": "调休放假",
        "2026-05-04": "调休放假",
        "2026-05-05": "调休放假",
        // 端午节 (Jun 19 Fri — Jun 19–21)
        "2026-06-19": "holiday",
        "2026-06-20": "holiday",
        "2026-06-21": "holiday",
        // 中秋节 (Sep 25 Fri — Sep 25–26；Sep 27 为国庆调休上班)
        "2026-09-25": "holiday",
        "2026-09-26": "holiday",
        // 国庆节 (Oct 1–7, Sep 27 Sun & Oct 10 Sat makeup)
        "2026-09-27": "调休上班",
        "2026-10-01": "holiday",
        "2026-10-02": "holiday",
        "2026-10-03": "holiday",
        "2026-10-04": "调休放假",
        "2026-10-05": "调休放假",
        "2026-10-06": "调休放假",
        "2026-10-07": "调休放假",
        "2026-10-10": "调休上班",
    }
    ,
    // 2027 官方调休表未内置：默认仅按周末 + 固定节日判断。
    // 若你拿到 2027 国务院放假安排，可在这里补全 "YYYY-MM-DD": "holiday" | "调休上班" | "调休放假"
    "2027": {}
};

// ============= JAPAN (JP) =============
const JP_FIXED_HOLIDAYS = [
    { name: "元日", nameEn: "New Year's Day", date: "01-01" },
    { name: "成人の日", nameEn: "Coming of Age Day", date: "01-13" }, // 2nd Mon Jan (approx)
    { name: "建国記念の日", nameEn: "National Foundation Day", date: "02-11" },
    { name: "天皇誕生日", nameEn: "Emperor's Birthday", date: "02-23" },
    { name: "春分の日", nameEn: "Vernal Equinox", date: "03-20" },
    { name: "昭和の日", nameEn: "Showa Day", date: "04-29" },
    { name: "憲法記念日", nameEn: "Constitution Memorial Day", date: "05-03" },
    { name: "みどりの日", nameEn: "Greenery Day", date: "05-04" },
    { name: "こどもの日", nameEn: "Children's Day", date: "05-05" },
    { name: "海の日", nameEn: "Marine Day", date: "07-20" }, // 3rd Mon Jul (approx)
    { name: "山の日", nameEn: "Mountain Day", date: "08-11" },
    { name: "敬老の日", nameEn: "Respect for the Aged Day", date: "09-15" }, // 3rd Mon Sep (approx)
    { name: "秋分の日", nameEn: "Autumnal Equinox", date: "09-23" },
    { name: "スポーツの日", nameEn: "Sports Day", date: "10-13" }, // 2nd Mon Oct (approx)
    { name: "文化の日", nameEn: "Culture Day", date: "11-03" },
    { name: "勤労感謝の日", nameEn: "Labor Thanksgiving Day", date: "11-23" },
];

// ============= KOREA (KR) =============
const KR_FIXED_HOLIDAYS = [
    { name: "신정 (新正)", nameEn: "New Year", date: "01-01" },
    { name: "삼일절 (三一節)", nameEn: "Independence Movement Day", date: "03-01" },
    { name: "어린이날", nameEn: "Children's Day", date: "05-05" },
    { name: "현충일 (顯忠日)", nameEn: "Memorial Day", date: "06-06" },
    { name: "광복절 (光復節)", nameEn: "Liberation Day", date: "08-15" },
    { name: "개천절 (開天節)", nameEn: "National Foundation Day", date: "10-03" },
    { name: "한글날", nameEn: "Hangul Day", date: "10-09" },
    { name: "성탄절", nameEn: "Christmas", date: "12-25" },
];

// ============= UNITED STATES (US) =============
const US_FIXED_HOLIDAYS = [
    { name: "New Year's Day", date: "01-01" },
    { name: "MLK Day", nameEn: "Martin Luther King Jr. Day", date: "01-20" }, // 3rd Mon (approx)
    { name: "Presidents' Day", date: "02-17" }, // 3rd Mon Feb (approx)
    { name: "Memorial Day", date: "05-26" }, // Last Mon May (approx)
    { name: "Independence Day", date: "07-04" },
    { name: "Labor Day", date: "09-01" }, // 1st Mon Sep (approx)
    { name: "Columbus Day", date: "10-13" }, // 2nd Mon Oct (approx)
    { name: "Veterans Day", date: "11-11" },
    { name: "Thanksgiving", date: "11-27" }, // 4th Thu Nov (approx)
    { name: "Christmas", date: "12-25" },
];

// ============= UNITED KINGDOM (UK) =============
const UK_FIXED_HOLIDAYS = [
    { name: "New Year's Day", date: "01-01" },
    { name: "Good Friday", date: "04-03" }, // Varies (approx 2026)
    { name: "Easter Monday", date: "04-06" }, // Varies
    { name: "Early May Bank Holiday", date: "05-04" }, // 1st Mon May
    { name: "Spring Bank Holiday", date: "05-25" }, // Last Mon May
    { name: "Summer Bank Holiday", date: "08-31" }, // Last Mon Aug
    { name: "Christmas Day", date: "12-25" },
    { name: "Boxing Day", date: "12-26" },
];

// ============= TAIWAN (TW) =============
const TW_FIXED_HOLIDAYS = [
    { name: "元旦 (開國紀念日)", nameEn: "New Year / Republic Day", date: "01-01" },
    { name: "228和平紀念日", nameEn: "Peace Memorial Day", date: "02-28" },
    { name: "兒童節", nameEn: "Children's Day", date: "04-04" },
    { name: "勞動節", nameEn: "Labor Day", date: "05-01" },
    { name: "國慶日", nameEn: "National Day", date: "10-10" },
];

// ============= HONG KONG (HK) =============
const HK_FIXED_HOLIDAYS = [
    { name: "元旦", nameEn: "New Year", date: "01-01" },
    { name: "農曆年初一", nameEn: "Lunar New Year Day 1", date: "02-17" }, // varies
    { name: "清明節", nameEn: "Ching Ming", date: "04-05" },
    { name: "勞動節", nameEn: "Labor Day", date: "05-01" },
    { name: "佛誕", nameEn: "Buddha's Birthday", date: "05-25" }, // varies
    { name: "端午節", nameEn: "Tuen Ng", date: "06-19" }, // varies
    { name: "香港特別行政區成立紀念日", nameEn: "HKSAR Day", date: "07-01" },
    { name: "中秋節翌日", nameEn: "Mid-Autumn Festival", date: "09-26" }, // varies
    { name: "重陽節", nameEn: "Chung Yeung", date: "10-18" }, // varies
    { name: "國慶日", nameEn: "National Day", date: "10-01" },
    { name: "聖誕節", nameEn: "Christmas", date: "12-25" },
    { name: "聖誕節翌日", nameEn: "Boxing Day", date: "12-26" },
];

const HOLIDAY_DB = {
    CN: CN_FIXED_HOLIDAYS,
    JP: JP_FIXED_HOLIDAYS,
    KR: KR_FIXED_HOLIDAYS,
    US: US_FIXED_HOLIDAYS,
    UK: UK_FIXED_HOLIDAYS,
    TW: TW_FIXED_HOLIDAYS,
    HK: HK_FIXED_HOLIDAYS,
};

const REGION_NAMES = {
    CN: "中国大陆",
    TW: "台湾",
    JP: "日本",
    KR: "韩国",
    US: "美国",
    UK: "英国",
    HK: "香港",
};

/**
 * Get holidays matching a specific date for a given region
 */
function getHolidaysForDate(date, region) {
    if (!region) return [];
    const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const holidays = HOLIDAY_DB[region] || [];
    return holidays.filter(h => h.date === mmdd).map(h => h.name + (h.nameEn ? ` (${h.nameEn})` : ""));
}

/**
 * Get the day type for China (accounts for 调休)
 */
function getChinaDayType(date) {
    const yyyy = date.getFullYear().toString();
    const dateStr = `${yyyy}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yearData = CN_SPECIAL_DAYS[yyyy];
    if (yearData && yearData[dateStr]) {
        return yearData[dateStr];
    }
    // 若未配置调休：至少按固定节日判定为 holiday
    const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (CN_FIXED_HOLIDAYS.some(h => h.date === mmdd)) {
        return "holiday";
    }
    // Default: weekday = workday, weekend = weekend
    const dow = date.getDay();
    return (dow === 0 || dow === 6) ? "weekend" : "workday";
}

/**
 * Get the day type for any region (simplified — only CN has 调休 logic)
 */
function getDayType(date, region) {
    if (region === "CN") return getChinaDayType(date);
    // For other regions, just weekend detection
    const dow = date.getDay();
    const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const holidays = HOLIDAY_DB[region] || [];
    const isHoliday = holidays.some(h => h.date === mmdd);
    if (isHoliday) return "holiday";
    return (dow === 0 || dow === 6) ? "weekend" : "workday";
}

/**
 * Get upcoming holidays within the next N days
 */
function getUpcomingHolidays(date, region, daysAhead = 7) {
    if (!region) return [];
    const holidays = HOLIDAY_DB[region] || [];
    const results = [];
    
    for (let i = 1; i <= daysAhead; i++) {
        const futureDate = new Date(date);
        futureDate.setDate(futureDate.getDate() + i);
        const mmdd = `${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
        const matching = holidays.filter(h => h.date === mmdd);
        for (const h of matching) {
            results.push({ name: h.name, daysUntil: i });
        }
    }
    return results;
}

/**
 * For China: get the number of consecutive days off remaining from today
 */
function getChinaHolidayStreak(date) {
    let count = 0;
    const check = new Date(date);
    for (let i = 0; i < 14; i++) {
        const dt = getChinaDayType(check);
        if (dt === "holiday" || dt === "调休放假" || dt === "weekend") {
            count++;
            check.setDate(check.getDate() + 1);
        } else {
            break;
        }
    }
    return count;
}

/**
 * Build a comprehensive time-awareness context string for the AI
 */
function buildRegionTimeContext(date, region) {
    if (!region) return "";
    
    const regionName = REGION_NAMES[region] || region;
    const dayType = getDayType(date, region);
    const todayHolidays = getHolidaysForDate(date, region);
    const upcoming = getUpcomingHolidays(date, region, 7);
    const dow = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
    
    let dayTypeStr = "";
    switch (dayType) {
        case "workday": dayTypeStr = "工作日"; break;
        case "weekend": dayTypeStr = "周末"; break;
        case "holiday": dayTypeStr = "法定假日"; break;
        case "调休上班": dayTypeStr = "调休上班日（虽然是周末但要上班/上学）"; break;
        case "调休放假": dayTypeStr = "调休放假（虽然是工作日但放假）"; break;
    }
    
    let ctx = `\n- User Region: ${regionName}\n- Day of Week: 星期${dow}\n- Day Type: ${dayTypeStr}`;
    
    if (todayHolidays.length > 0) {
        ctx += `\n- Today's Holiday(s): ${todayHolidays.join(", ")}`;
    }
    
    if (upcoming.length > 0) {
        const upcomingStr = upcoming.slice(0, 3).map(u => `${u.name}(${u.daysUntil}天后)`).join(", ");
        ctx += `\n- Upcoming: ${upcomingStr}`;
    }
    
    // China-specific: holiday streak info
    if (region === "CN") {
        const streak = getChinaHolidayStreak(date);
        if (streak >= 3) {
            ctx += `\n- Holiday Streak: 从今天开始连休${streak}天`;
        }
        // Check if tomorrow is 调休上班
        const tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowType = getChinaDayType(tomorrow);
        if (tomorrowType === "调休上班") {
            ctx += `\n- WARNING: 明天是调休上班日！`;
        }
    }
    
    ctx += `\n- INSTRUCTION: Use the user's region, day type, and holidays to enrich your responses naturally. If it's a holiday, celebrate; if it's 调休上班, empathize with the user having to work on a weekend; if a holiday is approaching, mention anticipation.`;
    
    return ctx;
}

const REGION_OPTIONS = [
  { value: "CN", label: "中国大陆" },
  { value: "TW", label: "台湾" },
  { value: "HK", label: "香港" },
  { value: "JP", label: "日本" },
  { value: "KR", label: "韩国" },
  { value: "US", label: "美国" },
  { value: "UK", label: "英国" },
  { value: "", label: "不设定" }
];

window.XXJ_HOLIDAYS = {
  buildRegionTimeContext,
  REGION_OPTIONS
};
