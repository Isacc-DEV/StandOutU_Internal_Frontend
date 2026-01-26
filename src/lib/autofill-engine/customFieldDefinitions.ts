import type { CustomFieldDefinition } from './config/types'
import { GREENHOUSE_CUSTOM_FIELD_DEFINITIONS } from './config/domains/customDefinitions.config'

/**
 * Custom Field Definitions
 *
 * Define pre-configured answers for common custom questions to avoid sending them to AI.
 * This improves performance and ensures consistent answers.
 */

export type { CustomFieldDefinition }

export const CUSTOM_FIELD_DEFINITIONS: CustomFieldDefinition[] = GREENHOUSE_CUSTOM_FIELD_DEFINITIONS

/**
 * Find a custom field definition that matches the given question label
 */
export function findCustomFieldDefinition(label: string, type: string): CustomFieldDefinition | null {
  const normalizedLabel = label.toLowerCase().trim()
  
  for (const definition of CUSTOM_FIELD_DEFINITIONS) {
    // Normalize select types (treat select/react-select as the same single-select)
    const defType =
      definition.type === 'react-multi-select'
        ? 'react-multi-select'
        : definition.type === 'react-select' || definition.type === 'select'
          ? 'select'
          : definition.type
    const fieldType =
      type === 'react-multi-select'
        ? 'react-multi-select'
        : type === 'react-select' || type === 'select'
          ? 'select'
          : type
    
    if (defType !== fieldType) {
      continue
    }
    
    // Check if any pattern matches
    for (const pattern of definition.patterns) {
      if (pattern.test(normalizedLabel)) {
        return definition
      }
    }
  }
  
  return null
}

/**
 * Get the formatted value for a custom field definition
 * Handles index-based selection and multi-select
 */
export function getCustomFieldValue(
  definition: CustomFieldDefinition,
  options?: string[]
): string | null {
  // For text/textarea, return direct value
  if (definition.type === 'text' || definition.type === 'textarea') {
    return definition.value || null
  }
  
  // For select/radio/react-select with index
  if ((definition.type === 'select' || definition.type === 'radio' || definition.type === 'react-select') && definition.index !== undefined) {
    // Always return index format for select types
    return `#${definition.index}`
  }
  
  // For checkbox with indices
  if (definition.type === 'checkbox' && definition.indices !== undefined) {
    if (!options || options.length === 0) {
      return definition.value || null
    }
    
    const validIndices = definition.indices
      .map(idx => idx < 0 ? options.length + idx : idx)
      .filter(idx => idx >= 0 && idx < options.length)
    
    if (validIndices.length > 0) {
      return validIndices.map(idx => `#${idx}`).join(',')
    }
    
    return definition.value || null
  }
  
  // Fallback to direct value
  return definition.value || null
}
