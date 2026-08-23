// ============================================================
// Shared GeoIP Helper — queries https://ipwho.is/ over HTTPS
// Replaces deprecated / mixed-content http://ip-api.com calls
// ============================================================

export interface GeoIpResult {
  ip: string;
  country: string;
  city: string;
  region: string;
  isp: string;
  org: string;
  as: string;
  lat: number;
  lon: number;
  isPrivate?: boolean;
}

/**
 * Fetch geolocation and ASN/network data for an IP address (or the caller's IP if omitted).
 * Queries https://ipwho.is/ and normalizes the response.
 */
export async function fetchGeoIp(ip?: string): Promise<GeoIpResult | null> {
  try {
    const target = ip ? ip.trim() : '';
    const res = await fetch(`https://ipwho.is/${target}`);
    if (!res.ok) return null;

    const d = await res.json();
    if (d.success) {
      const isp = d.connection?.isp || d.connection?.org || 'Unknown ISP';
      const org = d.connection?.org || d.connection?.isp || 'Unknown';
      const asn = d.connection?.asn ? `AS${d.connection.asn}` : '';

      return {
        ip: d.ip || target,
        country: d.country || '',
        city: d.city || '',
        region: d.region || '',
        isp,
        org,
        as: asn,
        lat: typeof d.latitude === 'number' ? d.latitude : 0,
        lon: typeof d.longitude === 'number' ? d.longitude : 0,
        isPrivate: false,
      };
    } else if (
      d.message?.toLowerCase().includes('private') ||
      d.message?.toLowerCase().includes('reserved')
    ) {
      return {
        ip: target,
        country: '',
        city: '',
        region: '',
        isp: '',
        org: '',
        as: '',
        lat: 0,
        lon: 0,
        isPrivate: true,
      };
    }
    return null;
  } catch (err) {
    console.warn('[GeoIP] Lookup failed:', err);
    return null;
  }
}
