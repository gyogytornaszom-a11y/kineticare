import Image from 'next/image'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { MediaImage } from '@/components/content/MediaImage'
import { CourseCta } from '@/components/courses/CourseCta'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PriceTag } from '@/components/ui/PriceTag'
import { coursePriceHuf, courseTitle, isPaidCourse } from '@/lib/courses'
import { ctaLabel } from '@/lib/cta-vocabulary'
import {
  DEMO_COURSE_EXCERPT,
  DEMO_COURSE_HERO_IMAGE,
  DEMO_COURSE_TITLE,
  demoCourseLayout,
} from '@/lib/demo-course-content'
import type { Page, Product } from '@/payload-types'

import './demo-course.css'

export interface DemoCourseLandingProps {
  page?: Page | null
  /**
   * A kampányoldalon árult kurzus. `null`, ha nincs beállítva vagy a
   * lekérdezés hibázott — ilyenkor az oldal a korábbi, vásárlás nélküli
   * alakjában jelenik meg, és kimondja, hogy most nem vásárolható.
   */
  course?: Product | null
  /** A bejelentkezett vevőnek él-e a hozzáférése ehhez a kurzushoz. */
  hasPurchased?: boolean
}

type Layout = NonNullable<Page['layout']>
type FaqBlock = Extract<Layout[number], { blockType: 'faq' }>

function faqAsAccordion(block: FaqBlock): Extract<Layout[number], { blockType: 'accordion' }> {
  return {
    id: block.id,
    blockType: 'accordion',
    eyebrow: 'Kérdések és válaszok',
    title: block.heading,
    items: (block.items ?? []).map((item) => ({
      id: item.id,
      cim: item.question,
      tartalom: {
        root: {
          type: 'root',
          direction: null,
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'paragraph',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: item.answer,
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  version: 1,
                },
              ],
            },
          ],
        },
      },
    })),
    sectionSettings: block.sectionSettings,
  }
}

function renderableLayout(layout: ReturnType<typeof demoCourseLayout>): Layout {
  const hasVisibleModules = layout.some(
    (block) =>
      block.sectionSettings?.anchorId === 'modulok' && block.sectionSettings.visible !== false,
  )

  return layout.map((block) => {
    if (block.blockType === 'faq') {
      return faqAsAccordion(block)
    }
    if (block.blockType === 'ctaBanner' && block.cta?.url === '#modulok' && !hasVisibleModules) {
      return { ...block, cta: undefined }
    }
    return block
  })
}

export function DemoCourseLanding({
  page,
  course = null,
  hasPurchased = false,
}: DemoCourseLandingProps) {
  // Sorrend: a szerkesztő által írt CMS-szöveg nyer, utána a TERMÉK adata, és
  // csak legvégül a beégetett alapérték. Így az adminban átírt kurzuscím és
  // rövid leírás magától megjelenik itt is, külön szerkesztés nélkül.
  const title = page?.title?.trim() || (course ? courseTitle(course) : '') || DEMO_COURSE_TITLE
  const excerpt = page?.excerpt?.trim() || course?.shortDescription?.trim() || DEMO_COURSE_EXCERPT
  // Vásárolható-e itt: érvényes árú, publikált kurzus kell hozzá. A hiányos
  // konfigurációjú terméket a pénztár úgyis elutasítaná, ezért inkább nem
  // mutatunk gombot (courses.ts isPaidCourse).
  const purchasable = course !== null && course.status === 'published' && isPaidCourse(course)
  // A CTA akkor is kell, ha a kurzus már a vevőé (akár archivált): neki a
  // lejátszóra mutató gomb jár, nem a „nem vásárolható" mondat.
  const showCta = course !== null && (purchasable || hasPurchased)
  // Az árat csak a még NEM vevőnek mutatjuk; aki megvette, annak zaj lenne.
  // A `course !== null` itt kiírva szerepel, hogy a szűkítés ne az aliasolt
  // feltételtől függjön.
  const priceHuf =
    course !== null && purchasable && !hasPurchased ? coursePriceHuf(course) : null
  const heroMedia = page?.heroImage && typeof page.heroImage === 'object' ? page.heroImage : null
  const layout = demoCourseLayout(page)
  const blocks = renderableLayout(layout)
  const hasVisibleModules = blocks.some(
    (block) =>
      block.sectionSettings?.anchorId === 'modulok' && block.sectionSettings.visible !== false,
  )

  return (
    <article className="kc-demo-course">
      <section aria-labelledby="demo-course-title" className="kc-demo-hero">
        <div className="kc-demo-hero__media" aria-hidden="true">
          {heroMedia ? (
            <MediaImage
              className="kc-demo-hero__image"
              decorative
              media={heroMedia}
              preferredSize="lg"
              priority
              sizes="100vw"
            />
          ) : (
            <Image
              alt=""
              className="kc-demo-hero__image"
              fill
              priority
              sizes="100vw"
              src={DEMO_COURSE_HERO_IMAGE.src}
            />
          )}
        </div>
        <div className="kc-demo-hero__veil" aria-hidden="true" />
        <Container className="kc-demo-hero__inner">
          <div className="kc-demo-hero__copy">
            {/* A „nem vásárolható" közlés CSAK akkor igaz, ha tényleg nincs
                mögötte megvehető kurzus. Ha van, a mondat helyére a valódi ár
                és a vásárlás gomb kerül — a felirat legyen igaz (SKILL.md 2.). */}
            {showCta ? null : (
              <p className="kc-demo-hero__disclosure">Demókurzus, jelenleg nem vásárolható.</p>
            )}
            <h1 className="kc-demo-hero__title" id="demo-course-title">
              {title}
            </h1>
            <p className="kc-demo-hero__lead">{excerpt}</p>
            {/* Az ár a GOMB MELLETT áll, nem az oldal alján: a „mibe kerül"
                kérdésre a cselekvés közelében kell válasz (SKILL.md 2.).
                A gombot a resolveCourseCta adja a CourseCta-n keresztül —
                ugyanaz az állapotgép, mint a kurzusoldalon, a kosárban és a
                pénztárban; második CTA-gépet nem írunk (ügynök-kézikönyv 5.7). */}
            {showCta && course ? (
              <div className="kc-demo-hero__buy">
                {priceHuf !== null ? (
                  <PriceTag className="kc-demo-hero__price" label="Ár:" priceHuf={priceHuf} />
                ) : null}
                <CourseCta hasPurchased={hasPurchased} product={course} />
              </div>
            ) : null}
            <div className="kc-demo-hero__actions">
              {hasVisibleModules ? (
                <Button className="kc-demo-hero__cta" href="#modulok" variant="secondary">
                  {ctaLabel('course-modules-jump')}
                </Button>
              ) : null}
              <Button className="kc-demo-hero__cta" href="/kapcsolat" variant="secondary">
                {ctaLabel('contact-open')}
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <RenderBlocks layout={blocks} posts={[]} products={[]} testimonials={[]} />
    </article>
  )
}

export default DemoCourseLanding
