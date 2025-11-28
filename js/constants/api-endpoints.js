/**
 * API 엔드포인트 상수 정의
 * 백엔드 API 엔드포인트 경로를 중앙에서 관리
 * 
 * 주의: 이 경로들은 API_BASE_URL과 결합됩니다.
 * api-client.js에서 이미 /api/v1이 baseURL에 포함되어 있으므로,
 * 여기서는 /api/v1을 제외한 상대 경로만 정의합니다.
 */

export const API_ENDPOINTS = {
  // 인증 관련
  AUTH: {
    SIGNUP: '/auth/signup',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    FIND_LOGIN_ID: '/auth/find-login-id',
    VERIFY_ACCOUNT: '/auth/verify-account',
    RESET_PASSWORD: '/auth/reset-password',
  },
  
  // 사용자 관련
  USER: {
    PROFILE: '/users/me', // API 문서 기준: /users/me
    DUPLICATE_LOGIN_ID: '/users/duplicate/loginId',
    DUPLICATE_EMAIL: '/users/duplicate/email',
  },
  
  // 도서 관련
  BOOKS: {
    SEARCH: '/books/search',
    DETAIL: '/books', // /books/{isbn}
    USER_BOOKS: '/user/books', // /user/books, /user/books/{userBookId}
  },
  
  // 서재 관련
  BOOKSHELF: {
    LIST: '/user/books',
    ADD: '/user/books',
    UPDATE: (userBookId) => `/user/books/${userBookId}`,
    DELETE: (userBookId) => `/user/books/${userBookId}`,
    START_READING: (userBookId) => `/user/books/${userBookId}/start-reading`,
    FINISH_READING: (userBookId) => `/user/books/${userBookId}/finish-reading`,
  },
  
  // 메모 관련
  MEMOS: {
    TODAY_FLOW: '/today-flow',
    LIST: '/memos',
    CREATE: '/memos',
    UPDATE: (memoId) => `/memos/${memoId}`,
    DELETE: (memoId) => `/memos/${memoId}`,
    BY_BOOK: (userBookId) => `/memos/books/${userBookId}`,
    CLOSE_BOOK: (userBookId) => `/memos/books/${userBookId}/close`,
    RECENT_BOOKS: '/memos/books/recent',
    DATES: '/memos/dates',
  },
};

export default API_ENDPOINTS;

