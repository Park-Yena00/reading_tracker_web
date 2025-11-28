/**
 * 애플리케이션 전역 상태 관리 클래스
 * 로딩 상태, 에러 상태, 현재 페이지 등의 전역 상태를 관리합니다.
 */

import eventBus from '../utils/event-bus.js';
import { APP_EVENTS } from '../constants/events.js';

class AppState {
  constructor() {
    this.state = {
      loading: false,
      error: null,
      currentPage: 'home',
    };
  }

  /**
   * 상태 업데이트
   * @param {Object} updates - 업데이트할 상태 객체
   */
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // 특정 상태 변경에 대한 이벤트 발행
    if ('loading' in updates) {
      if (updates.loading) {
        eventBus.publish(APP_EVENTS.LOADING_START);
      } else {
        eventBus.publish(APP_EVENTS.LOADING_END);
      }
    }

    if ('error' in updates && updates.error) {
      eventBus.publish(APP_EVENTS.ERROR, {
        error: updates.error,
        timestamp: new Date(),
      });
    }

    if ('currentPage' in updates) {
      eventBus.publish(APP_EVENTS.PAGE_CHANGED, {
        page: updates.currentPage,
        previousPage: oldState.currentPage,
      });
    }

    // 전체 상태 변경 이벤트 발행
    eventBus.publish(APP_EVENTS.STATE_CHANGED, {
      state: this.state,
      changes: updates,
    });
  }

  /**
   * 현재 상태 반환
   * @returns {Object} 현재 애플리케이션 상태
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 로딩 상태 설정 헬퍼
   * @param {boolean} loading - 로딩 여부
   */
  setLoading(loading) {
    this.setState({ loading });
  }

  /**
   * 에러 상태 설정 헬퍼
   * @param {Error|string|null} error - 에러 객체, 에러 메시지 또는 null
   */
  setError(error) {
    if (error && typeof error === 'string') {
      this.setState({ error: { message: error } });
    } else {
      this.setState({ error });
    }
  }

  /**
   * 에러 초기화
   */
  clearError() {
    this.setState({ error: null });
  }

  /**
   * 현재 페이지 설정 헬퍼
   * @param {string} page - 페이지 이름
   */
  setCurrentPage(page) {
    this.setState({ currentPage: page });
  }

  /**
   * 로딩 상태 반환
   * @returns {boolean} 로딩 상태
   */
  isLoading() {
    return this.state.loading;
  }

  /**
   * 에러 상태 반환
   * @returns {Error|string|null} 에러 객체, 에러 메시지 또는 null
   */
  getError() {
    return this.state.error;
  }

  /**
   * 현재 페이지 반환
   * @returns {string} 현재 페이지 이름
   */
  getCurrentPage() {
    return this.state.currentPage;
  }
}

// 싱글톤 인스턴스 생성 및 export
export const appState = new AppState();

export default appState;


