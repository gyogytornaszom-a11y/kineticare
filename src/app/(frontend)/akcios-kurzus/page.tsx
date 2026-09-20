import type { Metadata } from 'next'
import { draftMode, headers } from 'next/headers'
import { cache } from 'react'

import { DemoCourseLanding } from '@/components/campaign/DemoCourseLanding'
import { PreviewBar } from '@/components/preview/PreviewBar'
import {
  getCampaignCourse,
  getCampaignViewer,
  hasLiveCampaignAccess,
} from '@/lib/campaign-course'
import { getPageBySlug } from '@/lib/cms'
import { courseTitle } from '@/lib/courses'
import { DEMO_COURSE_PATH, DEMO_COURSE_SLUG } from '@/lib/demo-course-route'
import { buildPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

const campaignPage = cache((draft: boolean) => getPageBySlug(DEMO_COURSE_SLUG, { draft }))
const campaignCourse = cache(() => getCampaignCourse())

export async function generateMetadata(): Promise<Metadata> {
  const { isEnabled } = await draftMode()
  const [page, course] = await Promise.all([campaignPage(isEnabled), campaignCourse()])
  return {
    ...buildPageMetadata(
      page ?? {
        // Kurzus nélkül az oldal TÉNYLEG csak bemutató, ezért marad a korábbi,
        // őszinte cím. Élő kurzussal a termék címe és rövid leírása jön.
        title: course ? courseTitle(course) : 'Képzeletbeli akciós kurzus',
        excerpt:
          course?.shortDescription?.trim() ||
          'Ismerd meg a Kineticare online kézrehabilitációs kurzusának bemutatóoldalát: modulok, olvasható tananyagminta és válaszok a kérdéseidre.',
      },
      DEMO_COURSE_PATH,
    ),
    // Szándékos noindex: ugyanezt a kurzust a kanonikus /kurzusok/{slug} oldal
    // is árulja, és két indexelt oldal ugyanarra a termékre egymás ellen
    // versenyezne a találati listában. A menüből és a linkről az oldal
    // változatlanul elérhető és megvásárolható.
    // Forrás: Google Search Central, Consolidate duplicate URLs
    // https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  }
}

export default async function DemoCoursePage() {
  const { isEnabled } = await draftMode()
  const [page, course] = await Promise.all([campaignPage(isEnabled), campaignCourse()])
  // Előnézetben nincs vevő-állapot: a szerkesztő a nyilvános alakot látja.
  const viewer = isEnabled ? null : await getCampaignViewer(await headers())
  const hasPurchased = await hasLiveCampaignAccess(course, viewer)

  return (
    <>
      {isEnabled ? <PreviewBar path={DEMO_COURSE_PATH} /> : null}
      <DemoCourseLanding course={course} hasPurchased={hasPurchased} page={page} />
    </>
  )
}
