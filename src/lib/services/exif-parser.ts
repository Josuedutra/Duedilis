/**
 * EXIF parser service — Sprint D2, Task gov-1775041297153-uzp0s2
 *
 * Client-side EXIF extraction from JPEG/HEIC files.
 * Extracts GPS coordinates and capture date using DataView binary parsing.
 * No external dependency — works in browser with File/ArrayBuffer API.
 *
 * If photo lacks GPS data → returns null for GPS fields (acceptable for desktop).
 */

export interface ExifGpsData {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  takenAt: Date | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const JPEG_SOI = 0xffd8;
const JPEG_APP1 = 0xffe1;
const EXIF_HEADER = 0x45786966; // "Exif"

// TIFF tags
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;

// GPS sub-IFD tags
const GPS_LATITUDE_REF = 0x0001;
const GPS_LATITUDE = 0x0002;
const GPS_LONGITUDE_REF = 0x0003;
const GPS_LONGITUDE = 0x0004;
const GPS_ALTITUDE_REF = 0x0005;
const GPS_ALTITUDE = 0x0006;

// TIFF types
const TYPE_RATIONAL = 5;
const TYPE_SRATIONAL = 10;
const TYPE_ASCII = 2;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_BYTE = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readRational(
  view: DataView,
  offset: number,
  littleEndian: boolean,
): number {
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

function readSRational(
  view: DataView,
  offset: number,
  littleEndian: boolean,
): number {
  const num = view.getInt32(offset, littleEndian);
  const den = view.getInt32(offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

function dmsToDecimal(d: number, m: number, s: number, ref: string): number {
  const decimal = d + m / 60 + s / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

function readTagValue(
  view: DataView,
  offset: number,
  type: number,
  count: number,
  littleEndian: boolean,
  tiffOffset: number,
): unknown {
  // For values > 4 bytes, offset field contains pointer to actual data
  const valueSize =
    type === TYPE_RATIONAL || type === TYPE_SRATIONAL
      ? 8
      : type === TYPE_SHORT
        ? 2
        : type === TYPE_LONG
          ? 4
          : 1;

  const totalSize = valueSize * count;
  const dataOffset =
    totalSize > 4
      ? view.getUint32(offset + 8, littleEndian) + tiffOffset
      : offset + 8;

  if (type === TYPE_ASCII) {
    let str = "";
    for (let i = 0; i < count - 1; i++) {
      str += String.fromCharCode(view.getUint8(dataOffset + i));
    }
    return str;
  }

  if (type === TYPE_RATIONAL) {
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
      values.push(readRational(view, dataOffset + i * 8, littleEndian));
    }
    return count === 1 ? values[0] : values;
  }

  if (type === TYPE_SRATIONAL) {
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
      values.push(readSRational(view, dataOffset + i * 8, littleEndian));
    }
    return count === 1 ? values[0] : values;
  }

  if (type === TYPE_SHORT) {
    return view.getUint16(dataOffset, littleEndian);
  }

  if (type === TYPE_LONG) {
    return view.getUint32(dataOffset, littleEndian);
  }

  if (type === TYPE_BYTE) {
    return view.getUint8(dataOffset);
  }

  return null;
}

function parseIfd(
  view: DataView,
  ifdOffset: number,
  littleEndian: boolean,
  tiffOffset: number,
): Map<number, unknown> {
  const tags = new Map<number, unknown>();

  try {
    const entryCount = view.getUint16(ifdOffset, littleEndian);
    for (let i = 0; i < entryCount; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;

      const tag = view.getUint16(entryOffset, littleEndian);
      const type = view.getUint16(entryOffset + 2, littleEndian);
      const count = view.getUint32(entryOffset + 4, littleEndian);

      try {
        const value = readTagValue(
          view,
          entryOffset,
          type,
          count,
          littleEndian,
          tiffOffset,
        );
        tags.set(tag, value);
      } catch {
        // Skip tags we can't read
      }
    }
  } catch {
    // Return partial results on parse error
  }

  return tags;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Extract GPS metadata and capture date from a JPEG/HEIC file.
 * Returns null values for any fields that cannot be extracted.
 */
export async function extractExifMetadata(file: File): Promise<ExifGpsData> {
  const result: ExifGpsData = {
    latitude: null,
    longitude: null,
    altitude: null,
    takenAt: null,
  };

  try {
    // Read first 64KB — sufficient for EXIF in most files
    const slice = file.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    // Validate JPEG SOI marker
    if (view.byteLength < 4) return result;
    if (view.getUint16(0) !== JPEG_SOI) {
      // Not a JPEG — could be HEIC/PNG; return empty GPS (not supported without library)
      return result;
    }

    // Scan for APP1 marker with EXIF
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      const segmentLength = view.getUint16(offset + 2);

      if (marker === JPEG_APP1) {
        // Check for "Exif\0\0" header
        if (
          offset + 10 < view.byteLength &&
          view.getUint32(offset + 4) === EXIF_HEADER
        ) {
          const tiffOffset = offset + 10; // Skip "Exif\0\0"
          parseTiff(view, tiffOffset, result);
        }
        break;
      }

      offset += 2 + segmentLength;
    }
  } catch {
    // Return empty result on any error
  }

  return result;
}

function parseTiff(
  view: DataView,
  tiffOffset: number,
  result: ExifGpsData,
): void {
  if (tiffOffset + 8 > view.byteLength) return;

  // Check byte order: "II" = little endian, "MM" = big endian
  const byteOrder = view.getUint16(tiffOffset);
  const littleEndian = byteOrder === 0x4949; // "II"

  // Validate TIFF magic
  const magic = view.getUint16(tiffOffset + 2, littleEndian);
  if (magic !== 42) return;

  // Get IFD0 offset
  const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian) + tiffOffset;
  const ifd0 = parseIfd(view, ifd0Offset, littleEndian, tiffOffset);

  // Extract DateTimeOriginal from EXIF sub-IFD (via GPS IFD we skip to Exif IFD first)
  // Note: DateTimeOriginal (0x9003) is in ExifIFD (0x8769), not IFD0
  // For simplicity, we look for it in GPS IFD scan path
  const exifIfdOffset = ifd0.get(0x8769) as number | undefined;
  if (exifIfdOffset !== undefined) {
    const exifIfd = parseIfd(
      view,
      exifIfdOffset + tiffOffset,
      littleEndian,
      tiffOffset,
    );
    const dateTimeOriginal = exifIfd.get(TAG_DATETIME_ORIGINAL) as
      | string
      | undefined;
    if (dateTimeOriginal) {
      // Format: "YYYY:MM:DD HH:MM:SS"
      const parsed = dateTimeOriginal.replace(
        /^(\d{4}):(\d{2}):(\d{2})/,
        "$1-$2-$3",
      );
      const d = new Date(parsed);
      if (!isNaN(d.getTime())) {
        result.takenAt = d;
      }
    }
  }

  // Extract GPS data
  const gpsIfdOffset = ifd0.get(TAG_GPS_IFD) as number | undefined;
  if (gpsIfdOffset === undefined) return;

  const gpsTags = parseIfd(
    view,
    gpsIfdOffset + tiffOffset,
    littleEndian,
    tiffOffset,
  );

  const latRef = gpsTags.get(GPS_LATITUDE_REF) as string | undefined;
  const latData = gpsTags.get(GPS_LATITUDE) as number[] | undefined;
  const lngRef = gpsTags.get(GPS_LONGITUDE_REF) as string | undefined;
  const lngData = gpsTags.get(GPS_LONGITUDE) as number[] | undefined;
  const altRef = gpsTags.get(GPS_ALTITUDE_REF) as number | undefined;
  const altData = gpsTags.get(GPS_ALTITUDE) as number | undefined;

  if (
    latRef &&
    latData &&
    latData.length >= 3 &&
    lngRef &&
    lngData &&
    lngData.length >= 3
  ) {
    result.latitude = dmsToDecimal(latData[0], latData[1], latData[2], latRef);
    result.longitude = dmsToDecimal(lngData[0], lngData[1], lngData[2], lngRef);
  }

  if (altData !== undefined) {
    // altRef: 0 = above sea level, 1 = below sea level
    result.altitude = altRef === 1 ? -altData : altData;
  }
}
