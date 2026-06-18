import { PDFDocument, rgb } from 'pdf-lib';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { SignaturePosition } from '../types';

const { fs } = ReactNativeBlobUtil;

// Base64 decode/encode helpers (Hermes doesn't have atob/btoa)
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(base64: string): Uint8Array {
  // Remove padding and whitespace
  const cleaned = base64.replace(/[\s=]/g, '');
  const byteLength = Math.floor((cleaned.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = BASE64_CHARS.indexOf(cleaned[i]);
    const b = BASE64_CHARS.indexOf(cleaned[i + 1]);
    const c = cleaned[i + 2] !== undefined ? BASE64_CHARS.indexOf(cleaned[i + 2]) : -1;
    const d = cleaned[i + 3] !== undefined ? BASE64_CHARS.indexOf(cleaned[i + 3]) : -1;

    bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (c !== -1 && byteIndex < byteLength) {
      bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
    }
    if (d !== -1 && byteIndex < byteLength) {
      bytes[byteIndex++] = ((c & 3) << 6) | d;
    }
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 63] : '=';
  }
  return result;
}

export interface PdfPageInfo {
  pageIndex: number;
  width: number;
  height: number;
}

export const pdfService = {
  /**
   * Read a local file URI and return its bytes as a Uint8Array.
   */
  readFileAsBytes: async (fileUri: string): Promise<Uint8Array> => {
    // Normalize content:// or file:// URIs
    let filePath = fileUri;
    if (filePath.startsWith('file://')) {
      filePath = filePath.replace('file://', '');
    }

    // For content:// URIs on Android, copy to a temp file first
    if (filePath.startsWith('content://')) {
      const tempPath = `${fs.dirs.CacheDir}/signify_temp_input.pdf`;
      await fs.cp(filePath, tempPath);
      filePath = tempPath;
    }

    const base64 = await fs.readFile(filePath, 'base64');
    return base64ToBytes(base64);
  },

  /**
   * Get page count and dimensions from a PDF.
   */
  getPdfInfo: async (pdfBytes: Uint8Array): Promise<PdfPageInfo[]> => {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    return pages.map((page, index) => ({
      pageIndex: index,
      width: page.getWidth(),
      height: page.getHeight(),
    }));
  },

  /**
   * Embed signature SVG paths directly onto a PDF page.
   * pdf-lib uses bottom-left origin, so we flip the Y coordinate.
   */
  embedSignatureOnPdf: async (
    pdfBytes: Uint8Array,
    pageIndex: number,
    strokes: string[],
    canvasWidth: number,
    canvasHeight: number,
    position: SignaturePosition,
    viewerWidth: number,
    viewerHeight: number,
  ): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const page = pages[pageIndex];
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    // Calculate scale from viewer coordinates to PDF coordinates
    const scaleX = pageWidth / viewerWidth;
    const scaleY = pageHeight / viewerHeight;

    // Position in PDF coordinate space (pdf-lib uses bottom-left origin)
    const pdfX = position.x * scaleX;
    const pdfY = pageHeight - (position.y * scaleY); // Flip Y axis

    // Scale for the signature strokes relative to the overlay size
    const sigScaleX = (position.width / canvasWidth) * scaleX;
    const sigScaleY = (position.height / canvasHeight) * scaleY;
    const sigScale = Math.min(sigScaleX, sigScaleY);

    // Draw each stroke path onto the PDF page
    for (const stroke of strokes) {
      try {
        page.drawSvgPath(stroke, {
          x: pdfX,
          y: pdfY,
          scale: sigScale,
          borderColor: rgb(15 / 255, 35 / 255, 66 / 255), // Navy blue matching our brand
          borderWidth: 2,
        });
      } catch (err) {
        console.warn('Could not draw SVG path on PDF:', err);
      }
    }

    const modifiedBytes = await pdfDoc.save();
    return new Uint8Array(modifiedBytes);
  },

  /**
   * Save PDF bytes to a local file and return the file path.
   */
  savePdfToFile: async (pdfBytes: Uint8Array, fileName: string): Promise<string> => {
    const outputDir = fs.dirs.CacheDir;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    const outputPath = `${outputDir}/${sanitizedName}`;

    const base64 = bytesToBase64(pdfBytes);
    await fs.writeFile(outputPath, base64, 'base64');
    return outputPath;
  },

  /**
   * Copy a file to the Downloads directory for the user.
   */
  copyToDownloads: async (sourcePath: string, fileName: string): Promise<string> => {
    const downloadDir = fs.dirs.DownloadDir || fs.dirs.DocumentDir;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    const destPath = `${downloadDir}/${sanitizedName}`;
    await fs.cp(sourcePath, destPath);
    return destPath;
  },
};

