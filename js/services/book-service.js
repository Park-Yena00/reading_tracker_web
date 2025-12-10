/**
 * 도서 관련 API 서비스
 * 도서 검색, 상세 정보 조회, 서재 관리 등의 API 호출 함수 제공
 * 오프라인 지원: 로컬 저장 및 자동 동기화 기능 통합
 */

import { apiClient } from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';
import { offlineBookService } from './offline-book-service.js';
import { networkMonitor } from '../utils/network-monitor.js';
import { BookOperationHelper } from '../utils/book-operation-helper.js';
import { syncStateManager } from '../utils/sync-state-manager.js';
import { requestQueueManager } from '../utils/request-queue-manager.js';

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
   * 서재에 도서 추가 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * - 동기화 중: 요청 큐잉 (질문 6-1 개선)
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
    if (networkMonitor.isOnline) {
      // 동기화 중이면 요청 큐에 추가 (질문 6-1 개선)
      if (syncStateManager.isSyncing) {
        console.log('[BookService] 동기화 중이므로 요청 큐에 추가: addBookToShelf');
        return await requestQueueManager.enqueue(
          () => this.addBookToShelf(bookData),
          { type: 'create', data: bookData }
        );
      }

      // 온라인: 서버 우선 전략
      try {
        // 1. 서버에서 먼저 추가 시도
        const serverBook = await apiClient.post(API_ENDPOINTS.BOOKS.USER_BOOKS, {
          ...bookData,
          category: bookData.category || 'ToRead', // 기본값: 읽고 싶은 책
        });
        
        // 2. 성공 시 IndexedDB 갱신
        const localBook = await BookOperationHelper.updateLocalAfterCreate(serverBook);
        
        // 3. 서버 응답 반환
        return serverBook;
      } catch (error) {
        // 서버 실패 시 오프라인 모드로 전환
        return await BookOperationHelper.handleServerError(
          error,
          null,
          async () => {
            // 오프라인 로직: 로컬 저장소에 먼저 저장
            const localBook = await offlineBookService.addBookToShelf(bookData);
            return this.mapLocalBookToResponse(localBook);
          }
        );
      }
    } else {
      // 오프라인: 로컬 우선 전략 (기존 로직)
      const localBook = await offlineBookService.addBookToShelf(bookData);
      return this.mapLocalBookToResponse(localBook);
    }
  },

  /**
   * 서재 조회 (로컬 + 서버 통합)
   * 하이브리드 전략: 오프라인에서는 로컬 데이터만 반환
   * 동기화 완료 후 서버에서 조회 (질문 6 개선)
   * @param {Object} [params] - 조회 파라미터
   * @param {string} [params.category] - 카테고리 필터 (ToRead, Reading, AlmostFinished, Finished)
   * @param {string} [params.sortBy] - 정렬 기준 (TITLE, AUTHOR, PUBLISHER, GENRE)
   * @returns {Promise<Object>} MyShelfResponse { totalCount, books[] }
   */
  async getBookshelf({ category, sortBy } = {}) {
    // 로컬 내 서재 정보 조회
    let localBooks = [];
    if (category) {
      localBooks = await offlineBookService.getBooksByCategory(category);
    } else {
      localBooks = await offlineBookService.getAllBooks();
    }

    // 온라인 상태면 서버에서도 조회하여 통합
    if (networkMonitor.isOnline) {
      // 동기화 중이면 로컬 내 서재 정보만 반환 (질문 6 개선)
      if (syncStateManager.isSyncing) {
        console.log('[BookService] 동기화 중이므로 로컬 내 서재 정보만 반환');
        return {
          totalCount: localBooks.length,
          books: this.mapLocalBooksToResponse(localBooks)
        };
      }

      // 동기화 완료 대기 (질문 6 개선)
      const isSyncComplete = await syncStateManager.waitForSyncComplete();
      if (!isSyncComplete) {
        console.warn('[BookService] 동기화 완료 대기 타임아웃, 로컬 내 서재 정보만 반환');
        return {
          totalCount: localBooks.length,
          books: this.mapLocalBooksToResponse(localBooks)
        };
      }

      // 동기화 완료 후 서버에서 조회
      try {
        const params = {};
        if (category) params.category = category;
        if (sortBy) params.sortBy = sortBy;
        
        const serverResponse = await apiClient.get(API_ENDPOINTS.BOOKS.USER_BOOKS, params);
        const serverBooks = serverResponse.books || [];

        // 서버 내 서재 정보를 IndexedDB에 저장
        for (const serverBook of serverBooks) {
          await BookOperationHelper.saveServerBookAsLocal(serverBook);
        }

        // 로컬 내 서재 정보와 서버 내 서재 정보 통합
        return this.mergeBooks(localBooks, serverBooks);
      } catch (error) {
        console.error('서버 내 서재 정보 조회 실패, 로컬 데이터만 반환:', error);
        return {
          totalCount: localBooks.length,
          books: this.mapLocalBooksToResponse(localBooks)
        };
      }
    } else {
      // 오프라인 상태면 로컬 데이터만 반환
      return {
        totalCount: localBooks.length,
        books: this.mapLocalBooksToResponse(localBooks)
      };
    }
  },

  /**
   * 서재에서 도서 제거 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * - 동기화 중: 요청 큐잉 (질문 6-1 개선)
   * @param {number} userBookId - 사용자 도서 ID
   * @returns {Promise<string>} 성공 메시지
   */
  async removeBookFromShelf(userBookId) {
    if (networkMonitor.isOnline) {
      // 동기화 중이면 요청 큐에 추가 (질문 6-1 개선)
      if (syncStateManager.isSyncing) {
        console.log('[BookService] 동기화 중이므로 요청 큐에 추가: removeBookFromShelf');
        return await requestQueueManager.enqueue(
          () => this.removeBookFromShelf(userBookId),
          { type: 'delete', userBookId }
        );
      }

      // 온라인: 서버 우선 전략
      try {
        // 1. 로컬 내 서재 정보 조회 (serverId 확인용)
        const localBook = await BookOperationHelper.getLocalBook(userBookId);
        
        let serverId = userBookId;
        if (localBook && localBook.serverId) {
          serverId = localBook.serverId;
        } else if (!localBook) {
          // 로컬에 없으면 서버에서 삭제 시도 (서버에만 존재할 수 있음)
          serverId = userBookId;
        } else {
          // serverId가 없는 로컬 내 서재 정보는 오프라인 로직으로 전환
          return await offlineBookService.removeBookFromShelf(userBookId)
            .then(result => {
              if (result.deleted && result.localOnly) {
                return '내 서재에서 도서가 제거되었습니다.';
              } else {
                return '내 서재에서 도서 제거가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.';
              }
            });
        }

        // 2. 서버에서 먼저 삭제 시도
        await apiClient.delete(`${API_ENDPOINTS.BOOKS.USER_BOOKS}/${serverId}`);
        
        // 3. 성공 시 IndexedDB 갱신
        await BookOperationHelper.updateLocalAfterDelete(serverId);
        
        return '내 서재에서 도서가 제거되었습니다.';
      } catch (error) {
        // 서버 실패 시 오프라인 모드로 전환
        return await BookOperationHelper.handleServerError(
          error,
          userBookId,
          async () => {
            const result = await offlineBookService.removeBookFromShelf(userBookId);
            if (result.deleted && result.localOnly) {
              return '내 서재에서 도서가 제거되었습니다.';
            } else {
              return '내 서재에서 도서 제거가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.';
            }
          }
        );
      }
    } else {
      // 오프라인: 로컬 우선 전략 (기존 로직)
      const result = await offlineBookService.removeBookFromShelf(userBookId);
      
      if (result.deleted && result.localOnly) {
        return '내 서재에서 도서가 제거되었습니다.';
      } else {
        return '내 서재에서 도서 제거가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.';
      }
    }
  },

  /**
   * 도서 상태 변경 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * @param {number} userBookId - 사용자 도서 ID
   * @param {string} category - 새로운 카테고리 (ToRead, Reading, AlmostFinished, Finished)
   * @returns {Promise<string>} 성공 메시지
   */
  async updateBookStatus(userBookId, category) {
    return await this.updateBookDetail(userBookId, { category });
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
   * 책 상세 정보 변경 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * - 동기화 중: 요청 큐잉 (질문 6-1 개선)
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
    if (networkMonitor.isOnline) {
      // 동기화 중이면 요청 큐에 추가 (질문 6-1 개선)
      if (syncStateManager.isSyncing) {
        console.log('[BookService] 동기화 중이므로 요청 큐에 추가: updateBookDetail');
        return await requestQueueManager.enqueue(
          () => this.updateBookDetail(userBookId, updateData),
          { type: 'update', userBookId, data: updateData }
        );
      }

      // 온라인: 서버 우선 전략
      try {
        // 1. 로컬 내 서재 정보 조회 (serverId 확인용)
        const localBook = await BookOperationHelper.getLocalBook(userBookId);
        
        if (!localBook) {
          // 로컬에 없으면 서버에서 조회 시도
          try {
            const serverBook = await this.getUserBookDetail(userBookId);
            // 서버에 존재하면 수정 시도
            await apiClient.put(API_ENDPOINTS.BOOKSHELF.UPDATE(userBookId), updateData);
            // IndexedDB 갱신
            await BookOperationHelper.updateLocalAfterUpdate(userBookId, { ...serverBook, ...updateData });
            return '내 서재 정보가 수정되었습니다.';
          } catch (error) {
            throw new Error('내 서재 정보를 찾을 수 없습니다.');
          }
        }

        // 2. serverId가 있으면 서버에서 수정 시도
        if (localBook.serverId) {
          await apiClient.put(API_ENDPOINTS.BOOKSHELF.UPDATE(localBook.serverId), updateData);
          
          // 3. 성공 시 IndexedDB 갱신
          await BookOperationHelper.updateLocalAfterUpdate(
            localBook.serverId,
            { ...localBook, ...updateData }
          );
          
          return '내 서재 정보가 수정되었습니다.';
        } else {
          // serverId가 없으면 오프라인 로직으로 전환
          await offlineBookService.updateBook(userBookId, updateData);
          return '내 서재 정보 수정이 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.';
        }
      } catch (error) {
        // 서버 실패 시 오프라인 모드로 전환
        return await BookOperationHelper.handleServerError(
          error,
          userBookId,
          async () => {
            await offlineBookService.updateBook(userBookId, updateData);
            return '내 서재 정보 수정이 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.';
          }
        );
      }
    } else {
      // 오프라인: 로컬 우선 전략 (기존 로직)
      await offlineBookService.updateBook(userBookId, updateData);
      return '내 서재 정보 수정이 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.';
    }
  },

  /**
   * 로컬 내 서재 정보와 서버 내 서재 정보 통합
   * @param {Array} localBooks - 로컬 내 서재 정보 배열
   * @param {Array} serverBooks - 서버 내 서재 정보 배열
   * @returns {Object} 통합된 MyShelfResponse { totalCount, books[] }
   */
  mergeBooks(localBooks, serverBooks) {
    // 서버 내 서재 정보를 맵으로 변환 (중복 제거용)
    const serverBookMap = new Map();
    serverBooks.forEach(book => {
      serverBookMap.set(book.userBookId, book);
    });

    const result = [];
    const processedServerIds = new Set(); // 처리된 서버 ID 추적

    localBooks.forEach(localBook => {
      if (localBook.syncStatus === 'synced' && localBook.serverId) {
        // 동기화 완료된 내 서재 정보: 서버 내 서재 정보로 대체
        const serverBook = serverBookMap.get(localBook.serverId);
        if (serverBook) {
          result.push(serverBook);
          processedServerIds.add(localBook.serverId);
          serverBookMap.delete(localBook.serverId);
        } else {
          result.push(this.mapLocalBookToResponse(localBook));
        }
      } else if (localBook.serverId) {
        // 동기화 대기 중인 내 서재 정보 (수정/삭제 대기)
        // 서버 내 서재 정보는 제외하고 로컬 내 서재 정보만 표시 (낡은 데이터 무시)
        result.push(this.mapLocalBookToResponse(localBook));
        processedServerIds.add(localBook.serverId);
        serverBookMap.delete(localBook.serverId); // 중요: 서버 내 서재 정보 제거하여 중복 방지
      } else {
        // 아직 동기화되지 않은 내 서재 정보 (생성 대기)
        // serverId가 null이므로 서버 내 서재 정보와 매칭 불가
        result.push(this.mapLocalBookToResponse(localBook));
      }
    });

    // 서버에만 있는 내 서재 정보 추가 (처리되지 않은 내 서재 정보만)
    serverBookMap.forEach(book => {
      if (!processedServerIds.has(book.userBookId)) {
        result.push(book);
      }
    });

    return {
      totalCount: result.length,
      books: result
    };
  },

  /**
   * 로컬 내 서재 정보를 ShelfBook 형식으로 변환
   * @param {Object} localBook - 로컬 내 서재 정보 객체
   * @returns {Object} ShelfBook 형식의 객체
   */
  mapLocalBookToResponse(localBook) {
    return {
      userBookId: localBook.serverId || localBook.localId, // 서버 ID가 없으면 로컬 ID 사용
      localId: localBook.localId,
      bookId: localBook.bookId,
      isbn: localBook.isbn,
      title: localBook.title,
      author: localBook.author,
      publisher: localBook.publisher,
      description: localBook.description,
      coverUrl: localBook.coverUrl,
      totalPages: localBook.totalPages,
      mainGenre: localBook.mainGenre,
      pubDate: localBook.pubDate,
      category: localBook.category,
      expectation: localBook.expectation,
      lastReadPage: localBook.lastReadPage,
      lastReadAt: localBook.lastReadAt,
      readingFinishedDate: localBook.readingFinishedDate,
      purchaseType: localBook.purchaseType,
      rating: localBook.rating,
      review: localBook.review,
      addedAt: localBook.addedAt || localBook.createdAt,
      syncStatus: localBook.syncStatus
    };
  },

  /**
   * 로컬 내 서재 정보 배열을 ShelfBook 배열로 변환
   * @param {Array} localBooks - 로컬 내 서재 정보 배열
   * @returns {Array} ShelfBook 배열
   */
  mapLocalBooksToResponse(localBooks) {
    return localBooks.map(book => this.mapLocalBookToResponse(book));
  },
};

