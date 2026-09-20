export const DEMO_COURSE_SLUG = 'akcios-kurzus'
export const DEMO_COURSE_PATH = `/${DEMO_COURSE_SLUG}`

/**
 * A kampányoldalon árult kurzus `products.slug` értéke.
 *
 * Az oldal 2026-09-20-ig képzeletbeli demó volt (ár és fizetés nélkül).
 * Tulajdonosi döntéssel valódi, megvásárolható ajánlat lett, de a felépítése
 * változatlan maradt. A slug azért él konstansként, mert a kampányoldalnak
 * EGYETLEN kurzusa van, és így nem kell séma-módosítás (új relációs mező a
 * `pages` collectionön) ahhoz, hogy az oldal a termékhez kössön.
 *
 * Ha a kurzus slugja változik, ezt az egy sort kell átírni; a cím, a leírás és
 * az ár a termékből jön, azokat nem kell követni.
 */
export const CAMPAIGN_COURSE_SLUG = 'otthoni-kezrehab-program-akcio'
