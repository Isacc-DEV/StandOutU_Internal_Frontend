import type { BaseResume, Profile as WorkspaceProfile } from "@/app/workspace/types";
import type { Profile as AutofillProfile, ResumeSnapshot } from "./profile";

const toText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return "";
};

const pickText = (...values: Array<unknown>): string => {
  for (const value of values) {
    const text = toText(value).trim();
    if (text) return text;
  }
  return "";
};

const parseFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  };
};

const buildResumeSnapshot = (baseResume?: BaseResume): ResumeSnapshot | null => {
  if (!baseResume) return null;
  return {
    workExperience: baseResume.workExperience?.map((entry) => ({
      companyTitle: entry.companyTitle,
      roleTitle: entry.roleTitle,
      startDate: entry.startDate,
      endDate: entry.endDate,
    })),
    education: baseResume.education?.map((entry) => ({
      institution: entry.institution,
      degree: entry.degree,
      field: entry.field,
      date: entry.date,
    })),
  };
};

export function buildAutofillProfile(profile: WorkspaceProfile): AutofillProfile {
  const baseInfo = profile.baseInfo ?? {};
  const contact = baseInfo.contact ?? {};
  const links = baseInfo.links ?? {};
  const location = baseInfo.location ?? {};
  const career = baseInfo.career ?? {};
  const educationInfo = baseInfo.education ?? {};
  const preferences = baseInfo.preferences ?? {};
  const defaultAnswers = baseInfo.defaultAnswers ?? {};
  const contactPassword = pickText(contact.password);

  const resumeProfile = profile.baseResume?.Profile ?? {};
  const resumeContact = resumeProfile.contact ?? {};

  const nameFromResume = pickText(resumeProfile.name);
  const nameParts = parseFullName(pickText(profile.displayName, nameFromResume));

  const firstName = pickText(baseInfo.name?.first, nameParts.first);
  const lastName = pickText(baseInfo.name?.last, nameParts.last);
  const middleName = pickText(nameParts.middle);

  const rawPhone = pickText(contact.phone, resumeContact.phone);
  let countryCode = pickText(contact.phoneCode);
  let number = pickText(contact.phoneNumber);
  if (!number && rawPhone) {
    if (!countryCode && rawPhone.startsWith("+")) {
      const parts = rawPhone.split(/\s+/);
      countryCode = parts[0];
      number = parts.slice(1).join(" ");
    } else {
      number = rawPhone;
    }
  }

  const getLink = (...keys: string[]) => {
    for (const key of keys) {
      const value = (links as Record<string, string | undefined>)[key];
      if (value && value.trim()) return value.trim();
    }
    return "";
  };

  const resumeSnapshot = buildResumeSnapshot(profile.baseResume);

  const resumeEducation = profile.baseResume?.education ?? [];
  const education = resumeEducation.map((entry, index) => ({
    id: `resume-edu-${index}`,
    school: pickText(entry.institution),
    degree: pickText(entry.degree),
    major: pickText(entry.field),
    gpa: "",
    startDate: "",
    endDate: pickText(entry.date),
    current: false,
  }));

  const hasBaseInfoEducation = Boolean(
    pickText(educationInfo.school, educationInfo.degree, educationInfo.majorField, educationInfo.graduationAt)
  );
  if (education.length === 0 && hasBaseInfoEducation) {
    education.push({
      id: "base-info-edu",
      school: pickText(educationInfo.school),
      degree: pickText(educationInfo.degree),
      major: pickText(educationInfo.majorField),
      gpa: "",
      startDate: "",
      endDate: pickText(educationInfo.graduationAt),
      current: false,
    });
  }

  const resumeWork = profile.baseResume?.workExperience ?? [];
  const workExperience = resumeWork.map((entry, index) => {
    const endDate = pickText(entry.endDate);
    const current = !endDate || /present/i.test(endDate);
    return {
      id: `resume-work-${index}`,
      company: pickText(entry.companyTitle),
      position: pickText(entry.roleTitle),
      description: (entry.bullets ?? []).filter(Boolean).join("\n"),
      startDate: pickText(entry.startDate),
      endDate,
      current,
    };
  });

  const desiredSalary = pickText(career.desiredSalary);

  return {
    id: profile.id,
    name: pickText(profile.displayName, `${firstName} ${lastName}`.trim()),
    personalInfo: {
      prefix: "",
      firstName,
      middleName,
      lastName,
      address: pickText(location.address, resumeContact.location),
      city: pickText(location.city),
      state: pickText(location.state),
      postalCode: pickText(location.postalCode),
      country: pickText(location.country),
      email: pickText(contact.email, resumeContact.email),
      password: contactPassword,
      phone: {
        countryCode,
        number,
      },
      nationality: pickText(location.country),
      linkedInURL: pickText(getLink("linkedin"), resumeContact.linkedin),
      twitterURL: pickText(getLink("twitter"), getLink("x")),
      githubURL: pickText(getLink("github"), getLink("gitHub")),
      website: pickText(getLink("website"), getLink("portfolio")),
      gender: "",
    },
    additionalInfo: {
      currentSalary: "",
      expectedSalary: desiredSalary,
      noticePeriod: pickText(preferences.noticePeriod, preferences.notice_period, preferences.notice),
      earliestAvailableDate: pickText(preferences.earliestAvailableDate),
      coverLetter: pickText(defaultAnswers.coverLetter, defaultAnswers["cover_letter"], defaultAnswers["coverletter"]),
      genderIdentity: "",
      raceEthnicity: "",
      sexualOrientation: "",
      disabilityStatus: "",
      veteranStatus: "",
    },
    education,
    workExperience,
    resume: resumeSnapshot,
  };
}
