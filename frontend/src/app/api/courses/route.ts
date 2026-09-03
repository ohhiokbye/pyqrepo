import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    let courses = await prisma.course.findMany({
      include: {
        modules: {
          include: {
            topics: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    // If no courses exist in the database, automatically initialize the base DBMS course
    if (courses.length === 0) {
      const defaultCourse = await prisma.course.create({
        data: {
          code: 'CSE2005',
          title: 'Database Management Systems',
          credits: 4,
          modules: {
            create: [
              {
                moduleNo: 1,
                name: 'Introduction and ER Model',
                topics: {
                  create: [
                    { topicName: 'ER Model' },
                    { topicName: 'Relational Model' },
                  ],
                },
              },
              {
                moduleNo: 2,
                name: 'Relational Algebra and SQL',
                topics: {
                  create: [
                    { topicName: 'SQL' },
                    { topicName: 'Normalization' },
                  ],
                },
              },
              {
                moduleNo: 3,
                name: 'Transaction Processing',
                topics: {
                  create: [
                    { topicName: 'Transactions' },
                    { topicName: 'Serializability' },
                    { topicName: 'Deadlocks' },
                  ],
                },
              },
            ],
          },
        },
        include: {
          modules: {
            include: {
              topics: true,
            },
          },
        },
      })
      courses = [defaultCourse]
    }

    return NextResponse.json({ courses })
  } catch (error) {
    console.error('Failed to fetch courses:', error)
    return NextResponse.json(
      {
        error: 'Failed to connect to database or fetch courses',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
