import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 4;

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 2) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51) ||
    (first === 203 && second === 0);
}

function isPrivateIp(address: string) {
  const mappedIpv4 = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4[1]);
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const value = address.toLowerCase();
  return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
}

export function parsePublicWebUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public http or https web link.');
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('Use a standard public web link.');
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || isPrivateIp(hostname)) throw new Error('Use a public web link, not a local or private address.');
  return url;
}

async function verifyPublicHost(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Use a public web link, not a local or private address.');
    return;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) throw new Error('That link does not resolve to a public website.');
}

export async function fetchPublicWebPage(value: string, init: RequestInit) {
  let url = parsePublicWebUrl(value);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await verifyPublicHost(url);
    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url };
    const location = response.headers.get('location');
    if (!location) throw new Error('That page sent an invalid redirect.');
    url = parsePublicWebUrl(new URL(location, url).toString());
  }
  throw new Error('That link redirected too many times.');
}
