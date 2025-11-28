/**
 * 라우트 경로 상수 정의
 * 페이지 경로를 중앙에서 관리
 */

export const ROUTES = {
  HOME: '/',
  LOGIN: '/html/login.html',
  REGISTER: '/html/register.html',
  BOOK_SEARCH: '/html/book-search.html',
  BOOK_DETAIL: (isbn) => `/html/book-detail.html?isbn=${isbn}`,
  USER_BOOK_DETAIL: (userBookId) => `/html/book-detail.html?userBookId=${userBookId}`,
  BOOKSHELF: '/html/bookshelf.html',
  PROFILE: '/html/profile.html',
  FLOW: '/html/flow.html',
};

/**
 * 라우트 경로로 이동
 * @param {string} route - 이동할 경로
 * @param {boolean} replace - 히스토리 교체 여부 (기본값: false)
 */
export function navigateTo(route, replace = false) {
  if (replace) {
    window.location.replace(route);
  } else {
    window.location.href = route;
  }
}

/**
 * 라우트 경로로 이동 (히스토리 교체)
 * @param {string} route - 이동할 경로
 */
export function replaceTo(route) {
  navigateTo(route, true);
}

export default ROUTES;


