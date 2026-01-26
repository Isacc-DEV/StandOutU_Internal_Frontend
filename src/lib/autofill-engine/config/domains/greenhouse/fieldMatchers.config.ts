import type { Profile } from "../../../profile";

export interface GreenhouseFieldMatcher {
  patterns: RegExp[];
  getValue: (profile: Profile) => string | undefined;
  selector?: string;
}

export const GREENHOUSE_FIELD_MATCHERS: Record<string, GreenhouseFieldMatcher> = {
  firstName: {
    patterns: [/first[_\s-]?name/i, /given[_\s-]?name/i, /fname/i],
    selector: 'input[id*="first_name"], input[name*="first_name"]',
    getValue: (profile) => profile.personalInfo.firstName,
  },

  familyName: {
    patterns: [/family[_\s-]?name/i],
    selector: 'input[id*="family_name"], input[name*="family_name"]',
    getValue: (profile) => profile.personalInfo.familyName || profile.personalInfo.lastName,
  },

  lastName: {
    patterns: [/last[_\s-]?name/i, /surname/i, /lname/i],
    selector: 'input[id*="last_name"], input[name*="last_name"]',
    getValue: (profile) => profile.personalInfo.lastName,
  },

  fullName: {
    patterns: [
      /full[_\s-]?name/i,
      /complete[_\s-]?name/i,
      /^name$/i,
      /applicant[_\s-]?name/i,
      /candidate[_\s-]?name/i,
    ],
    selector: 'input[id*="name"], input[name*="name"]',
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

  preferredName: {
    patterns: [/preferred[_\s-]?(first[_\s-]?)?name/i, /nickname/i],
    selector: 'input[id*="preferred_name"], input[name*="preferred"]',
    getValue: (profile) => profile.personalInfo.firstName,
  },

  email: {
    patterns: [/e?mail/i, /email[_\s-]?address/i],
    selector: 'input[id="email"], input[name="email"], input[type="email"]',
    getValue: (profile) => profile.personalInfo.email,
  },

  phoneExtension: {
    patterns: [/phone.*extension/i, /\bextension\b/i, /\bext\.?\b/i],
    selector: 'input[id*="extension"], input[name*="extension"]',
    getValue: () => undefined,
  },

  phone: {
    patterns: [/phone/i, /mobile/i, /telephone/i, /cell/i, /phone[_\s-]?number/i],
    selector: 'input[id="phone"], input[name="phone"], input[type="tel"]',
    getValue: (profile) => {
      const { number } = profile.personalInfo.phone;
      return number || undefined;
    },
  },

  contactNumber: {
    patterns: [/contact[_\s-]?number/i, /phone[_\s-]?number.*country[_\s-]?code/i],
    selector: 'input[id="contactNumber"], input[name="contactNumber"], input[type="tel"]',
    getValue: (profile) => {
      const { countryCode, number } = profile.personalInfo.phone;
      return `${countryCode || ""} ${number}`.trim() || undefined;
    },
  },

  phoneCountry: {
    patterns: [
      /phone.*country/i,
      /country.*phone/i,
      /phone.*code/i,
      /dial.*code/i,
      /country.*code/i,
    ],
    selector: 'select[id="country"], input[id="country"][type="text"]',
    getValue: (profile) => {
      const { countryCode } = profile.personalInfo.phone;
      return countryCode || undefined;
    },
  },

  linkedIn: {
    patterns: [/linkedin/i, /linked[_\s-]?in/i],
    selector: 'input[id*="linkedin"], input[name*="linkedin"]',
    getValue: (profile) => profile.personalInfo.linkedInURL,
  },

  website: {
    patterns: [/website/i, /portfolio/i, /personal[_\s-]?site/i, /url/i, /homepage/i],
    selector: 'input[id*="website"], input[name*="website"], input[name*="url"]',
    getValue: (profile) => profile.personalInfo.website,
  },

  github: {
    patterns: [/github/i, /git[_\s-]?hub/i],
    selector: 'input[id*="github"], input[name*="github"]',
    getValue: (profile) => profile.personalInfo.githubURL,
  },

  twitter: {
    patterns: [/twitter/i, /x\.com/i],
    selector: 'input[id*="twitter"], input[name*="twitter"]',
    getValue: (profile) => profile.personalInfo.twitterURL,
  },

  address: {
    patterns: [/address/i, /addr/i],
    selector: 'input[id*="address"], input[name*="address"]',
    getValue: (profile) => profile.personalInfo.address,
  },

  streetName: {
    patterns: [/street[_\s-]?name/i, /street[_\s-]?address/i, /\bstreet\b/i],
    selector: 'input[id*="street"], input[name*="street"]',
    getValue: (profile) => profile.personalInfo.streetName || profile.personalInfo.address,
  },

  city: {
    patterns: [/\blocation.*city\b/i, /\bcurrent.*city\b/i, /\bcity.*location\b/i],
    selector: 'input[id="city"], input[name="city"]',
    getValue: (profile) => profile.personalInfo.city,
  },

  state: {
    patterns: [/^state$/i, /province/i, /region/i, /location.*state/i],
    selector: 'input[id*="state"], input[name*="state"]',
    getValue: (profile) => profile.personalInfo.state,
  },

  postalCode: {
    patterns: [/postal[_\s-]?code/i, /zip[_\s-]?code/i, /postcode/i, /^zip$/i],
    selector: 'input[id*="zip"], input[name*="postal"]',
    getValue: (profile) => profile.personalInfo.postalCode,
  },

  country: {
    patterns: [
      /^country$/i,
      /\blocation.*country\b/i,
      /\bcurrent.*country\b/i,
      /\bcountry.*location\b/i,
      /\bcountry.*residence\b/i,
    ],
    selector: 'select[id*="country"], input[id*="country"]',
    getValue: (profile) => profile.personalInfo.country,
  },

  school: {
    patterns: [/school/i, /university/i, /college/i, /institution/i, /alma[_\s-]?mater/i],
    selector: 'select[id*="school"], input[id*="school"]',
    getValue: (profile) => profile.education[0]?.school,
  },

  degree: {
    patterns: [/degree/i, /qualification/i, /diploma/i, /education[_\s-]?level/i],
    selector: 'select[id*="degree"], input[id*="degree"]',
    getValue: (profile) => profile.education[0]?.degree,
  },

  fieldOfStudy: {
    patterns: [
      /field[_\s-]?of[_\s-]?study/i,
      /major/i,
      /discipline/i,
      /concentration/i,
      /specialization/i,
    ],
    selector: 'input[id*="field"], input[id*="major"], input[id*="discipline"]',
    getValue: (profile) => profile.education[0]?.major,
  },

  currentSalary: {
    patterns: [
      /current[\s_-]?salary/i,
      /current[\s_-]?compensation/i,
      /expected[\s_-]?annual[\s_-]?cash[\s_-]?compensation/i,
      /annual[\s_-]?compensation/i,
      /cash[\s_-]?compensation/i,
    ],
    selector: 'input[id*="salary"], input[name*="compensation"]',
    getValue: (profile) =>
      profile.additionalInfo.currentSalary || profile.additionalInfo.expectedSalary,
  },

  coverLetter: {
    patterns: [
      /^cover[\s_-]?letter$/i,
      /^cover\s*letter\s*upload$/i,
      /^attach.*cover.*letter$/i,
    ],
    selector: 'textarea[id*="cover"], textarea[name*="letter"]',
    getValue: (profile) => profile.additionalInfo.coverLetter,
  },

  hispanicEthnicity: {
    patterns: [/hispanic/i, /latino/i, /latina/i, /latinx/i, /hispanic.*ethnicity/i],
    selector: 'select[id*="hispanic"], select[name*="ethnicity"], input[id*="hispanic_ethnicity"]',
    getValue: (profile) => profile.additionalInfo.raceEthnicity,
  },

  gender: {
    patterns: [/^gender$/i, /gender.*identity/i, /sex/i],
    selector: 'select[id="gender"], input[id="gender"]',
    getValue: (profile) => profile.personalInfo.gender,
  },

  companyName: {
    patterns: [
      /^company.*name$/i,
      /^employer$/i,
      /^current.*employer$/i,
      /^company$/i,
    ],
    selector: 'input[id*="question"]',
    getValue: (profile) => profile.workExperience[0]?.company,
  },

  gpa: {
    patterns: [/gpa/i, /grade[_\s-]?point/i],
    selector: 'input[id*="gpa"]',
    getValue: (profile) => profile.education[0]?.gpa,
  },

  startDate: {
    patterns: [/start[_\s-]?date/i, /from[_\s-]?date/i, /begin[_\s-]?date/i],
    selector: 'input[id*="start"], input[name*="start_date"]',
    getValue: (profile) => profile.education[0]?.startDate || profile.workExperience[0]?.startDate,
  },

  endDate: {
    patterns: [/end[_\s-]?date/i, /to[_\s-]?date/i, /graduation[_\s-]?date/i, /completion[_\s-]?date/i],
    selector: 'input[id*="end"], input[name*="end_date"], input[id*="graduation"]',
    getValue: (profile) => profile.education[0]?.endDate || profile.workExperience[0]?.endDate,
  },

  password: {
    patterns: [/password/i, /\bpasscode\b/i, /\bpassphrase\b/i, /\bpwd\b/i],
    selector: 'input[type="password"], input[name*="password"], input[id*="password"]',
    getValue: (profile) => profile.personalInfo.password,
  },
};
