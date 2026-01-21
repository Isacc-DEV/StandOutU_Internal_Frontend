import type { DomainAutofillSelectors } from "../../types";

export const GREENHOUSE_SELECTORS: DomainAutofillSelectors = {
  fieldCollector: {
    formFields: [
      'input[type="text"]:not([type="hidden"])',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="url"]',
      'input[type="number"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      "textarea",
      "select",
    ],
    labelContainers: [
      ".form-group",
      ".field",
      ".input-wrapper",
      ".select-shell",
      ".select__container",
      '[class*="question"]',
    ],
    labelElements: ["label", "legend", ".label", "h1", "h2", "h3", "h4", "h5", "h6"],
    requiredIndicators: [".required", ".asterisk", '[aria-label*="required"]'],
    checkboxWrappers: [".checkbox__wrapper"],
  },
  reactSelect: {
    container: [".select-shell", ".select__container", ".select"],
    control: [".select__control"],
    menuList: [".select__menu-list", ".select_menu-list"],
    option: [".select__option"],
    input: ['.select__input', '[role="combobox"][aria-autocomplete="list"]'],
    multiValueContainer: [".select__value-container--is-multi"],
  },
};
