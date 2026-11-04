const sharp = require("sharp");
const { createWorker, PSM } = require("tesseract.js");

const MAX_IMAGE_PIXELS = 40000000;

const normalizeText = (text) =>
  String(text || "")
    .replace(/[|]/g, " ")
    .replace(/[â‚¹]/g, " Rs ")
    .replace(/[^\w\s./:@&'#+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanLines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const preprocessReceiptVariants = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Receipt image is missing or empty.");
  }

  const image = sharp(buffer, {
    limitInputPixels: MAX_IMAGE_PIXELS
  });

  const metadata = await image.metadata();

  if (
    !metadata.width ||
    !metadata.height ||
    !["jpeg", "png", "webp", "tiff"].includes(metadata.format)
  ) {
    throw new Error("Unsupported or invalid receipt image.");
  }

  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new Error("Receipt image dimensions are too large.");
  }

  // Create independent pipelines from the original image.
  const base = sharp(buffer, {
    limitInputPixels: MAX_IMAGE_PIXELS
  })
    .rotate()
    .flatten({ background: "#ffffff" })
    .grayscale()
    .normalize()
    .resize({
      width: 2400,
      withoutEnlargement: true
    });

  const normal = await base
    .clone()
    .sharpen()
    .png()
    .toBuffer();

  // A high-contrast version may help with faint or uneven printing.
  const highContrast = await base
    .clone()
    .linear(1.35, -25)
    .sharpen()
    .png()
    .toBuffer();

  return [
    { name: "normal", buffer: normal },
    { name: "high-contrast", buffer: highContrast }
  ];
};

const isValidDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const formatDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const extractDate = (text) => {
  const value = String(text || "");

  // Prefer dates appearing on lines explicitly labelled as invoice/transaction dates.
  const lines = cleanLines(value);
  const labelledLines = lines.filter((line) =>
    /\b(invoice\s*date|bill\s*date|transaction\s*date|receipt\s*date|date)\b/i.test(line)
  );

  const searchText = [...labelledLines, ...lines].join("\n");

  // ISO: YYYY-MM-DD or YYYY/MM/DD.
  const isoRegex = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  let match;

  while ((match = isoRegex.exec(searchText)) !== null) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (isValidDate(year, month, day)) {
      return {
        value: formatDate(year, month, day),
        ambiguous: false
      };
    }
  }

  // Numeric dates. Indian DD/MM/YYYY convention is used when both
  // the day and month are <= 12, but that case is flagged as ambiguous.
  const numericRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/g;

  while ((match = numericRegex.exec(searchText)) !== null) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);

    let day;
    let month;
    let ambiguous = false;

    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      day = second;
      month = first;
    } else if (first <= 12 && second <= 12) {
      day = first;
      month = second;
      ambiguous = true;
    } else {
      continue;
    }

    if (isValidDate(year, month, day)) {
      return {
        value: formatDate(year, month, day),
        ambiguous
      };
    }
  }

  const monthMap = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  const monthNames =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

  // Support named dates with two-digit or four-digit years.
  // Examples: 23-Oct-26, 23 October 2026, Oct 23, 2026.
  const yearPattern = "(\\d{2}|\\d{4})";

  const namedPatterns = [
    // Day-Month-Year: 23-Oct-26, 23 October 2026
    new RegExp(
      `\\b(\\d{1,2})[\\s./-]+(${monthNames})[\\s,./-]+${yearPattern}\\b`,
      "gi"
    ),

    // Month-Day-Year: Oct 23, 2026, October 23 26
    new RegExp(
      `\\b(${monthNames})[\\s./-]+(\\d{1,2}),?[\\s,./-]+${yearPattern}\\b`,
      "gi"
    )
  ];

  for (let i = 0; i < namedPatterns.length; i++) {
    while ((match = namedPatterns[i].exec(searchText)) !== null) {
      let day;
      let month;
      let year;

      if (i === 0) {
        day = Number(match[1]);
        month = monthMap[match[2].toLowerCase()];
        year = Number(match[3]);
      } else {
        month = monthMap[match[1].toLowerCase()];
        day = Number(match[2]);
        year = Number(match[3]);
      }

      // Interpret two-digit years consistently.
      if (year < 100) {
        year += year <= 49 ? 2000 : 1900;
      }

      if (month && isValidDate(year, month, day)) {
        return {
          value: formatDate(year, month, day),
          ambiguous: false
        };
      }
    }
  }

  return {
    value: null,
    ambiguous: false
  };
};

