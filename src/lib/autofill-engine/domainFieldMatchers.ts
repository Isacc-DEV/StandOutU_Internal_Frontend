import { GREENHOUSE_SELECTORS } from "./config/domains/greenhouse/selectors.config";
import {
  GREENHOUSE_FIELD_MATCHERS,
  type GreenhouseFieldMatcher,
} from "./config/domains/greenhouse/fieldMatchers.config";
import { WORKDAY_FIELD_MATCHERS } from "./config/domains/workday/fieldMatchers.config";
import { EngineMode } from "./types";

export type DomainFieldMatcher = GreenhouseFieldMatcher;
export const DOMAIN_FIELD_MATCHERS = GREENHOUSE_FIELD_MATCHERS;

export const getDomainFieldMatchers = (engineMode: EngineMode) => {
  if (engineMode === "workday") {
    return WORKDAY_FIELD_MATCHERS;
  }
  return GREENHOUSE_FIELD_MATCHERS;
};

const findClosestLabelElement = (element: HTMLElement): HTMLLabelElement | null => {
  let currentElement: HTMLElement | null = element
  for (let i = 0; i < 10; i++) {
    const parent = currentElement?.parentElement as HTMLElement | null
    const label = parent?.querySelector("label")
    if (label) {
      return label
    }
    currentElement = parent
  }
  return null
}

export function matchDomainField(element: HTMLElement, engineMode: EngineMode): { key: string, label: string } {
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

  let labelElement: HTMLLabelElement | null = null
  switch (engineMode) {
    case 'greenhouse':
      labelElement = element.closest(labelContainerSelector)?.querySelector("label") as HTMLLabelElement | null
      break
    case 'workday':
      labelElement = findClosestLabelElement(element)
      break
    default:
      labelElement = findClosestLabelElement(element)
      break
  }

  const labelText = labelElement?.textContent || ''
  const normalizedLabelText = labelText.replace(/\*/g, '').replace(/[:;]$/g, '').trim().toLowerCase()

  console.log('labelText', labelText)
  const textToMatch = `${id} ${name} ${label} ${placeholder} ${labelText} ${ariaDescription} ${ariaLabelText}`.toLowerCase()
  const matchers = getDomainFieldMatchers(engineMode)

  if (engineMode === 'workday') {
    if (/^(street name|street address|address line 1|address line1)$/i.test(normalizedLabelText)) {
      return { key: 'streetName', label: labelText }
    }
    if (/^city$/i.test(normalizedLabelText)) {
      return { key: 'city', label: labelText }
    }
    if (/^(postal code|zip|zip code|postcode)$/i.test(normalizedLabelText)) {
      return { key: 'postalCode', label: labelText }
    }
  }
  
  // Special check for phone country code selector
  const isPhoneCountry = element.closest('.phone-input__country') !== null || 
                         element.closest('.phone-input') !== null ||
                         /country.*label/i.test(ariaLabelledBy || '') && /phone/i.test(textToMatch) ||
                         (textToMatch.includes('country') && (textToMatch.includes('phone') || textToMatch.includes('dial')))
  
  if (isPhoneCountry) {
    return { key: 'phoneCountry', label: labelText }
  }

  if (normalizedLabelText === 'country') {
    return { key: 'country', label: labelText }
  }
  
  for (const [fieldKey, matcher] of Object.entries(matchers)) {
    // Skip country matcher if this is a phone country selector
    if (fieldKey === 'country' && isPhoneCountry) {
      continue
    }
    
    for (const pattern of matcher.patterns) {
      if (pattern.test(textToMatch)) {
        return { key: fieldKey, label: labelText }
      }
    }
  }
  
  return { key: '', label: labelText }
}
