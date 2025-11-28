/**
 * 사용자 관련 API 서비스
 * 프로필 조회, 수정 등의 API 호출 함수 제공
 */

import apiClient from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';

export const userService = {
  /**
   * 프로필 조회
   * @returns {Promise<Object>} UserProfileResponse { id, loginId, email, name, role, status }
   */
  async getProfile() {
    const response = await apiClient.get(API_ENDPOINTS.USER.PROFILE);
    return response; // UserProfileResponse 반환
  },

  /**
   * 프로필 수정
   * @param {Object} profileData - 프로필 수정 데이터
   * @param {string} [profileData.name] - 이름
   * @param {string} [profileData.email] - 이메일
   * @returns {Promise<Object>} UserProfileResponse { id, loginId, email, name, role, status }
   */
  async updateProfile(profileData) {
    const response = await apiClient.put(API_ENDPOINTS.USER.PROFILE, profileData);
    return response; // UserProfileResponse 반환
  },
};

export default userService;

