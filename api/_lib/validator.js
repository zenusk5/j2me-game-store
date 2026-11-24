export const MAX_JAR_BYTES = 2 * 1024 * 1024;
export const MAX_IMG_BYTES = 800 * 1024;

export function sanitizeSlug(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function validateGameMetadata(body) {
  const errors = [];
  const name = String(body.name || '').trim();
  const slug = sanitizeSlug(body.slug || name);
  const category = String(body.category || '').trim();
  const shortDescription = String(body.shortDescription || '').trim();
  const fullDescription = String(body.fullDescription || '').trim();
  const version = String(body.version || '').trim();
  const resolution = String(body.resolution || '').trim();
  const language = String(body.language || '').trim();

  if (name.length < 2 || name.length > 100) errors.push('Tên game phải từ 2 đến 100 ký tự.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push('Slug không hợp lệ.');
  if (!category || category.length > 50) errors.push('Thể loại không hợp lệ.');
  if (shortDescription.length < 5 || shortDescription.length > 300) {
    errors.push('Mô tả ngắn phải từ 5 đến 300 ký tự.');
  }
  if (fullDescription.length > 5000) errors.push('Mô tả chi tiết tối đa 5000 ký tự.');
  if (!/^[0-9A-Za-z._-]{1,20}$/.test(version)) errors.push('Phiên bản không hợp lệ.');
  if (!/^[0-9]{2,4}x[0-9]{2,4}$|^Multi$/i.test(resolution)) {
    errors.push('Độ phân giải phải dạng 240x320 hoặc Multi.');
  }
  if (!language || language.length > 40) errors.push('Ngôn ngữ không hợp lệ.');

  return {
    valid: errors.length === 0,
    errors,
    data: { name, slug, category, shortDescription, fullDescription, version, resolution, language }
  };
}

export function decodeBase64File(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return null;
  const cleaned = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
  return Buffer.from(cleaned, 'base64');
}

export function validateJarBuffer(buf, fileName) {
  if (!buf || buf.length < 4) return 'File JAR rỗng hoặc lỗi.';
  if (buf.length > MAX_JAR_BYTES) return 'File JAR vượt quá giới hạn 2MB.';
  if (!/\.jar$/i.test(fileName || '')) return 'Tên file phải có định dạng .jar.';
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (!isZip) return 'Nội dung file không đúng chuẩn định dạng JAR/ZIP.';
  return null;
}

export function detectImageExtension(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.length > MAX_IMG_BYTES) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}