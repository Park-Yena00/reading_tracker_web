/**
 * 인증 관련 헬퍼 함수
 * 인증 상태 확인 및 로그인/로그아웃 처리 헬퍼 함수
 */

import { authState } from '../state/auth-state.js';
import { tokenManager } from './token-manager.js';
import { authService } from '../services/auth-service.js';
import { ROUTES } from '../constants/routes.js';
import { eventBus } from './event-bus.js';
import { AUTH_EVENTS } from '../constants/events.js';

export const authHelper = {
  /**
   * 인증 상태 확인
   * @returns {boolean} 인증 여부
   */
  isAuthenticated() {
    return authState.getIsAuthenticated() && tokenManager.hasAccessToken();
  },

  /**
   * 보호된 페이지 접근 확인
   * 미인증 시 로그인 페이지로 리다이렉트
   * 토큰이 있으면 인증 상태 복원을 기다림
   * @returns {Promise<boolean>} 인증 여부
   */
  async checkAuth() {
    // 토큰이 있으면 인증 상태 복원 대기
    if (tokenManager.hasAccessToken() && !authState.getIsAuthenticated()) {
      // restoreAuthState가 이미 실행 중이면 완료될 때까지 대기
      if (authState.getIsRestoring()) {
        await authState.waitForRestore();
      } else {
        // restoreAuthState가 실행되지 않았으면 수동으로 실행
        await authState.restoreAuthState();
      }
    }
    
    // 인증 상태 확인
    if (!this.isAuthenticated()) {
      console.warn('[AuthHelper] 인증되지 않음, 로그인 페이지로 리다이렉트:', {
        hasAccessToken: tokenManager.hasAccessToken(),
        hasRefreshToken: tokenManager.hasRefreshToken(),
        isAuthenticated: authState.getIsAuthenticated(),
        user: authState.getUser()
      });
      window.location.href = ROUTES.LOGIN;
      return false;
    }
    
    return true;
  },

  /**
   * 로그인 처리
   * @param {Object} loginData - 로그인 데이터 { loginId, password }
   * @returns {Promise<Object>} { success: boolean, user?: Object, error?: string }
   */
  async handleLogin(loginData) {
    try {
      const response = await authService.login(loginData);
      
      // 응답 데이터 검증
      if (!response) {
        throw new Error('로그인 응답이 없습니다.');
      }
      
      // 토큰이 없는 경우 에러 처리
      if (!response?.accessToken) {
        console.error('[AuthHelper] 로그인 응답에 accessToken이 없습니다:', response);
        throw new Error('로그인 응답에 accessToken이 없습니다.');
      }
      
      if (!response?.refreshToken) {
        console.error('[AuthHelper] 로그인 응답에 refreshToken이 없습니다:', response);
        throw new Error('로그인 응답에 refreshToken이 없습니다.');
      }
      
      // 토큰 저장
      tokenManager.setTokens(response.accessToken, response.refreshToken);
      
      // 사용자 정보 설정 (내부에서 이벤트 자동 발행)
      // user가 없어도 로그인은 성공으로 처리 (선택적)
      if (response.user) {
        authState.setUser(response.user);
      } else {
        console.warn('[AuthHelper] 로그인 응답에 user 정보가 없습니다:', response);
        // user 정보가 없어도 토큰이 있으면 로그인 성공으로 처리
        // 이후 사용자 정보는 별도 API로 조회 가능
      }
      
      return {
        success: true,
        user: response.user || null,
      };
    } catch (error) {
      console.error('[AuthHelper] 로그인 실패:', error);
      
      // 필드별 에러 메시지 처리
      let errorMessage = error.message || '로그인에 실패했습니다.';
      
      // 네트워크 에러 처리
      if (error.isNetworkError || error.name === 'NetworkError') {
        errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      }
      
      // API 에러 응답에서 필드 에러 정보 추출
      if (error.fieldErrors && error.fieldErrors.length > 0) {
        errorMessage = error.fieldErrors[0].message || errorMessage;
      }
      
      return {
        success: false,
        error: errorMessage,
        fieldErrors: error.fieldErrors || [],
      };
    }
  },

  /**
   * 로그아웃 처리
   */
  handleLogout() {
    // 토큰 삭제 및 상태 초기화 (내부에서 이벤트 자동 발행)
    authState.logout();
    
    // 로그인 페이지로 이동
    window.location.href = ROUTES.LOGIN;
  },

  /**
   * 회원가입 처리
   * @param {Object} registerData - 회원가입 데이터 { loginId, email, name, password }
   * @returns {Promise<Object>} { success: boolean, user?: Object, error?: string, fieldErrors?: Array }
   */
  async handleRegister(registerData) {
    try {
      const response = await authService.register(registerData);
      
      return {
        success: true,
        user: response,
      };
    } catch (error) {
      console.error('회원가입 실패:', error);
      
      let errorMessage = error.message || '회원가입에 실패했습니다.';
      
      // 필드별 에러 메시지 처리
      if (error.fieldErrors && error.fieldErrors.length > 0) {
        errorMessage = error.fieldErrors[0].message || errorMessage;
      }
      
      return {
        success: false,
        error: errorMessage,
        fieldErrors: error.fieldErrors || [],
      };
    }
  },

  /**
   * 현재 사용자 정보 반환
   * @returns {Object|null} 사용자 정보 또는 null
   */
  getCurrentUser() {
    return authState.getUser();
  },
};

/**
 * 네트워크 에러로 인한 로그아웃 시 리다이렉트 처리
 * 모듈 로드 시 자동으로 이벤트 구독 설정
 */
(function initAuthHelper() {
  // 로그아웃 이벤트 구독 (네트워크 에러로 인한 로그아웃 시 리다이렉트)
  eventBus.subscribe(AUTH_EVENTS.LOGOUT, (data) => {
    // 네트워크 에러로 인한 로그아웃인 경우에만 리다이렉트
    if (data.reason === 'network_error') {
      // 로그인 페이지가 아닌 경우에만 리다이렉트
      // (로그인 페이지에서는 무한 리다이렉트 방지)
      const currentPath = window.location.pathname;
      if (currentPath !== '/html/login.html' && 
          currentPath !== '/login.html' &&
          !currentPath.includes('login.html')) {
        // 약간의 지연 후 리다이렉트 (이벤트 발행 완료 대기)
        setTimeout(() => {
          window.location.href = ROUTES.LOGIN;
        }, 100);
      }
    }
  });
})();


