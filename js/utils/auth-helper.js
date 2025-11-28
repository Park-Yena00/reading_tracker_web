/**
 * 인증 관련 헬퍼 함수
 * 인증 상태 확인 및 로그인/로그아웃 처리 헬퍼 함수
 */

import authState from '../state/auth-state.js';
import tokenManager from './token-manager.js';
import authService from '../services/auth-service.js';
import { ROUTES } from '../constants/routes.js';

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
   * @returns {boolean} 인증 여부
   */
  checkAuth() {
    if (!this.isAuthenticated()) {
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
      
      // 토큰 저장
      tokenManager.setTokens(response.accessToken, response.refreshToken);
      
      // 사용자 정보 설정 (내부에서 이벤트 자동 발행)
      authState.setUser(response.user);
      
      return {
        success: true,
        user: response.user,
      };
    } catch (error) {
      console.error('로그인 실패:', error);
      
      // 필드별 에러 메시지 처리
      let errorMessage = error.message || '로그인에 실패했습니다.';
      
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

export default authHelper;


