import type { BaseResume, WorkExperience, EducationEntry } from "@/app/workspace/types";
import { cleanString } from "./resume";

export function renderResumeTemplate(templateHtml: string, resume: BaseResume) {
  if (!templateHtml.trim()) return "";
  const data = buildTemplateData(resume);
  return renderMustacheTemplate(templateHtml, data);
}

type SafeHtml = { __html: string };

function safeHtml(value: string): SafeHtml {
  return { __html: value };
}

function isSafeHtml(value: unknown): value is SafeHtml {
  return Boolean(value && typeof value === "object" && "__html" in (value as SafeHtml));
}

function buildTemplateData(resume: BaseResume) {
  const profile = resume.Profile ?? {};
  const summary = resume.summary ?? {};
  const skills = resume.skills ?? {};
  return {
    ...resume,
    Profile: profile,
    profile,
    summary,
    skills,
    work_experience: safeHtml(buildWorkExperienceHtml(resume.workExperience)),
  };
}

function buildWorkExperienceHtml(items?: WorkExperience[]) {
  const list = (items ?? []).filter(hasWorkExperience);
  if (!list.length) return "";
  return list
    .map((item, index) => {
      const title = [item.roleTitle, item.companyTitle]
        .map(cleanString)
        .filter(Boolean)
        .join(" - ");
      const dates = [item.startDate, item.endDate].map(cleanString).filter(Boolean).join(" - ");
      const meta = [item.location, item.employmentType]
        .map(cleanString)
        .filter(Boolean)
        .join(" | ");
      const bullets = (item.bullets ?? []).map(cleanString).filter(Boolean);
      const bulletHtml = bullets.length
        ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
        : "";
      const header = escapeHtml(title || `Role ${index + 1}`);
      const datesHtml = dates ? `<div class="resume-meta">${escapeHtml(dates)}</div>` : "";
      const metaHtml = meta ? `<div class="resume-meta">${escapeHtml(meta)}</div>` : "";
      return `<div class="resume-item"><div><strong>${header}</strong></div>${datesHtml}${metaHtml}${bulletHtml}</div>`;
    })
    .join("");
}

function buildEducationHtml(items?: EducationEntry[]) {
  const list = (items ?? []).filter(hasEducationEntry);
  if (!list.length) return "";
  return list
    .map((item, index) => {
      const title = [item.degree, item.field].map(cleanString).filter(Boolean).join(" - ");
      const header = [item.institution, title].map(cleanString).filter(Boolean).join(" | ");
      const date = cleanString(item.date);
      const coursework = (item.coursework ?? []).map(cleanString).filter(Boolean);
      const courseworkText = coursework.length ? `Coursework: ${coursework.join(", ")}` : "";
      const dateHtml = date ? `<div class="resume-meta">${escapeHtml(date)}</div>` : "";
      const courseworkHtml = courseworkText
        ? `<div class="resume-meta">${escapeHtml(courseworkText)}</div>`
        : "";
      const label = escapeHtml(header || `Education ${index + 1}`);
      return `<div class="resume-item"><div><strong>${label}</strong></div>${dateHtml}${courseworkHtml}</div>`;
    })
    .join("");
}

function renderMustacheTemplate(template: string, data: Record<string, unknown>) {
  return renderTemplateWithContext(template, [data]);
}

function renderTemplateWithContext(template: string, stack: unknown[]): string {
  let output = "";
  let index = 0;

  while (index < template.length) {
    const openIndex = template.indexOf("{{", index);
    if (openIndex === -1) {
      output += template.slice(index);
      break;
    }
    output += template.slice(index, openIndex);
    const closeIndex = template.indexOf("}}", openIndex + 2);
    if (closeIndex === -1) {
      output += template.slice(openIndex);
      break;
    }
    const tag = template.slice(openIndex + 2, closeIndex).trim();
    index = closeIndex + 2;
    if (!tag) continue;

    const type = tag[0];
    if (type === "#" || type === "^") {
      const name = tag.slice(1).trim();
      if (!name) continue;
      const section = findSectionEnd(template, index, name);
      if (!section) continue;
      const inner = template.slice(index, section.start);
      index = section.end;
      const value = resolvePath(name, stack);
      const truthy = isSectionTruthy(value);

      if (type === "#") {
        if (Array.isArray(value)) {
          if (value.length) {
            value.forEach((item) => {
              output += renderTemplateWithContext(inner, pushContext(stack, item));
            });
          }
        } else if (truthy) {
          output += renderTemplateWithContext(inner, pushContext(stack, value));
        }
      } else if (!truthy) {
        output += renderTemplateWithContext(inner, stack);
      }
      continue;
    }

    if (type === "/") {
      continue;
    }

    const value = resolvePath(tag, stack);
    output += renderValue(value, tag);
  }

  return output;
}

