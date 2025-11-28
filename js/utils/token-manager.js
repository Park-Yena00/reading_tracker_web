/**
 * JWT 토큰 관리 유틸리티
 * localStorage에 토큰을 저장/조회/삭제하는 기능 제공
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * 토큰 관리자
 */
export const tokenManager = {
  /**
   * Access Token 저장
   * @param {string} token - Access Token
   */
  setAccessToken(token) {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  },

  /**
   * Refresh Token 저장
   * @param {string} token - Refresh Token
   */
  setRefreshToken(token) {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  /**
   * Access Token 조회
   * @returns {string|null} Access Token 또는 null
   */
  getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * Refresh Token 조회
   * @returns {string|null} Refresh Token 또는 null
   */
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * 모든 토큰 저장
   * @param {string} accessToken - Access Token
   * @param {string} refreshToken - Refresh Token
   */
  setTokens(accessToken, refreshToken) {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  },

  /**
   * 모든 토큰 삭제
   */
  clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Access Token 존재 여부 확인
   * @returns {boolean} 토큰 존재 여부
   */
  hasAccessToken() {
    return !!this.getAccessToken();
  },

  /**
   * Refresh Token 존재 여부 확인
   * @returns {boolean} 토큰 존재 여부
   */
  hasRefreshToken() {
    return !!this.getRefreshToken();
  },

  /**
   * 모든 토큰 존재 여부 확인
   * @returns {boolean} 토큰 존재 여부
   */
  hasTokens() {
    return this.hasAccessToken() && this.hasRefreshToken();
  },
};

export default tokenManager;


