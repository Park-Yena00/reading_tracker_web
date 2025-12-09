/**
 * 동기화 큐 관리자
 * 오프라인 메모 동기화를 위한 큐 관리 및 재시도 로직 제공
 */

import { dbManager } from '../storage/indexeddb-manager.js';

class SyncQueueManager {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5초
    }

    /**
     * 동기화 큐에 항목 추가
     * @param {Object} item - 큐 항목 데이터
     * @param {string} item.type - 작업 타입 ('CREATE', 'UPDATE', 'DELETE')
     * @param {string} item.localMemoId - 로컬 메모 ID
     * @param {number} [item.serverMemoId] - 서버 메모 ID (UPDATE/DELETE 시 필요)
     * @param {string} [item.status] - 큐 항목 상태 ('PENDING', 'WAITING', 'SYNCING', 'SUCCESS', 'FAILED')
     * @param {string} [item.originalQueueId] - 원본 큐 항목 ID (시나리오 2, 5: waiting 상태일 때 참조)
     * @param {string} [item.idempotencyKey] - 멱등성 키 (중복 요청 방지용)
     * @param {Object} item.data - 요청 데이터
     * @returns {Promise<Object>} 생성된 큐 항목
     */
    async enqueue(item) {
        const queueItem = {
            id: this.generateId(),
            type: item.type,
            localMemoId: item.localMemoId,
            serverMemoId: item.serverMemoId || null, // UPDATE/DELETE 시 필요
            data: item.data,
            status: item.status || 'PENDING', // waiting 상태 지원
            originalQueueId: item.originalQueueId || null, // 시나리오 2, 5: 원본 항목 참조
            idempotencyKey: item.idempotencyKey || null, // 멱등성 키 (중복 요청 방지용)
            retryCount: 0,
            error: null,
            createdAt: new Date().toISOString(),
            lastRetryAt: null
        };

        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.put(queueItem);
            request.onsuccess = () => resolve(queueItem);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 동기화 큐 항목 상태 업데이트
     * @param {string} queueId - 큐 항목 ID
     * @param {string} status - 새로운 상태 ('PENDING', 'SYNCING', 'SUCCESS', 'FAILED')
     * @returns {Promise<void>}
     */
    async updateStatus(queueId, status) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.status = status;
                    item.updatedAt = new Date().toISOString();
                    if (status === 'SYNCING') {
                        item.lastRetryAt = new Date().toISOString();
                    }
                    const putRequest = store.put(item);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * 동기화 큐 항목 제거
     * @param {string} queueId - 큐 항목 ID
     * @returns {Promise<void>}
     */
    async removeQueueItem(queueId) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.delete(queueId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 동기화 성공 처리
     * @param {string} queueId - 큐 항목 ID
     * @returns {Promise<void>}
     */
    async markAsSuccess(queueId) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.status = 'SUCCESS';
                    item.updatedAt = new Date().toISOString();
                    const putRequest = store.put(item);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * 동기화 실패 처리 및 재시도 예약
     * @param {string} queueId - 큐 항목 ID
     * @param {string} errorMessage - 에러 메시지
     * @returns {Promise<void>}
     */
    async markAsFailed(queueId, errorMessage) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);

            getRequest.onsuccess = () => {
                const item = getRequest.result;

                if (item) {
                    item.status = 'FAILED';
                    item.error = errorMessage;
                    item.retryCount = (item.retryCount || 0) + 1;
                    item.lastRetryAt = new Date().toISOString();
                    item.updatedAt = new Date().toISOString();

                    // 최대 재시도 횟수 확인
                    if (item.retryCount < this.maxRetries) {
                        // 재시도 예약 (Exponential Backoff)
                        const delay = this.retryDelay * Math.pow(2, item.retryCount - 1);
                        setTimeout(() => {
                            this.retrySync(item).catch(error => {
                                console.error('재시도 실패:', error);
                            });
                        }, delay);
                    }

                    const putRequest = store.put(item);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * 재시도 실행
     * @param {Object} queueItem - 큐 항목
     * @returns {Promise<void>}
     */
    async retrySync(queueItem) {
        // 메모 서비스를 통해 재동기화 시도
        if (queueItem.localMemoId) {
            const localMemo = await dbManager.getMemoByLocalId(queueItem.localMemoId);
            if (localMemo && localMemo.syncStatus !== 'synced') {
                queueItem.status = 'PENDING';
                queueItem.retryCount = 0; // 재시도 횟수 초기화
                queueItem.error = null;
                await this.enqueue(queueItem);
                // offlineMemoService.syncSingleMemo 호출은 offline-memo-service에서 처리
            }
        }
    }

    /**
     * 모든 대기 중인 큐 항목 조회
     * @returns {Promise<Array>} PENDING 상태인 큐 항목 배열
     */
    async getPendingItems() {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('status');
            const request = index.getAll('PENDING');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 특정 localMemoId를 가진 모든 큐 항목 조회 (시나리오 1: 연쇄 업데이트용)
     * @param {string} localMemoId - 로컬 메모 ID
     * @returns {Promise<Array>} 큐 항목 배열
     */
    async getQueueItemsByLocalMemoId(localMemoId) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('localMemoId');
            const request = index.getAll(localMemoId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 큐 항목 업데이트 (시나리오 1: 연쇄 업데이트용)
     * @param {Object} queueItem - 업데이트할 큐 항목
     * @returns {Promise<void>}
     */
    async updateQueueItem(queueItem) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.put(queueItem);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 특정 큐 항목 조회 (시나리오 2, 5: waiting 상태 처리용)
     * @param {string} queueId - 큐 항목 ID
     * @returns {Promise<Object|null>} 큐 항목 또는 null
     */
    async getQueueItem(queueId) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const request = store.get(queueId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * WAITING 상태인 큐 항목 조회 (시나리오 2, 5: 대기 중인 항목 처리용)
     * @returns {Promise<Array>} WAITING 상태인 큐 항목 배열
     */
    async getWaitingItems() {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('status');
            const request = index.getAll('WAITING');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 원자적 상태 변경 시도 (동시성 제어)
     * 예상 상태와 일치할 때만 새 상태로 변경
     * @param {string} queueId - 큐 항목 ID
     * @param {string} expectedStatus - 예상 상태
     * @param {string} newStatus - 새로운 상태
     * @returns {Promise<boolean>} 변경 성공 여부
     */
    async tryUpdateStatus(queueId, expectedStatus, newStatus) {
        return new Promise((resolve, reject) => {
            const transaction = dbManager.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item && item.status === expectedStatus) {
                    // 예상 상태와 일치하면 업데이트
                    item.status = newStatus;
                    item.updatedAt = new Date().toISOString();
                    if (newStatus === 'SYNCING') {
                        item.lastRetryAt = new Date().toISOString();
                    }
                    const putRequest = store.put(item);
                    putRequest.onsuccess = () => resolve(true);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    // 상태가 예상과 다르면 실패 (다른 프로세스가 이미 처리 중)
                    resolve(false);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * 큐 항목 ID 생성
     * @returns {string} 고유 ID
     */
    generateId() {
        return 'sync-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

export const syncQueueManager = new SyncQueueManager();

