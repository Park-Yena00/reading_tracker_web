/**
 * 헤더 컴포넌트
 * 인증 상태에 따라 메뉴가 변경되는 공통 헤더 컴포넌트
 */

import authState from '../../state/auth-state.js';
import eventBus from '../../utils/event-bus.js';
import { AUTH_EVENTS } from '../../constants/events.js';
import { ROUTES } from '../../constants/routes.js';

export class HeaderView {
  constructor(containerId = 'header') {
    this.container = document.getElementById(containerId);
    this.unsubscribers = [];
    
    if (!this.container) {
      console.warn(`Header container with id "${containerId}" not found`);
      return;
    }
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.render();
    this.attachEvents();
    this.subscribeToAuthEvents();
  }

  /**
   * 헤더 렌더링
   */
  render() {
    const isAuthenticated = authState.getIsAuthenticated();
    const user = authState.getUser();
    
    this.container.innerHTML = `
      <header class="header">
        <div class="container">
          <div class="header-content">
            <div class="header-logo">
              <a href="${ROUTES.HOME}">Reading Tracker</a>
            </div>
            <nav class="header-nav">
              ${isAuthenticated ? this.renderAuthenticatedNav(user) : this.renderUnauthenticatedNav()}
            </nav>
          </div>
        </div>
      </header>
    `;
  }

  /**
   * 인증된 사용자용 네비게이션 렌더링
   * @param {Object} user - 사용자 정보
   * @returns {string} HTML 문자열
   */
  renderAuthenticatedNav(user) {
    return `
      <ul class="nav-list">
        <li><a href="${ROUTES.BOOKSHELF}">내 서재</a></li>
        <li><a href="${ROUTES.FLOW}">오늘의 흐름</a></li>
        <li class="nav-user">
          <span class="user-name">${user?.name || '사용자'}</span>
          <div class="user-menu">
            <a href="${ROUTES.PROFILE}">프로필</a>
            <button class="btn-text btn-logout">로그아웃</button>
          </div>
        </li>
      </ul>
    `;
  }

  /**
   * 비인증 사용자용 네비게이션 렌더링
   * @returns {string} HTML 문자열
   */
  renderUnauthenticatedNav() {
    return `
      <ul class="nav-list">
        <li><a href="${ROUTES.LOGIN}" class="btn btn-secondary">로그인</a></li>
        <li><a href="${ROUTES.REGISTER}" class="btn btn-primary">회원가입</a></li>
      </ul>
    `;
  }

  /**
   * 이벤트 리스너 연결
   */
  attachEvents() {
    // 로그아웃 버튼 클릭
    const logoutBtn = this.container.querySelector('.btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        authState.logout();
        window.location.href = ROUTES.LOGIN;
      });
    }
  }

  /**
   * 인증 이벤트 구독
   */
  subscribeToAuthEvents() {
    // 로그인 이벤트 구독
    const unsubscribeLogin = eventBus.subscribe(AUTH_EVENTS.LOGIN, () => {
      this.render();
      this.attachEvents();
    });
    this.unsubscribers.push(unsubscribeLogin);
    
    // 로그아웃 이벤트 구독
    const unsubscribeLogout = eventBus.subscribe(AUTH_EVENTS.LOGOUT, () => {
      this.render();
      this.attachEvents();
    });
    this.unsubscribers.push(unsubscribeLogout);
    
    // 인증 상태 변경 이벤트 구독
    const unsubscribeStateChanged = eventBus.subscribe(AUTH_EVENTS.STATE_CHANGED, () => {
      this.render();
      this.attachEvents();
    });
    this.unsubscribers.push(unsubscribeStateChanged);
  }

  /**
   * 컴포넌트 정리
   */
  destroy() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }
}

export default HeaderView;


