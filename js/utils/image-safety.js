/**
 * 이미지 안전성 유틸리티
 * 외부 placeholder URL 등을 차단하고 안전한 이미지 URL만 허용
 */

// 차단할 URL 패턴 목록
const BLOCKED_URL_PATTERNS = [
  'via.placeholder.com',
  'placeholder.com',
  '200x300?text=No+Cover',
  '400x600?text=No+Cover',
  'placeholder',
];

// 기본 표지 이미지 (SVG 데이터 URI)
export const DEFAULT_COVER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob0NvdmVyPC90ZXh0Pjwvc3ZnPg==';

/**
 * 이미지 URL이 차단 목록에 있는지 확인
 * @param {string} url - 확인할 이미지 URL
 * @returns {boolean} 차단되어야 하는지 여부
 */
export function isBlockedUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  const lowerUrl = url.toLowerCase();
  return BLOCKED_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern.toLowerCase()));
}

/**
 * 안전한 이미지 URL로 변환
 * @param {string} url - 원본 이미지 URL
 * @returns {string} 안전한 이미지 URL (차단된 경우 기본 이미지)
 */
export function getSafeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return DEFAULT_COVER_IMAGE;
  }
  
  const trimmedUrl = url.trim();
  
  // 차단 목록에 있는 URL인지 확인
  if (isBlockedUrl(trimmedUrl)) {
    return DEFAULT_COVER_IMAGE;
  }
  
  return trimmedUrl;
}

/**
 * 모든 이미지 요소에 안전성 검사를 적용
 */
export function enforceImageSafety() {
  // 모든 이미지 요소에 대해 안전성 검사 적용
  document.addEventListener('error', (event) => {
    if (event.target && event.target.tagName === 'IMG') {
      const img = event.target;
      const src = img.src;
      
      // 차단된 URL인 경우 기본 이미지로 변경
      if (isBlockedUrl(src)) {
        img.src = DEFAULT_COVER_IMAGE;
        img.onerror = null; // 무한 루프 방지
      }
    }
  }, true);
}

export default {
  isBlockedUrl,
  getSafeImageUrl,
  enforceImageSafety,
  DEFAULT_COVER_IMAGE,
};

