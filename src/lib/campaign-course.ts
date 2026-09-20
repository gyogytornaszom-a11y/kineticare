import { getPayload } from 'payload'

import config from '../payload.config'

import { resolveSingleCourseAccess } from './course-access-lookup'
import { hasUserPurchased } from './courses'
import { CAMPAIGN_COURSE_SLUG } from './demo-course-route'
import { logger } from './logger'
import type { Product, User } from '../payload-types'

/**
 * A kampányoldal (`/akcios-kurzus`) termék-oldali adatai.
 *
 * A route vékony marad, a lekérdezés itt él — így unit-tesztelhető és
 * mockolható (ügynök-kézikönyv 6.1). Minden hiba lefelé degradál: termék
 * nélkül a kampányoldal a korábbi, vásárlás nélküli alakjában jelenik meg,
 * nem 500-zal áll meg.
 */

/** A kampányoldalon árult kurzus, vagy null, ha nincs / nem érhető el. */
export async function getCampaignCourse(): Promise<Product | null> {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'products',
      where: { slug: { equals: CAMPAIGN_COURSE_SLUG } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })
    return docs[0] ?? null
  } catch (error) {
    logger.warn('kampányoldal: kurzus-lekérdezés sikertelen — vásárlás nélkül renderelünk', {
      courseSlug: CAMPAIGN_COURSE_SLUG,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Van-e a bejelentkezett vevőnek ÉLŐ hozzáférése a kampány-kurzushoz.
 *
 * A lejárt hozzáférés a CTA szempontjából „még nem vevő", tehát a kurzus újra
 * megvásárolható — azonos szabály a kurzusoldallal. Lekérdezési hibánál true,
 * mert a tényleges lejátszást a stream-token végpont amúgy is újraellenőrzi.
 */
export async function hasLiveCampaignAccess(
  course: Product | null,
  user: User | null,
): Promise<boolean> {
  if (course === null || user === null) {
    return false
  }
  if (!hasUserPurchased(user.purchases, course.id)) {
    return false
  }
  try {
    const payload = await getPayload({ config })
    const access = await resolveSingleCourseAccess({
      payload,
      userId: user.id,
      product: course,
      logger,
    })
    return access.hasAccess
  } catch (error) {
    logger.warn('kampányoldal: hozzáférés-állapot számítása sikertelen', {
      userId: user.id,
      productId: course.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return true
  }
}

/** A bejelentkezett felhasználó, anonim látogatónál null. Csak olvasás. */
export async function getCampaignViewer(requestHeaders: Headers): Promise<User | null> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: requestHeaders })
    return (user as User | null) ?? null
  } catch {
    return null
  }
}
