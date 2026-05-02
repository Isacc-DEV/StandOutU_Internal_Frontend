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

const parseLocation = (rawLocation: string) => {
  const parts = rawLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { city: "", state: "", country: "" };
  }
  if (parts.length === 1) {
    return { city: parts[0], state: "", country: "" };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: parts[1], country: "" };
  }
  return {
    city: parts[0],
    state: parts[1],
    country: parts.slice(2).join(", "),
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
  const resumeProfile = profile.baseResume?.Profile ?? {};
  const resumeContact = resumeProfile.contact ?? {};

  const resolvedName = pickText(resumeProfile.name, profile.displayName);
  const nameParts = parseFullName(resolvedName);
  const firstName = pickText(nameParts.first);
  const middleName = pickText(nameParts.middle);
  const lastName = pickText(nameParts.last);
  const familyName = pickText(lastName);
  const locationText = pickText(resumeContact.location);
  const parsedLocation = parseLocation(locationText);

  const rawPhone = pickText(resumeContact.phone);
  let countryCode = "";
  let number = "";
  if (!number && rawPhone) {
    if (rawPhone.startsWith("+")) {
      const parts = rawPhone.split(/\s+/);
      countryCode = parts[0];
      number = parts.slice(1).join(" ");
    } else {
      number = rawPhone;
    }
  }

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

  return {
    id: profile.id,
    name: pickText(profile.displayName, resolvedName, `${firstName} ${lastName}`.trim()),
    personalInfo: {
      prefix: "",
      firstName,
      middleName,
      lastName,
      familyName,
      address: locationText,
      streetName: locationText,
      city: parsedLocation.city,
      state: parsedLocation.state,
      postalCode: "",
      country: parsedLocation.country,
      email: pickText(resumeContact.email),
      password: "",
      phone: {
        countryCode,
        number,
      },
      nationality: parsedLocation.country,
      linkedInURL: pickText(resumeContact.linkedin),
      twitterURL: "",
      githubURL: "",
      website: "",
      gender: "",
    },
    additionalInfo: {
      currentSalary: "",
      expectedSalary: "",
      noticePeriod: "",
      earliestAvailableDate: "",
      coverLetter: "",
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
