import { GREENHOUSE_SELECTORS } from "./config/domains/greenhouse/selectors.config";
import {
  GREENHOUSE_FIELD_MATCHERS,
  type GreenhouseFieldMatcher,
} from "./config/domains/greenhouse/fieldMatchers.config";

export type DomainFieldMatcher = GreenhouseFieldMatcher;
export const DOMAIN_FIELD_MATCHERS = GREENHOUSE_FIELD_MATCHERS;

export function matchDomainField(element: HTMLElement): string | null {
  const id = element.getAttribute('id') || ''
  const name = element.getAttribute('name') || ''
  const label = element.getAttribute('aria-label') || ''
  const placeholder = element.getAttribute('placeholder') || ''
  const ariaDescribedBy = element.getAttribute('aria-describedby')
  const ariaLabelledBy = element.getAttribute('aria-labelledby')
  
  let ariaDescription = ''
  if (ariaDescribedBy) {
    const descElement = document.getElementById(ariaDescribedBy)
    ariaDescription = descElement?.textContent || ''
  }
  
  let ariaLabelText = ''
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy)
    ariaLabelText = labelElement?.textContent || ''
  }
  
  const labelContainerSelector = [
    ...GREENHOUSE_SELECTORS.fieldCollector.labelContainers,
    ".phone-input",
    ".phone-input__country",
  ].join(", ");
  const labelElement = element
    .closest(labelContainerSelector)
    ?.querySelector("label")
  const labelText = labelElement?.textContent || ''
  
  const textToMatch = `${id} ${name} ${label} ${placeholder} ${labelText} ${ariaDescription} ${ariaLabelText}`.toLowerCase()
  
  // Special check for phone country code selector
  const isPhoneCountry = element.closest('.phone-input__country') !== null || 
                         element.closest('.phone-input') !== null ||
                         /country.*label/i.test(ariaLabelledBy || '') && /phone/i.test(textToMatch)
  
  if (isPhoneCountry && id === 'country') {
    return 'phoneCountry'
  }
  
  for (const [fieldKey, matcher] of Object.entries(DOMAIN_FIELD_MATCHERS)) {
    // Skip country matcher if this is a phone country selector
    if (fieldKey === 'country' && isPhoneCountry) {
      continue
    }
    
    for (const pattern of matcher.patterns) {
      if (pattern.test(textToMatch)) {
        return fieldKey
      }
    }
  }
  
  return null
}
