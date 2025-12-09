/**
 * 공통 API 클라이언트
 * Fetch API 래퍼로, 인증 토큰 자동 추가 및 401 에러 처리 (토큰 갱신) 기능 제공
 */

import { tokenManager } from '../utils/token-manager.js';
import { authState } from '../state/auth-state.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';

/**
 * API Base URL을 동적으로 가져오는 함수
 * window.API_CONFIG가 설정될 때까지 기다림
 */
function getApiBaseURL() {
  if (window.API_CONFIG?.baseURL) {
    return window.API_CONFIG.baseURL;
  }
  return 'http://localhost:8080/api/v1';
}

/**
 * API 클라이언트 클래스
 */
class ApiClient {
  constructor(baseURL) {
    // baseURL이 제공되지 않으면 동적으로 가져옴
    this.baseURL = baseURL || getApiBaseURL();
  }
  
  /**
   * 현재 baseURL을 가져옴 (동적)
   */
  getBaseURL() {
    return getApiBaseURL();
  }

  /**
   * 공통 HTTP 요청 메서드
   * @param {string} endpoint - API 엔드포인트 (예: '/auth/login')
   * @param {Object} options - Fetch API 옵션
   * @returns {Promise} 응답 데이터
   */
  async request(endpoint, options = {}) {
    // 동적으로 baseURL 가져오기
    const baseURL = this.getBaseURL();
    
    // 엔드포인트 정리: /api/v1로 시작하면 제거 (안전장치)
    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith('/api/v1')) {
      cleanEndpoint = cleanEndpoint.replace('/api/v1', '');
    }
    
    // 최종 URL 구성
    let url = cleanEndpoint.startsWith('http') 
      ? cleanEndpoint 
      : `${baseURL}${cleanEndpoint}`;
    
    // URL 중복 확인 및 제거 (안전장치)
    if (url.includes('/api/v1/api/v1')) {
      url = url.replace(/\/api\/v1\/api\/v1/g, '/api/v1');
      console.warn(`[API Client] URL 중복 제거: ${url}`);
    }
    
