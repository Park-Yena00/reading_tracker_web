/**
 * 요청 큐 관리자
 * 동기화 중 사용자 요청을 큐에 저장하여 동기화 완료 후 처리
 * Event-Driven 패턴을 사용하여 아키텍처 준수
 */

import { eventBus } from './event-bus.js';
import { syncStateManager } from './sync-state-manager.js';

class RequestQueueManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.setupEventHandlers();
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        // 동기화 완료 시 큐에 저장된 요청 처리
        eventBus.subscribe('sync:complete', () => {
            this.processQueue();
        });
    }

    /**
     * 요청을 큐에 추가
     * @param {Function} requestFn - 실행할 요청 함수 (Promise 반환)
     * @param {Object} [options] - 옵션
     * @param {string} [options.type] - 요청 타입 (예: 'create', 'update', 'delete', 'read')
     * @param {*} [options.data] - 요청 데이터
     * @returns {Promise<*>} 요청 결과
     */
    async enqueue(requestFn, options = {}) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                id: this.generateId(),
                requestFn,
                options,
                resolve,
                reject,
                createdAt: new Date()
            };

            this.queue.push(queueItem);
            console.log(`[RequestQueueManager] 요청 큐에 추가: ${options.type || 'unknown'} (큐 크기: ${this.queue.length})`);

            // 동기화가 완료되었으면 즉시 처리
            if (!syncStateManager.isSyncing && !this.isProcessing) {
                this.processQueue();
            }
        });
    }

    /**
     * 큐에 저장된 요청 처리
     * @returns {Promise<void>}
     */
    async processQueue() {
        if (this.isProcessing) {
            return; // 이미 처리 중
        }

        if (this.queue.length === 0) {
            return; // 처리할 요청 없음
        }

        // 동기화 중이면 대기
        if (syncStateManager.isSyncing) {
            console.log('[RequestQueueManager] 동기화 중이므로 요청 처리 대기');
            return;
        }

        this.isProcessing = true;
        console.log(`[RequestQueueManager] 큐 처리 시작: ${this.queue.length}개 요청`);

        // 큐의 모든 요청을 순차 처리
        while (this.queue.length > 0) {
            // 동기화가 다시 시작되었으면 중단
            if (syncStateManager.isSyncing) {
                console.log('[RequestQueueManager] 동기화 시작으로 인해 큐 처리 중단');
                break;
            }

            const queueItem = this.queue.shift();
            
            try {
                console.log(`[RequestQueueManager] 요청 실행: ${queueItem.options.type || 'unknown'}`);
                const result = await queueItem.requestFn();
                queueItem.resolve(result);
            } catch (error) {
                console.error(`[RequestQueueManager] 요청 실행 실패:`, error);
                queueItem.reject(error);
            }
        }

        this.isProcessing = false;
        console.log(`[RequestQueueManager] 큐 처리 완료 (남은 요청: ${this.queue.length}개)`);
    }

    /**
     * 큐에 저장된 요청 개수 반환
     * @returns {number} 큐 크기
     */
    getQueueSize() {
        return this.queue.length;
    }

    /**
     * 큐 초기화
     */
    clear() {
        // 대기 중인 모든 요청을 거부
        while (this.queue.length > 0) {
            const queueItem = this.queue.shift();
            queueItem.reject(new Error('요청 큐가 초기화되었습니다.'));
        }
        this.isProcessing = false;
    }

    /**
     * 고유 ID 생성
     * @returns {string} 고유 ID
     */
    generateId() {
        return 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

export const requestQueueManager = new RequestQueueManager();

