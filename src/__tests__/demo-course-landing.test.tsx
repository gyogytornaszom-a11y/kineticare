import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DemoCourseLanding } from '../components/campaign/DemoCourseLanding'
import {
  DEFAULT_DEMO_COURSE_LAYOUT,
  DEMO_COURSE_TITLE,
  demoCourseLayout,
} from '../lib/demo-course-content'
import { formatPriceHuf } from '../lib/format-price'
import { logger } from '../lib/logger'
import type { Page, Product } from '../payload-types'

function render(page?: Page | null): string {
  return renderToStaticMarkup(createElement(DemoCourseLanding, { page }))
}

/** A kampányoldalon árult kurzus minimális, érvényes alakja. */
function courseFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: 4242,
    title: 'Otthoni kézrehab program akció',
    // A courseTitle a displayTitle-t nézi először, utána a sku-t — a `title`
    // mezőt NEM használja (courses.ts courseTitle).
    displayTitle: 'Otthoni kézrehab program akció',
    sku: 'otthoni-kezrehab-akcio',
    slug: 'otthoni-kezrehab-program-akcio',
    shortDescription: 'Az otthoni program akciós ára.',
    status: 'published',
    priceInHUF: 39500,
    priceInHUFEnabled: true,
    updatedAt: '2026-09-20T12:00:00.000Z',
    createdAt: '2026-09-20T12:00:00.000Z',
    ...overrides,
  } as Product
}

function renderWithCourse(course: Product | null, hasPurchased = false): string {
  return renderToStaticMarkup(
    createElement(DemoCourseLanding, { page: null, course, hasPurchased }),
  )
}