const extractTime = (text) => {
  const lines = cleanLines(text);

  // Prefer lines containing an explicit date/time label.
  const labelledLines = lines.filter((line) =>
    /\b(time|transaction time|invoice time|receipt time|date)\b/i.test(line)
  );

  const candidates = [];

  for (let i = 0; i < lines.length; i++) {
    candidates.push(lines[i]);

    // Join nearby lines to recover a time split by OCR.
    if (i + 1 < lines.length) {
      candidates.push(lines[i] + " " + lines[i + 1]);
    }

    if (i + 2 < lines.length) {
      candidates.push(
        lines[i] + " " + lines[i + 1] + " " + lines[i + 2]
      );
    }
  }

  const orderedCandidates = [
    ...labelledLines,
    ...candidates
  ];

  for (const line of orderedCandidates) {
    // Standard time: 02:26 PM, 14:26, or 02:26:30 PM.
    let match = line.match(
      /\b(0?[1-9]|1[0-2]|2[0-3])\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(AM|PM)?\b/i
    );

    // OCR sometimes replaces the colon with a space or degree symbol.
    if (!match) {
      match = line.match(
        /\b(0?[1-9]|1[0-2])\s+([0-5]\d)\s*[°ºo]?\s*(AM|PM)\b/i
      );

      if (match) {
        const hour = Number(match[1]);
        const minute = match[2];
        const meridiem = match[3].toUpperCase();

        const normalizedHour =
          meridiem === "PM" && hour < 12
            ? hour + 12
            : meridiem === "AM" && hour === 12
              ? 0
              : hour;

        return (
          String(normalizedHour).padStart(2, "0") +
          ":" + minute + ":00"
        );
      }
    }

    if (!match) continue;

    let hour = Number(match[1]);
    const minute = match[2];
    const second = match[3] || "00";
    const meridiem = match[4]?.toUpperCase();

    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    return (
      String(hour).padStart(2, "0") +
      ":" + minute + ":" + second
    );
  }

  return null;
};

