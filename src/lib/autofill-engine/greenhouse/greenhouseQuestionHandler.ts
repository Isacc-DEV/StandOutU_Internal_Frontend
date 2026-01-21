import { Profile } from "../profile";

export interface GreenhouseQuestion {
  id: string
  type: 'text' | 'textarea' | 'select' | 'multi_value_single_select' | 'checkbox' | 'file'
  label: string
  required: boolean
  element: HTMLElement
  options?: string[]
}

export interface GreenhouseAiQuestionPayload {
  id: string
  type: GreenhouseQuestion['type']
  label: string
  required: boolean
  options?: string[]
}

export interface AIQuestionResponse {
  question: string
  answer: string
  selectedIndex?: number
  selectedIndices?: number[]
}

export class GreenhouseQuestionHandler {
  private openaiApiKey: string | null = null
  private answerOverrides: AIQuestionResponse[] | null = null
  
  setApiKey(apiKey: string) {
    this.openaiApiKey = apiKey
  }

  setAnswerOverrides(responses: AIQuestionResponse[] | null) {
    this.answerOverrides = responses
  }
  
  private getApiKey(): string | null {
    if (this.openaiApiKey) {
      return this.openaiApiKey;
    }

    return null;
  }

  private log(_message: string, _data?: Record<string, unknown>) {}

  private consumeAnswerOverrides(): AIQuestionResponse[] | null {
    if (!this.answerOverrides) {
      return null
    }
    const overrides = this.answerOverrides
    this.answerOverrides = null
    return overrides
  }
  
  async analyzeAndAnswerQuestions(questions: GreenhouseQuestion[], profile: Profile): Promise<Map<string, string>> {
    const answers = new Map<string, string>()
    
    const overrideResponses = this.consumeAnswerOverrides()
    const apiKey = this.getApiKey()
    
    if ((!apiKey && !overrideResponses) || questions.length === 0) {
      this.log('skipping: missing api key or no questions', {
        hasKey: Boolean(apiKey),
        hasOverrides: Boolean(overrideResponses),
        questionCount: questions.length
      })
      return answers
    }

    this.log('requesting answers', { questionCount: questions.length })
    
    try {
      const aiResponses = overrideResponses ?? await this.getAIAnswers(questions, profile)
      this.log('responses received', { responseCount: aiResponses.length })
      let matchedCount = 0
      
      aiResponses.forEach((response) => {
        // Strip "(REQUIRED)" from the response question for matching
        const cleanResponseQuestion = response.question.replace(/\s*\(REQUIRED\)\s*$/i, '').trim()
        
        const matchedQuestion = questions.find(
          q => this.normalizeText(q.label) === this.normalizeText(cleanResponseQuestion)
        )
        
        if (matchedQuestion) {
          matchedCount += 1
          // Handle checkbox with multiple selections
          if (response.selectedIndices !== undefined && matchedQuestion.type === 'checkbox') {
            const value = response.selectedIndices.map(idx => `#${idx}`).join(',')
            answers.set(matchedQuestion.id, value)
          }
          // Handle single select with index (all select types)
          else if (response.selectedIndex !== undefined) {
            const value = `#${response.selectedIndex}`
            answers.set(matchedQuestion.id, value)
          } 
          // Handle text answers
          else {
            answers.set(matchedQuestion.id, response.answer)
          }
        }
      })

      this.log('answers matched', { matchedCount })
    } catch (error) {
      console.error('AI Error:', error)
    }
    
    return answers
  }
  
