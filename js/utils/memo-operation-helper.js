/**
 * 메모 작업 공통 헬퍼 함수
 * IndexedDB 갱신 및 오류 처리 로직을 공통화하여 코드 중복 제거
 */

import { dbManager } from '../storage/indexeddb-manager.js';

export class MemoOperationHelper {
    /**
     * 메모 삭제 후 IndexedDB 갱신
     * @param {string|number} memoId - 메모 ID (serverId)
     * @returns {Promise<void>}
     */
    static async updateLocalAfterDelete(memoId) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        const localMemo = await dbManager.getMemoByServerId(memoId);
        if (localMemo) {
            await dbManager.deleteMemo(localMemo.localId);
        }
    }

    /**
     * 메모 생성 후 IndexedDB 갱신
     * @param {Object} serverMemo - 서버에서 반환된 메모 객체
     * @returns {Promise<Object|null>} 업데이트된 로컬 메모 객체 또는 null
     */
    static async updateLocalAfterCreate(serverMemo) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        // serverId로 기존 로컬 메모 조회
        const localMemo = await dbManager.getMemoByServerId(serverMemo.id);
        
        if (localMemo) {
            // 기존 로컬 메모가 있으면 서버 ID 업데이트 및 동기화 상태 변경
            await dbManager.updateMemoWithServerId(localMemo.localId, serverMemo.id);
            const updatedMemo = await dbManager.getMemoByLocalId(localMemo.localId);
            
            // 하이브리드 전략: 최근 7일 메모만 보관
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const memoDate = new Date(updatedMemo.memoStartTime);

            if (memoDate < sevenDaysAgo) {
                // 7일 이상 된 메모는 삭제
                await dbManager.deleteMemo(updatedMemo.localId);
                return null;
            } else {
                // 최근 7일 메모는 보관
                updatedMemo.syncStatus = 'synced';
                await dbManager.saveMemo(updatedMemo);
                return updatedMemo;
            }
        } else {
            // 기존 로컬 메모가 없으면 새로 생성 (하이브리드 전략: 최근 7일만)
            return await this.saveServerMemoAsLocal(serverMemo);
        }
    }

    /**
     * 메모 수정 후 IndexedDB 갱신
     * @param {string|number} memoId - 메모 ID (serverId)
     * @param {Object} serverMemo - 서버에서 반환된 메모 객체
     * @returns {Promise<Object>} 업데이트된 로컬 메모 객체
     */
    static async updateLocalAfterUpdate(memoId, serverMemo) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        const localMemo = await dbManager.getMemoByServerId(memoId);
        
        if (localMemo) {
            // 로컬 메모 업데이트
            localMemo.content = serverMemo.content;
            localMemo.tags = serverMemo.tags || [];
            localMemo.pageNumber = serverMemo.pageNumber;
            localMemo.memoStartTime = serverMemo.memoStartTime || serverMemo.createdAt;
            localMemo.updatedAt = new Date().toISOString();
            localMemo.syncStatus = 'synced';
            
            await dbManager.saveMemo(localMemo);
            return localMemo;
        }
        
        return null;
    }

    /**
     * 서버 오류 처리 및 오프라인 모드로 전환
     * @param {Error} error - 발생한 오류
     * @param {string|number} memoId - 메모 ID
     * @param {Function} fallbackOperation - 오프라인 모드로 전환할 함수
     * @returns {Promise<*>} fallbackOperation의 반환값
     */
    static async handleServerError(error, memoId, fallbackOperation) {
        // 네트워크 오류인지 확인
        const isNetworkError = error.message?.includes('Failed to fetch') || 
                              error.message?.includes('NetworkError') ||
                              error.message?.includes('network') ||
                              !navigator.onLine;
        
        if (isNetworkError) {
            console.warn('서버 오류 발생, 오프라인 모드로 전환:', error);
            return await fallbackOperation(memoId);
        }
        
        // 네트워크 오류가 아니면 원래 오류를 다시 던짐
        throw error;
    }

    /**
     * 로컬 메모 조회 (serverId 또는 localId로)
     * @param {string|number} memoId - 메모 ID
     * @returns {Promise<Object|null>} 로컬 메모 객체 또는 null
     */
    static async getLocalMemo(memoId) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        // memoId가 localId인지 serverId인지 확인
        if (typeof memoId === 'string' && (memoId.includes('-') || memoId.startsWith('local-'))) {
            // localId로 조회 (UUID 형식 또는 local- 접두사)
            const actualLocalId = memoId.startsWith('local-') ? memoId : memoId;
            return await dbManager.getMemoByLocalId(actualLocalId);
        } else {
            // serverId로 조회
            return await dbManager.getMemoByServerId(memoId);
        }
    }

    /**
     * 서버 메모를 로컬에 저장 (하이브리드 전략: 최근 7일만)
     * @param {Object} serverMemo - 서버 메모 객체
     * @returns {Promise<Object|null>} 저장된 로컬 메모 객체 또는 null
     */
    static async saveServerMemoAsLocal(serverMemo) {
        // IndexedDB 초기화 확인
        await dbManager.init();
        
        // 최근 7일 메모만 저장
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const memoDate = new Date(serverMemo.memoStartTime || serverMemo.createdAt);
        
        if (memoDate < sevenDaysAgo) {
            // 7일 이상 된 메모는 저장하지 않음
            return null;
        }

        // 이미 존재하는 메모인지 확인 (serverId로)
        const existingMemo = await dbManager.getMemoByServerId(serverMemo.id);
        if (existingMemo) {
            // 이미 존재하면 업데이트
            existingMemo.content = serverMemo.content;
            existingMemo.tags = serverMemo.tags || [];
            existingMemo.pageNumber = serverMemo.pageNumber;
            existingMemo.memoStartTime = serverMemo.memoStartTime || serverMemo.createdAt;
            existingMemo.updatedAt = new Date().toISOString();
            existingMemo.syncStatus = 'synced';
            await dbManager.saveMemo(existingMemo);
            return existingMemo;
        }

        // 새 메모로 저장
        const localId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        const localMemo = {
            localId,
            serverId: serverMemo.id,
            userBookId: serverMemo.userBookId,
            pageNumber: serverMemo.pageNumber,
            content: serverMemo.content,
            tags: serverMemo.tags || [],
            memoStartTime: serverMemo.memoStartTime || serverMemo.createdAt,
            syncStatus: 'synced',
            createdAt: serverMemo.createdAt || new Date().toISOString(),
            updatedAt: serverMemo.updatedAt || new Date().toISOString(),
            syncQueueId: null
        };

        await dbManager.saveMemo(localMemo);
        return localMemo;
    }
}

