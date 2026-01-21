import { autofillCollectDomainQuestions, autofillRuntime } from "./runtime";

declare global {
  interface Window {
    autofillRuntime?: typeof autofillRuntime;
    autofillCollectDomainQuestions?: typeof autofillCollectDomainQuestions;
  }
}

if (typeof window !== "undefined") {
  window.autofillRuntime = autofillRuntime;
  window.autofillCollectDomainQuestions = autofillCollectDomainQuestions;
}