const extractAmountsFromLine = (line) => {
  const value = String(line || "");

  const regex =
    /(?:\u20B9|INR\b|Rs\.?\s*)\s*\d[\d,]*(?:\s*\.\s*\d{1,2})?(?![A-Za-z])|\b\d{1,3}(?:,\d{3})+(?:\s*\.\s*\d{1,2})?(?![A-Za-z])|\b\d{1,7}\s*\.\s*\d{1,2}(?![A-Za-z])|\b\d{1,7}(?![A-Za-z0-9])/gi;

  const results = [];
  let match;

  while ((match = regex.exec(value)) !== null) {
    const raw = match[0];

    const amountText = raw
      .replace(/(?:\u20B9|INR|Rs\.?)/gi, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .trim();

    const amount = Number(amountText);

    if (
      Number.isFinite(amount) &&
      amount > 0 &&
      amount <= 100000000
    ) {
      results.push({
        amount: Math.round(amount * 100) / 100,
        index: match.index,
        raw
      });
    }
  }

  return results;
};

const TOTAL_LABEL =
  /\bgrand\s*t\s*[o0]?\s*t\s*[o0]?\s*a?\s*l?\b|\b(total\s*payable|amount\s*payable|net\s*amount|total\s*due|invoice\s*total|bill\s*total|total\s*amount|total)\b/i;

const EXCLUDED_TOTAL_LABEL =
  /\b(subtotal|tax\s*total|gst\s*total|vat\s*total|total\s*discount|total\s*tax|previous\s*balance|total\s*items)\b/i;

const isPaymentLine = (line) =>
  /\b(received|paid|payment|cash\s*tendered|change|refund|balance\s*due|amount\s*due|outstanding|credit|debit)\b/i.test(line);

const extractAmountDetails = (text) => {
  const lines = cleanLines(text);
  const candidates = [];
  const warnings = [];

  const paymentValues = {
    received: [],
    due: []
  };

  const totalPattern =
    /\b(grand\s*t[o0]?\s*t[a4]?\s*l?|total\s*payable|amount\s*payable|net\s*amount|invoice\s*total|bill\s*total|total\s*amount|total\s*due|total)\b/i;

  const excludedPattern =
    /\b(subtotal|tax\s*total|gst\s*total|vat\s*total|total\s*discount|total\s*tax|previous\s*balance|total\s*items|discount|disc(?:ount)?|dis|savings|mrp|maximum\s*retail\s*price|tax\s*details?)\b/i;

  const paymentPattern =
    /\b(amount\s*paid|paid\s*amount|payment\s*received|received\s*amount|amount\s*received|cash\s*received|cash\s*tendered|change|refund|balance\s*due|due\s*balance|outstanding|credit|debit)\b/i;

  const priorityFor = (line) => {
    if (/\bgrand\s*t[o0]?\s*t[a4]?\s*l?\b/i.test(line)) return 7;
    if (/\b(total\s*payable|amount\s*payable)\b/i.test(line)) return 6;
    if (/\b(invoice\s*total|bill\s*total|net\s*amount)\b/i.test(line)) return 5;
    if (/\b(total\s*amount)\b/i.test(line)) return 4;
    if (/\b(total\s*due)\b/i.test(line)) return 3;
    return 2;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const amounts = extractAmountsFromLine(line);

    if (/\b(received\s*amount|amount\s*received|amount\s*paid|paid\s*amount|cash\s*received)\b/i.test(line)) {
      paymentValues.received.push(...amounts.map((item) => item.amount));
    }

    if (/\b(due\s*balance|balance\s*due|outstanding\s*balance|amount\s*due)\b/i.test(line)) {
      paymentValues.due.push(...amounts.map((item) => item.amount));
    }

    if (
      !totalPattern.test(line) ||
      excludedPattern.test(line) ||
      paymentPattern.test(line)
    ) {
      continue;
    }

    let chosen = amounts.length
      ? amounts[amounts.length - 1]
      : null;

    // If the total label has no valid amount on the same line,
    // look ahead only until another financial label is encountered.
    if (!chosen) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j];

        if (
          totalPattern.test(nextLine) ||
          excludedPattern.test(nextLine) ||
          paymentPattern.test(nextLine) ||
          /\b(discount|savings|mrp|tax|gst|cgst|sgst|igst|round\s*off)\b/i.test(nextLine)
        ) {
          break;
        }

        const nextAmounts = extractAmountsFromLine(nextLine);

        if (nextAmounts.length > 0) {
          chosen = nextAmounts[nextAmounts.length - 1];
          break;
        }
      }
    }

    if (chosen) {
      candidates.push({
        amount: chosen.amount,
        priority: priorityFor(line),
        lineIndex: i,
        source: line
      });
    }
  }

  if (candidates.length === 0) {
    return {
      amount: null,
      warnings: [
        "Could not reliably identify a labelled final total."
      ],
      candidates: [],
      paymentValues
    };
  }

  candidates.sort(
    (a, b) => b.priority - a.priority || a.lineIndex - b.lineIndex
  );

  const bestPriority = candidates[0].priority;
  const bestCandidates = candidates.filter(
    (item) => item.priority === bestPriority
  );

  const distinctAmounts = [
    ...new Set(bestCandidates.map((item) => item.amount))
  ];

  if (distinctAmounts.length > 1) {
    warnings.push(
      "Different amounts appear on equally prioritised total lines. Verify the final total manually."
    );
  }

  const amount = candidates[0].amount;
  const received = paymentValues.received[0];
  const due = paymentValues.due[0];

  if (
    received !== undefined &&
    due !== undefined &&
    Math.abs(received + due - amount) > 0.01
  ) {
    warnings.push(
      "Received amount and due balance do not reconcile with the extracted total. Verify manually."
    );
  }

  return {
    amount,
    warnings,
    candidates,
    paymentValues
  };
};

