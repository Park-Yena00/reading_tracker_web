/**
 * 동기화 상태 관리자
 * 동기화 진행 상태를 추적하고, 동기화 완료 이벤트를 발행
 * Event-Driven 패턴을 사용하여 아키텍처 준수
 */

import { eventBus } from './event-bus.js';
import { syncQueueManager } from '../services/sync-queue-manager.js';

class SyncStateManager {
    constructor() {
        this.isSyncing = false;
        this.syncStartTime = null;
        this.pendingCount = 0;
        this.syncingCount = 0;
        this.totalProcessedCount = 0; // 전체 처리된 항목 수 (메모 + 내 서재 정보)
        this.setupEventHandlers();
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        // 네트워크 온라인 전환 시 동기화 상태 확인
        // offline-memo-service와 offline-book-service가 각각 동기화를 시작하므로
        // 여기서는 동기화 시작을 트리거하지 않고, 각 서비스에서 시작하도록 함
        // (중복 시작 방지)
    }

    /**
     * 동기화 상태 확인 및 시작
     * @returns {Promise<void>}
     */
    async checkAndStartSync() {
        if (this.isSyncing) {
            // 이미 동기화 중이면 무시
            return;
        }

        // PENDING 상태 항목 확인
        const pendingItems = await syncQueueManager.getPendingItems();
        if (pendingItems.length === 0) {
            // 동기화할 항목이 없으면 완료 상태로 설정
            this.setSyncComplete();
            return;
        }

        // 동기화 시작
        this.startSync(pendingItems.length);
    }

    /**
     * 동기화 시작
     * @param {number} pendingCount - 대기 중인 항목 수 (메모 + 내 서재 정보 모두 포함)
     */
    startSync(pendingCount) {
        this.isSyncing = true;
        this.syncStartTime = new Date();
        this.pendingCount = pendingCount;
        this.syncingCount = 0;
        this.totalProcessedCount = 0; // 초기화

        // 동기화 시작 이벤트 발행
        eventBus.publish('sync:start', {
            pendingCount,
            startTime: this.syncStartTime
        });

        console.log(`[SyncStateManager] 동기화 시작: ${pendingCount}개 항목 대기 중`);
    }

    /**
     * 동기화 진행 상태 업데이트
     * @param {number} additionalProcessedCount - 추가로 처리된 항목 수 (이번 호출에서 처리한 항목 수)
     * @param {number} remainingCount - 남은 항목 수 (모든 PENDING 항목)
     */
    updateSyncProgress(additionalProcessedCount, remainingCount) {
        // 전체 처리된 항목 수 누적
        this.totalProcessedCount += additionalProcessedCount;
        this.syncingCount = this.totalProcessedCount;
        this.pendingCount = remainingCount;

        // 동기화 진행 이벤트 발행
        eventBus.publish('sync:progress', {
            completedCount: this.totalProcessedCount,
            remainingCount,
            totalCount: this.totalProcessedCount + remainingCount
        });
    }

    /**
     * 동기화 완료 확인 및 상태 업데이트
     * 모든 PENDING 상태 항목(메모 + 내 서재 정보)이 처리되었는지 확인
     * @returns {Promise<boolean>} 동기화 완료 여부
     */
    async checkSyncComplete() {
        if (!this.isSyncing) {
            return true; // 동기화 중이 아니면 완료로 간주
        }

        // PENDING 상태 항목 확인 (메모 + 내 서재 정보 모두)
        const pendingItems = await syncQueueManager.getPendingItems();
        
        if (pendingItems.length === 0) {
            // 모든 항목이 완료되었으면 동기화 완료
            this.setSyncComplete();
            return true;
        }

        return false; // 아직 동기화 중
    }

    /**
     * 동기화 완료 상태로 설정
     */
    setSyncComplete() {
        if (!this.isSyncing) {
            return; // 이미 완료 상태
        }

        const syncDuration = this.syncStartTime 
            ? new Date() - this.syncStartTime 
            : 0;

        this.isSyncing = false;
        this.syncStartTime = null;
        this.pendingCount = 0;
        this.syncingCount = 0;
        this.totalProcessedCount = 0; // 초기화

        // 동기화 완료 이벤트 발행
        eventBus.publish('sync:complete', {
            duration: syncDuration,
            completedAt: new Date()
        });

        console.log(`[SyncStateManager] 동기화 완료: ${syncDuration}ms 소요`);
    }

    /**
     * 현재 동기화 상태 반환
     * @returns {Object} 동기화 상태 정보
     */
    getState() {
        return {
            isSyncing: this.isSyncing,
            pendingCount: this.pendingCount,
            syncingCount: this.syncingCount,
            syncStartTime: this.syncStartTime
        };
    }

    /**
     * 동기화 완료 대기
     * @param {number} timeout - 최대 대기 시간 (ms, 기본값: 30000)
     * @returns {Promise<boolean>} 동기화 완료 여부
     */
    async waitForSyncComplete(timeout = 30000) {
        if (!this.isSyncing) {
            return true; // 이미 완료 상태
        }

        const startTime = Date.now();
        const checkInterval = 500; // 500ms마다 확인

        return new Promise((resolve) => {
            const checkComplete = async () => {
                const isComplete = await this.checkSyncComplete();
                
                if (isComplete) {
                    resolve(true);
                    return;
                }

                // 타임아웃 확인
                if (Date.now() - startTime >= timeout) {
                    console.warn('[SyncStateManager] 동기화 완료 대기 타임아웃');
                    resolve(false);
                    return;
                }

                // 다음 확인까지 대기
                setTimeout(checkComplete, checkInterval);
            };

            // 이벤트 기반으로도 확인 (더 빠른 응답)
            const unsubscribe = eventBus.subscribe('sync:complete', () => {
                unsubscribe();
                resolve(true);
            });

            checkComplete();
        });
    }
}

export const syncStateManager = new SyncStateManager();

