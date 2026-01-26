import { Profile } from "./profile";
import { FIELD_MATCHERS, matchField } from "./fieldMatchers";
import { CommonInputSimulator } from "./inputSimulator";
import { domainEngine } from "./domainEngine";
import type { AIQuestionResponse } from "./domainQuestionHandler";
import { EngineMode } from "./types";

export class AutofillEngineClass {
  private profile: Profile | null = null;
  private engineMode: EngineMode = "common";
  
  setProfile(profile: Profile) {
    this.profile = profile;
  }
  
  setEngineMode(mode: EngineMode) {
    this.engineMode = mode;
  }
  
  setOpenAIKey(apiKey: string) {
    domainEngine.setOpenAIKey(apiKey);
  }

  setAIAnswerOverrides(responses: AIQuestionResponse[] | null) {
    domainEngine.setAIAnswerOverrides(responses);
  }

  setAIAnswerDebug(debug: { prompt?: string; rawResponse?: string } | null) {
    domainEngine.setAIAnswerDebug(debug);
  }

  async collectDomainAIQuestions() {
    if (!this.profile) {
      return [];
    }
    domainEngine.setProfile(this.profile);
    return domainEngine.collectAIQuestions();
  }
  
  async autofillPage() {
    if (!this.profile) {
      console.warn("No profile set for autofill");
      return { filledCount: 0, totalFields: 0, unmatchedCount: 0, unknownCount: 0 };
    }

    // Check for Greenhouse iframe redirect before anything else
    this.isSpecificPage();

    domainEngine.setProfile(this.profile);
    const result = await domainEngine.autofillDomainPage(this.engineMode);
    return {
      filledCount: result.filledCount,
      totalFields: result.totalFields,
      unmatchedCount: result.unmatchedCount,
      unknownCount: 0,
      aiQuestionsHandled: result.aiQuestionsHandled,
    };
  }
  
  private isSpecificPage(): boolean {
    // Check for embedded Greenhouse iframe with different domain
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      const iframeSrc = iframe.src?.toLowerCase() || "";
      if (iframeSrc.includes("greenhouse.io/embed/job_app")) {
        window.open(iframe.src, "_blank");
        throw new Error("GREENHOUSE_IFRAME_REDIRECT");
      }
    }

    return false;
  }
  
  private async defaultAutofill() {
    const formElements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="submit"]):not([type="button"]):not([type="image"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select'
    );
    
    let filledCount = 0;
    let unmatchedCount = 0;
    let unknownCount = 0;
    const totalFields = formElements.length;
    
    console.log(`Found ${totalFields} fillable fields`);
    
    for (const element of formElements) {
      const fieldKey = matchField(element);
      
      if (fieldKey) {
        const matcher = FIELD_MATCHERS[fieldKey];
        console.log(`Matched field: ${fieldKey} for element:`, element);
        
        if (matcher.handleSpecialCases) {
          try {
            await matcher.handleSpecialCases(element, this.profile!);
            filledCount++;
          } catch (error) {
            console.error(`Error in special case handler for ${fieldKey}:`, error);
            unmatchedCount++;
          }
        } else {
          const value = matcher.getValue(this.profile!);
          
          if (value) {
            try {
              if (element instanceof HTMLSelectElement) {
                const isSearchable = this.isSearchableSelect(element);
                const success = await CommonInputSimulator.fillSelect(element, value, { searchable: isSearchable });
                if (success) {
                  filledCount++;
                  console.log(`Successfully filled ${fieldKey}: ${value}`);
                } else {
                  unmatchedCount++;
                  console.warn(`Failed to fill ${fieldKey}, no matching option for: ${value}`);
                }
              } else {
                await CommonInputSimulator.fillInput(element, value);
                filledCount++;
                console.log(`Successfully filled ${fieldKey}: ${value}`);
              }
            } catch (error) {
              console.error(`Error filling field ${fieldKey}:`, error);
              unmatchedCount++;
            }
          } else {
            unmatchedCount++;
            console.log(`Matched field "${fieldKey}" but no value in profile for:`, element);
          }
        }
      } else {
        unknownCount++;
        console.log("Unknown field (no pattern match):", {
          element,
          name: element.getAttribute("name"),
          id: element.getAttribute("id"),
          placeholder: element.getAttribute("placeholder"),
          ariaLabel: element.getAttribute("aria-label"),
        });
      }
    }

    console.log(
      `Autofilled ${filledCount}/${totalFields} fields, unmatched: ${unmatchedCount}, unknown: ${unknownCount}`
    );
    return { filledCount, totalFields, unmatchedCount, unknownCount };
  }
  
  private isSearchableSelect(select: HTMLSelectElement): boolean {
    const parent = select.parentElement;
    if (!parent) return false;

    const indicators = [
      parent.querySelector('[class*="select"]'),
      parent.querySelector('[class*="Select"]'),
      parent.querySelector('[class*="dropdown"]'),
      parent.querySelector('[class*="Dropdown"]'),
      parent.classList.contains("v-select"),
      parent.querySelector(".vs__dropdown-toggle"),
      parent.querySelector("mat-select"),
      select.getAttribute("mat-select") !== null,
      parent.classList.contains("ui") && parent.classList.contains("dropdown"),
      select.classList.contains("selectize-input"),
      select.classList.contains("select2-hidden-accessible"),
    ];

    return indicators.some((indicator) => indicator);
  }
}

export const autofillEngine = new AutofillEngineClass();
