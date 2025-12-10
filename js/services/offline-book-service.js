/**
 * 오프라인 내 서재 정보 서비스
 * 오프라인 환경에서 내 서재 정보 추가/수정/삭제 및 동기화 기능 제공
 */

import { dbManager } from '../storage/indexeddb-manager.js';
import { syncQueueManager } from './sync-queue-manager.js';
import { networkMonitor } from '../utils/network-monitor.js';
import { apiClient } from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';
import { eventBus } from '../utils/event-bus.js';
import { syncStateManager } from '../utils/sync-state-manager.js';

class OfflineBookService {
    constructor() {
        this.isInitialized = false;
        this.setupEventHandlers();
    }

    /**
     * 이벤트 핸들러 설정 (이벤트 기반 상태 전환 처리)
     */
    setupEventHandlers() {
        // 네트워크 온라인 전환 시 동기화 큐 처리
        eventBus.subscribe('network:online', async (data) => {
            if (data && data.processQueue) {
                try {
                    await this.syncPendingBooks();
                } catch (error) {
                    console.error('네트워크 온라인 전환 시 내 서재 정보 동기화 실패:', error);
                }
            }
        });

        // 네트워크 오프라인 전환 시 처리
        eventBus.subscribe('network:offline', async (data) => {
            if (data && data.queueOperations) {
                console.log('네트워크 오프라인 전환: 내 서재 정보 동기화 대기 상태로 전환');
            }
        });
    }

    /**
     * 초기화: IndexedDB 초기화
     */
    async init() {
        if (!this.isInitialized) {
            await dbManager.init();
            this.isInitialized = true;
        }
    }

    /**
     * 내 서재에 도서 추가 (오프라인 지원)
     * 1. 로컬 저장소에 저장
     * 2. 동기화 큐에 추가
     * 3. 네트워크가 연결되어 있으면 즉시 동기화 시도
     * @param {Object} bookData - 도서 추가 데이터
     * @returns {Promise<Object>} 로컬 내 서재 정보 객체
     */
    async addBookToShelf(bookData) {
        await this.init();

        // 로컬 ID 생성 (UUID v4)
        const localId = this.generateLocalId();
        
        // 멱등성 키 생성 (큐 항목별로 고정)
        const idempotencyKey = this.generateLocalId();

        // 로컬 내 서재 정보 객체 생성
        const localBook = {
            localId,
            serverId: null,
            bookId: null,
            isbn: bookData.isbn,
            title: bookData.title,
            author: bookData.author,
            publisher: bookData.publisher,
            description: bookData.description,
            coverUrl: bookData.coverUrl,
            totalPages: bookData.totalPages,
            mainGenre: bookData.mainGenre,
            pubDate: bookData.pubDate,
            category: bookData.category || 'ToRead',
            expectation: bookData.expectation,
            lastReadPage: null,
            lastReadAt: null,
            readingFinishedDate: null,
            purchaseType: null,
            rating: null,
            review: null,
            syncStatus: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncQueueId: null
        };

        // 로컬 저장소에 저장
        await dbManager.saveBook(localBook);

        // 동기화 큐에 추가 (멱등성 키 포함)
        const queueItem = await syncQueueManager.enqueue({
            type: 'CREATE',
            localBookId: localId, // 메모와 구분하기 위해 localBookId 사용
            data: bookData,
            idempotencyKey: idempotencyKey // 멱등성 키 저장
        });

        // syncQueueId 업데이트
        localBook.syncQueueId = queueItem.id;
        await dbManager.saveBook(localBook);

        // 네트워크가 연결되어 있으면 즉시 동기화 시도 (비동기, await 하지 않음)
        if (networkMonitor.isOnline) {
            this.syncPendingBooks().catch(error => {
                console.error('백그라운드 동기화 실패:', error);
            });
        }

        return localBook;
    }