const extractCategory = (text, merchant = null) => {
  const merchantText = normalizeText(merchant || "").toLowerCase();
  const value = normalizeText(
    String(text || "")
  ).toLowerCase();

  // Merchant-specific clues are stronger than incidental OCR text.
  if (
    /\b(rice|grocery|groceries|supermarket|provision store|vegetable|fruit|food|bakery|restaurant|cafe|canteen|dairy|milk products)\b/i.test(merchantText)
  ) {
    return "Food";
  }

  if (
    /\b(hospital|clinic|pharmacy|medical store|diagnostic centre|diagnostic center)\b/i.test(merchantText)
  ) {
    return "Healthcare";
  }

  if (
    /\b(petrol bunk|fuel station|travel agency|taxi service|transport service)\b/i.test(merchantText)
  ) {
    return "Travel";
  }

  const categories = [
    {
      category: "Healthcare",
      keywords: [
        "hospital", "clinic", "pharmacy", "medicine",
        "medical store", "doctor", "diagnostic", "healthcare"
      ]
    },
    {
      category: "Food",
      keywords: [
        "restaurant", "cafe", "coffee", "grocery",
        "supermarket", "bakery", "pizza", "food",
        "swiggy", "zomato", "dominos", "mcdonald",
        "kfc", "canteen", "fruit", "fruits", "vegetable",
        "vegetables", "produce", "milk", "bread", "rice",
        "provision store", "rice traders"
      ]
    },
    {
      category: "Travel",
      keywords: [
        "uber", "ola", "rapido", "taxi", "petrol",
        "diesel", "fuel", "bus ticket", "train ticket",
        "flight", "parking", "metro", "transport"
      ]
    },
    {
      category: "Shopping",
      keywords: [
        "clothing", "shirt", "shoes", "shopping",
        "fashion", "electronics", "department store",
        "mall", "amazon", "flipkart"
      ]
    },
    {
      category: "Bills",
      keywords: [
        "electricity bill", "water bill", "internet bill",
        "gas bill", "utility bill", "mobile recharge",
        "broadband", "telephone bill"
      ]
    },
    {
      category: "Education",
      keywords: [
        "tuition", "school fee", "college fee",
        "university", "textbook", "course fee",
        "stationery", "bookstore"
      ]
    }
  ];

  for (const entry of categories) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.category;
    }
  }

  return "Other";
};

const calculateConfidence = (
  blockConfidence,
  sparseConfidence,
  receipt
) => {
  const scores = [
    Number(blockConfidence),
    Number(sparseConfidence)
  ].filter(
    (value) => Number.isFinite(value) && value >= 0 && value <= 100
  );

  const ocrConfidence = scores.length
    ? scores.reduce((sum, value) => sum + value, 0) / scores.length
    : 0;

  const fieldScore =
    (receipt.merchant ? 15 : 0) +
    (receipt.amount !== null ? 45 : 0) +
    (receipt.date ? 15 : 0) +
    (receipt.time ? 5 : 0) +
    (receipt.category !== "Other" ? 10 : 0) +
    (receipt.warnings.length === 0 ? 10 : 0);

  return Math.round(
    Math.max(
      0,
      Math.min(100, ocrConfidence * 0.65 + fieldScore * 0.35)
    )
  );
};


const normalizeMerchantForMatch = (text) =>
  normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const merchantSimilarity = (first, second) => {
  const a = normalizeMerchantForMatch(first);
  const b = normalizeMerchantForMatch(second);

  if (!a || !b) return 0;
  if (a === b) return 1;

  // Compare token similarity as well as complete-name similarity.
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);

  const tokenScore = (tokens, otherTokens) => {
    if (!tokens.length) return 0;

    let total = 0;

    for (const token of tokens) {
      let best = 0;

      for (const other of otherTokens) {
        if (token === other) {
          best = 1;
          break;
        }

        const longest = Math.max(token.length, other.length);

        if (longest < 4) continue;

        // Levenshtein distance, allowing minor OCR spelling errors.
        let previous = Array.from(
          { length: other.length + 1 },
          (_, index) => index
        );

        for (let i = 1; i <= token.length; i++) {
          const current = [i];

          for (let j = 1; j <= other.length; j++) {
            current[j] = Math.min(
              current[j - 1] + 1,
              previous[j] + 1,
              previous[j - 1] +
                (token[i - 1] === other[j - 1] ? 0 : 1)
            );
          }

          previous = current;
        }

        const similarity =
          1 - previous[other.length] / longest;

        best = Math.max(best, similarity);
      }

      total += best;
    }

    return total / tokens.length;
  };

  const tokenAgreement =
    (
      tokenScore(tokensA, tokensB) +
      tokenScore(tokensB, tokensA)
    ) / 2;

  return tokenAgreement;
};

