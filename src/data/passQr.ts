// Kazuhiko Arase's MIT-licensed QR encoder is vendored from qrcode-terminal.
// Keeping it local makes demo passes scannable without a network QR service.
// @ts-expect-error Vendored CommonJS module has no TypeScript declarations.
import QRCode from '../vendor/qrcode/index.js';

export function passPayload(grantId: string, backupCode: string) {
  return `${window.location.origin}/visitor-pass/${encodeURIComponent(grantId)}?code=${encodeURIComponent(backupCode)}`;
}

export function qrDataUrl(payload: string) {
  const qr = new QRCode(-1, 0);
  qr.addData(payload);
  qr.make();
  const quiet = 4;
  const count = qr.getModuleCount();
  const size = count + quiet * 2;
  const modules: string[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) modules.push(`<rect x="${column + quiet}" y="${row + quiet}" width="1" height="1"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#183f32">${modules.join('')}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
