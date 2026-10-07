import qrcode from "qrcode-generator";

/**
 * Gera um SVG puro e responsivo de um código QR.
 * Não requer nenhuma requisição externa nem dependência pesada de canvas,
 * respeitando 100% a Content Security Policy (CSP).
 */
export function generateQrSvg(text: string, cellSize = 5, margin = 2): string {
  try {
    // 0 = versão automática adequada ao tamanho do texto; 'M' = 15% de redundância para leitura fácil em câmeras
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({
      cellSize,
      margin,
      scalable: true,
    });
  } catch (err) {
    console.error("Falha ao gerar QR Code:", err);
    return `<div class="qr-error">Não foi possível gerar o QR Code</div>`;
  }
}