const extractMerchantCandidates = (text) => {
  const lines = cleanLines(text);
  const candidates = [];

  const businessSuffix =
    /\b(enterprises?|traders?|trading|industries|stores?|restaurant|foods?|pharmacy|medical|mart|retail|services|solutions|limited|ltd|pvt|private|corporation|company)\b/i;

  const addressPattern =
    /\b(road|cross road|street|colony|nagar|pincode|pin code|near|address|phone|mobile|branch|gstin|state code)\b/i;

  const invalidPattern =
    /\b(tax invoice|cash receipt|sales receipt|receipt no|invoice no|bill to|ship to|gstin|pan number|phone|place of supply|invoice date|subtotal|grand total|total payable|discount|received amount|due balance|authorised signatory|authorized signatory|terms and conditions)\b/i;

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const original = normalizeText(lines[i]);
    const value = normalizeMerchantForMatch(original);

    const letters = (value.match(/[a-z]/g) || []).length;
    const digits = (value.match(/\d/g) || []).length;

    if (value.length < 4 || value.length > 100) continue;
    if (letters < 4 || digits > letters) continue;
    if (invalidPattern.test(value)) continue;
    if (/^(https?:\/\/|www\.)/i.test(value)) continue;

    let score = Math.max(0, 30 - i);

    if (businessSuffix.test(value)) {
      score += 25;
    }

    if (addressPattern.test(value)) {
      score -= 25;
    }

    // Penalize lines that look like numeric invoice details.
    if (/\b\d{5,}\b/.test(value)) {
      score -= 15;
    }

    candidates.push({
      candidate: original,
      score,
      index: i
    });
  }

  return candidates;
};

const extractMerchant = (text) => {
  const candidates = extractMerchantCandidates(text);

  candidates.sort(
    (a, b) => b.score - a.score || a.index - b.index
  );

  return candidates[0]?.candidate || null;
};


const selectMerchantFromOcrRuns = (ocrRuns) => {
  const candidates = [];

  // Collect merchant candidates independently from every OCR run.
  for (const run of ocrRuns) {
    for (const mode of ["auto", "sparse"]) {
      const text = run[mode + "Text"] || "";
      const confidence = Number(run[mode + "Confidence"]) || 0;
      const lines = cleanLines(text);

      for (const item of extractMerchantCandidates(text)) {
        candidates.push({
          candidate: item.candidate,
          normalized: normalizeMerchantForMatch(item.candidate),
          baseScore:
            item.score +
            Math.max(0, Math.min(100, confidence)) * 0.08,
          runName: run.name + "/" + mode,
          index: item.index
        });
      }

      // OCR sometimes splits a shop name over adjacent lines.
      // Test adjacent lines near the beginning, where merchant names
      // usually appear. Do not join addresses or long invoice sections.
      for (let i = 0; i < Math.min(lines.length - 1, 12); i++) {
        const first = normalizeText(lines[i]);
        const second = normalizeText(lines[i + 1]);

        if (!first || !second) continue;
        if (first.length > 45 || second.length > 45) continue;
        if (/\d{5,}/.test(first + " " + second)) continue;

        const joined = first + " " + second;
        const normalized = normalizeMerchantForMatch(joined);

        if (
          normalized.length < 7 ||
          normalized.length > 90 ||
          !/[a-z]{4}/i.test(normalized) ||
          /\b(address|invoice date|grand total|subtotal|gstin|phone|mobile)\b/i.test(joined)
        ) {
          continue;
        }

        const suffix =
          /\b(limited|ltd|private|pvt|traders|trading|stores|store|enterprises|enterprise|industries|industry|mart|supermarket|restaurant|hotel|foods|food|agency|agencies|medical|pharmacy|retailers|retailer|provisions|provision)\b/i.test(joined);

        // Only retain a joined candidate when it resembles a plausible
        // business name, rather than arbitrary neighboring OCR text.
        if (!suffix) continue;

        candidates.push({
          candidate: joined,
          normalized,
          baseScore: Math.max(0, 27 - i) +
            Math.max(0, Math.min(100, confidence)) * 0.08 -
            5,
          runName: run.name + "/" + mode,
          index: i
        });
      }
    }
  }

  if (!candidates.length) return null;

  const similarity = (a, b) =>
    merchantSimilarity(a, b);

  // Score consensus once per independent OCR output, rather than
  // rewarding repeated candidates within the same output.
  for (const candidate of candidates) {
    const bestPerRun = new Map();

    for (const other of candidates) {
      if (candidate.runName === other.runName) continue;

      const score = similarity(
        candidate.candidate,
        other.candidate
      );

      const previous = bestPerRun.get(other.runName) || 0;

      if (score > previous) {
        bestPerRun.set(other.runName, score);
      }
    }

    let agreementScore = 0;
    let supportingRuns = 0;

    for (const score of bestPerRun.values()) {
      if (score >= 0.45) {
        agreementScore += score;
        supportingRuns++;
      }
    }

    const tokens = candidate.normalized
      .split(/\s+/)
      .filter((token) => token.length >= 4);

    let unsupportedTokens = 0;

    for (const token of tokens) {
      let supported = false;

      for (const other of candidates) {
        if (other.runName === candidate.runName) continue;

        const otherTokens = other.normalized
          .split(/\s+/)
          .filter(Boolean);

        if (
          otherTokens.some(
            (otherToken) => similarity(token, otherToken) >= 0.65
          )
        ) {
          supported = true;
          break;
        }
      }

      if (!supported) unsupportedTokens++;
    }

    const businessSuffix =
      /\b(traders|trading|stores|store|enterprises|enterprise|industries|industry|mart|supermarket|restaurant|hotel|foods|food|agency|agencies|medical|pharmacy|retailers|retailer|provisions|provision|limited|ltd|pvt|private)\b/i
        .test(candidate.candidate);

    // Slightly penalize extra words that may be OCR artifacts.
    // This is a tie-breaker, not a rule that merchant names must be short.
    const extraWordPenalty = Math.max(0, tokens.length - 3) * 4;

    candidate.finalScore =
      candidate.baseScore +
      Math.min(30, agreementScore * 5) +
      Math.min(12, supportingRuns * 3) -
      Math.min(15, unsupportedTokens * 3) +
      (businessSuffix ? 5 : 0) -
      extraWordPenalty;
  }

  candidates.sort(
    (a, b) =>
      b.finalScore - a.finalScore ||
      a.index - b.index
  );

  return candidates[0]?.candidate || null;
};

