/**
 * Custom Field Definitions
 * 
 * Define pre-configured answers for common custom questions to avoid sending them to AI.
 * This improves performance and ensures consistent answers.
 */

export interface CustomFieldDefinition {
  // Pattern to match the question label
  patterns: RegExp[]
  // Type of field
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'react-select' | 'react-multi-select'
  // Direct value for text/textarea fields
  value?: string
  // Index for single-select fields (0-based)
  index?: number
  // Array of indices for multi-select/checkbox fields (0-based)
  indices?: number[]
}

export const CUSTOM_FIELD_DEFINITIONS: CustomFieldDefinition[] = [
  // Work Authorization
  {
    patterns: [
      /legally authorized to work/i,
      /work authorization/i,
      /authorized to work.*country/i,
      /legal.*work.*country/i,
      /authorized.*work.*employment/i
    ],
    type: 'react-select',
    index: 0
  },
  
  // Veteran Status
  {
    patterns: [
      /veteran.*status/i,
      /military.*service/i,
      /protected.*veteran/i
    ],
    type: 'react-select',
    index: 0
  },
  
  // Disability Status
  {
    patterns: [
      /disability.*status/i,
      /disabled/i,
      /physical.*mental.*disability/i
    ],
    type: 'react-select',
    index: 1
  },
  
  // Gender
  {
    patterns: [
      /^gender$/i,
      /gender identity/i,
      /gender.*select/i
    ],
    type: 'react-select',
    index: 0
  },
  
  // Hispanic/Latino
  {
    patterns: [
      /hispanic.*latino/i,
      /are you hispanic/i,
      /hispanic\/latino/i,
      /latino.*latina/i
    ],
    type: 'react-select',
    index: 1
  },

  // Data processing / privacy consent
  {
    patterns: [
      /agree.*process.*data/i,
      /processes? my data/i,
      /privacy.*policy/i,
      /data.*processing/i,
      /consent.*data/i
    ],
    type: 'react-select',
    value: 'Yes'
  },

  // Data retention checkbox consent
  {
    patterns: [
      /retain.*data/i,
      /allow.*retain/i,
      /agree.*retain/i,
      /keep.*data/i
    ],
    type: 'checkbox',
    value: 'true'
  },

  // Source of vacancy
  {
    patterns: [
      /where did you.*hear/i,
      /where did you.*see/i,
      /how did you.*hear/i,
      /source of.*vacancy/i,
      /source of.*job/i
    ],
    type: 'react-select',
    value: 'LinkedIn'
  }
]

/**
 * Find a custom field definition that matches the given question label
 */
export function findCustomFieldDefinition(label: string, type: string): CustomFieldDefinition | null {
  const normalizedLabel = label.toLowerCase().trim()
  
  for (const definition of CUSTOM_FIELD_DEFINITIONS) {
    // Check if type matches (treat react-select same as select)
    const defType = definition.type === 'react-select' || definition.type === 'react-multi-select' ? 'react-select' : definition.type
    const fieldType = type === 'react-select' || type === 'react-multi-select' ? 'react-select' : type
    
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
