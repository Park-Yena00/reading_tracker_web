// API 설정 파일
// 백엔드 서버 주소를 여기에 설정합니다

const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8080';
const API_VERSION = '/api/v1';  // API 버전 경로

const API_CONFIG = {
  baseURL: API_BASE_URL + API_VERSION,  // 기본 경로: http://localhost:8080/api/v1
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// 전역으로 export (ES6 모듈 사용 시)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
} else {
  window.API_CONFIG = API_CONFIG;
}

