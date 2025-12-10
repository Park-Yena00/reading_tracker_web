/**
 * 내 서재 정보 작업 공통 헬퍼 함수
 * IndexedDB 갱신 및 오류 처리 로직을 공통화하여 코드 중복 제거
 */

import { dbManager } from '../storage/indexeddb-manager.js';

export class BookOperationHelper {
    /**
     * 내 서재 정보 삭제 후 IndexedDB 갱신
     * @param {string|number} bookId - 내 서재 정보 ID (serverId)
     * @returns {Promise<void>}
     */
    static async updateLocalAfterDelete(bookId) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        const localBook = await dbManager.getBookByServerId(bookId);
        if (localBook) {
            await dbManager.deleteBook(localBook.localId);
        }
    }

    /**
     * 내 서재 정보 생성 후 IndexedDB 갱신
     * @param {Object} serverBook - 서버에서 반환된 내 서재 정보 객체
     * @returns {Promise<Object>} 업데이트된 로컬 내 서재 정보 객체
     */
    static async updateLocalAfterCreate(serverBook) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        // serverId로 기존 로컬 내 서재 정보 조회
        const localBook = await dbManager.getBookByServerId(serverBook.userBookId);
        
        if (localBook) {
            // 기존 로컬 내 서재 정보가 있으면 서버 ID 업데이트 및 동기화 상태 변경
            await dbManager.updateBookWithServerId(localBook.localId, serverBook.userBookId);
            const updatedBook = await dbManager.getBookByLocalId(localBook.localId);
            updatedBook.syncStatus = 'synced';
            await dbManager.saveBook(updatedBook);
            return updatedBook;
        } else {
            // 기존 로컬 내 서재 정보가 없으면 새로 생성
            return await this.saveServerBookAsLocal(serverBook);
        }
    }

    /**
     * 내 서재 정보 수정 후 IndexedDB 갱신
     * @param {string|number} bookId - 내 서재 정보 ID (serverId)
     * @param {Object} serverBook - 서버에서 반환된 내 서재 정보 객체
     * @returns {Promise<Object>} 업데이트된 로컬 내 서재 정보 객체
     */
    static async updateLocalAfterUpdate(bookId, serverBook) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        const localBook = await dbManager.getBookByServerId(bookId);
        
        if (localBook) {
            // 로컬 내 서재 정보 업데이트
            localBook.category = serverBook.category;
            localBook.expectation = serverBook.expectation;
            localBook.lastReadPage = serverBook.lastReadPage;
            localBook.lastReadAt = serverBook.lastReadAt;
            localBook.readingFinishedDate = serverBook.readingFinishedDate;
            localBook.purchaseType = serverBook.purchaseType;
            localBook.rating = serverBook.rating;
            localBook.review = serverBook.review;
            localBook.updatedAt = new Date().toISOString();
            localBook.syncStatus = 'synced';
            
            await dbManager.saveBook(localBook);
            return localBook;
        }
        
        return null;
    }

    /**
     * 서버 오류 처리 및 오프라인 모드로 전환
     * @param {Error} error - 발생한 오류
     * @param {string|number} bookId - 내 서재 정보 ID
     * @param {Function} fallbackOperation - 오프라인 모드로 전환할 함수
     * @returns {Promise<*>} fallbackOperation의 반환값
     */
    static async handleServerError(error, bookId, fallbackOperation) {
        // 네트워크 오류인지 확인
        const isNetworkError = error.message?.includes('Failed to fetch') || 
                              error.message?.includes('NetworkError') ||
                              error.message?.includes('network') ||
                              !navigator.onLine;
        
        if (isNetworkError) {
            console.warn('서버 오류 발생, 오프라인 모드로 전환:', error);
            return await fallbackOperation(bookId);
        }
        
        // 네트워크 오류가 아니면 원래 오류를 다시 던짐
        throw error;
    }

    /**
     * 로컬 내 서재 정보 조회 (serverId 또는 localId로)
     * @param {string|number} bookId - 내 서재 정보 ID
     * @returns {Promise<Object|null>} 로컬 내 서재 정보 객체 또는 null
     */
    static async getLocalBook(bookId) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        // bookId가 localId인지 serverId인지 확인
        if (typeof bookId === 'string' && (bookId.includes('-') || bookId.startsWith('local-'))) {
            // localId로 조회 (UUID 형식 또는 local- 접두사)
            const actualLocalId = bookId.startsWith('local-') ? bookId : bookId;
            return await dbManager.getBookByLocalId(actualLocalId);
        } else {
            // serverId로 조회
            return await dbManager.getBookByServerId(bookId);
        }
    }

    /**
     * 서버 내 서재 정보를 로컬에 저장
     * @param {Object} serverBook - 서버 내 서재 정보 객체
     * @returns {Promise<Object>} 저장된 로컬 내 서재 정보 객체
     */
    static async saveServerBookAsLocal(serverBook) {
        // IndexedDB 초기화 확인
        await dbManager.init();

        // 이미 존재하는 내 서재 정보인지 확인 (serverId로)
        const existingBook = await dbManager.getBookByServerId(serverBook.userBookId);
        if (existingBook) {
            // 이미 존재하면 업데이트
            existingBook.category = serverBook.category;
            existingBook.expectation = serverBook.expectation;
            existingBook.lastReadPage = serverBook.lastReadPage;
            existingBook.lastReadAt = serverBook.lastReadAt;
            existingBook.readingFinishedDate = serverBook.readingFinishedDate;
            existingBook.purchaseType = serverBook.purchaseType;
            existingBook.rating = serverBook.rating;
            existingBook.review = serverBook.review;
            existingBook.updatedAt = new Date().toISOString();
            existingBook.syncStatus = 'synced';
            await dbManager.saveBook(existingBook);
            return existingBook;
        }

        // 새 내 서재 정보로 저장
        const localId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        const localBook = {
            localId,
            serverId: serverBook.userBookId,
            bookId: serverBook.bookId,
            isbn: serverBook.isbn,
            title: serverBook.title,
            author: serverBook.author,
            publisher: serverBook.publisher,
            description: serverBook.description,
            coverUrl: serverBook.coverUrl,
            totalPages: serverBook.totalPages,
            mainGenre: serverBook.mainGenre,
            pubDate: serverBook.pubDate,
            category: serverBook.category,
            expectation: serverBook.expectation,
            lastReadPage: serverBook.lastReadPage,
            lastReadAt: serverBook.lastReadAt,
            readingFinishedDate: serverBook.readingFinishedDate,
            purchaseType: serverBook.purchaseType,
            rating: serverBook.rating,
            review: serverBook.review,
            addedAt: serverBook.addedAt || new Date().toISOString(),
            syncStatus: 'synced',
            createdAt: serverBook.addedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncQueueId: null
        };

        await dbManager.saveBook(localBook);
        return localBook;
    }
}

