import type { Profile } from "../../../profile";
import { GREENHOUSE_FIELD_MATCHERS } from "../greenhouse/fieldMatchers.config";

export interface WorkdayFieldMatcher {
  patterns: RegExp[];
  getValue: (profile: Profile) => string | undefined;
  selector?: string;
}

export const WORKDAY_FIELD_MATCHERS: Record<string, WorkdayFieldMatcher> = {
  ...GREENHOUSE_FIELD_MATCHERS,
};