  private normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '')
  }
  
  private async getAIAnswers(questions: GreenhouseQuestion[], profile: Profile): Promise<AIQuestionResponse[]> {
    const prompt = this.buildPrompt(questions, profile)
    
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return []
    }

    console.log('[AI Prompt]', prompt)
    this.log('sending OpenAI request', { questionCount: questions.length })
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are answering job applications for a senior software engineer with 10+ years of comprehensive experience across all modern technologies, platforms, and domains. The candidate is applying through job board platforms (LinkedIn, Indeed, etc.), not through recruiters or referrals. Always answer with confidence and expertise. For SELECT questions: return {"answer": "text", "selectedIndex": number}. For CHECKBOX: return {"answer": "text", "selectedIndices": [numbers]}. Return JSON array format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      console.log("[autofill-engine]", "response", response);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        const detail = errorText.trim() || "<empty response body>"
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${detail}`)
      }
      
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      
      console.log('[AI Response]', content)
      
      if (!content) {
        throw new Error('No content in OpenAI response')
      }
      
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        this.log('parsed response', { parsedCount: Array.isArray(parsed) ? parsed.length : 0 })
        return Array.isArray(parsed) ? parsed : []
      }
      
      return []
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const name = error instanceof Error ? error.name : "UnknownError"
      const stack =
        error instanceof Error && error.stack
          ? error.stack.split("\n").slice(0, 3).join(" | ")
          : undefined
      const details = {
        name,
        message,
        stack,
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
        url: "https://api.openai.com/v1/chat/completions",
      }
      console.log("[AI Response]", `ERROR: ${JSON.stringify(details)}`)
      return []
    }
  }
  
  private buildPrompt(questions: GreenhouseQuestion[], profile: Profile): string {
    const questionList = questions.map((q, idx) => {
      let questionText = `${idx + 1}. ${q.label}`
      if (q.required) {
        questionText += ' (REQUIRED)'
      }
      // Show options for any question type that has options
      if (q.options && q.options.length > 0) {
        if (q.type === 'checkbox') {
          questionText += `\n   Type: CHECKBOX\n   Options: ${q.options.map((opt, i) => `[${i}] ${opt}`).join(', ')}`
        } else {
          questionText += `\n   Type: SELECT\n   Options: ${q.options.map((opt, i) => `[${i}] ${opt}`).join(', ')}`
        }
      }
      return questionText
    }).join('\n')
    
    const workHistory = profile.workExperience?.length > 0 
      ? profile.workExperience.map(exp => {
          const parts = [
            exp.company ? `Company: ${exp?.company}` : null,
            exp.position ? `Role: ${exp?.position}` : null,
            exp?.startDate || exp?.endDate ? `Period: ${exp?.startDate || 'N/A'} - ${exp?.endDate || 'Present'}` : null,
            exp.description ? `Description: ${exp?.description}` : null
          ].filter(Boolean)
          return parts.join('\n')
        }).join('\n\n')
      : (profile.resume?.workExperience?.length ?? 0) > 0
      ? (profile.resume?.workExperience ?? []).map(exp => {
          const parts = [
            exp.companyTitle ? `${exp.companyTitle}` : null,
            exp.roleTitle ? `${exp.roleTitle}` : null,
            exp.startDate || exp.endDate ? `${exp.startDate || 'N/A'} - ${exp.endDate || 'Present'}` : null,
          ].filter(Boolean)
          return parts.join('\n')
        }).join('\n\n')
      : 'Extensive software engineering background'

    const education = profile.education?.length > 0
      ? profile.education.map(edu => {
          const parts = [
            edu?.school ? `University: ${edu?.school}` : null,
            edu?.degree ? `Degree: ${edu?.degree}` : null,
            edu?.major ? `Major: ${edu?.major}` : null,
            edu?.startDate || edu?.endDate ? `Period: ${edu?.startDate || 'N/A'} - ${edu?.endDate || 'Present'}` : null,
            edu?.gpa ? `GPA: ${edu?.gpa}` : null
          ].filter(Boolean)
          return parts.join('\n')
        }).join('\n\n')
      : (profile.resume?.education?.length ?? 0) > 0
      ? (profile.resume?.education ?? []).map(edu => {
          const parts = [
            edu.institution ? `${edu.institution}` : null,
            edu.degree ? `${edu.degree}` : null,
            edu.field ? `${edu.field}` : null,
            edu.date ? `${edu.date}` : null,
          ].filter(Boolean)
          return parts.join('\n')
        }).join('\n\n')
      : 'Computer Science degree'

    return `
CANDIDATE: ${profile.personalInfo.firstName} ${profile.personalInfo.lastName} - Senior Software Engineer with 10+ years experience
Contact: ${profile.personalInfo.email} | ${profile.personalInfo.phone.countryCode} ${profile.personalInfo.phone.number}
Location: ${[profile.personalInfo.city, profile.personalInfo.state, profile.personalInfo.country].filter(Boolean).join(', ')}

WORK HISTORY:
${workHistory}

EDUCATION:
${education}

QUESTIONS:
${questionList}

INSTRUCTIONS:
You are a versatile senior engineer with expertise across ALL modern technologies and platforms. Answer with complete confidence.

RULES:
1. Technical questions: Always answer "Yes" or select positive options. Provide 5-10+ years experience for any technology.
2. Implementation questions: Confirm with specific technical details (e.g., "Yes, I've implemented [X] in production with [specific patterns/tools]")
3. Work authorization: Answer honestly based on actual status
4. Motivation questions: Show genuine interest in the company
5. Text answers: 40-150 words, assertive tone using "I have", "I've implemented", "I've successfully delivered"
6. NEVER use hedging language: "While I haven't", "Although not directly", "similar to", "transferable skills"

FORMAT:
- SELECT questions: {"question": "exact question text", "answer": "exact option text", "selectedIndex": 0}
- CHECKBOX questions: {"question": "exact question text", "answer": "Option1, Option2", "selectedIndices": [0, 2]}
- TEXT questions: {"question": "exact question text", "answer": "your detailed answer"}

Return ONLY valid JSON array:
[
  {"question": "Question 1 text", "answer": "Your answer"},
  {"question": "Select question", "answer": "Selected option", "selectedIndex": 0},
  {"question": "Checkbox question", "answer": "Opt1, Opt2", "selectedIndices": [0, 2]}
]
`
  }
}

export const greenhouseQuestionHandler = new GreenhouseQuestionHandler()