const calculateMerchantAgreement = (ocrRuns, merchant) => {
  if (!merchant || !ocrRuns.length) return 0;

  const similarities = [];

  for (const run of ocrRuns) {
    for (const mode of ["auto", "sparse"]) {
      const text = run[mode + "Text"] || "";
      const candidate = extractMerchant(text);

      if (candidate) {
        similarities.push(
          merchantSimilarity(merchant, candidate)
        );
      }
    }
  }

  if (!similarities.length) return 0;

  return similarities.reduce(
    (sum, value) => sum + value,
    0
  ) / similarities.length;
};

const analyzeReceipt = async (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Receipt image is missing or invalid.");
  }

  const imageVariants = await preprocessReceiptVariants(file.buffer);
  let worker;

  try {
    worker = await createWorker("eng");

    const ocrRuns = [];

    for (const variant of imageVariants) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO
      });

      const autoResult = await worker.recognize(variant.buffer);
      const autoText = String(autoResult.data.text || "").trim();

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT
      });

      const sparseResult = await worker.recognize(variant.buffer);
      const sparseText = String(sparseResult.data.text || "").trim();

      ocrRuns.push({
        name: variant.name,
        autoText,
        sparseText,
        autoConfidence: autoResult.data.confidence,
        sparseConfidence: sparseResult.data.confidence
      });
    }

    const combinedText = ocrRuns
      .map((run) =>
        "===== " + run.name.toUpperCase() + " / AUTO =====\n" +
        run.autoText +
        "\n===== " + run.name.toUpperCase() + " / SPARSE TEXT =====\n" +
        run.sparseText
      )
      .filter(Boolean)
      .join("\n");

    if (!combinedText.trim()) {
      return {
        merchant: null,
        amount: null,
        date: null,
        time: null,
        category: "Other",
        confidence: 0,
        needsReview: true,
        warnings: ["No readable text was detected."],
        rawText: "",
        message: "No readable text found. Try a clearer receipt image."
      };
    }

    // Prefer the OCR run that identifies a labelled total.
    // The same amount appearing in multiple OCR runs is not added together.
    const amountResults = [];

    for (const run of ocrRuns) {
      const autoAmounts = extractAmountDetails(run.autoText);
      const sparseAmounts = extractAmountDetails(run.sparseText);

      if (autoAmounts.amount !== null) {
        amountResults.push({
          ...autoAmounts,
          ocrMode: run.name + "/auto",
          confidence: Number(run.autoConfidence) || 0
        });
      }

      if (sparseAmounts.amount !== null) {
        amountResults.push({
          ...sparseAmounts,
          ocrMode: run.name + "/sparse",
          confidence: Number(run.sparseConfidence) || 0
        });
      }
    }

    amountResults.sort((a, b) => {
      const priority = (item) => {
        const line = item.candidates?.[0]?.source || "";

        // OCR may insert spaces or confuse characters in "Grand Total".
        const compact = line
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .replace(/0/g, "o");

        if (
          /\bgrand\s*total\b/i.test(line) ||
          compact.includes("grandtotal") ||
          compact.includes("grantdotal")
        ) return 7;

        if (/\b(total\s*payable|amount\s*payable)\b/i.test(line)) return 6;
        if (/\b(invoice\s*total|bill\s*total|net\s*amount)\b/i.test(line)) return 5;
        if (/\b(total\s*amount)\b/i.test(line)) return 4;
        if (/\b(total\s*due)\b/i.test(line)) return 3;
        return 2;
      };

      return priority(b) - priority(a) ||
        b.confidence - a.confidence;
    });

    const selectedAmount = amountResults[0] || null;
    const amount = selectedAmount ? selectedAmount.amount : null;

    // Use the most legible auto result as the primary source for merchant,
    // date and time extraction. Combined OCR text remains a fallback.
    const bestRun = [...ocrRuns].sort(
      (a, b) => (Number(b.autoConfidence) || 0) -
                (Number(a.autoConfidence) || 0)
    )[0];

    const primaryText = bestRun?.autoText || combinedText;
    const dateResult = extractDate(combinedText);
    const merchant = selectMerchantFromOcrRuns(ocrRuns);
    const merchantAgreement = calculateMerchantAgreement(
      ocrRuns,
      merchant
    );

    const time = extractTime(combinedText);
    const category = extractCategory(combinedText, merchant);

    const warnings = [];

    if (selectedAmount) {
      warnings.push(...selectedAmount.warnings);
    } else {
      warnings.push("Could not reliably identify a labelled final total.");
      warnings.push("Final total was not identified reliably.");
    }

    if (!merchant) {
      warnings.push("Merchant name could not be identified reliably.");
    }

    if (merchant && merchantAgreement < 0.72) {
      warnings.push(
        "Merchant name differs across OCR results. Verify the merchant before saving."
      );
    }

    if (!dateResult.value) {
      warnings.push("Invoice date was not detected.");
    }

    if (dateResult.ambiguous) {
      warnings.push(
        "The numeric date may be interpreted differently in different date formats. Verify it manually."
      );
    }

    if (category === "Other") {
      warnings.push(
        "Category could not be confidently classified. Select the correct category manually."
      );
    }

    const uniqueWarnings = [...new Set(warnings)];

    const receipt = {
      merchant,
      amount,
      date: dateResult.value,
      time,
      category,
      warnings: uniqueWarnings
    };


    const confidenceValues = ocrRuns
      .flatMap((run) => [
        Number(run.autoConfidence),
        Number(run.sparseConfidence)
      ])
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 100
      );

    const averageOcrConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) /
        confidenceValues.length
      : 0;

    // Check how consistently the OCR runs identify the selected merchant.
    const merchantAgreementScore = Math.max(
      0,
      Math.min(100, merchantAgreement * 100)
    );

    // Check whether different OCR runs agree on the final amount.
    const amountValues = amountResults.map(
      (item) => Number(item.amount)
    );

    const amountAgreementScore = amountValues.length
      ? (
          amountValues.filter(
            (value) => value === Number(amount)
          ).length / amountValues.length
        ) * 100
      : 0;

    // Heuristic reliability score:
    // OCR engine confidence contributes 60%.
    // Merchant agreement contributes 20%.
    // Amount agreement contributes 20%.
    // Field presence alone does not increase confidence.
    const confidence = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          averageOcrConfidence * 0.60 +
          merchantAgreementScore * 0.20 +
          amountAgreementScore * 0.20
        )
      )
    );

    const confidenceThreshold = 85;
    const needsReview =
      uniqueWarnings.length > 0 ||
      confidence < confidenceThreshold;

    const finalWarnings = [...uniqueWarnings];

    if (confidence < confidenceThreshold) {
      finalWarnings.push(
        "OCR confidence is " + confidence +
        "%. Verify the extracted fields before saving."
      );
    }

    return {
      ...receipt,
      warnings: [...new Set(finalWarnings)],
      confidence,
      needsReview,
      rawText: combinedText,
      message: needsReview
        ? "Receipt analyzed. Verify the flagged fields before saving."
        : "Receipt analyzed successfully."
    };
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
};

module.exports = {
  analyzeReceipt
};
