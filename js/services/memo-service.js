/**
 * 메모 관련 API 서비스
 * 오늘의 흐름, 메모 작성/수정/삭제 등의 API 호출 함수 제공
 */

import apiClient from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';

export const memoService = {
  /**
   * 오늘의 흐름 조회
   * @param {Object} [params] - 조회 파라미터
   * @param {string} [params.date] - 조회할 날짜 (ISO 8601 형식: YYYY-MM-DD, 기본값: 오늘)
   * @param {string} [params.sortBy] - 정렬 방식 (SESSION, BOOK, TAG, 기본값: SESSION)
   * @param {string} [params.tagCategory] - 태그 대분류 (TYPE, TOPIC, 기본값: TYPE)
   * @returns {Promise<Object>} TodayFlowResponse
   */
  async getTodayFlow({ date, sortBy = 'SESSION', tagCategory } = {}) {
    const params = {};
    if (date) params.date = date;
    if (sortBy) params.sortBy = sortBy;
    // TAG 모드일 때만 tagCategory 추가
    if (tagCategory) {
      params.tagCategory = tagCategory;
    }
    
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.TODAY_FLOW, params);
    return response; // TodayFlowResponse 반환
  },

  /**
   * 메모 작성 날짜 목록 조회 (캘린더용)
   * @param {number} year - 조회할 년도
   * @param {number} month - 조회할 월 (1-12)
   * @returns {Promise<Array<string>>} 날짜 문자열 리스트 (ISO 8601 형식: YYYY-MM-DD)
   */
  async getMemoDates(year, month) {
    const params = { year, month };
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.DATES, params);
    return response; // List<String> 반환
  },

  /**
   * 메모 작성
   * @param {Object} memoData - 메모 작성 데이터
   * @param {number} memoData.userBookId - 사용자 책 ID
   * @param {number} [memoData.pageNumber] - 페이지 번호
   * @param {string} memoData.content - 메모 내용
   * @param {Array<string>} [memoData.tags] - 태그 코드 리스트
   * @param {string} [memoData.memoStartTime] - 메모 시작 시간 (ISO 8601 형식, 기본값: 현재 시간)
   * @returns {Promise<Object>} MemoResponse
   */
  async createMemo(memoData) {
    const data = {
      userBookId: memoData.userBookId,
      content: memoData.content,
      tags: memoData.tags || [],
    };
    
    if (memoData.pageNumber !== undefined) {
      data.pageNumber = memoData.pageNumber;
    }
    
    if (memoData.memoStartTime) {
      data.memoStartTime = memoData.memoStartTime;
    }
    
    const response = await apiClient.post(API_ENDPOINTS.MEMOS.CREATE, data);
    return response; // MemoResponse 반환
  },

  /**
   * 메모 수정
   * @param {number} memoId - 메모 ID
   * @param {Object} memoData - 메모 수정 데이터
   * @param {string} [memoData.content] - 메모 내용
   * @param {Array<string>} [memoData.tags] - 태그 코드 리스트
   * @returns {Promise<Object>} MemoResponse
   */
  async updateMemo(memoId, memoData) {
    const data = {};
    if (memoData.content !== undefined) data.content = memoData.content;
    if (memoData.tags !== undefined) data.tags = memoData.tags;
    
    const response = await apiClient.put(API_ENDPOINTS.MEMOS.UPDATE(memoId), data);
    return response; // MemoResponse 반환
  },

  /**
   * 메모 삭제
   * @param {number} memoId - 메모 ID
   * @returns {Promise<string>} 성공 메시지
   */
  async deleteMemo(memoId) {
    const response = await apiClient.delete(API_ENDPOINTS.MEMOS.DELETE(memoId));
    return response; // 성공 메시지 반환
  },

  /**
   * 특정 책의 메모 조회
   * @param {number} userBookId - 사용자 책 ID
   * @param {string} [date] - 조회할 날짜 (ISO 8601 형식: YYYY-MM-DD, 선택사항)
   * @returns {Promise<Array<Object>>} MemoResponse 리스트
   */
  async getMemosByBook(userBookId, date = null) {
    const params = {};
    if (date) params.date = date;
    
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.BY_BOOK(userBookId), params);
    return response; // List<MemoResponse> 반환
  },

  /**
   * 책 덮기 (독서 활동 종료)
   * @param {number} userBookId - 사용자 책 ID
   * @param {number} lastReadPage - 마지막으로 읽은 페이지 수
   * @returns {Promise<string>} 성공 메시지
   */
  async closeBook(userBookId, lastReadPage) {
    const response = await apiClient.post(API_ENDPOINTS.MEMOS.CLOSE_BOOK(userBookId), {
      lastReadPage,
    });
    return response; // 성공 메시지 반환
  },

  /**
   * 최근 메모 작성 책 목록 조회
   * @param {number} [months] - 조회 기간 (개월 수, 기본값: 1)
   * @returns {Promise<Array<Object>>} BookResponse 리스트
   */
  async getRecentMemoBooks(months = 1) {
    const params = { months };
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.RECENT_BOOKS, params);
    return response; // List<BookResponse> 반환
  },
};

export default memoService;

