/**
 * 인증 관련 API 서비스
 * 인증 관련 API 호출 함수 제공
 */

import apiClient from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';

export const authService = {
  /**
   * 로그인
   * @param {Object} loginData - 로그인 데이터 { loginId, password }
   * @returns {Promise<Object>} LoginResponse { accessToken, refreshToken, tokenType, expiresIn, user }
   */
  async login(loginData) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, loginData);
    return response; // LoginResponse 반환
  },

  /**
   * 회원가입
   * @param {Object} registerData - 회원가입 데이터 { loginId, email, name, password }
   * @returns {Promise<Object>} RegisterResponse { id, loginId, email, name, role, status }
   */
  async register(registerData) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.SIGNUP, registerData);
    return response; // RegisterResponse 반환
  },

  /**
   * 토큰 갱신
   * @param {string} refreshToken - Refresh Token
   * @returns {Promise<Object>} RefreshTokenResponse { accessToken, refreshToken }
   */
  async refreshToken(refreshToken) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken });
    return response; // RefreshTokenResponse 반환
  },

  /**
   * 아이디 찾기
   * @param {Object} requestData - 요청 데이터 { email, name }
   * @returns {Promise<Object>} LoginIdRetrievalResponse { loginId, email }
   */
  async findLoginId(requestData) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.FIND_LOGIN_ID, requestData);
    return response; // LoginIdRetrievalResponse 반환
  },

  /**
   * 계정 확인 (비밀번호 재설정 1단계)
   * @param {Object} requestData - 요청 데이터 { loginId, email }
   * @returns {Promise<Object>} AccountVerificationResponse { message, resetToken }
   */
  async verifyAccount(requestData) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.VERIFY_ACCOUNT, requestData);
    return response; // AccountVerificationResponse 반환
  },

  /**
   * 비밀번호 재설정 (비밀번호 재설정 2단계)
   * @param {Object} requestData - 요청 데이터 { resetToken, newPassword, confirmPassword }
   * @returns {Promise<Object>} PasswordResetResponse { message, loginId }
   */
  async resetPassword(requestData) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, requestData);
    return response; // PasswordResetResponse 반환
  },

  /**
   * 로그인 ID 중복 확인
   * @param {string} loginId - 확인할 로그인 ID
   * @returns {Promise<boolean>} true: 중복됨, false: 중복되지 않음
   */
  async checkLoginIdDuplicate(loginId) {
    const response = await apiClient.get(API_ENDPOINTS.USER.DUPLICATE_LOGIN_ID, {
      value: loginId,
    });
    return response; // boolean 반환
  },

  /**
   * 이메일 중복 확인
   * @param {string} email - 확인할 이메일
   * @returns {Promise<boolean>} true: 중복됨, false: 중복되지 않음
   */
  async checkEmailDuplicate(email) {
    const response = await apiClient.get(API_ENDPOINTS.USER.DUPLICATE_EMAIL, {
      value: email,
    });
    return response; // boolean 반환
  },
};

export default authService;


