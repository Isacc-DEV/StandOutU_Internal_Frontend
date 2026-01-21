import { Profile } from "./profile";
import { CommonInputSimulator } from "./inputSimulator";

export interface FieldMatcher {
  patterns: RegExp[];
  priority: number;
  getValue: (profile: Profile) => string;
  handleSpecialCases?: (element: HTMLElement, profile: Profile) => Promise<void>;
}

export const FIELD_MATCHERS: Record<string, FieldMatcher> = {
  prefix: {
    patterns: [/^prefix$/i, /title[\s_-]?prefix/i, /salutation/i, /honorific/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.prefix,
  },

  firstName: {
    patterns: [/first[\s_-]?name/i, /fname/i, /forename/i, /given[\s_-]?name/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.firstName,
  },

  middleName: {
    patterns: [/middle[\s_-]?name/i, /mname/i, /middle[\s_-]?initial/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.middleName,
  },

  lastName: {
    patterns: [/last[\s_-]?name/i, /lname/i, /surname/i, /family[\s_-]?name/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.lastName,
  },

  fullName: {
    patterns: [
      /full[\s_-]?name/i,
      /complete[\s_-]?name/i,
      /^name$/i,
      /applicant[\s_-]?name/i,
      /candidate[\s_-]?name/i,
    ],
    priority: 2,
    getValue: (profile) => {
      const parts = [
        profile.personalInfo.prefix,
        profile.personalInfo.firstName,
        profile.personalInfo.middleName,
        profile.personalInfo.lastName,
      ];
      return parts.filter(Boolean).join(" ");
    },
  },

  email: {
    patterns: [
      /e?mail/i,
      /email[\s_-]?address/i,
      /contact[\s_-]?email/i,
      /work[\s_-]?email/i,
      /personal[\s_-]?email/i,
    ],
    priority: 1,
    getValue: (profile) => profile.personalInfo.email,
  },

  password: {
    patterns: [/\bpassword\b/i, /\bpwd\b/i, /\bpasscode\b/i, /\bpassphrase\b/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.password || "",
  },

  phone: {
    patterns: [
      /phone/i,
      /telephone/i,
      /mobile/i,
      /cell/i,
      /tel/i,
      /contact[\s_-]?number/i,
      /phone[\s_-]?number/i,
    ],
    priority: 1,
    getValue: (profile) => {
      const { countryCode, number } = profile.personalInfo.phone;
      return number ? `${countryCode || ""} ${number}`.trim() : "";
    },
    handleSpecialCases: async (element: HTMLElement, profile: Profile) => {
      const parent =
        element.closest('form, .form-group, .phone-input-container, [class*="phone"]') ||
        element.parentElement?.parentElement;
      const phoneInput = element as HTMLInputElement;
      const { countryCode, number } = profile.personalInfo.phone;
      const fullPhone = `${countryCode || ""} ${number}`.trim();

      if (!parent) {
        await CommonInputSimulator.fillInput(phoneInput, fullPhone);
        return;
      }

      const countryCodeSelect = parent.querySelector(
        'select[name*="country" i], select[id*="country" i], select[name*="code" i], select[id*="code" i]'
      ) as HTMLSelectElement | null;
      const countryCodeInput = parent.querySelector(
        'input[name*="country" i], input[id*="country" i], input[name*="code" i], input[id*="code" i]'
      ) as HTMLInputElement | null;

      if ((countryCodeSelect || countryCodeInput) && countryCode) {
        if (countryCodeSelect) {
          const success = await CommonInputSimulator.fillSelect(countryCodeSelect, countryCode, {
            searchable: true,
          });
          if (success) {
            await CommonInputSimulator.fillInput(phoneInput, number);
            return;
          }
        } else if (countryCodeInput && countryCodeInput !== phoneInput) {
          await CommonInputSimulator.fillInput(countryCodeInput, countryCode);
          await CommonInputSimulator.fillInput(phoneInput, number);
          return;
        }
      }

      await CommonInputSimulator.fillInput(phoneInput, fullPhone);
    },
  },

  address: {
    patterns: [/address/i, /street/i, /addr/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.address,
  },

  city: {
    patterns: [/city/i, /town/i, /municipality/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.city,
  },

  state: {
    patterns: [/state/i, /province/i, /region/i, /county/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.state,
  },

  postalCode: {
    patterns: [/postal[\s_-]?code/i, /zip[\s_-]?code/i, /postcode/i, /zip/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.postalCode,
  },

  country: {
    patterns: [/country/i, /nation/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.country,
  },

  nationality: {
    patterns: [/nationality/i, /citizen/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.nationality,
  },

  gender: {
    patterns: [/^gender$/i, /sex/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.gender,
  },

  linkedin: {
    patterns: [/linkedin/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.linkedInURL,
  },

  twitter: {
    patterns: [/twitter/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.twitterURL,
  },

  github: {
    patterns: [/github/i, /git[\s_-]?hub/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.githubURL,
  },

  website: {
    patterns: [/website/i, /portfolio/i, /homepage/i, /url/i],
    priority: 1,
    getValue: (profile) => profile.personalInfo.website,
  },

  currentSalary: {
    patterns: [/current[\s_-]?salary/i, /compensation/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.currentSalary,
  },

  expectedSalary: {
    patterns: [
      /expected[\s_-]?salary/i,
      /desired[\s_-]?salary/i,
      /salary[\s_-]?expectation/i,
      /remuneration[\s_-]?expectation/i,
    ],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.expectedSalary,
  },

  noticePeriod: {
    patterns: [/notice[\s_-]?period/i, /availability/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.noticePeriod,
  },

  earliestAvailableDate: {
    patterns: [
      /earliest[\s_-]?available/i,
      /start[\s_-]?date/i,
      /available[\s_-]?from/i,
      /join[\s_-]?date/i,
    ],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.earliestAvailableDate,
  },

  coverLetter: {
    patterns: [
      /cover[\s_-]?letter/i,
      /motivation/i,
      /introduction/i,
      /why[\s_-]?apply/i,
      /tell[\s_-]?us/i,
      /why[\s_-]?interested/i,
      /why[\s_-]?you[\s_-]?interested/i,
      /interest/i,
    ],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.coverLetter,
  },

  genderIdentity: {
    patterns: [/gender[\s_-]?identity/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.genderIdentity,
  },

  raceEthnicity: {
    patterns: [/race/i, /ethnicity/i, /ethnic/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.raceEthnicity,
  },

  sexualOrientation: {
    patterns: [/sexual[\s_-]?orientation/i, /orientation/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.sexualOrientation,
  },

  disabilityStatus: {
    patterns: [/disability/i, /disabled/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.disabilityStatus,
  },

  veteranStatus: {
    patterns: [/veteran/i, /military[\s_-]?service/i],
    priority: 1,
    getValue: (profile) => profile.additionalInfo.veteranStatus,
  },
};

export function matchField(element: HTMLElement): string | null {
  const label = element.closest("label")?.textContent || "";
  const ariaLabel = element.getAttribute("aria-label") || "";
  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  let ariaLabelledByText = "";

  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    ariaLabelledByText = labelElement?.textContent || "";
  }

  const searchableText = [
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("placeholder"),
    ariaLabel,
    ariaLabelledByText,
    element.getAttribute("data-field"),
    element.getAttribute("autocomplete"),
    element.getAttribute("type"),
    label,
  ]
    .filter(Boolean)
    .join(" ");

  let bestMatch: { key: string; priority: number } | null = null;

  for (const [key, matcher] of Object.entries(FIELD_MATCHERS)) {
    for (const pattern of matcher.patterns) {
      if (pattern.test(searchableText)) {
        if (!bestMatch || matcher.priority < bestMatch.priority) {
          bestMatch = { key, priority: matcher.priority };
        }
      }
    }
  }

  return bestMatch?.key || null;
}
