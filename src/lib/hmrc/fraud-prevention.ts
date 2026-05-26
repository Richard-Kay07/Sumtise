/**
 * HMRC MTD Fraud Prevention Headers
 * Required on ALL calls to the HMRC API (per HMRC Developer Hub docs).
 */
export function buildFraudPreventionHeaders(
  userAgent: string,
  userId: string
): Record<string, string> {
  return {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-User-IDs': `sumtise=${userId}`,
    'Gov-Client-Timezone': 'UTC+00:00',
    'Gov-Client-Screens': '1280x720',
    'Gov-Client-Window-Size': '1280x720',
    'Gov-Client-Browser-JS-User-Agent': userAgent,
    'Gov-Client-Browser-Do-Not-Track': '1',
    'Gov-Vendor-Version': 'sumtise=1.0.0',
    'Gov-Vendor-License-IDs': '',
  }
}
