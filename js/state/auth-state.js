/**
 * 인증 상태 관리 클래스
 * 사용자 인증 상태를 관리하고, 상태 변경 시 이벤트를 발행합니다.
 */

import { eventBus } from '../utils/event-bus.js';
import { AUTH_EVENTS } from '../constants/events.js';
import { tokenManager } from '../utils/token-manager.js';
import { userService } from '../services/user-service.js';
import { apiClient } from '../services/api-client.js';

class AuthState {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.isRestoring = false; // 복원 중 플래그
    
    // 페이지 로드 시 토큰이 있으면 인증 상태 복원 (비동기)
    this.restoreAuthState();
  }

  /**
   * 토큰이 있으면 서버 연결 확인 후 인증 상태 복원
   * 서버가 종료되었거나 연결할 수 없으면 자동 로그아웃 처리
   */
  async restoreAuthState() {
    if (!tokenManager.hasAccessToken()) {
      return;
    }
    
    // 이미 복원 중이면 중복 실행 방지
    if (this.isRestoring) {
      return;
    }
    
    this.isRestoring = true;
    
    try {
      // 서버 연결 확인 및 토큰 유효성 검증
      // /users/me 엔드포인트를 호출하여 서버 연결 및 토큰 유효성 확인
      const userProfile = await userService.getProfile();
      
      // 서버 응답 성공 시 사용자 정보 설정
      if (userProfile) {
        this.setUser(userProfile);
      } else {
        // 응답은 왔지만 사용자 정보가 없는 경우 로그아웃
        this.logout();
      }
    } catch (error) {
      // 네트워크 에러 또는 서버 연결 불가 시 처리
      console.warn('[AuthState] 서버 연결 확인 실패:', error.message);
      
      // 403 에러인 경우 토큰 갱신 시도 (Access Token 만료 가능성)
      if (error.status === 403 || error.statusCode === 403) {
        try {
          // 토큰 갱신 시도
          const refreshed = await apiClient.handleTokenRefresh();
          if (refreshed) {
            // 갱신 성공 시 사용자 정보 재조회
            const userProfile = await userService.getProfile();
            if (userProfile) {
              this.setUser(userProfile);
              return;
            }
          }
        } catch (refreshError) {
          // 토큰 갱신 실패
          console.warn('[AuthState] 토큰 갱신 실패:', refreshError.message);
        }
      }
      
      // 네트워크 에러인지 확인
      const isNetworkError = 
        error.isNetworkError === true ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('Network request failed') ||
        error.message?.includes('서버에 연결할 수 없습니다') ||
        (error.name === 'TypeError' && error.message?.includes('fetch')) ||
        (!navigator.onLine);
      
      if (isNetworkError) {
        // 네트워크 에러는 일시적이므로 토큰 유지
        // 인증 상태만 초기화 (서버 재시작 후 동기화 가능하도록)
        this.isAuthenticated = false;
        this.user = null;
        // 토큰은 유지 (clearTokens() 호출하지 않음)
        
        // 이벤트 발행 (UI 업데이트용)
        eventBus.publish(AUTH_EVENTS.STATE_CHANGED, {
          user: null,
          isAuthenticated: false,
        });
      } else {
        // 네트워크 에러가 아닌 경우 (예: 401, 403 등)
        if (error.status === 401 || error.statusCode === 401) {
          // 인증 실패는 영구적이므로 로그아웃
          this.logout({ reason: 'token_invalid' });
        } else {
          // 기타 에러는 인증 상태만 초기화 (토큰은 유지)
          this.isAuthenticated = false;
          this.user = null;
        }
      }
    } finally {
      this.isRestoring = false;
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
   * @param {Object} [options] - 로그아웃 옵션
   * @param {string} [options.reason] - 로그아웃 원인 ('network_error', 'token_invalid', 'user_action' 등)
   */
  logout(options = {}) {
    this.user = null;
    this.isAuthenticated = false;
    
    // 토큰 삭제
    tokenManager.clearTokens();

    // 이벤트 발행 (원인 정보 포함)
    eventBus.publish(AUTH_EVENTS.LOGOUT, {
      reason: options.reason || 'user_action',
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

  /**
   * 인증 상태 복원 중 여부 확인
   * @returns {boolean} 복원 중 여부
   */
  getIsRestoring() {
    return this.isRestoring;
  }

  /**
   * 인증 상태 복원 완료 대기
   * @param {number} maxWaitTime - 최대 대기 시간 (ms)
   * @returns {Promise<void>}
   */
  async waitForRestore(maxWaitTime = 5000) {
    if (!this.isRestoring) {
      return;
    }
    
    const startTime = Date.now();
    while (this.isRestoring && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// 싱글톤 인스턴스 생성 및 export
export const authState = new AuthState();