    /**
     * 내 서재 정보 수정 (오프라인 지원)
     * 1. IndexedDB에서 기존 내 서재 정보 조회
     * 2. 수정 내용 반영
     * 3. 동기화 큐에 UPDATE 항목 추가
     * 4. 네트워크가 연결되어 있으면 즉시 동기화 시도
     * @param {string|number} bookId - 내 서재 정보 ID (localId 또는 serverId)
     * @param {Object} updateData - 수정 데이터
     * @returns {Promise<Object>} 수정된 로컬 내 서재 정보 객체
     */
    async updateBook(bookId, updateData) {
        await this.init();

        // bookId가 localId인지 serverId인지 확인
        let localBook;
        if (typeof bookId === 'string' && (bookId.includes('-') || bookId.startsWith('local-'))) {
            // localId로 조회 (UUID 형식 또는 local- 접두사)
            const actualLocalId = bookId.startsWith('local-') ? bookId : bookId;
            localBook = await dbManager.getBookByLocalId(actualLocalId);
        } else {
            // serverId로 조회
            localBook = await dbManager.getBookByServerId(bookId);
        }

        if (!localBook) {
            throw new Error('내 서재 정보를 찾을 수 없습니다.');
        }

        // 서버에 동기화된 내 서재 정보만 수정 가능 (serverId가 있어야 함)
        if (!localBook.serverId) {
            throw new Error('아직 동기화되지 않은 내 서재 정보는 수정할 수 없습니다. 먼저 동기화를 완료해주세요.');
        }

        // 수정 내용 반영
        if (updateData.category !== undefined) {
            localBook.category = updateData.category;
        }
        if (updateData.expectation !== undefined) {
            localBook.expectation = updateData.expectation;
        }
        if (updateData.lastReadPage !== undefined) {
            localBook.lastReadPage = updateData.lastReadPage;
        }
        if (updateData.lastReadAt !== undefined) {
            localBook.lastReadAt = updateData.lastReadAt;
        }
        if (updateData.readingFinishedDate !== undefined) {
            localBook.readingFinishedDate = updateData.readingFinishedDate;
        }
        if (updateData.purchaseType !== undefined) {
            localBook.purchaseType = updateData.purchaseType;
        }
        if (updateData.rating !== undefined) {
            localBook.rating = updateData.rating;
        }
        if (updateData.review !== undefined) {
            localBook.review = updateData.review;
        }
        localBook.updatedAt = new Date().toISOString();
        
        // 동기화 상태 업데이트
        localBook.syncStatus = 'pending'; // 수정 후 동기화 대기 상태로 변경

        // 기존 동기화 큐 항목이 있으면 제거 (새로운 수정 내용으로 대체)
        if (localBook.syncQueueId) {
            await syncQueueManager.removeQueueItem(localBook.syncQueueId);
        }

        // 동기화 큐에 UPDATE 항목 추가
        const queueItem = await syncQueueManager.enqueue({
            type: 'UPDATE',
            localBookId: localBook.localId,
            serverBookId: localBook.serverId, // 서버 ID 필요
            data: {
                userBookId: localBook.serverId,
                ...updateData
            }
        });

        // syncQueueId 업데이트
        localBook.syncQueueId = queueItem.id;
        await dbManager.saveBook(localBook);

        // 네트워크가 연결되어 있으면 즉시 동기화 시도 (비동기, await 하지 않음)
        if (networkMonitor.isOnline) {
            this.syncPendingBooks().catch(error => {
                console.error('백그라운드 동기화 실패:', error);
            });
        }

        return localBook;
    }