function pageFixture(overrides: Partial<Page> = {}): Page {
  return {
    id: 901,
    title: 'CMS demó cím',
    slug: 'akcios-kurzus',
    excerpt: 'CMS demó bevezető.',
    content: {
      root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
    },
    status: 'published',
    updatedAt: '2026-09-05T12:00:00.000Z',
    createdAt: '2026-09-05T12:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DemoCourseLanding', () => {
  it('CMS nélkül teljes, egyértelműen demó fallback oldalt renderel', () => {
    const html = render()
    const disclosure = 'Demókurzus, jelenleg nem vásárolható.'

    expect(html).toContain(
      `<h1 class="kc-demo-hero__title" id="demo-course-title">${DEMO_COURSE_TITLE}</h1>`,
    )
    expect(html.match(new RegExp(disclosure, 'g'))).toHaveLength(1)
    expect(html).toContain('Készíts használható megfigyelési jegyzetet')
    expect(html).toContain('1. modul: Pontos megfigyelés')
    expect(html).toContain('5. modul: Felkészülés a konzultációra')
    expect(html).toContain('Gyakori kérdések')
    expect(html).not.toMatch(/\bFt\b|kosárba teszem|tovább a pénztárhoz|75 perc|100 perc/i)
    expect(html).not.toContain('"@type":"FAQPage"')
  })

  it('megvásárolható kurzussal a demó-közlés eltűnik, és valódi ár + CTA jelenik meg', () => {
    const html = renderWithCourse(courseFixture())

    // A „nem vásárolható" mondat hazugság lenne a vásárlás gomb mellett.
    expect(html).not.toContain('Demókurzus, jelenleg nem vásárolható.')
    // Az ár a gomb mellett, a §3.2 #1 felirattal és a kanonikus pénztár-úttal.
    // A formázott alakot a formatPriceHuf adja (nem törhető szóközökkel), ezért
    // azzal hasonlítunk, nem kézzel írt szóközös sztringgel.
    expect(html).toContain(formatPriceHuf(39500))
    expect(html).toContain('Megveszem a kurzust')
    expect(html).toContain('/penztar?termek=4242')
    // A kurzus címe és rövid leírása a TERMÉKBŐL jön, ha nincs CMS-oldal.
    expect(html).toContain('Otthoni kézrehab program akció')
    expect(html).toContain('Az otthoni program akciós ára.')
  })

  it('már megvett kurzusnál a lejátszóra visz, nem a pénztárba', () => {
    const html = renderWithCourse(courseFixture(), true)

    expect(html).toContain('Kezdd el a kurzust')
    expect(html).toContain('/kurzusaim/4242')
    expect(html).not.toContain('/penztar?termek=4242')
  })

  it('nem publikált vagy ár nélküli kurzusnál nincs vásárlás, marad a demó-közlés', () => {
    const piszkozat = renderWithCourse(courseFixture({ status: 'draft' }))
    expect(piszkozat).toContain('Demókurzus, jelenleg nem vásárolható.')
    expect(piszkozat).not.toContain('Megveszem a kurzust')

    // Ár-pipa BE, összeg ÜRES: hiányos konfiguráció, nem ingyenes (courses.ts).
    const arNelkul = renderWithCourse(courseFixture({ priceInHUF: null }))
    expect(arNelkul).toContain('Demókurzus, jelenleg nem vásárolható.')
    expect(arNelkul).not.toContain('Megveszem a kurzust')
  })

  it('a CMS hero-adatát és teljes, szerkesztői sorrendjét használja', () => {
    const page = pageFixture({
      heroImage: {
        id: 77,
        alt: 'CMS kép',
        url: '/media/cms-demo.webp',
        width: 1600,
        height: 1000,
        createdAt: '2026-09-05T12:00:00.000Z',
        updatedAt: '2026-09-05T12:00:00.000Z',
      },
      layout: [
        {
          id: 'cms-how-first',
          blockType: 'howItWorks',
          title: 'Első CMS szakasz',
          steps: [{ id: 'cms-step', title: 'Első lépés', text: 'CMS szöveg.' }],
        },
        {
          id: 'cms-faq-middle',
          blockType: 'faq',
          heading: 'Második CMS szakasz',
          items: [{ id: 'cms-faq-item', question: 'CMS kérdés?', answer: 'CMS válasz.' }],
        },
        {
          id: 'cms-welcome-last',
          blockType: 'welcome',
          title: 'Harmadik CMS szakasz',
        },
      ],
    })
    const html = render(page)

    expect(html).toContain('CMS demó cím')
    expect(html).toContain('CMS demó bevezető.')
    expect(html).toContain('%2Fmedia%2Fcms-demo.webp')
    expect(html).toContain('class="kc-section kc-accordion"')
    expect(html.indexOf('Első CMS szakasz')).toBeLessThan(html.indexOf('Második CMS szakasz'))
    expect(html.indexOf('Második CMS szakasz')).toBeLessThan(html.indexOf('Harmadik CMS szakasz'))
    expect(html).not.toContain('"@type":"FAQPage"')
    expect(html).not.toContain('Készíts használható megfigyelési jegyzetet')
  })

  it('a szándékosan üres CMS layoutot üresen hagyja', () => {
    const html = render(pageFixture({ layout: [] }))

    expect(html).toContain('CMS demó cím')
    expect(html).not.toContain('Készíts használható megfigyelési jegyzetet')
    expect(html).not.toContain('href="#modulok"')
    expect(html).toContain('href="/kapcsolat"')
  })

  it('nem támogatott CMS-blokknál figyelmeztet és teljes fallbacket használ', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const page = pageFixture({
      layout: [
        {
          id: 'cms-how',
          blockType: 'howItWorks',
          title: 'Részlegesen nem jelenhet meg',
          steps: [{ id: 'cms-step', title: 'CMS lépés', text: 'CMS szöveg.' }],
        },
        { id: 'unsupported-products', blockType: 'courseCards', sectionSettings: {} },
      ],
    })

    const layout = demoCourseLayout(page)
    const html = render(page)

    expect(layout.map((block) => block.id)).toEqual(
      DEFAULT_DEMO_COURSE_LAYOUT.map((block) => block.id),
    )
    expect(html).toContain('Készíts használható megfigyelési jegyzetet')
    expect(html).not.toContain('Részlegesen nem jelenhet meg')
    expect(warn).toHaveBeenCalledWith(
      'demo-course: nem támogatott CMS-blokk, teljes alapelrendezést használunk',
      expect.objectContaining({ blockTypes: ['courseCards'], pageId: 901 }),
    )
  })

  it('a rejtett minta-, modul- és FAQ-blokkot kihagyja, a hiányzó modulcélhoz nem linkel', () => {
    const hiddenBlocks = DEFAULT_DEMO_COURSE_LAYOUT.map((block) =>
      ['demo-minta-lecke', 'demo-modulok', 'demo-gyik'].includes(block.id ?? '')
        ? { ...block, sectionSettings: { ...block.sectionSettings, visible: false } }
        : block,
    ) as Page['layout']
    const html = render(pageFixture({ layout: hiddenBlocks }))

    expect(html).not.toContain('href="#modulok"')
    expect(html).not.toContain('Készíts használható megfigyelési jegyzetet')
    expect(html).not.toContain('1. modul: Pontos megfigyelés')
    expect(html).not.toContain('Gyakori kérdések')
    expect(html).toContain('href="/kapcsolat"')
  })

  it('a mintaleckét normál, natív accordionként és csak egyszer rendereli', () => {
    const html = render()

    expect(html).toContain('id="minta-lecke"')
    expect(html).toContain('<details class="kc-accordion__item">')
    expect(html).toContain('<summary class="kc-accordion__summary">')
    expect(html.match(/Készíts használható megfigyelési jegyzetet/g)).toHaveLength(1)
    expect(html).toContain('Jegyezd fel röviden a napszakot és a tevékenységet')
    expect(html).not.toContain('kc-demo-preview')
  })

  it('full-bleed hero, alsó kézfókusz és kizárólag L/M/S tipográfia marad', () => {
    const cssPath = fileURLToPath(
      new URL('../components/campaign/demo-course.css', import.meta.url),
    )
    const css = readFileSync(cssPath, 'utf8')

    expect(css).toMatch(/\.kc-demo-hero\s*\{[\s\S]*position:\s*relative/)
    expect(css).toMatch(/\.kc-demo-hero__media,[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0/)
    expect(css).toContain('object-position: center 86%')
    expect(css).toContain('object-position: center 89%')
    expect(css).not.toMatch(/\.kc-demo-hero__lead\s*\{[^}]*display:\s*none/)
    expect(css).toMatch(/\.kc-demo-hero__cta:focus-visible\s*\{[\s\S]*--kc-color-focus-on-dark/)
    expect(css).toContain('var(--kc-font-l)')
    expect(css).toContain('var(--kc-font-m)')
    expect(css).toContain('var(--kc-font-s)')
    const fontSizes = [
      ...css.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/font-size:\s*([^;]+);/g),
    ].map((match) => match[1].trim())
    expect(new Set(fontSizes)).toEqual(
      new Set(['var(--kc-font-l)', 'var(--kc-font-m)', 'var(--kc-font-s)']),
    )
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
