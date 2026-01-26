export type DesktopBridge = {
  isElectron?: boolean;
  openJobWindow?: (url: string) => Promise<{ ok?: boolean; error?: string } | void>;
};

export type WebviewHandle = HTMLElement & {
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  loadURL?: (url: string) => Promise<void> | void;
};

export type User = {
  id: string;
  email: string;
  userName: string;
  role: "ADMIN" | "MANAGER" | "BIDDER" | "OBSERVER";
};

export type BaseInfo = {
  name?: { first?: string; last?: string };
  contact?: {
    email?: string;
    phone?: string;
    phoneCode?: string;
    phoneNumber?: string;
    password?: string;
  };
  links?: Record<string, string> & { linkedin?: string };
  location?: { address?: string; city?: string; state?: string; country?: string; postalCode?: string };
  career?: { jobTitle?: string; currentCompany?: string; yearsExp?: string | number; desiredSalary?: string };
  education?: { school?: string; degree?: string; majorField?: string; graduationAt?: string };
  workAuth?: { authorized?: boolean; needsSponsorship?: boolean };
  preferences?: Record<string, unknown>;
  defaultAnswers?: Record<string, string>;
};

export type BaseResume = {
  Profile?: {
    name?: string;
    headline?: string;
    contact?: {
      location?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
    };
  };
  summary?: { text?: string };
  workExperience?: Array<{
    companyTitle?: string;
    roleTitle?: string;
    employmentType?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    field?: string;
    date?: string;
    coursework?: string[];
  }>;
  skills?: { raw?: string[] };
};

export type WorkExperience = NonNullable<BaseResume["workExperience"]>[number];
export type EducationEntry = NonNullable<BaseResume["education"]>[number];

export type Profile = {
  id: string;
  displayName: string;
  baseInfo: BaseInfo;
  baseResume?: BaseResume;
  baseAdditionalBullets?: Record<string, number>;
  resumeTemplateId?: string | null;
  resumeTemplateName?: string | null;
  assignedBidderId?: string;
};

export type ResumeTemplate = {
  id: string;
  name: string;
  description?: string | null;
  html: string;
  profileCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type TailorResumeResponse = {
  content?: string;
  parsed?: unknown;
  provider?: string;
  model?: string;
};

export type BulletAugmentation = {
  first_company?: string[];
  second_company?: string[];
  other_companies?: Array<{
    experience_index?: number | string;
    bullets?: string[];
  }>;
};

export type CompanyBulletMap = Record<string, string[]>;

export type ApplicationSession = {
  id: string;
  bidderUserId: string;
  profileId: string;
  url: string;
  status: string;
  jobContext?: Record<string, unknown>;
  fillPlan?: FillPlan;
  startedAt?: string;
};

export type FillPlan = {
  filled?: { field: string; value: string; confidence?: number }[];
  suggestions?: { field: string; suggestion: string }[];
  blocked?: string[];
  actions?: FillPlanAction[];
};

export type FillPlanAction = {
  field?: string;
  field_id?: string;
  label?: string;
  selector?: string | null;
  action?: "fill" | "select" | "check" | "uncheck" | "click" | "upload" | "skip";
  value?: string;
  confidence?: number;
};

export type PageFieldCandidate = {
  field_id?: string;
  id?: string | null;
  name?: string | null;
  label?: string | null;
  ariaName?: string | null;
  placeholder?: string | null;
  questionText?: string | null;
  type?: string | null;
  selector?: string | null;
  locators?: { css?: string; playwright?: string };
  constraints?: Record<string, number>;
  required?: boolean;
};

export type AutofillResponse = {
  fillPlan: FillPlan;
  pageFields?: PageFieldCandidate[];
  candidateFields?: PageFieldCandidate[];
};

export type ApplicationPhraseResponse = {
  phrases: string[];
};

export type Metrics = {
  tried: number;
  submitted: number;
  appliedPercentage: number;
  monthlyApplied?: number;
  recent: ApplicationSession[];
};