    // 디버깅 로그 (개발 환경)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`[API] ${options.method || 'GET'} ${url}`);
    }
    
    // 토큰 가져오기
    const accessToken = tokenManager.getAccessToken();
    
    // 인증이 필요 없는 엔드포인트 목록
    const publicEndpoints = [
      '/auth/login',
      '/auth/signup',
      '/auth/find-login-id',
      '/auth/verify-account',
      '/auth/reset-password',
      '/users/duplicate/loginId',
      '/users/duplicate/email',
    ];
    
    // 현재 엔드포인트가 공개 엔드포인트인지 확인
    const isPublicEndpoint = publicEndpoints.some(publicPath => 
      cleanEndpoint.includes(publicPath)
    );
    
    // 디버깅: 토큰 존재 여부 확인 (개발 환경, 공개 엔드포인트 제외)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (!accessToken && !isPublicEndpoint) {
        console.warn('[API Client] Access Token이 없습니다. 인증이 필요할 수 있습니다.');
      }
    }

    // 요청 설정
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        ...options.headers,
      },
    };

    // 요청 본문이 객체인 경우 JSON으로 변환
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // 응답이 JSON인지 확인
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      // 401 에러 처리 (토큰 갱신 시도)
      if (response.status === 401) {
        const refreshed = await this.handleTokenRefresh();
        if (refreshed) {
          // 토큰 갱신 후 원래 요청 재시도
          const newToken = tokenManager.getAccessToken();
          config.headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, config);
          return this.handleResponse(retryResponse, isJson);
        } else {
          // 토큰 갱신 실패 시 로그아웃 처리
          authState.logout();
          // 로그인 페이지로 리다이렉트
          if (window.location.pathname !== '/html/login.html') {
            window.location.href = '/html/login.html';
          }
          throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
        }
      }

      // 403 에러 처리 (권한 없음)
      // Access Token 만료로 인한 403일 수 있으므로 토큰 갱신 시도
      if (response.status === 403) {
        const refreshed = await this.handleTokenRefresh();
        if (refreshed) {
          // 토큰 갱신 성공 시 원래 요청 재시도
          const newToken = tokenManager.getAccessToken();
          config.headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, config);
          return this.handleResponse(retryResponse, isJson);
        } else {
          // 토큰 갱신 실패 시 기존 403 에러 처리 로직 실행
          // 응답 본문에서 에러 메시지 추출 시도
          let errorMessage = '접근 권한이 없습니다.';
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.clone().json();
              if (errorData && errorData.error && errorData.error.message) {
                errorMessage = errorData.error.message;
              }
            }
          } catch (e) {
            // JSON 파싱 실패 시 기본 메시지 사용
          }
          
          const error = new Error(errorMessage);
          error.status = 403;
          error.statusCode = 403;
          throw error;
        }
      }

      return this.handleResponse(response, isJson);
    } catch (error) {
      // 네트워크 에러 감지 및 처리
      // fetch API는 네트워크 에러 시 TypeError를 발생시킴
      const isNetworkError = 
        error instanceof TypeError ||
        (error.message && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed') ||
          error.message.includes('fetch')
        )) ||
        error.name === 'NetworkError' ||
        error.isNetworkError === true;
      
      if (isNetworkError) {
        // 네트워크 연결 실패 (서버 종료, 네트워크 오류 등)
        const networkError = new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
        networkError.name = 'NetworkError';
        networkError.isNetworkError = true;
        networkError.originalError = error;
        console.error('[API Client] 네트워크 에러:', networkError.message);
        throw networkError;
      }
      
      // 기타 에러는 그대로 전달
      console.error('[API Client] API 요청 오류:', error);
      throw error;
    }
  }

  /**
   * 토큰 갱신 처리
   * @returns {Promise<boolean>} 갱신 성공 여부
   */
  async handleTokenRefresh() {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      // 토큰 갱신 API 호출 (인증 헤더 없이)
      const baseURL = this.getBaseURL();
      const response = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const responseData = await response.json();
      
      // ApiResponse<T> 형식 처리
      if (responseData.ok && responseData.data) {
        const { accessToken, refreshToken: newRefreshToken } = responseData.data;
        
        // 새 토큰 저장
        tokenManager.setTokens(accessToken, newRefreshToken);
        
        // 토큰 갱신 이벤트 발행
        authState.publishTokenRefreshed({
          accessToken,
          refreshToken: newRefreshToken,
        });
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('토큰 갱신 실패:', error);
      return false;
    }
  }

  /**
   * 응답 처리
   * @param {Response} response - Fetch API 응답 객체
   * @param {boolean} isJson - JSON 응답 여부
   * @returns {Promise} 파싱된 응답 데이터
   */
  async handleResponse(response, isJson = true) {
    // HTTP 상태 코드 확인 (200-299 범위가 아니면 에러)
    if (!response.ok) {
      // JSON 응답인 경우 에러 메시지 추출 시도
      if (isJson) {
        try {
          const responseData = await response.json();
          
          // ApiResponse<T> 형식 처리
          if (responseData.ok === false) {
            const error = responseData.error || {};
            const errorMessage = error.message || '요청에 실패했습니다.';
            
            const apiError = new Error(errorMessage);
            apiError.status = response.status;
            apiError.statusCode = response.status;
            apiError.code = error.code;
            apiError.fieldErrors = error.fieldErrors || [];
            
            throw apiError;
          }
        } catch (parseError) {
          // JSON 파싱 실패 또는 이미 throw된 에러인 경우
          // parseError가 실제 API 에러인 경우 (이미 throw된 경우) 재throw
          if (parseError.status || parseError.statusCode) {
            throw parseError;
          }
          // JSON 파싱 실패 시 기본 에러 메시지
          const error = new Error(`요청에 실패했습니다. (${response.status})`);
          error.status = response.status;
          error.statusCode = response.status;
          throw error;
        }
      } else {
        const error = new Error(`요청에 실패했습니다. (${response.status})`);
        error.status = response.status;
        error.statusCode = response.status;
        throw error;
      }
    }
    
    // 성공 응답 처리
    if (isJson) {
      const responseData = await response.json();
      
      // ApiResponse<T> 형식 처리
      if (responseData.ok === false) {
        const error = responseData.error || {};
        const errorMessage = error.message || '요청에 실패했습니다.';
        
        const apiError = new Error(errorMessage);
        apiError.code = error.code;
        apiError.fieldErrors = error.fieldErrors || [];
        
        throw apiError;
      }
      
      // 성공 응답: data 필드 반환
      return responseData.data;
    } else {
      return await response.text();
    }
  }

  /**
   * GET 요청
   * @param {string} endpoint - API 엔드포인트
   * @param {Object} params - 쿼리 파라미터
   * @param {Object} options - 추가 옵션
   * @returns {Promise} 응답 데이터
   */
  async get(endpoint, params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(fullEndpoint, { ...options, method: 'GET' });
  }

  /**
   * POST 요청
   * @param {string} endpoint - API 엔드포인트
   * @param {Object} body - 요청 본문
   * @param {Object} options - 추가 옵션
   * @returns {Promise} 응답 데이터
   */
  async post(endpoint, body = {}, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT 요청
   * @param {string} endpoint - API 엔드포인트
   * @param {Object} body - 요청 본문
   * @param {Object} options - 추가 옵션
   * @returns {Promise} 응답 데이터
   */
  async put(endpoint, body = {}, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE 요청
   * @param {string} endpoint - API 엔드포인트
   * @param {Object} options - 추가 옵션
   * @returns {Promise} 응답 데이터
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

// 싱글톤 인스턴스 생성 및 export
// baseURL은 동적으로 가져오므로 인스턴스 생성 시점에는 기본값 사용
export const apiClient = new ApiClient();