    /**
     * 내 서재에서 도서 제거 (오프라인 지원)
     * 1. IndexedDB에서 기존 내 서재 정보 조회
     * 2. 동기화 큐에 DELETE 항목 추가
     * 3. 로컬 내 서재 정보는 삭제하지 않고 삭제 표시만 함 (동기화 완료 후 삭제)
     * 4. 네트워크가 연결되어 있으면 즉시 동기화 시도
     * @param {string|number} bookId - 내 서재 정보 ID (localId 또는 serverId)
     * @returns {Promise<Object>} 삭제 결과
     */
    async removeBookFromShelf(bookId) {
        await this.init();

        // bookId가 localId인지 serverId인지 확인
        let localBook;
        if (typeof bookId === 'string' && (bookId.includes('-') || bookId.startsWith('local-'))) {
            // localId로 조회 (UUID 형식 또는 local- 접두사)
            const actualLocalId = bookId.startsWith('local-') ? bookId : bookId;
            localBook = await dbManager.getBookByLocalId(actualLocalId);
        } else {
            // serverId로 조회
            localBook = await dbManager.getBookByServerId(bookId);
        }

        if (!localBook) {
            throw new Error('내 서재 정보를 찾을 수 없습니다.');
        }

        // 서버에 동기화된 내 서재 정보만 삭제 가능 (serverId가 있어야 함)
        // 단, 아직 동기화되지 않은 내 서재 정보는 로컬에서 즉시 삭제
        if (!localBook.serverId) {
            // 아직 동기화되지 않은 내 서재 정보는 로컬에서 즉시 삭제
            await dbManager.deleteBook(localBook.localId);
            
            // 동기화 큐에 CREATE 항목이 있으면 제거
            if (localBook.syncQueueId) {
                await syncQueueManager.removeQueueItem(localBook.syncQueueId);
            }
            
            return { deleted: true, localOnly: true };
        }

        // 동기화 큐에 DELETE 항목 추가
        const queueItem = await syncQueueManager.enqueue({
            type: 'DELETE',
            localBookId: localBook.localId,
            serverBookId: localBook.serverId, // 서버 ID 필요
            data: {
                userBookId: localBook.serverId
            }
        });

        // 로컬 내 서재 정보는 삭제 표시만 하고 실제 삭제는 동기화 완료 후
        localBook.syncStatus = 'pending'; // 삭제 대기 상태
        localBook.syncQueueId = queueItem.id;
        localBook.updatedAt = new Date().toISOString();
        await dbManager.saveBook(localBook);

        // 네트워크가 연결되어 있으면 즉시 동기화 시도 (비동기, await 하지 않음)
        if (networkMonitor.isOnline) {
            this.syncPendingBooks().catch(error => {
                console.error('백그라운드 동기화 실패:', error);
            });
        }

        return { deleted: false, localOnly: false, localBook };
    }

    /**
     * 모든 오프라인 내 서재 정보 조회 (UI 표시용)
     * @returns {Promise<Array>} 모든 내 서재 정보 배열
     */
    async getAllBooks() {
        await this.init();
        return await dbManager.getAllBooks();
    }

    /**
     * 카테고리별 내 서재 정보 조회
     * @param {string} category - 카테고리 (ToRead, Reading, AlmostFinished, Finished)
     * @returns {Promise<Array>} 내 서재 정보 배열
     */
    async getBooksByCategory(category) {
        await this.init();
        return await dbManager.getBooksByCategory(category);
    }

    /**
     * 서버 내 서재 정보를 로컬 내 서재 정보로 저장
     * @param {Object} serverBook - 서버 내 서재 정보 객체
     * @returns {Promise<Object>} 로컬 내 서재 정보 객체
     */
    async saveServerBookAsLocal(serverBook) {
        await this.init();

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
        const localId = this.generateLocalId();
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
            syncStatus: 'synced', // 서버에서 가져온 내 서재 정보는 이미 동기화 완료
            createdAt: serverBook.addedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncQueueId: null
        };

