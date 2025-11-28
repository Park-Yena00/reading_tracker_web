/**
 * 도서 관련 상태 관리 클래스
 * 서재 데이터, 검색 결과 등의 도서 관련 상태를 관리합니다.
 */

import eventBus from '../utils/event-bus.js';
import { BOOK_EVENTS } from '../constants/events.js';

class BookState {
  constructor() {
    this.state = {
      bookshelf: [], // 서재 목록
      searchResults: [], // 검색 결과
      currentBook: null, // 현재 선택된 도서
      searchQuery: '', // 검색어
      filters: {
        category: null, // 독서 상태 필터
        sortBy: 'addedAt', // 정렬 기준
      },
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
    if ('bookshelf' in updates) {
      eventBus.publish(BOOK_EVENTS.BOOKSHELF_UPDATED, {
        bookshelf: this.state.bookshelf,
        timestamp: new Date(),
      });
    }

    if ('searchResults' in updates) {
      eventBus.publish(BOOK_EVENTS.BOOK_SEARCH_COMPLETED, {
        results: this.state.searchResults,
        query: this.state.searchQuery,
        timestamp: new Date(),
      });
    }

    if ('currentBook' in updates) {
      // 현재 도서 변경 이벤트 (필요 시)
    }
  }

  /**
   * 서재 목록 설정
   * @param {Array} books - 도서 목록
   */
  setBookshelf(books) {
    this.setState({ bookshelf: books });
  }

  /**
   * 도서를 서재에 추가
   * @param {Object} book - 추가할 도서 정보
   */
  addBook(book) {
    const updatedBookshelf = [...this.state.bookshelf, book];
    this.setState({ bookshelf: updatedBookshelf });
    
    eventBus.publish(BOOK_EVENTS.BOOK_ADDED, {
      book,
      timestamp: new Date(),
    });
  }

  /**
   * 서재에서 도서 삭제
   * @param {number} userBookId - 삭제할 도서의 userBookId
   */
  removeBook(userBookId) {
    const updatedBookshelf = this.state.bookshelf.filter(
      book => book.id !== userBookId
    );
    this.setState({ bookshelf: updatedBookshelf });
    
    eventBus.publish(BOOK_EVENTS.BOOK_REMOVED, {
      userBookId,
      timestamp: new Date(),
    });
  }

  /**
   * 도서 상태 변경
   * @param {number} userBookId - 변경할 도서의 userBookId
   * @param {Object} updates - 업데이트할 필드들
   */
  updateBookStatus(userBookId, updates) {
    const updatedBookshelf = this.state.bookshelf.map(book => {
      if (book.id === userBookId) {
        return { ...book, ...updates };
      }
      return book;
    });
    
    this.setState({ bookshelf: updatedBookshelf });
    
    eventBus.publish(BOOK_EVENTS.BOOK_STATUS_CHANGED, {
      userBookId,
      updates,
      timestamp: new Date(),
    });
  }

  /**
   * 검색 결과 설정
   * @param {Array} results - 검색 결과 목록
   * @param {string} query - 검색어
   */
  setSearchResults(results, query) {
    this.setState({
      searchResults: results,
      searchQuery: query || '',
    });
  }

  /**
   * 현재 도서 설정
   * @param {Object} book - 도서 정보
   */
  setCurrentBook(book) {
    this.setState({ currentBook: book });
  }

  /**
   * 필터 설정
   * @param {Object} filters - 필터 객체
   */
  setFilters(filters) {
    this.setState({
      filters: { ...this.state.filters, ...filters },
    });
  }

  /**
   * 서재 목록 반환
   * @returns {Array} 서재 목록
   */
  getBookshelf() {
    return [...this.state.bookshelf];
  }

  /**
   * 검색 결과 반환
   * @returns {Array} 검색 결과
   */
  getSearchResults() {
    return [...this.state.searchResults];
  }

  /**
   * 현재 도서 반환
   * @returns {Object|null} 현재 도서 또는 null
   */
  getCurrentBook() {
    return this.state.currentBook;
  }

  /**
   * 필터 반환
   * @returns {Object} 필터 객체
   */
  getFilters() {
    return { ...this.state.filters };
  }

  /**
   * 전체 상태 반환
   * @returns {Object} 전체 상태
   */
  getState() {
    return {
      ...this.state,
      bookshelf: [...this.state.bookshelf],
      searchResults: [...this.state.searchResults],
      filters: { ...this.state.filters },
    };
  }

  /**
   * 서재 초기화
   */
  clearBookshelf() {
    this.setState({ bookshelf: [] });
  }

  /**
   * 검색 결과 초기화
   */
  clearSearchResults() {
    this.setState({ searchResults: [], searchQuery: '' });
  }
}

// 싱글톤 인스턴스 생성 및 export
export const bookState = new BookState();

export default bookState;


