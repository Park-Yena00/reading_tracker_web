/**
 * 날짜/시간 포맷팅 유틸리티
 * 다양한 형식으로 날짜를 포맷팅하는 함수 제공
 */

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷팅
 * @param {Date|string} date - 날짜 객체 또는 ISO 문자열
 * @returns {string} 포맷팅된 날짜 문자열
 */
export function formatDate(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 날짜를 YYYY년 MM월 DD일 형식으로 포맷팅
 * @param {Date|string} date - 날짜 객체 또는 ISO 문자열
 * @returns {string} 포맷팅된 날짜 문자열
 */
export function formatDateKorean(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 날짜와 시간을 YYYY-MM-DD HH:mm 형식으로 포맷팅
 * @param {Date|string} date - 날짜 객체 또는 ISO 문자열
 * @returns {string} 포맷팅된 날짜/시간 문자열
 */
export function formatDateTime(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 상대 시간 포맷팅 (예: "3일 전", "2시간 전")
 * @param {Date|string} date - 날짜 객체 또는 ISO 문자열
 * @returns {string} 상대 시간 문자열
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSeconds < 60) {
    return '방금 전';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays < 30) {
    return `${diffDays}일 전`;
  } else if (diffMonths < 12) {
    return `${diffMonths}개월 전`;
  } else {
    return `${diffYears}년 전`;
  }
}

/**
 * 날짜 유효성 검사
 * @param {string} dateString - 날짜 문자열
 * @returns {boolean} 유효한 날짜인지 여부
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * 두 날짜 사이의 일수 계산
 * @param {Date|string} date1 - 첫 번째 날짜
 * @param {Date|string} date2 - 두 번째 날짜
 * @returns {number} 일수 차이
 */
export function daysBetween(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (로컬 시간대 기준)
 * toISOString()은 UTC 시간을 반환하므로, 한국 시간대에서는 하루 전 날짜가 나올 수 있음
 * @returns {string} 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}



