export type MarkedQuestion = { marks: number | null; questionTopics: { topicId: string; topic: { topicName: string; module: { name: string } } }[] }
export function aggregateTopicMarks(questions: MarkedQuestion[]) {
  const totalPublishedMarks = questions.reduce((sum, question) => sum + (question.marks ?? 0), 0)
  const topics = new Map<string, { topicId: string; topic: string; module: string; appearances: number; totalMarks: number }>()
  for (const question of questions) {
    const links = [...new Map(question.questionTopics.map((link) => [link.topicId, link])).values()]
    for (const link of links) {
      const row = topics.get(link.topicId) ?? { topicId: link.topicId, topic: link.topic.topicName, module: link.topic.module.name, appearances: 0, totalMarks: 0 }
      row.appearances++
      // Multi-topic questions split their marks to keep the overall share meaningful.
      row.totalMarks += (question.marks ?? 0) / links.length
      topics.set(link.topicId, row)
    }
  }
  return { totalPublishedMarks, publishedQuestionCount: questions.length, topics: [...topics.values()].map((row) => ({ ...row, averageMarks: row.totalMarks / row.appearances, markShare: totalPublishedMarks ? row.totalMarks / totalPublishedMarks : 0 })).sort((a, b) => b.totalMarks - a.totalMarks) }
}
