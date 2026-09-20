import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  draft: vi.fn(),
  course: vi.fn(),
  viewer: vi.fn(),
  access: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('@/lib/cms', () => ({ getPageBySlug: mocks.page }))
vi.mock('next/headers', () => ({ draftMode: mocks.draft, headers: mocks.headers }))
// A termék-lekérdezés a lib-ben él, hogy a route vékony és mockolható legyen:
// így a route-teszt nem nyúl valódi Payload-példányhoz.
vi.mock('@/lib/campaign-course', () => ({
  getCampaignCourse: mocks.course,
  getCampaignViewer: mocks.viewer,
  hasLiveCampaignAccess: mocks.access,
}))
vi.mock('@/components/campaign/DemoCourseLanding', () => ({
  DemoCourseLanding: ({ page }: { page: { title: string } | null }) => (
    <div>{page?.title ?? 'Demo fallback'}</div>
  ),
}))
vi.mock('@/components/preview/PreviewBar', () => ({
  PreviewBar: ({ path }: { path: string }) => <aside data-preview-path={path}>Preview</aside>,
}))

import DemoCoursePage, { generateMetadata } from '../app/(frontend)/akcios-kurzus/page'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.page.mockResolvedValue(null)
  mocks.draft.mockResolvedValue({ isEnabled: false })
  mocks.course.mockResolvedValue(null)
  mocks.viewer.mockResolvedValue(null)
  mocks.access.mockResolvedValue(false)
  mocks.headers.mockResolvedValue(new Headers())
})

describe('demo campaign route', () => {
  it('renders the complete fallback without creating a CMS record', async () => {
    expect(renderToStaticMarkup(await DemoCoursePage())).toContain('Demo fallback')
    expect(mocks.page).toHaveBeenCalledWith('akcios-kurzus', { draft: false })
  })

  it('uses published CMS content on the public route', async () => {
    mocks.page.mockResolvedValue({ title: 'Szerkesztett bemutató' })
    const html = renderToStaticMarkup(await DemoCoursePage())
    expect(html).toContain('Szerkesztett bemutató')
    expect(html).not.toContain('data-preview-path')
    expect(mocks.page).toHaveBeenCalledWith('akcios-kurzus', { draft: false })
  })

  it('supports the existing authenticated draft preview flow', async () => {
    mocks.draft.mockResolvedValue({ isEnabled: true })
    const html = renderToStaticMarkup(await DemoCoursePage())
    expect(html).toContain('data-preview-path="/akcios-kurzus"')
    expect(mocks.page).toHaveBeenCalledWith('akcios-kurzus', { draft: true })
  })

  it.each([false, true])(
    'keeps demo metadata noindex even with CMS content, draft=%s',
    async (draft) => {
      mocks.draft.mockResolvedValue({ isEnabled: draft })
      mocks.page.mockResolvedValue({
        title: 'Szerkesztett bemutató',
        seoTitle: 'Bemutató kurzus',
        seoDescription: 'Szerkesztett leírás a bemutatóhoz.',
      })
      const metadata = await generateMetadata()
      expect(metadata.title).toBe('Bemutató kurzus')
      expect(metadata.description).toBe('Szerkesztett leírás a bemutatóhoz.')
      expect(metadata.alternates?.canonical).toBe('/akcios-kurzus')
      expect(metadata.robots).toEqual({
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      })
    },
  )

  it('has descriptive metadata when CMS content is absent', async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe('Képzeletbeli akciós kurzus')
    expect(metadata.description).toContain('bemutatóoldalát')
  })

  it('CMS-oldal nélkül a KURZUS címét és leírását használja a metaadatban', async () => {
    mocks.course.mockResolvedValue({
      id: 4242,
      // A courseTitle a displayTitle-t nézi, nem a `title` mezőt.
      displayTitle: 'Otthoni kézrehab program akció',
      sku: 'otthoni-kezrehab-akcio',
      shortDescription: 'Az otthoni program akciós ára.',
      status: 'published',
      priceInHUF: 39500,
      priceInHUFEnabled: true,
    })

    const metadata = await generateMetadata()
    expect(metadata.title).toBe('Otthoni kézrehab program akció')
    expect(metadata.description).toBe('Az otthoni program akciós ára.')
    // A noindex a termék meglététől FÜGGETLENÜL marad: a kanonikus
    // kurzusoldallal nem versenyzünk a találati listában.
    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    })
  })
})
