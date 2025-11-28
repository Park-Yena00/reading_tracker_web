// API 클라이언트 (순수 JavaScript - Fetch API 사용)
// config.js를 먼저 로드해야 합니다.

const API_BASE_URL = window.API_CONFIG?.baseURL || 'http://localhost:8080';

/**
 * API 요청 헤더 생성
 */
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // 로컬 스토리지에서 토큰 가져오기
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  return headers;
}

/**
 * Fetch API를 사용한 HTTP 요청
 */
async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(fullUrl, config);
    
    // 응답이 JSON인지 확인
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const responseData = await response.json();
      
      // ApiResponse<T> 형식 처리
      if (responseData.ok === false) {
        // 에러 응답 처리
        const error = responseData.error || {};
        const errorMessage = error.message || '요청에 실패했습니다.';
        
        // 401 인증 오류 처리
        if (response.status === 401 || error.code === 'AUTHENTICATION_ERROR') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login.html';
          throw new Error('인증이 필요합니다.');
        }
        
        throw new Error(errorMessage);
      }
      
      // 성공 응답: data 필드 반환
      return responseData.data;
    } else {
      if (!response.ok) {
        throw new Error('요청에 실패했습니다.');
      }
      return await response.text();
    }
  } catch (error) {
    console.error('API 요청 오류:', error);
    throw error;
  }
}

/**
 * API 클라이언트 객체
 */
const apiClient = {
  /**
   * GET 요청
   */
  get: (url, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return request(fullUrl, { method: 'GET' });
  },
  
  /**
   * POST 요청
   */
  post: (url, data = {}) => {
    return request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * PUT 요청
   */
  put: (url, data = {}) => {
    return request(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * DELETE 요청
   */
  delete: (url) => {
    return request(url, { method: 'DELETE' });
  },
};

// 전역으로 export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiClient;
} else {
  window.apiClient = apiClient;
}

