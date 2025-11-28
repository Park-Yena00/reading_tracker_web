/**
 * 이벤트 이름 상수 정의
 * Event-Driven 패턴을 위한 이벤트 타입 정의
 */

export const AUTH_EVENTS = {
  /** 로그인 성공 시 발행 */
  LOGIN: 'auth:login',
  /** 로그아웃 시 발행 */
  LOGOUT: 'auth:logout',
  /** 인증 상태 변경 시 발행 */
  STATE_CHANGED: 'auth:stateChanged',
  /** 토큰 갱신 시 발행 */
  TOKEN_REFRESHED: 'auth:tokenRefreshed',
  /** 토큰 갱신 실패 시 발행 */
  TOKEN_REFRESH_FAILED: 'auth:tokenRefreshFailed',
};

export const APP_EVENTS = {
  /** 로딩 시작 시 발행 */
  LOADING_START: 'app:loadingStart',
  /** 로딩 종료 시 발행 */
  LOADING_END: 'app:loadingEnd',
  /** 에러 발생 시 발행 */
  ERROR: 'app:error',
  /** 페이지 변경 시 발행 */
  PAGE_CHANGED: 'app:pageChanged',
  /** 애플리케이션 상태 변경 시 발행 */
  STATE_CHANGED: 'app:stateChanged',
};

export const BOOK_EVENTS = {
  /** 서재 업데이트 시 발행 */
  BOOKSHELF_UPDATED: 'book:bookshelfUpdated',
  /** 도서 추가 시 발행 */
  BOOK_ADDED: 'book:bookAdded',
  /** 도서 삭제 시 발행 */
  BOOK_REMOVED: 'book:bookRemoved',
  /** 도서 상태 변경 시 발행 */
  BOOK_STATUS_CHANGED: 'book:bookStatusChanged',
  /** 도서 검색 완료 시 발행 */
  BOOK_SEARCH_COMPLETED: 'book:bookSearchCompleted',
};

// 모든 이벤트를 하나의 객체로 export
export default {
  AUTH_EVENTS,
  APP_EVENTS,
  BOOK_EVENTS,
};

