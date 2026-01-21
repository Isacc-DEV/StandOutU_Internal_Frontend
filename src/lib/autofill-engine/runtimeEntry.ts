import { autofillCollectGreenhouseQuestions, autofillRuntime } from "./runtime";

declare global {
  interface Window {
    autofillRuntime?: typeof autofillRuntime;
    autofillCollectGreenhouseQuestions?: typeof autofillCollectGreenhouseQuestions;
  }
}

if (typeof window !== "undefined") {
  window.autofillRuntime = autofillRuntime;
  window.autofillCollectGreenhouseQuestions = autofillCollectGreenhouseQuestions;
}
