export type PhoneNumber = {
  countryCode: string;
  number: string;
  areaCode?: string;
  localNumber?: string;
  extension?: string;
  formatted?: string;
};

export type ResumeSnapshot = {
  workExperience?: Array<{
    companyTitle?: string;
    roleTitle?: string;
    startDate?: string;
    endDate?: string;
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    field?: string;
    date?: string;
  }>;
};

export type PersonalInfo = {
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string;
  password?: string;
  phone: PhoneNumber;
  nationality: string;
  linkedInURL: string;
  twitterURL: string;
  githubURL: string;
  website: string;
  gender: string;
};

export type AdditionalInfo = {
  currentSalary: string;
  expectedSalary: string;
  noticePeriod: string;
  earliestAvailableDate: string;
  coverLetter: string;
  genderIdentity: string;
  raceEthnicity: string;
  sexualOrientation: string;
  disabilityStatus: string;
  veteranStatus: string;
  resumeFile?: File;
};

export type Education = {
  id: string;
  school: string;
  degree: string;
  major: string;
  gpa?: string;
  startDate: string;
  endDate: string;
  current: boolean;
};

export type WorkExperience = {
  id: string;
  company: string;
  position: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
};

export type Profile = {
  id: string;
  name: string;
  personalInfo: PersonalInfo;
  additionalInfo: AdditionalInfo;
  education: Education[];
  workExperience: WorkExperience[];
  resume?: ResumeSnapshot | null;
};
