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
        
        // serverBook.userBookId 검증
        if (!serverBook || !serverBook.userBookId) {
            console.error('[BookOperationHelper] updateLocalAfterCreate: serverBook 또는 userBookId가 없습니다:', serverBook);
            // userBookId가 없어도 새로 생성은 가능하므로 계속 진행
            return await this.saveServerBookAsLocal(serverBook);
        }
        
        // saveServerBookAsLocal이 중복 제거 로직을 포함하므로 직접 호출
        return await this.saveServerBookAsLocal(serverBook);
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
        
        // serverBook.userBookId가 있으면 중복 제거 로직을 포함한 saveServerBookAsLocal 사용
        if (serverBook && serverBook.userBookId) {
            return await this.saveServerBookAsLocal(serverBook);
        }
        
        // serverBook.userBookId가 없으면 기존 로직 사용 (bookId로 조회)
        const localBook = await dbManager.getBookByServerId(bookId);
        
        if (localBook) {
            // 로컬 내 서재 정보 업데이트 (모든 필드 업데이트)
            // 서버에서 받은 데이터로 모든 필드를 업데이트하여 데이터 일관성 보장
            if (serverBook.category !== undefined) localBook.category = serverBook.category;
            if (serverBook.expectation !== undefined) localBook.expectation = serverBook.expectation;
            if (serverBook.lastReadPage !== undefined) localBook.lastReadPage = serverBook.lastReadPage;
            if (serverBook.readingProgress !== undefined) localBook.lastReadPage = serverBook.readingProgress; // readingProgress도 lastReadPage로 매핑
            if (serverBook.lastReadAt !== undefined) localBook.lastReadAt = serverBook.lastReadAt;
            if (serverBook.readingStartDate !== undefined) localBook.lastReadAt = serverBook.readingStartDate; // readingStartDate도 lastReadAt로 매핑
            if (serverBook.readingFinishedDate !== undefined) localBook.readingFinishedDate = serverBook.readingFinishedDate;
            if (serverBook.purchaseType !== undefined) localBook.purchaseType = serverBook.purchaseType;
            if (serverBook.rating !== undefined) localBook.rating = serverBook.rating;
            if (serverBook.review !== undefined) localBook.review = serverBook.review;
            
            // 도서 기본 정보도 업데이트 (서버에서 받은 경우)
            if (serverBook.title !== undefined) localBook.title = serverBook.title;
            if (serverBook.author !== undefined) localBook.author = serverBook.author;
            if (serverBook.publisher !== undefined) localBook.publisher = serverBook.publisher;
            if (serverBook.description !== undefined) localBook.description = serverBook.description;
            if (serverBook.coverUrl !== undefined) localBook.coverUrl = serverBook.coverUrl;
            if (serverBook.totalPages !== undefined) localBook.totalPages = serverBook.totalPages;
            if (serverBook.mainGenre !== undefined) localBook.mainGenre = serverBook.mainGenre;
            if (serverBook.pubDate !== undefined) localBook.pubDate = serverBook.pubDate;
            if (serverBook.isbn !== undefined) localBook.isbn = serverBook.isbn;
            if (serverBook.bookId !== undefined) localBook.bookId = serverBook.bookId;
            
            // serverId가 없으면 설정 (서버에서 받은 경우)
            if (serverBook.userBookId && !localBook.serverId) {
                localBook.serverId = serverBook.userBookId;
            }
            
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
        // userBookId가 있는 경우에만 조회 시도
        if (serverBook && serverBook.userBookId) {
            // 같은 serverId를 가진 모든 책 조회 (중복 데이터 처리)
            const existingBooks = await dbManager.getAllBooksByServerId(serverBook.userBookId);
            
            if (existingBooks && existingBooks.length > 0) {
                // 첫 번째 책을 업데이트하고 나머지는 삭제 (중복 제거)
                const existingBook = existingBooks[0];
                
                // 나머지 중복 책들 삭제
                for (let i = 1; i < existingBooks.length; i++) {
                    await dbManager.deleteBook(existingBooks[i].localId);
                    console.log(`[BookOperationHelper] 중복 책 삭제: localId=${existingBooks[i].localId}, serverId=${serverBook.userBookId}`);
                }
                
                // 첫 번째 책 업데이트
                existingBook.category = serverBook.category;
                existingBook.expectation = serverBook.expectation;
                existingBook.lastReadPage = serverBook.lastReadPage || serverBook.readingProgress;
                existingBook.lastReadAt = serverBook.lastReadAt || serverBook.readingStartDate;
                existingBook.readingFinishedDate = serverBook.readingFinishedDate;
                existingBook.purchaseType = serverBook.purchaseType;
                existingBook.rating = serverBook.rating;
                existingBook.review = serverBook.review;
                
                // 도서 기본 정보도 업데이트
                if (serverBook.title !== undefined) existingBook.title = serverBook.title;
                if (serverBook.author !== undefined) existingBook.author = serverBook.author;
                if (serverBook.publisher !== undefined) existingBook.publisher = serverBook.publisher;
                if (serverBook.coverUrl !== undefined) existingBook.coverUrl = serverBook.coverUrl;
                if (serverBook.totalPages !== undefined) existingBook.totalPages = serverBook.totalPages;
                
                existingBook.updatedAt = new Date().toISOString();
                existingBook.syncStatus = 'synced';
                await dbManager.saveBook(existingBook);
                return existingBook;
            }
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

