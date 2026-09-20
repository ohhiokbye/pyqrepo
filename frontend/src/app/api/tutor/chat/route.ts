import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { QuestionResult } from '@/lib/types'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ChatRequestBody = {
  messages: ChatMessage[]
  context: {
    courseCode: string
    moduleId?: string
    topicName?: string
  }
  apiKey?: string
  provider?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody
    const { messages, context, apiKey: clientApiKey, provider = 'gemini' } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return NextResponse.json({ error: 'Invalid messages array (1-50 allowed)' }, { status: 400 })
    }

    if (messages.some((m) => typeof m.content !== 'string' || m.content.length > 4000)) {
      return NextResponse.json({ error: 'Message content must be a string under 4000 characters' }, { status: 400 })
    }

    if (!context || !context.courseCode || typeof context.courseCode !== 'string' || context.courseCode.length > 15) {
      return NextResponse.json({ error: 'Valid course code context is required' }, { status: 400 })
    }

    // 1. Resolve API Key: client provided -> server environment
    const apiKey = (clientApiKey && clientApiKey.trim().length > 0)
      ? clientApiKey.trim()
      : (process.env.GEMINI_API_KEY || '').trim()

    if (!apiKey) {
      return NextResponse.json({
        error: 'AI_KEY_REQUIRED',
        message: 'No AI API key configured. Please configure your Gemini API key in the tutor settings to enable conversational tutoring.',
      }, { status: 401 })
    }

    // 2. Fetch Course & Syllabus Hierarchy from Database
    const course = await prisma.course.findUnique({
      where: { code: context.courseCode },
      include: {
        modules: {
          include: { topics: true },
          orderBy: { moduleNo: 'asc' },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: `Course ${context.courseCode} not found` }, { status: 404 })
    }

    // 3. Fetch Grounding Questions for this Course & Topic
    const topicFilter = context.topicName?.trim()
    const matchingQuestions = await prisma.question.findMany({
      where: {
        paper: {
          course: { code: context.courseCode },
        },
        ...(topicFilter
          ? {
              OR: [
                {
                  questionTopics: {
                    some: {
                      topic: {
                        topicName: {
                          contains: topicFilter,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                },
                {
                  extractedText: {
                    contains: topicFilter,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      take: 8,
      orderBy: [
        { paper: { year: 'desc' } },
        { questionNumber: 'asc' },
      ],
      include: {
        paper: {
          include: { course: true },
        },
        questionTopics: {
          include: { topic: true },
        },
      },
    })

    // If few questions match the specific topic, fetch general questions from this course
    let generalQuestions: typeof matchingQuestions = []
    if (matchingQuestions.length < 5) {
      generalQuestions = await prisma.question.findMany({
        where: {
          paper: { course: { code: context.courseCode } },
          id: { notIn: matchingQuestions.map((q) => q.id) },
        },
        take: 6 - matchingQuestions.length,
        orderBy: [
          { paper: { year: 'desc' } },
          { questionNumber: 'asc' },
        ],
        include: {
          paper: {
            include: { course: true },
          },
          questionTopics: {
            include: { topic: true },
          },
        },
      })
    }

    const allGroundingQuestions = [...matchingQuestions, ...generalQuestions]

    const formattedQuestions: QuestionResult[] = allGroundingQuestions.map((q) => {
      const primaryTopic = q.questionTopics[0]
      return {
        id: q.id,
        questionNumber: q.questionNumber,
        marks: q.marks,
        extractedText: q.extractedText,
        imageCropS3Key: q.imageCropS3Key,
        cropUrl: q.imageCropS3Key ? `/api/crops/${q.imageCropS3Key}` : null,
        paper: {
          id: q.paper.id,
          examType: q.paper.examType,
          year: q.paper.year,
        },
        course: {
          id: q.paper.course.id,
          code: q.paper.course.code,
          title: q.paper.course.title,
        },
        primaryTopic: primaryTopic
          ? {
              id: primaryTopic.topic.id,
              name: primaryTopic.topic.topicName,
              confidence: primaryTopic.confidence,
            }
          : null,
        topics: q.questionTopics.map((qt) => ({
          id: qt.topic.id,
          name: qt.topic.topicName,
          confidence: qt.confidence,
        })),
      }
    })

    // 4. Build Structured Grounding Prompt for the Academic Tutor
    const modulesSummary = course.modules
      .map((m) => `Module ${m.moduleNo} (${m.name}): ` + m.topics.map((t) => t.topicName).join(', '))
      .join('\n')

    const pyqSummary = formattedQuestions.length > 0
      ? formattedQuestions
          .map((q, idx) => {
            const marksStr = q.marks ? `[${q.marks} Marks]` : ''
            const examStr = `${q.paper.examType}${q.paper.year ? ' ' + q.paper.year : ''}`
            const textSnippet = q.extractedText.slice(0, 200).replace(/\n+/g, ' ')
            return `Question #${idx + 1} (${q.questionNumber}, ${examStr} ${marksStr}):\n"${textSnippet}"`
          })
          .join('\n\n')
      : 'No specific archived exam questions indexed yet for this course.'

    const systemPrompt = `You are a distinguished university academic tutor for the course: ${course.code} — ${course.title} (${course.credits} Credits).
Your primary role is to teach concepts with rigorous clarity, guide the student through their syllabus, and directly ground your answers in the historical university examination papers (PYQs).

Official Course Syllabus:
${modulesSummary}

Currently Selected Focus:
- Course: ${course.code} - ${course.title}
- Focus Topic: ${context.topicName || 'Entire Course Syllabus'}

Historical University Examination Questions (Grounding Context):
${pyqSummary}

Core Pedagogical Guidelines:
1. Explain technical concepts clearly, logically, and systematically.
2. Directly reference the historical exam questions above when explaining concepts! (e.g. "Notice how this concept appeared in your CAT2 exam as a 10-mark question...", "Faculty frequently test this by asking you to normalize a relation or compute covariance...").
3. Point out examination expectations: what steps are mandatory for full marks, common pitfalls, and calculation/derivation traps.
4. Keep the tone academic, encouraging, and focused. Avoid marketing cliches or generic conversational filler.
5. Format mathematical equations, schema, or code using clean standard markdown blocks.`

    // 5. Call LLM (Gemini 3.6 Flash)
    const geminiContents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\nPlease acknowledge and prepare to tutor the student.' }],
      },
      {
        role: 'model',
        parts: [{ text: `Understood. I am ready to tutor you on ${course.code} (${course.title}), grounded strictly in your official syllabus and university examination papers. What would you like to explore or practice?` }],
      },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    ]

    const geminiPayload = {
      contents: geminiContents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }

    // 5. Call LLM with multi-model fallback and retry on transient 503 / 429
    const candidateModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']
    let replyText = ''
    let lastError = ''

    for (const modelName of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
          })

          if (res.ok) {
            const data = await res.json()
            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (candidateText) {
              replyText = candidateText
              break
            }
          } else if (res.status === 503 || res.status === 429) {
            lastError = `Model ${modelName} returned status ${res.status}`
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            continue
          } else {
            const errBody = await res.text()
            lastError = `Model ${modelName} returned status ${res.status}: ${errBody.slice(0, 150)}`
            break // try next model
          }
        } catch (fetchErr) {
          lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        }
      }
      if (replyText) break
    }

    if (!replyText) {
      // Fallback: If cloud LLMs are temporarily overloaded, provide grounded syllabus guidance
      replyText = `### University Examination Overview: ${course.code} (${course.title})\n\n` +
        `I am grounding your study in the **${context.topicName || course.title}** syllabus.\n\n` +
        `**Key Exam Areas & Question Trends:**\n` +
        (formattedQuestions.length > 0
          ? formattedQuestions.slice(0, 3).map((q) => 
              `- **${q.questionNumber} (${q.paper.examType}${q.paper.year ? ' ' + q.paper.year : ''}${q.marks ? ', ' + q.marks + ' marks' : ''}):** ` +
              `*${q.extractedText.slice(0, 150).replace(/\n+/g, ' ')}...*`
            ).join('\n')
          : `- Review the course syllabus modules for key definitions and step-by-step algorithms.\n`) +
        `\n\n*(Note: Cloud AI model is experiencing peak traffic; questions and syllabus references above are loaded directly from your university exam bank.)*`
    }

    return NextResponse.json({
      success: true,
      reply: replyText,
      grounding: {
        course: {
          code: course.code,
          title: course.title,
          credits: course.credits,
        },
        topicName: context.topicName || null,
        relevantQuestions: formattedQuestions,
      },
    })
  } catch (error) {
    console.error('[Tutor API Exception]', error)
    return NextResponse.json({
      error: 'Failed to process tutor conversation',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
