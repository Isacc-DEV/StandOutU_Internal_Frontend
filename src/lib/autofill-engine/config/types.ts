export type ReactSelectSelectors = {
  container: string[];
  control: string[];
  menuList: string[];
  option: string[];
  input: string[];
  multiValueContainer: string[];
};

export type FieldCollectorSelectors = {
  formFields: string[];
  labelContainers: string[];
  labelElements: string[];
  requiredIndicators: string[];
  checkboxWrappers: string[];
  checkboxGroupContainers?: string[];
  checkboxOptionLabelSelectors?: string[];
  radioGroupContainers?: string[];
  radioOptionLabelSelectors?: string[];
};

export type DomainAutofillSelectors = {
  fieldCollector: FieldCollectorSelectors;
  reactSelect: ReactSelectSelectors;
};

export type CustomFieldDefinition = {
  patterns: RegExp[];
  type:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio"
    | "react-select"
    | "react-multi-select";
  value?: string;
  index?: number;
  indices?: number[];
};
