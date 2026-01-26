import type {
  BaseInfo,
  BaseResume,
  WorkExperience,
  EducationEntry,
  TailorResumeResponse,
  BulletAugmentation,
  CompanyBulletMap,
} from "@/app/workspace/types";

export function cleanString(val?: string | number | null) {
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val.trim();
  return "";
}

export function formatPhone(contact?: BaseInfo["contact"]) {
  if (!contact) return "";
  const parts = [contact.phoneCode, contact.phoneNumber].map((p) => cleanString(p)).filter(Boolean);
  const combined = parts.join(" ").trim();
  const fallback = cleanString(contact.phone);
  return combined || fallback;
}

export function cleanBaseInfo(base: BaseInfo): BaseInfo {
  const links = { ...(base?.links ?? {}) } as Record<string, string> & { linkedin?: string };
  if (typeof links.linkedin === "string") links.linkedin = links.linkedin.trim();
  return {
    name: { first: cleanString(base?.name?.first), last: cleanString(base?.name?.last) },
    contact: {
      email: cleanString(base?.contact?.email),
      phone: formatPhone(base?.contact),
      phoneCode: cleanString(base?.contact?.phoneCode),
      phoneNumber: cleanString(base?.contact?.phoneNumber),
      password: cleanString(base?.contact?.password),
    },
    links,
    location: {
      address: cleanString(base?.location?.address),
      city: cleanString(base?.location?.city),
      state: cleanString(base?.location?.state),
      country: cleanString(base?.location?.country),
      postalCode: cleanString(base?.location?.postalCode),
    },
    career: {
      jobTitle: cleanString(base?.career?.jobTitle),
      currentCompany: cleanString(base?.career?.currentCompany),
      yearsExp: cleanString(base?.career?.yearsExp as string | number | undefined),
      desiredSalary: cleanString(base?.career?.desiredSalary),
    },
    education: {
      school: cleanString(base?.education?.school),
      degree: cleanString(base?.education?.degree),
      majorField: cleanString(base?.education?.majorField),
      graduationAt: cleanString(base?.education?.graduationAt),
    },
    workAuth: {
      authorized: base?.workAuth?.authorized ?? false,
      needsSponsorship: base?.workAuth?.needsSponsorship ?? false,
    },
    preferences: base?.preferences ?? {},
    defaultAnswers: base?.defaultAnswers ?? {},
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return Object.prototype.toString.call(value) === "[object Object]";
}

function getEmptyWorkExperience(): WorkExperience {
  return {
    companyTitle: "",
    roleTitle: "",
    employmentType: "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: [""],
  };
}

function getEmptyEducation(): EducationEntry {
  return {
    institution: "",
    degree: "",
    field: "",
    date: "",
    coursework: [""],
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [""];
  const cleaned = value.map((item) => cleanString(item as string | number | null));
  return cleaned.length ? cleaned : [""];
}

function normalizeWorkExperience(value: unknown): WorkExperience {
  const source = isPlainObject(value) ? value : {};
  return {
    companyTitle: cleanString(source.companyTitle as string | number | null),
    roleTitle: cleanString(source.roleTitle as string | number | null),
    employmentType: cleanString(source.employmentType as string | number | null),
    location: cleanString(source.location as string | number | null),
    startDate: cleanString(source.startDate as string | number | null),
    endDate: cleanString(source.endDate as string | number | null),
    bullets: normalizeStringList(source.bullets),
  };
}

function normalizeEducation(value: unknown): EducationEntry {
  const source = isPlainObject(value) ? value : {};
  return {
    institution: cleanString(source.institution as string | number | null),
    degree: cleanString(source.degree as string | number | null),
    field: cleanString(source.field as string | number | null),
    date: cleanString(source.date as string | number | null),
    coursework: normalizeStringList(source.coursework),
  };
}

function getEmptyBaseResume(): BaseResume {
  return {
    Profile: {
      name: "",
      headline: "",
      contact: {
        location: "",
        email: "",
        phone: "",
        linkedin: "",
      },
    },
    summary: { text: "" },
    workExperience: [getEmptyWorkExperience()],
    education: [getEmptyEducation()],
    skills: { raw: [""] },
  };
}

export function normalizeBaseResume(value?: BaseResume): BaseResume {
  if (!isPlainObject(value)) return getEmptyBaseResume();
  const profileAlias = isPlainObject((value as Record<string, unknown>).profile)
    ? ((value as Record<string, unknown>).profile as Record<string, unknown>)
    : {};
  const profileInput = isPlainObject(value.Profile) ? value.Profile : profileAlias;
  const contactInput = isPlainObject(profileInput.contact) ? profileInput.contact : {};
  const summaryInput = isPlainObject(value.summary) ? value.summary : {};
  const summaryText =
    typeof value.summary === "string"
      ? value.summary
      : cleanString(summaryInput.text as string | number | null);
  const workExperience =
    Array.isArray(value.workExperience) && value.workExperience.length
      ? value.workExperience.map(normalizeWorkExperience)
      : [getEmptyWorkExperience()];
  const education =
    Array.isArray(value.education) && value.education.length
      ? value.education.map(normalizeEducation)
      : [getEmptyEducation()];
  const skillsInput = isPlainObject(value.skills) ? value.skills : {};
  const rawSkills = Array.isArray(value.skills) ? value.skills : skillsInput.raw;

  return {
    Profile: {
      name: cleanString(profileInput.name as string | number | null),
      headline: cleanString(profileInput.headline as string | number | null),
      contact: {
        location: cleanString(contactInput.location as string | number | null),
        email: cleanString(contactInput.email as string | number | null),
        phone: cleanString(contactInput.phone as string | number | null),
        linkedin: cleanString(contactInput.linkedin as string | number | null),
      },
    },
    summary: { text: cleanString(summaryText) },
    workExperience,
    education,
    skills: { raw: normalizeStringList(rawSkills) },
  };
}

function parseJsonSafe(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonPayload(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = parseJsonSafe(trimmed);
  if (direct) return direct;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = parseJsonSafe(fenced[1].trim());
    if (parsed) return parsed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = parseJsonSafe(trimmed.slice(start, end + 1));
    if (parsed) return parsed;
  }
  return null;
}

export function extractTailorPayload(response: TailorResumeResponse) {
  const parsed = response.parsed ?? extractJsonPayload(response.content ?? "");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

export function selectResumePatch(payload: Record<string, unknown>) {
  const candidates = [
    payload.tailored_resume,
    payload.tailoredResume,
    payload.resume,
    payload.updated_resume,
    payload.updates,
    payload.patch,
    payload.result,
    payload.output,
    payload.data,
  ];
  for (const candidate of candidates) {
    if (isPlainObject(candidate)) return candidate as Record<string, unknown>;
  }
  return payload;
}

export function normalizeResumePatch(patch: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...patch };
  if (!next.Profile && isPlainObject(next.profile)) {
    next.Profile = next.profile as Record<string, unknown>;
  }
  if (!next.workExperience && Array.isArray(next.work_experience)) {
    next.workExperience = next.work_experience;
  }
  if (!next.workExperience && Array.isArray(next.experience)) {
    next.workExperience = next.experience;
  }
  if (typeof next.summary === "string") {
    next.summary = { text: next.summary };
  }
  if (Array.isArray(next.skills)) {
    next.skills = { raw: next.skills };
  }
  if (typeof next.skills === "string") {
    next.skills = { raw: [next.skills] };
  }
  return next;
}

export function isBulletAugmentation(
  value: Record<string, unknown>
): value is BulletAugmentation {
  return "first_company" in value || "second_company" in value || "other_companies" in value;
}

export function isCompanyBulletMap(
  value: Record<string, unknown>
): value is CompanyBulletMap {
  if (isBulletAugmentation(value)) return false;
  const entries = Object.entries(value);
  if (!entries.length) return false;
  const hasArray = entries.some(([, v]) => Array.isArray(v));
  if (!hasArray) return false;
  return entries.every(([, v]) => Array.isArray(v) && v.every((item) => typeof item === "string"));
}

function normalizeBulletList(value?: string[]) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

export function applyBulletAugmentation(
  base: BaseResume,
  augmentation: BulletAugmentation
): BaseResume {
  const normalized = normalizeBaseResume(base);
  const workExperience = (normalized.workExperience ?? []).map((item) => ({
    ...item,
    bullets: Array.isArray(item.bullets) ? [...item.bullets] : [],
  }));

  const appendAt = (index: number, bullets?: string[]) => {
    if (index < 0 || index >= workExperience.length) return;
    const existing = normalizeBulletList(workExperience[index].bullets);
    const extras = normalizeBulletList(bullets);
    if (!extras.length) return;
    workExperience[index] = {
      ...workExperience[index],
      bullets: [...extras, ...existing],
    };
  };

  appendAt(0, augmentation.first_company);
  appendAt(1, augmentation.second_company);

  if (Array.isArray(augmentation.other_companies)) {
    augmentation.other_companies.forEach((entry) => {
      const rawIndex = entry?.experience_index;
      const index = typeof rawIndex === "number" ? rawIndex : Number(rawIndex);
      if (!Number.isFinite(index)) return;
      appendAt(index, entry?.bullets);
    });
  }

  return {
    ...normalized,
    workExperience,
  };
}

export function buildPromptCompanyTitleKey(item: WorkExperience) {
  const source = item as Record<string, unknown>;
  const explicit = cleanString(
    (source.company_title ??
      source.companyTitle ??
      source.companyTitleText ??
      source.company_title_text ??
      source.display_title ??
      source.displayTitle ??
      source.heading) as string | number | null | undefined
  );
  if (explicit) return explicit;
  const title = cleanString(
    (source.title ?? source.roleTitle ?? source.role) as string | number | null | undefined
  );
  const company = cleanString(
    (source.company ?? source.companyTitle ?? source.company_name) as
      | string
      | number
      | null
      | undefined
  );
  if (title && company) return `${title} - ${company}`;
  return title || company || "";
}

function normalizeKeyForMatch(key: string): string {
  return cleanString(key)
    .replace(/[ƒ?"ƒ?"ƒ^']/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildBulletCountDefaults(
  keys: string[],
  profileDefaults?: Record<string, number>
) {
  const result: Record<string, number> = {};

  // Create a normalized lookup map from profile defaults
  const normalizedDefaults = new Map<string, { originalKey: string; value: number }>();
  if (profileDefaults) {
    Object.entries(profileDefaults).forEach(([key, value]) => {
      if (typeof value === "number") {
        const normalized = normalizeKeyForMatch(key);
        if (normalized) {
          normalizedDefaults.set(normalized, { originalKey: key, value });
        }
      }
    });
  }

  keys.forEach((key, index) => {
    if (!key) return;
    const normalizedKey = normalizeKeyForMatch(key);
    // Try exact match first
    if (profileDefaults && typeof profileDefaults[key] === "number") {
      result[key] = profileDefaults[key];
    }
    // Try normalized match
    else if (normalizedDefaults.has(normalizedKey)) {
      result[key] = normalizedDefaults.get(normalizedKey)!.value;
    }
    // Fall back to static defaults
    else {
      result[key] = index === 0 ? 3 : 1;
    }
  });
  return result;
}

export function buildBulletCountByCompanyPayload(
  keys: string[],
  counts: Record<string, number>
) {
  const result: Record<string, number> = {};
  keys.forEach((key, index) => {
    if (!key) return;
    const raw = counts[key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : index === 0 ? 3 : 1;
    result[key] = value;
  });
  return result;
}

function buildExperienceKey(item: WorkExperience) {
  const title = cleanString(item.roleTitle);
  const company = cleanString(item.companyTitle);
  if (title && company) return `${title} - ${company}`;
  return title || company || "";
}

function normalizeCompanyKey(value: string) {
  return cleanString(value)
    .replace(/[ƒ?"ƒ?"ƒ^']/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildExperienceKeyAliases(item: WorkExperience) {
  const aliases = new Set<string>();
  const key = buildExperienceKey(item);
  if (key) aliases.add(key);
  const title = cleanString(item.roleTitle);
  const company = cleanString(item.companyTitle);
  if (title) aliases.add(title);
  if (company) aliases.add(company);
  if (title && company) aliases.add(`${company} - ${title}`);
  return Array.from(aliases);
}

export function applyCompanyBulletMap(base: BaseResume, map: CompanyBulletMap): BaseResume {
  const normalized = normalizeBaseResume(base);
  const workExperience = (normalized.workExperience ?? []).map((item) => ({
    ...item,
    bullets: Array.isArray(item.bullets) ? [...item.bullets] : [],
  }));
  const keyToIndex = new Map<string, number>();
  workExperience.forEach((item, index) => {
    buildExperienceKeyAliases(item).forEach((key) => {
      if (key && !keyToIndex.has(key)) {
        keyToIndex.set(key, index);
      }
      const normalizedKey = normalizeCompanyKey(key);
      if (normalizedKey && !keyToIndex.has(normalizedKey)) {
        keyToIndex.set(normalizedKey, index);
      }
    });
  });
  Object.entries(map).forEach(([key, bullets]) => {
    const cleanKey = cleanString(key);
    if (!cleanKey) return;
    const normalizedKey = normalizeCompanyKey(cleanKey);
    const index = keyToIndex.get(cleanKey) ?? keyToIndex.get(normalizedKey);
    if (index === undefined) return;
    const existing = normalizeBulletList(workExperience[index].bullets);
    const extras = normalizeBulletList(bullets);
    if (!extras.length) return;
    workExperience[index] = {
      ...workExperience[index],
      bullets: [...extras, ...existing],
    };
  });
  return { ...normalized, workExperience };
}

export function mergeResumeData(base: BaseResume, patch: Record<string, unknown>) {
  if (!isPlainObject(patch)) return base;
  const target = isPlainObject(base) ? base : {};
  return deepMerge(target, patch) as BaseResume;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value;
      return;
    }
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
      return;
    }
    result[key] = value;
  });
  return result;
}

export function buildResumePdfName(profileName?: string, _templateName?: string) {
  const shortId = Date.now().toString(36);
  const core = profileName ? profileName : "resume";
  const base = core || "resume";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${cleaned || "resume"}-${shortId}`;
}

export function getPdfFilenameFromHeader(header: string | null) {
  if (!header) return "";
  const match = header.match(/filename=\"?([^\";]+)\"?/i);
  return match ? match[1] : "";
}
