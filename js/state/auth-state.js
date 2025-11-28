/**
 * 인증 상태 관리 클래스
 * 사용자 인증 상태를 관리하고, 상태 변경 시 이벤트를 발행합니다.
 */

import eventBus from '../utils/event-bus.js';
import { AUTH_EVENTS } from '../constants/events.js';
import tokenManager from '../utils/token-manager.js';

class AuthState {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    
    // 페이지 로드 시 토큰이 있으면 인증 상태 복원
    this.restoreAuthState();
  }

  /**
   * 토큰이 있으면 인증 상태 복원
   */
  restoreAuthState() {
    if (tokenManager.hasAccessToken()) {
      // 토큰은 있지만 사용자 정보는 없을 수 있음
      // 실제 구현에서는 토큰을 검증하거나 사용자 정보를 조회해야 함
      // 지금은 토큰만 확인
      this.isAuthenticated = true;
    }
  }

  /**
   * 사용자 설정 및 인증 상태 업데이트
   * @param {Object} user - 사용자 정보 객체
   */
  setUser(user) {
    this.user = user;
    this.isAuthenticated = !!user;

    // 이벤트 발행
    eventBus.publish(AUTH_EVENTS.LOGIN, {
      user: this.user,
      timestamp: new Date(),
    });
    
    eventBus.publish(AUTH_EVENTS.STATE_CHANGED, {
      user: this.user,
      isAuthenticated: this.isAuthenticated,
    });
  }

  /**
   * 로그아웃
   */
  logout() {
    this.user = null;
    this.isAuthenticated = false;
    
    // 토큰 삭제
    tokenManager.clearTokens();

    // 이벤트 발행
    eventBus.publish(AUTH_EVENTS.LOGOUT, {
      timestamp: new Date(),
    });
    
    eventBus.publish(AUTH_EVENTS.STATE_CHANGED, {
      user: null,
      isAuthenticated: false,
    });
  }

  /**
   * 토큰 갱신 이벤트 발행
   * @param {Object} tokens - 새로운 토큰 정보 { accessToken, refreshToken }
   */
  publishTokenRefreshed(tokens) {
    // 토큰 저장
    tokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
    
    eventBus.publish(AUTH_EVENTS.TOKEN_REFRESHED, {
      ...tokens,
      timestamp: new Date(),
    });
  }

  /**
   * 토큰 갱신 실패 이벤트 발행
   */
  publishTokenRefreshFailed() {
    eventBus.publish(AUTH_EVENTS.TOKEN_REFRESH_FAILED, {
      timestamp: new Date(),
    });
    
    // 토큰 갱신 실패 시 로그아웃 처리
    this.logout();
  }

  /**
   * 현재 상태 반환
   * @returns {Object} 현재 인증 상태
   */
  getState() {
    return {
      user: this.user,
      isAuthenticated: this.isAuthenticated,
    };
  }

  /**
   * 인증 여부 확인
   * @returns {boolean} 인증 상태
   */
  getIsAuthenticated() {
    return this.isAuthenticated;
  }

  /**
   * 현재 사용자 정보 반환
   * @returns {Object|null} 사용자 정보 또는 null
   */
  getUser() {
    return this.user;
  }
}

// 싱글톤 인스턴스 생성 및 export
export const authState = new AuthState();

export default authState;