function findSectionEnd(template: string, fromIndex: number, name: string) {
  let index = fromIndex;
  let depth = 1;
  while (index < template.length) {
    const openIndex = template.indexOf("{{", index);
    if (openIndex === -1) return null;
    const closeIndex = template.indexOf("}}", openIndex + 2);
    if (closeIndex === -1) return null;
    const tag = template.slice(openIndex + 2, closeIndex).trim();
    index = closeIndex + 2;
    if (!tag) continue;
    const type = tag[0];
    const tagName = type === "#" || type === "^" || type === "/" ? tag.slice(1).trim() : "";
    if (!tagName) continue;
    if ((type === "#" || type === "^") && tagName === name) {
      depth += 1;
    }
    if (type === "/" && tagName === name) {
      depth -= 1;
      if (depth === 0) {
        return { start: openIndex, end: closeIndex + 2 };
      }
    }
  }
  return null;
}

function resolvePath(path: string, stack: unknown[]) {
  if (path === ".") return resolveDot(stack);
  const parts = path.split(".");
  for (let i = 0; i < stack.length; i += 1) {
    const value = getPathValue(stack[i], parts);
    if (value !== undefined) return value;
  }
  return undefined;
}

function resolveDot(stack: unknown[]) {
  for (let i = 0; i < stack.length; i += 1) {
    const ctx = stack[i];
    if (ctx && typeof ctx === "object" && "." in (ctx as Record<string, unknown>)) {
      return (ctx as Record<string, unknown>)["."];
    }
    if (typeof ctx === "string" || typeof ctx === "number" || typeof ctx === "boolean") {
      return ctx;
    }
  }
  return undefined;
}

function getPathValue(context: unknown, parts: string[]) {
  if (!context || typeof context !== "object") return undefined;
  let current: unknown = context;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    if (!(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function pushContext(stack: unknown[], value: unknown) {
  if (value === null || value === undefined) return stack;
  if (value && typeof value === "object") {
    return [value, ...stack];
  }
  return [{ ".": value }, ...stack];
}

function isSectionTruthy(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (isSafeHtml(value)) return Boolean(value.__html);
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "object") return true;
  return Boolean(value);
}

function renderValue(value: unknown, path: string) {
  if (isSafeHtml(value)) return value.__html;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (path === "workExperience" || path === "work_experience") {
      return buildWorkExperienceHtml(value as WorkExperience[]);
    }
    if (path === "education") {
      return buildEducationHtml(value as EducationEntry[]);
    }
    if (path === "skills.raw") {
      const joined = value.map((item) => cleanString(item as string)).filter(Boolean).join(", ");
      return escapeHtml(joined);
    }
    const joined = value.map((item) => cleanString(item as string)).filter(Boolean).join(", ");
    return escapeHtml(joined);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return escapeHtml(record.text);
    if (Array.isArray(record.raw)) {
      const joined = record.raw.map((item) => cleanString(item as string)).filter(Boolean).join(", ");
      return escapeHtml(joined);
    }
    return "";
  }
  if (typeof value === "boolean") return value ? "true" : "";
  return escapeHtml(String(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasWorkExperience(item: WorkExperience) {
  if (!item) return false;
  const fields = [
    cleanString(item.companyTitle),
    cleanString(item.roleTitle),
    cleanString(item.employmentType),
    cleanString(item.location),
    cleanString(item.startDate),
    cleanString(item.endDate),
  ];
  if (fields.some(Boolean)) return true;
  return (item.bullets ?? []).some((bullet) => cleanString(bullet));
}

function hasEducationEntry(item: EducationEntry) {
  if (!item) return false;
  const fields = [
    cleanString(item.institution),
    cleanString(item.degree),
    cleanString(item.field),
    cleanString(item.date),
  ];
  if (fields.some(Boolean)) return true;
  return (item.coursework ?? []).some((course) => cleanString(course));
}
