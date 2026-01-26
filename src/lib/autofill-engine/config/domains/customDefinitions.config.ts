import type { CustomFieldDefinition } from "../types";

export const GREENHOUSE_CUSTOM_FIELD_DEFINITIONS: CustomFieldDefinition[] = [
  // Work Authorization
  {
    patterns: [
      /legally authorized to work/i,
      /work authorization/i,
      /authorized to work.*country/i,
      /legal.*work.*country/i,
      /authorized.*work.*employment/i,
    ],
    type: "react-select",
    index: 0,
  },

  // Veteran Status
  {
    patterns: [/veteran.*status/i, /military.*service/i, /protected.*veteran/i],
    type: "react-select",
    index: 0,
  },

  // Disability Status
  {
    patterns: [/disability.*status/i, /disabled/i, /physical.*mental.*disability/i],
    type: "react-select",
    index: 1,
  },

  // Gender
  {
    patterns: [/^gender$/i, /gender identity/i, /gender.*select/i],
    type: "react-select",
    index: 0,
  },

  // Hispanic/Latino
  {
    patterns: [/hispanic.*latino/i, /are you hispanic/i, /hispanic\/latino/i, /latino.*latina/i],
    type: "react-select",
    index: 1,
  },

  // Data processing / privacy consent
  {
    patterns: [
      /agree.*process.*data/i,
      /processes? my data/i,
      /privacy.*policy/i,
      /data.*processing/i,
      /consent.*data/i,
    ],
    type: "react-select",
    value: "Yes",
  },

  // Data retention checkbox consent
  {
    patterns: [/retain.*data/i, /allow.*retain/i, /agree.*retain/i, /keep.*data/i],
    type: "checkbox",
    value: "true",
  },

  // Terms of use acknowledgement (Destination Pet, etc.)
  {
    patterns: [
      /terms of use/i,
      /acknowledge.*terms/i,
      /understand.*terms/i,
      /destination pet/i,
    ],
    type: "checkbox",
    value: "true",
  },

  // Source of vacancy
  {
    patterns: [
      /where did you.*hear/i,
      /where did you.*see/i,
      /how did you.*hear/i,
      /source of.*vacancy/i,
      /source of.*job/i,
    ],
    type: "react-select",
    value: "LinkedIn",
  },

  // Phone device type (Workday)
  {
    patterns: [/phone device type/i, /phone.*type/i],
    type: "select",
    value: "Mobile",
  },

  // Prefix (Workday)
  {
    patterns: [/^prefix$/i, /name.*prefix/i],
    type: "select",
    index: 2,
  },

  // Suffix (Workday)
  {
    patterns: [/^suffix$/i, /name.*suffix/i],
    type: "select",
    index: 0,
  },
];
