/**
 * 도서 관련 API 서비스
 * 도서 검색, 상세 정보 조회, 서재 관리 등의 API 호출 함수 제공
 */

import apiClient from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';

export const bookService = {
  /**
   * 도서 검색
   * @param {Object} searchParams - 검색 파라미터
   * @param {string} searchParams.query - 검색어
   * @param {string} [searchParams.queryType] - 검색 타입 (TITLE, AUTHOR, PUBLISHER)
   * @param {number} [searchParams.start] - 시작 페이지 (기본값: 1)
   * @param {number} [searchParams.maxResults] - 페이지당 결과 수 (기본값: 10, 최대: 50)
   * @returns {Promise<Object>} BookSearchResponse { totalResults, start, maxResults, books[] }
   */
  async searchBooks({ query, queryType = 'TITLE', start = 1, maxResults = 10 }) {
    const params = {
      query,
      queryType,
      start,
      maxResults: Math.min(maxResults, 50), // 최대 50개로 제한
    };
    
    const response = await apiClient.get(API_ENDPOINTS.BOOKS.SEARCH, params);
    return response; // BookSearchResponse 반환
  },

  /**
   * 도서 상세 정보 조회
   * @param {string} isbn - 도서 ISBN
   * @returns {Promise<Object>} BookDetailResponse { isbn, title, author, publisher, pubDate, description, coverUrl, price, category }
   */
  async getBookDetail(isbn) {
    const response = await apiClient.get(`${API_ENDPOINTS.BOOKS.DETAIL}/${isbn}`);
    return response; // BookDetailResponse 반환
  },

  /**
   * 서재에 도서 추가
   * @param {Object} bookData - 도서 추가 데이터
   * @param {string} bookData.isbn - ISBN
   * @param {string} bookData.title - 도서명
   * @param {string} bookData.author - 저자명
   * @param {string} bookData.publisher - 출판사명
   * @param {string} bookData.pubDate - 출판일
   * @param {string} [bookData.description] - 책 설명
   * @param {string} [bookData.coverUrl] - 표지 이미지 URL (백엔드 표준 필드명)
   * @param {string} [bookData.category] - 카테고리 (ToRead, Reading, AlmostFinished, Finished)
   * @param {string} [bookData.expectation] - 기대감
   * @returns {Promise<Object>} BookAdditionResponse { userBookId, isbn, title, category, addedAt }
   */
  async addBookToShelf(bookData) {
    const response = await apiClient.post(API_ENDPOINTS.BOOKS.USER_BOOKS, {
      ...bookData,
      category: bookData.category || 'ToRead', // 기본값: 읽고 싶은 책
    });
    return response; // BookAdditionResponse 반환
  },

  /**
   * 서재 조회
   * @param {Object} [params] - 조회 파라미터
   * @param {string} [params.category] - 카테고리 필터 (ToRead, Reading, AlmostFinished, Finished)
   * @param {string} [params.sortBy] - 정렬 기준 (TITLE, AUTHOR, PUBLISHER, GENRE)
   * @returns {Promise<Object>} MyShelfResponse { totalCount, books[] }
   */
  async getBookshelf({ category, sortBy } = {}) {
    const params = {};
    if (category) params.category = category;
    if (sortBy) params.sortBy = sortBy;
    
    const response = await apiClient.get(API_ENDPOINTS.BOOKS.USER_BOOKS, params);
    return response; // MyShelfResponse 반환
  },

  /**
   * 서재에서 도서 제거
   * @param {number} userBookId - 사용자 도서 ID
   * @returns {Promise<string>} 성공 메시지
   */
  async removeBookFromShelf(userBookId) {
    const response = await apiClient.delete(`${API_ENDPOINTS.BOOKS.USER_BOOKS}/${userBookId}`);
    return response; // 성공 메시지 반환
  },

  /**
   * 도서 상태 변경
   * @param {number} userBookId - 사용자 도서 ID
   * @param {string} category - 새로운 카테고리 (ToRead, Reading, AlmostFinished, Finished)
   * @returns {Promise<string>} 성공 메시지
   */
  async updateBookStatus(userBookId, category) {
    // 쿼리 파라미터로 전달
    const endpoint = `${API_ENDPOINTS.BOOKS.USER_BOOKS}/${userBookId}/category?category=${encodeURIComponent(category)}`;
    const response = await apiClient.put(endpoint, {});
    return response; // 성공 메시지 반환
  },

  /**
   * 서재에 저장된 도서 상세 정보 조회
   * @param {number} userBookId - 사용자 도서 ID
   * @returns {Promise<Object>} MyShelfResponse.ShelfBook (도서 기본 정보 + 서재 저장 정보)
   */
  async getUserBookDetail(userBookId) {
    // 전체 서재 목록을 가져온 후 userBookId로 필터링
    const response = await apiClient.get(API_ENDPOINTS.BOOKS.USER_BOOKS, {});
    const books = response.books || [];
    const userBook = books.find(book => book.userBookId === parseInt(userBookId));
    
    if (!userBook) {
      throw new Error('서재에 저장된 도서를 찾을 수 없습니다.');
    }
    
    return userBook;
  },

  /**
   * 독서 시작하기 (ToRead → Reading)
   * @param {number} userBookId - 사용자 도서 ID
   * @param {Object} startReadingData - 독서 시작 데이터
   * @param {string} startReadingData.readingStartDate - 독서 시작일 (YYYY-MM-DD)
   * @param {number} startReadingData.readingProgress - 현재 읽은 페이지 수
   * @param {string} [startReadingData.purchaseType] - 구매 유형 (PURCHASED, BORROWED, GIFTED, LIBRARY)
   * @returns {Promise<string>} 성공 메시지
   */
  async startReading(userBookId, startReadingData) {
    const response = await apiClient.post(API_ENDPOINTS.BOOKSHELF.START_READING(userBookId), startReadingData);
    return response; // 성공 메시지 반환
  },

  /**
   * 책 상세 정보 변경
   * @param {number} userBookId - 사용자 도서 ID
   * @param {Object} updateData - 변경할 데이터
   * @param {string} [updateData.category] - 카테고리
   * @param {string} [updateData.expectation] - 기대감
   * @param {string} [updateData.readingStartDate] - 독서 시작일
   * @param {number} [updateData.readingProgress] - 현재 읽은 페이지 수
   * @param {string} [updateData.purchaseType] - 구매 유형
   * @param {string} [updateData.readingFinishedDate] - 독서 종료일
   * @param {number} [updateData.rating] - 평점
   * @param {string} [updateData.review] - 후기
   * @returns {Promise<string>} 성공 메시지
   */
  async updateBookDetail(userBookId, updateData) {
    const response = await apiClient.put(API_ENDPOINTS.BOOKSHELF.UPDATE(userBookId), updateData);
    return response; // 성공 메시지 반환
  },
};

export default bookService;

