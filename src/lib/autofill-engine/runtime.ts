import { autofillEngine } from "./index";
import type { AIQuestionResponse, GreenhouseAiQuestionPayload } from "./greenhouse/greenhouseQuestionHandler";
import type { Profile } from "./profile";

export type AutofillRuntimeOptions = {
  engineMode?: "auto" | "common" | "greenhouse";
  openaiApiKey?: string;
  aiAnswerOverrides?: AIQuestionResponse[];
};

export type AutofillRuntimeResult = {
  success: boolean;
  engine?: "common" | "greenhouse";
  redirectUrl?: string;
  error?: string;
  filledCount?: number;
  totalFields?: number;
  unmatchedCount?: number;
  unknownCount?: number;
  aiQuestionsHandled?: number;
};

const normalizeProfile = (profileInput: Profile | null | undefined): Profile => {
  const raw = (profileInput && typeof profileInput === "object" ? profileInput : {}) as Partial<Profile>;
  const personalInfo: Partial<Profile["personalInfo"]> = raw.personalInfo ?? {};
  const phone: Partial<Profile["personalInfo"]["phone"]> = personalInfo.phone ?? {};
  const additionalInfo: Partial<Profile["additionalInfo"]> = raw.additionalInfo ?? {};

  return {
    id: raw.id ?? "",
    name: raw.name ?? "",
    personalInfo: {
      prefix: personalInfo.prefix ?? "",
      firstName: personalInfo.firstName ?? "",
      middleName: personalInfo.middleName ?? "",
      lastName: personalInfo.lastName ?? "",
      address: personalInfo.address ?? "",
      city: personalInfo.city ?? "",
      state: personalInfo.state ?? "",
      postalCode: personalInfo.postalCode ?? "",
      country: personalInfo.country ?? "",
      email: personalInfo.email ?? "",
      phone: {
        countryCode: phone.countryCode ?? "",
        number: phone.number ?? "",
      },
      nationality: personalInfo.nationality ?? "",
      linkedInURL: personalInfo.linkedInURL ?? "",
      twitterURL: personalInfo.twitterURL ?? "",
      githubURL: personalInfo.githubURL ?? "",
      website: personalInfo.website ?? "",
      gender: personalInfo.gender ?? "",
    },
    additionalInfo: {
      currentSalary: additionalInfo.currentSalary ?? "",
      expectedSalary: additionalInfo.expectedSalary ?? "",
      noticePeriod: additionalInfo.noticePeriod ?? "",
      earliestAvailableDate: additionalInfo.earliestAvailableDate ?? "",
      coverLetter: additionalInfo.coverLetter ?? "",
      genderIdentity: additionalInfo.genderIdentity ?? "",
      raceEthnicity: additionalInfo.raceEthnicity ?? "",
      sexualOrientation: additionalInfo.sexualOrientation ?? "",
      disabilityStatus: additionalInfo.disabilityStatus ?? "",
      veteranStatus: additionalInfo.veteranStatus ?? "",
    },
    education: Array.isArray(raw.education) ? raw.education : [],
    workExperience: Array.isArray(raw.workExperience) ? raw.workExperience : [],
    resume: raw.resume ?? null,
  };
};

export async function autofillRuntime(
  profileInput: Profile | null | undefined,
  optionsInput?: AutofillRuntimeOptions
): Promise<AutofillRuntimeResult> {
  const profile = normalizeProfile(profileInput);
  const options = optionsInput ?? {};
  const engineMode =
    options.engineMode === "greenhouse" || options.engineMode === "common" ? options.engineMode : "auto";
  const openaiApiKey = typeof options.openaiApiKey === "string" ? options.openaiApiKey.trim() : "";
  const aiAnswerOverrides = Array.isArray(options.aiAnswerOverrides)
    ? options.aiAnswerOverrides
    : null;

  autofillEngine.setProfile(profile);
  autofillEngine.setEngineMode(engineMode);
  autofillEngine.setAIAnswerOverrides(aiAnswerOverrides);
  if (openaiApiKey) {
    autofillEngine.setOpenAIKey(openaiApiKey);
  }

  let redirectUrl = "";
  const originalOpen = window.open;
  window.open = ((url?: string | URL | null) => {
    if (url) {
      redirectUrl = typeof url === "string" ? url : url.toString();
    }
    return null;
  }) as typeof window.open;

  try {
    const result = await autofillEngine.autofillPage();
    if (redirectUrl) {
      return { success: false, redirectUrl, engine: "greenhouse" };
    }
    const engine = "aiQuestionsHandled" in result ? "greenhouse" : "common";
    return {
      success: true,
      engine,
      filledCount: result.filledCount,
      totalFields: result.totalFields,
      unmatchedCount: result.unmatchedCount,
      unknownCount: result.unknownCount,
      aiQuestionsHandled: (result as { aiQuestionsHandled?: number }).aiQuestionsHandled,
    };
  } catch (error) {
    if (redirectUrl) {
      return { success: false, redirectUrl, engine: "greenhouse" };
    }
    const message = error instanceof Error ? error.message : "Autofill failed";
    return { success: false, error: message };
  } finally {
    window.open = originalOpen;
  }
}

export async function autofillCollectGreenhouseQuestions(
  profileInput: Profile | null | undefined,
  optionsInput?: AutofillRuntimeOptions
): Promise<GreenhouseAiQuestionPayload[]> {
  const profile = normalizeProfile(profileInput);
  const options = optionsInput ?? {};
  const engineMode =
    options.engineMode === "greenhouse" || options.engineMode === "common" ? options.engineMode : "auto";

  autofillEngine.setProfile(profile);
  autofillEngine.setEngineMode(engineMode);
  return autofillEngine.collectGreenhouseAIQuestions();
}