        await dbManager.saveBook(localBook);
        return localBook;
    }

    /**
     * 로컬 ID 생성 (UUID v4)
     * @returns {string} UUID 형식의 로컬 ID
     */
    generateLocalId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 대기 중인 내 서재 정보 동기화
     * 동기화 큐에서 PENDING 항목을 가져와서 처리
     * @returns {Promise<{successCount: number, failedCount: number}>} 동기화 결과 (성공/실패 개수)
     */
    async syncPendingBooks() {
        if (!networkMonitor.isOnline) {
            console.log('네트워크가 오프라인 상태입니다.');
            return { successCount: 0, failedCount: 0 };
        }

        // 동기화 큐에서 PENDING 항목 조회 (내 서재 정보 관련 항목만)
        const allPendingItems = await syncQueueManager.getPendingItems();
        const pendingBookItems = allPendingItems.filter(item => item.localBookId);

        console.log(`동기화할 내 서재 정보 항목 수: ${pendingBookItems.length}`);

        // 동기화 시작 (동기화 상태 추적)
        // 모든 PENDING 항목(메모 + 내 서재 정보)을 고려하여 시작
        if (allPendingItems.length > 0 && !syncStateManager.isSyncing) {
            syncStateManager.startSync(allPendingItems.length);
        }

        let successCount = 0;
        let failedCount = 0;

        // 순서 보장: createdAt 기준 정렬
        pendingBookItems.sort((a, b) => {
            const timeA = new Date(a.createdAt);
            const timeB = new Date(b.createdAt);
            return timeA - timeB;
        });

        for (const queueItem of pendingBookItems) {
            // 이미 'SYNCING' 상태인 항목은 건너뛰기 (다른 프로세스가 처리 중)
            if (queueItem.status === 'SYNCING') {
                console.log(`동기화 중인 항목 건너뛰기: ${queueItem.id}`);
                continue;
            }
            
            // 원자적 상태 변경 시도 (PENDING -> SYNCING)
            const updated = await syncQueueManager.tryUpdateStatus(queueItem.id, 'PENDING', 'SYNCING');
            if (!updated) {
                // 다른 프로세스가 이미 처리 중이면 건너뛰기
                console.log(`동기화 중인 항목 건너뛰기: ${queueItem.id}`);
                continue;
            }
            
            try {
                await this.syncQueueItem(queueItem);
                successCount++;
                
                // 동기화 진행 상태 업데이트 (모든 PENDING 항목 고려)
                // 이번에 처리한 항목 수(1개)와 남은 항목 수를 전달
                const remainingItems = await syncQueueManager.getPendingItems();
                syncStateManager.updateSyncProgress(1, remainingItems.length);
            } catch (error) {
                console.error(`동기화 실패 (${queueItem.id}):`, error);
                failedCount++;
                
                // 동기화 진행 상태 업데이트 (실패도 처리된 것으로 간주, 모든 PENDING 항목 고려)
                // 이번에 처리한 항목 수(1개)와 남은 항목 수를 전달
                const remainingItems = await syncQueueManager.getPendingItems();
                syncStateManager.updateSyncProgress(1, remainingItems.length);
                // 재시도 로직은 syncQueueManager에서 처리
            }
        }
        
        // 동기화 완료 확인 (모든 PENDING 항목이 처리되었는지)
        await syncStateManager.checkSyncComplete();
        
        // 동기화 결과 반환 (토스트 메시지 표시에 사용)
        return { successCount, failedCount };
    }

    /**
     * 동기화 큐 항목 처리 (CREATE/UPDATE/DELETE)
     * @param {Object} queueItem - 동기화 큐 항목
     */
    async syncQueueItem(queueItem) {
        try {
            let response;
            let localBook;

            // 동기화 큐 항목 타입에 따라 처리
            switch (queueItem.type) {
                case 'CREATE':
                    // 내 서재에 도서 추가
                    localBook = await dbManager.getBookByLocalId(queueItem.localBookId);
                    if (!localBook) {
                        throw new Error('로컬 내 서재 정보를 찾을 수 없습니다.');
                    }

                    localBook.syncStatus = 'syncing_create';
                    await dbManager.saveBook(localBook);

                    // 멱등성 키 재사용 (없으면 생성 후 저장)
                    let idempotencyKey = queueItem.idempotencyKey;
                    if (!idempotencyKey) {
                        idempotencyKey = this.generateLocalId();
                        queueItem.idempotencyKey = idempotencyKey;
                        await syncQueueManager.updateQueueItem(queueItem);
                    }
                    
                    // API 호출 (고정된 멱등성 키 사용)
                    response = await apiClient.post(API_ENDPOINTS.BOOKS.USER_BOOKS, queueItem.data, {
                        headers: {
                            'Idempotency-Key': idempotencyKey
                        }
                    });

                    // 서버 ID로 업데이트
                    await dbManager.updateBookWithServerId(localBook.localId, response.userBookId);
                    localBook = await dbManager.getBookByLocalId(queueItem.localBookId);

                    localBook.syncStatus = 'synced';
                    await dbManager.saveBook(localBook);
                    console.log(`내 서재 정보 동기화 성공: ${localBook.localId} → ${response.userBookId}`);
                    break;

                case 'UPDATE':
                    // 내 서재 정보 수정
                    localBook = await dbManager.getBookByLocalId(queueItem.localBookId);
                    if (!localBook) {
                        throw new Error('로컬 내 서재 정보를 찾을 수 없습니다.');
                    }

                    if (!localBook.serverId) {
                        throw new Error('서버 ID가 없어 수정할 수 없습니다.');
                    }

                    localBook.syncStatus = 'syncing_update';
                    await dbManager.saveBook(localBook);

                    response = await apiClient.put(API_ENDPOINTS.BOOKSHELF.UPDATE(queueItem.serverBookId), queueItem.data);

                    // 수정 완료 후 상태 업데이트
                    localBook.syncStatus = 'synced';
                    localBook.updatedAt = new Date().toISOString();
                    await dbManager.saveBook(localBook);
                    console.log(`내 서재 정보 수정 동기화 성공: ${localBook.localId} → ${queueItem.serverBookId}`);
                    break;

                case 'DELETE':
                    // 내 서재에서 도서 제거
                    localBook = await dbManager.getBookByLocalId(queueItem.localBookId);
                    if (!localBook) {
                        // 이미 삭제된 경우 큐 항목만 제거
                        await syncQueueManager.markAsSuccess(queueItem.id);
                        console.log(`내 서재 정보가 이미 삭제됨: ${queueItem.serverBookId}`);
                        return;
                    }

                    if (!localBook.serverId) {
                        throw new Error('서버 ID가 없어 삭제할 수 없습니다.');
                    }

                    localBook.syncStatus = 'syncing_delete';
                    await dbManager.saveBook(localBook);

                    response = await apiClient.delete(API_ENDPOINTS.BOOKSHELF.DELETE(queueItem.serverBookId));

                    // 삭제 완료 후 로컬에서도 삭제
                    await dbManager.deleteBook(localBook.localId);
                    console.log(`내 서재 정보 삭제 동기화 성공: ${localBook.localId} → ${queueItem.serverBookId}`);
                    break;

                default:
                    throw new Error(`알 수 없는 동기화 타입: ${queueItem.type}`);
            }

            // 동기화 큐에서 제거
            await syncQueueManager.markAsSuccess(queueItem.id);
        } catch (error) {
            // 동기화 실패 처리
            if (queueItem.localBookId) {
                const localBook = await dbManager.getBookByLocalId(queueItem.localBookId);
                if (localBook) {
                    localBook.syncStatus = 'failed';
                    await dbManager.saveBook(localBook);
                }
            }

            // 동기화 큐에 에러 기록 및 재시도 예약
            await syncQueueManager.markAsFailed(queueItem.id, error.message);
            throw error;
        }
    }
}

export const offlineBookService = new OfflineBookService();

