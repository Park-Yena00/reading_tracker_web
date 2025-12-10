/**
 * 오프라인 메모 서비스
 * 오프라인 환경에서 메모 작성/수정/삭제 및 동기화 기능 제공
 */

import { dbManager } from '../storage/indexeddb-manager.js';
import { syncQueueManager } from './sync-queue-manager.js';
import { networkMonitor } from '../utils/network-monitor.js';
import { apiClient } from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';
import { eventBus } from '../utils/event-bus.js';
import { syncStateManager } from '../utils/sync-state-manager.js';

class OfflineMemoService {
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
                    await this.syncPendingMemos();
                } catch (error) {
                    console.error('네트워크 온라인 전환 시 동기화 실패:', error);
                }
            }
        });

        // 네트워크 오프라인 전환 시 처리
        eventBus.subscribe('network:offline', async (data) => {
            if (data && data.queueOperations) {
                console.log('네트워크 오프라인 전환: 동기화 대기 상태로 전환');
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
     * 메모 작성 (오프라인 지원)
     * 1. 로컬 저장소에 저장
     * 2. 동기화 큐에 추가
     * 3. 네트워크가 연결되어 있으면 즉시 동기화 시도
     * @param {Object} memoData - 메모 작성 데이터
     * @param {number} memoData.userBookId - 사용자 책 ID
     * @param {number} [memoData.pageNumber] - 페이지 번호
     * @param {string} memoData.content - 메모 내용
     * @param {Array<string>} [memoData.tags] - 태그 리스트
     * @param {string} [memoData.memoStartTime] - 메모 시작 시간 (ISO 8601)
     * @returns {Promise<Object>} 로컬 메모 객체
     */
    async createMemo(memoData) {
        await this.init();

        // 로컬 ID 생성 (UUID v4)
        const localId = this.generateLocalId();
        
        // 멱등성 키 생성 (큐 항목별로 고정)
        const idempotencyKey = this.generateLocalId();

        // 로컬 메모 객체 생성
        const localMemo = {
            localId,
            serverId: null,
            userBookId: memoData.userBookId,
            pageNumber: memoData.pageNumber,
            content: memoData.content,
            tags: memoData.tags || [],
            memoStartTime: memoData.memoStartTime || new Date().toISOString(),
            syncStatus: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncQueueId: null
        };

        // 로컬 저장소에 저장
        await dbManager.saveMemo(localMemo);

        // 동기화 큐에 추가 (멱등성 키 포함)
        const queueItem = await syncQueueManager.enqueue({
            type: 'CREATE',
            localMemoId: localId,
            data: memoData,
            idempotencyKey: idempotencyKey // 멱등성 키 저장
        });

        // syncQueueId 업데이트
        localMemo.syncQueueId = queueItem.id;
        await dbManager.saveMemo(localMemo);

        // 네트워크가 연결되어 있으면 즉시 동기화 시도 (비동기, await 하지 않음)
        if (networkMonitor.isOnline) {
            this.syncPendingMemos().catch(error => {
                console.error('백그라운드 동기화 실패:', error);
            });
        }

        return localMemo;
    }

    /**
     * 메모 수정 (오프라인 지원)
     * 1. IndexedDB에서 기존 메모 조회
     * 2. 수정 내용 반영
     * 3. 동기화 큐에 UPDATE 항목 추가
     * 4. 네트워크가 연결되어 있으면 즉시 동기화 시도
     * @param {string|number} memoId - 메모 ID (localId 또는 serverId)
     * @param {Object} updateData - 수정 데이터
     * @param {string} [updateData.content] - 메모 내용
     * @param {Array<string>} [updateData.tags] - 태그 리스트
     * @param {number} [updateData.pageNumber] - 페이지 번호
     * @param {string} [updateData.memoStartTime] - 메모 시작 시간
     * @returns {Promise<Object>} 수정된 로컬 메모 객체
     */
    async updateMemo(memoId, updateData) {
        await this.init();

        // memoId가 localId인지 serverId인지 확인
        let localMemo;
        if (typeof memoId === 'string' && (memoId.includes('-') || memoId.startsWith('local-'))) {
            // localId로 조회 (UUID 형식 또는 local- 접두사)
            const actualLocalId = memoId.startsWith('local-') ? memoId : memoId;
            localMemo = await dbManager.getMemoByLocalId(actualLocalId);
        } else {
            // serverId로 조회
            localMemo = await dbManager.getMemoByServerId(memoId);
        }

        if (!localMemo) {
            throw new Error('메모를 찾을 수 없습니다.');
        }

        // 서버에 동기화된 메모만 수정 가능 (serverId가 있어야 함)
        // 단, syncStatus가 'syncing_create'인 경우는 허용 (시나리오 1 개선)
        if (!localMemo.serverId && localMemo.syncStatus !== 'syncing_create') {
            throw new Error('아직 동기화되지 않은 메모는 수정할 수 없습니다. 먼저 동기화를 완료해주세요.');
        }

        // 수정 내용 반영
        if (updateData.content !== undefined) {
            localMemo.content = updateData.content;
        }
        if (updateData.tags !== undefined) {
            localMemo.tags = updateData.tags || [];
        }
        if (updateData.pageNumber !== undefined) {
            localMemo.pageNumber = updateData.pageNumber;
        }
        if (updateData.memoStartTime !== undefined) {
            localMemo.memoStartTime = updateData.memoStartTime;
        }
        localMemo.updatedAt = new Date().toISOString();
        
        // 동기화 상태 업데이트
        if (localMemo.serverId) {
            localMemo.syncStatus = 'pending'; // 수정 후 동기화 대기 상태로 변경
        } else {
            // serverId가 없지만 syncing_create 상태인 경우
            localMemo.syncStatus = 'syncing_create'; // 상태 유지
        }

        // 기존 동기화 큐 항목이 있으면 제거 (새로운 수정 내용으로 대체)
        if (localMemo.syncQueueId) {
            await syncQueueManager.removeQueueItem(localMemo.syncQueueId);
        }

        // 동기화 큐에 UPDATE 항목 추가
        const queueItem = await syncQueueManager.enqueue({
            type: 'UPDATE',
            localMemoId: localMemo.localId,
            serverMemoId: localMemo.serverId, // 서버 ID 필요
            data: {
                id: localMemo.serverId,
                content: localMemo.content,
                tags: localMemo.tags,
                pageNumber: localMemo.pageNumber,
                memoStartTime: localMemo.memoStartTime
            }
        });

        // syncQueueId 업데이트
        localMemo.syncQueueId = queueItem.id;
        await dbManager.saveMemo(localMemo);

        // 네트워크가 연결되어 있으면 즉시 동기화 시도 (비동기, await 하지 않음)
        if (networkMonitor.isOnline) {
            this.syncPendingMemos().catch(error => {
                console.error('백그라운드 동기화 실패:', error);
            });
        }

        return localMemo;
    }

    /**
     * 메모 삭제 (오프라인 지원)
     * 1. IndexedDB에서 기존 메모 조회
     * 2. 동기화 큐에 DELETE 항목 추가
     * 3. 로컬 메모는 삭제하지 않고 삭제 표시만 함 (동기화 완료 후 삭제)
     * 4. 네트워크가 연결되어 있으면 즉시 동기화 시도
     * @param {string|number} memoId - 메모 ID (localId 또는 serverId)
     * @returns {Promise<Object>} 삭제 결과
     */
    async deleteMemo(memoId) {
        await this.init();

        // memoId가 localId인지 serverId인지 확인
        let localMemo;
        if (typeof memoId === 'string' && (memoId.includes('-') || memoId.startsWith('local-'))) {
            // localId로 조회 (UUID 형식 또는 local- 접두사)
            const actualLocalId = memoId.startsWith('local-') ? memoId : memoId;
            localMemo = await dbManager.getMemoByLocalId(actualLocalId);
        } else {
            // serverId로 조회
            localMemo = await dbManager.getMemoByServerId(memoId);
        }

        if (!localMemo) {
            throw new Error('메모를 찾을 수 없습니다.');
        }

        // 서버에 동기화된 메모만 삭제 가능 (serverId가 있어야 함)
        // 단, 아직 동기화되지 않은 메모는 로컬에서 즉시 삭제
        if (!localMemo.serverId) {
            // 아직 동기화되지 않은 메모는 로컬에서 즉시 삭제
            await dbManager.deleteMemo(localMemo.localId);
            
            // 동기화 큐에 CREATE 항목이 있으면 제거
            if (localMemo.syncQueueId) {
                await syncQueueManager.removeQueueItem(localMemo.syncQueueId);
            }
            
            return { deleted: true, localOnly: true };
        }

        // 동기화 중인 경우 대기 상태로 설정 (시나리오 2, 5 개선)
        if (localMemo.syncStatus === 'syncing' || localMemo.syncStatus === 'syncing_update') {
            // DELETE 큐 항목을 'WAITING' 상태로 추가
            // originalQueueId: 원본 항목(UPDATE) ID 참조 (Service Worker에서 대기 처리용)
            const queueItem = await syncQueueManager.enqueue({
                type: 'DELETE',
                localMemoId: localMemo.localId,
                serverMemoId: localMemo.serverId,
                status: 'WAITING', // 대기 상태
                originalQueueId: localMemo.syncQueueId, // 원본 항목 ID 참조
                data: {
                    id: localMemo.serverId
                }
            });
            
            // waiting 상태로 표시 (Service Worker에서 처리)
            localMemo.syncStatus = 'waiting';
            localMemo.syncQueueId = queueItem.id;
            localMemo.updatedAt = new Date().toISOString();
            await dbManager.saveMemo(localMemo);
            
            return { deleted: false, localOnly: false, localMemo, waiting: true };
        }

        // 동기화 큐에 DELETE 항목 추가
        const queueItem = await syncQueueManager.enqueue({
            type: 'DELETE',
            localMemoId: localMemo.localId,
            serverMemoId: localMemo.serverId, // 서버 ID 필요
            data: {
                id: localMemo.serverId
            }
        });

        // 로컬 메모는 삭제 표시만 하고 실제 삭제는 동기화 완료 후
        localMemo.syncStatus = 'pending'; // 삭제 대기 상태
        localMemo.syncQueueId = queueItem.id;
        localMemo.updatedAt = new Date().toISOString();
        await dbManager.saveMemo(localMemo);

        // 네트워크가 연결되어 있으면 즉시 동기화 시도 (비동기, await 하지 않음)
        if (networkMonitor.isOnline) {
            this.syncPendingMemos().catch(error => {
                console.error('백그라운드 동기화 실패:', error);
            });
        }

        return { deleted: false, localOnly: false, localMemo };
    }

    /**
     * 모든 오프라인 메모 조회 (UI 표시용)
     * @returns {Promise<Array>} 모든 메모 배열
     */
    async getAllMemos() {
        await this.init();
        return await dbManager.getAllMemos();
    }

    /**
     * 특정 책의 메모 조회
     * @param {number} userBookId - 사용자 책 ID
     * @returns {Promise<Array>} 메모 배열
     */
    async getMemosByBook(userBookId) {
        await this.init();
        return await dbManager.getMemosByBook(userBookId);
    }

    /**
     * 서버 메모를 로컬 메모로 저장 (하이브리드 전략)
     * 최근 7일 메모만 IndexedDB에 저장
     * @param {Object} serverMemo - 서버 메모 객체
     * @returns {Promise<Object>} 로컬 메모 객체
     */
    async saveServerMemoAsLocal(serverMemo) {
        await this.init();

        // 이미 존재하는 메모인지 확인 (serverId로)
        const existingMemo = await dbManager.getMemoByServerId(serverMemo.id);
        if (existingMemo) {
            // 이미 존재하면 업데이트
            existingMemo.content = serverMemo.content;
            existingMemo.tags = serverMemo.tags || [];
            existingMemo.pageNumber = serverMemo.pageNumber;
            existingMemo.memoStartTime = serverMemo.memoStartTime || serverMemo.createdAt;
            existingMemo.updatedAt = new Date().toISOString();
            await dbManager.saveMemo(existingMemo);
            return existingMemo;
        }

        // 새 메모로 저장
        const localMemo = {
            localId: this.generateLocalId(),
            serverId: serverMemo.id,
            userBookId: serverMemo.userBookId,
            pageNumber: serverMemo.pageNumber,
            content: serverMemo.content,
            tags: serverMemo.tags || [],
            memoStartTime: serverMemo.memoStartTime || serverMemo.createdAt,
            syncStatus: 'synced', // 서버에서 가져온 메모는 이미 동기화 완료
            createdAt: serverMemo.createdAt || new Date().toISOString(),
            updatedAt: serverMemo.updatedAt || new Date().toISOString(),
            syncQueueId: null
        };

        await dbManager.saveMemo(localMemo);
        return localMemo;
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
     * 대기 중인 메모 동기화
     * 동기화 큐에서 PENDING 항목을 가져와서 처리
     * 시나리오 2, 5: WAITING 상태 항목 처리 (원본 항목 완료 대기)
     * @returns {Promise<{successCount: number, failedCount: number}>} 동기화 결과 (성공/실패 개수)
     */
    async syncPendingMemos() {
        if (!networkMonitor.isOnline) {
            console.log('네트워크가 오프라인 상태입니다.');
            return { successCount: 0, failedCount: 0 };
        }

        // 시나리오 2, 5: WAITING 상태 항목 처리 (원본 항목 완료 대기)
        const waitingQueueItems = await syncQueueManager.getWaitingItems();
        for (const waitingItem of waitingQueueItems) {
            if (waitingItem.originalQueueId) {
                // 원본 항목 조회
                const originalItem = await syncQueueManager.getQueueItem(waitingItem.originalQueueId);
                
                if (originalItem && originalItem.status === 'SUCCESS') {
                    // 원본 항목이 완료되었으면 'PENDING'으로 변경하고 실행
                    waitingItem.status = 'PENDING';
                    await syncQueueManager.updateQueueItem(waitingItem);
                    console.log(`WAITING 항목을 PENDING으로 변경: ${waitingItem.id} (원본 항목 완료: ${waitingItem.originalQueueId})`);
                } else {
                    // 아직 원본 항목이 처리 중이면 다음 항목으로
                    console.log(`WAITING 항목 대기 중: ${waitingItem.id} (원본 항목: ${waitingItem.originalQueueId}, 상태: ${originalItem?.status || '없음'})`);
                }
            }
        }

        // 동기화 큐에서 PENDING 항목 조회 (메모 관련 항목만)
        const allPendingItems = await syncQueueManager.getPendingItems();
        const pendingMemoItems = allPendingItems.filter(item => item.localMemoId);
        console.log(`동기화할 메모 항목 수: ${pendingMemoItems.length}`);

        // 동기화 시작 (동기화 상태 추적)
        // 모든 PENDING 항목(메모 + 내 서재 정보)을 고려하여 시작
        if (allPendingItems.length > 0 && !syncStateManager.isSyncing) {
            syncStateManager.startSync(allPendingItems.length);
        }

        let successCount = 0;
        let failedCount = 0;

        // 순서 보장: createdAt 기준 정렬
        pendingMemoItems.sort((a, b) => {
            const timeA = new Date(a.createdAt);
            const timeB = new Date(b.createdAt);
            return timeA - timeB;
        });

        for (const queueItem of pendingMemoItems) {
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
        // 상태는 syncPendingMemos()에서 이미 'SYNCING'으로 변경됨
        // 여기서는 추가 상태 변경 없이 바로 처리

        try {
            let response;
            let localMemo;

            // 동기화 큐 항목 타입에 따라 처리
            switch (queueItem.type) {
                case 'CREATE':
                    // 메모 생성
                    localMemo = await dbManager.getMemoByLocalId(queueItem.localMemoId);
                    if (!localMemo) {
                        throw new Error('로컬 메모를 찾을 수 없습니다.');
                    }

                    localMemo.syncStatus = 'syncing_create';
                    await dbManager.saveMemo(localMemo);

                    // 멱등성 키 재사용 (없으면 생성 후 저장)
                    let idempotencyKey = queueItem.idempotencyKey;
                    if (!idempotencyKey) {
                        idempotencyKey = this.generateLocalId();
                        queueItem.idempotencyKey = idempotencyKey;
                        await syncQueueManager.updateQueueItem(queueItem);
                    }
                    
                    // API 호출 (고정된 멱등성 키 사용)
                    response = await apiClient.post(API_ENDPOINTS.MEMOS.CREATE, queueItem.data, {
                        headers: {
                            'Idempotency-Key': idempotencyKey
                        }
                    });

                    // 서버 ID로 업데이트
                    await dbManager.updateMemoWithServerId(localMemo.localId, response.id);
                    localMemo = await dbManager.getMemoByLocalId(queueItem.localMemoId);

                    // 시나리오 1 개선: 서버 ID 할당 시 연쇄 업데이트
                    // 해당 localMemoId를 가진 모든 UPDATE/DELETE 큐 항목의 serverMemoId 업데이트
                    const relatedQueueItems = await syncQueueManager.getQueueItemsByLocalMemoId(localMemo.localId);
                    for (const relatedItem of relatedQueueItems) {
                        if ((relatedItem.type === 'UPDATE' || relatedItem.type === 'DELETE') && 
                            !relatedItem.serverMemoId) {
                            relatedItem.serverMemoId = response.id;
                            await syncQueueManager.updateQueueItem(relatedItem);
                        }
                    }

                    // 하이브리드 전략: 최근 7일 메모만 보관
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    const memoDate = new Date(localMemo.memoStartTime);

                    if (memoDate < sevenDaysAgo) {
                        await dbManager.deleteMemo(localMemo.localId);
                        console.log(`메모 동기화 성공 및 삭제 (오래된 메모): ${localMemo.localId} → ${response.id}`);
                    } else {
                        localMemo.syncStatus = 'synced';
                        await dbManager.saveMemo(localMemo);
                        console.log(`메모 동기화 성공 (보관): ${localMemo.localId} → ${response.id}`);
                    }
                    break;

                case 'UPDATE':
                    // 메모 수정
                    localMemo = await dbManager.getMemoByLocalId(queueItem.localMemoId);
                    if (!localMemo) {
                        throw new Error('로컬 메모를 찾을 수 없습니다.');
                    }

                    if (!localMemo.serverId) {
                        throw new Error('서버 ID가 없어 수정할 수 없습니다.');
                    }

                    localMemo.syncStatus = 'syncing_update';
                    await dbManager.saveMemo(localMemo);

                    response = await apiClient.put(API_ENDPOINTS.MEMOS.UPDATE(queueItem.serverMemoId), queueItem.data);

                    // 수정 완료 후 상태 업데이트
                    localMemo.syncStatus = 'synced';
                    localMemo.updatedAt = new Date().toISOString();
                    await dbManager.saveMemo(localMemo);
                    console.log(`메모 수정 동기화 성공: ${localMemo.localId} → ${queueItem.serverMemoId}`);
                    break;

                case 'DELETE':
                    // 메모 삭제
                    localMemo = await dbManager.getMemoByLocalId(queueItem.localMemoId);
                    if (!localMemo) {
                        // 이미 삭제된 경우 큐 항목만 제거
                        await syncQueueManager.markAsSuccess(queueItem.id);
                        console.log(`메모가 이미 삭제됨: ${queueItem.serverMemoId}`);
                        return;
                    }

                    if (!localMemo.serverId) {
                        throw new Error('서버 ID가 없어 삭제할 수 없습니다.');
                    }

                    localMemo.syncStatus = 'syncing_delete';
                    await dbManager.saveMemo(localMemo);

                    response = await apiClient.delete(API_ENDPOINTS.MEMOS.DELETE(queueItem.serverMemoId));

                    // 삭제 완료 후 로컬에서도 삭제
                    await dbManager.deleteMemo(localMemo.localId);
                    console.log(`메모 삭제 동기화 성공: ${localMemo.localId} → ${queueItem.serverMemoId}`);
                    break;

                default:
                    throw new Error(`알 수 없는 동기화 타입: ${queueItem.type}`);
            }

            // 동기화 큐에서 제거
            await syncQueueManager.markAsSuccess(queueItem.id);
        } catch (error) {
            // 동기화 실패 처리
            if (queueItem.localMemoId) {
                const localMemo = await dbManager.getMemoByLocalId(queueItem.localMemoId);
                if (localMemo) {
                    localMemo.syncStatus = 'failed';
                    await dbManager.saveMemo(localMemo);
                }
            }

            // 동기화 큐에 에러 기록 및 재시도 예약
            await syncQueueManager.markAsFailed(queueItem.id, error.message);
            throw error;
        }
    }

    /**
     * 주기적 정리 작업 (하이브리드 전략)
     * 30일 이상 된 동기화 완료 메모 삭제
     * @returns {Promise<number>} 삭제된 메모 개수
     */
    async periodicCleanup() {
        await this.init();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 동기화 완료된 메모 조회
        const syncedMemos = await dbManager.getSyncedMemos();

        let deletedCount = 0;
        for (const memo of syncedMemos) {
            const updatedAt = new Date(memo.updatedAt);
            if (updatedAt < thirtyDaysAgo) {
                // 30일 이상 된 동기화 완료 메모 삭제
                await dbManager.deleteMemo(memo.localId);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`주기적 정리 완료: ${deletedCount}개의 오래된 메모 삭제`);
        }

        return deletedCount;
    }
}

export const offlineMemoService = new OfflineMemoService();

