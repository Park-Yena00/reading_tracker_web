/**
 * 이미지 URL 처리 유틸리티
 * 이미지 URL을 고해상도로 변환하거나 최적화하는 함수 제공
 */

/**
 * 알라딘 API 이미지 URL을 고해상도로 변환
 * @param {string} imageUrl - 원본 이미지 URL
 * @returns {string} 고해상도 이미지 URL
 */
export function enhanceImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return imageUrl;
  }
  
  // 알라딘 이미지 URL인지 확인
  if (imageUrl.includes('image.aladin.co.kr')) {
    // 이미 최적화된 URL이면 그대로 반환
    if (imageUrl.includes('_b.') || imageUrl.includes('coversum')) {
      return imageUrl;
    }
    
    // 크기 파라미터가 있으면 큰 크기로 변경
    if (imageUrl.includes('/cover/s')) {
      imageUrl = imageUrl.replace(/\/cover\/s\d+\//, (match) => {
        const size = parseInt(match.match(/\d+/)[0]);
        if (size <= 500) {
          return '/cover/s2000/';
        } else if (size <= 800) {
          return '/cover/s1200/';
        }
        return match;
      });
    }
    
    // _b 접미사 추가하여 고해상도 이미지 사용
    if (!imageUrl.includes('_b.')) {
      const urlWithoutExtension = imageUrl.replace(/\.(jpg|png|gif)(\?.*)?$/i, '');
      const extension = imageUrl.match(/\.(jpg|png|gif)/i)?.[0] || '.jpg';
      const queryString = imageUrl.match(/\?.*$/)?.[0] || '';
      imageUrl = urlWithoutExtension + '_b' + extension + queryString;
    }
  }
  
  return imageUrl;
}

/**
 * 이미지 URL 정리 및 최적화
 * @param {string} imageUrl - 원본 이미지 URL
 * @returns {string} 최적화된 이미지 URL
 */
export function optimizeImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '';
  }
  
  let url = imageUrl.trim();
  
  // 외부 placeholder URL은 즉시 빈 문자열로 변환 (네트워크 의존성 제거)
  if (url.includes('via.placeholder.com') || url.includes('placeholder.com')) {
    return '';
  }
  
  // 상대 경로인 경우 절대 URL로 변환
  if (url.startsWith('/')) {
    const backendUrl = window.API_CONFIG?.baseURL 
      ? window.API_CONFIG.baseURL.replace('/api/v1', '')
      : 'http://localhost:8080';
    url = backendUrl + url;
  }
  
  // HTTP/HTTPS로 시작하는지 확인
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return '';
  }
  
  // 알라딘 이미지인 경우 고해상도로 변환
  if (url.includes('image.aladin.co.kr')) {
    url = enhanceImageUrl(url);
  }
  
  return url;
}

export default {
  enhanceImageUrl,
  optimizeImageUrl,
};

