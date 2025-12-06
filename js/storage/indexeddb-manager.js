/**
 * IndexedDB 관리자
 * 오프라인 메모 저장 및 동기화 큐 관리를 위한 IndexedDB 스키마 및 CRUD 메서드 제공
 */

class IndexedDBManager {
    constructor() {
        this.dbName = 'reading-tracker';
        this.version = 1;
        this.db = null;
    }

    /**
     * IndexedDB 초기화
     * @returns {Promise<IDBDatabase>} 데이터베이스 인스턴스
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // offline_memos 테이블
                if (!db.objectStoreNames.contains('offline_memos')) {
                    const memoStore = db.createObjectStore('offline_memos', {
                        keyPath: 'localId'
                    });
                    memoStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    memoStore.createIndex('userBookId', 'userBookId', { unique: false });
                    memoStore.createIndex('memoStartTime', 'memoStartTime', { unique: false });
                    memoStore.createIndex('serverId', 'serverId', { unique: false }); // 하이브리드 전략용
                }

                // sync_queue 테이블
                if (!db.objectStoreNames.contains('sync_queue')) {
                    const queueStore = db.createObjectStore('sync_queue', {
                        keyPath: 'id'
                    });
                    queueStore.createIndex('status', 'status', { unique: false });
                    queueStore.createIndex('localMemoId', 'localMemoId', { unique: false });
                }
            };
        });
    }

    /**
     * 메모 저장
     * @param {Object} memo - 메모 객체
     * @returns {Promise<IDBRequest>}
     */
    async saveMemo(memo) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readwrite');
            const store = transaction.objectStore('offline_memos');
            const request = store.put(memo);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 동기화 대기 중인 메모 조회
     * @returns {Promise<Array>} pending 상태인 메모 배열
     */
    async getPendingMemos() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readonly');
            const store = transaction.objectStore('offline_memos');
            const index = store.index('syncStatus');
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 메모 업데이트 (서버 ID 설정)
     * @param {string} localId - 로컬 메모 ID
     * @param {number} serverId - 서버 메모 ID
     * @returns {Promise<IDBRequest>}
     */
    async updateMemoWithServerId(localId, serverId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readwrite');
            const store = transaction.objectStore('offline_memos');
            const getRequest = store.get(localId);
            
            getRequest.onsuccess = () => {
                const memo = getRequest.result;
                if (memo) {
                    memo.serverId = serverId;
                    memo.syncStatus = 'synced';
                    const putRequest = store.put(memo);
                    putRequest.onsuccess = () => resolve(putRequest.result);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve(null);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * 로컬 ID로 메모 조회
     * @param {string} localId - 로컬 메모 ID
     * @returns {Promise<Object|null>} 메모 객체 또는 null
     */
    async getMemoByLocalId(localId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readonly');
            const store = transaction.objectStore('offline_memos');
            const request = store.get(localId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 서버 ID로 메모 조회 (하이브리드 전략용)
     * @param {number} serverId - 서버 메모 ID
     * @returns {Promise<Object|null>} 메모 객체 또는 null
     */
    async getMemoByServerId(serverId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readonly');
            const store = transaction.objectStore('offline_memos');
            const index = store.index('serverId');
            const request = index.get(serverId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 특정 책의 메모 조회
     * @param {number} userBookId - 사용자 책 ID
     * @returns {Promise<Array>} 메모 배열
     */
    async getMemosByBook(userBookId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readonly');
            const store = transaction.objectStore('offline_memos');
            const index = store.index('userBookId');
            const request = index.getAll(userBookId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 동기화 완료된 메모 조회 (하이브리드 전략용)
     * @returns {Promise<Array>} synced 상태인 메모 배열
     */
    async getSyncedMemos() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readonly');
            const store = transaction.objectStore('offline_memos');
            const index = store.index('syncStatus');
            const request = index.getAll('synced');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 메모 삭제 (하이브리드 전략용)
     * @param {string} localId - 로컬 메모 ID
     * @returns {Promise<IDBRequest>}
     */
    async deleteMemo(localId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readwrite');
            const store = transaction.objectStore('offline_memos');
            const request = store.delete(localId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 모든 메모 조회
     * @returns {Promise<Array>} 모든 메모 배열
     */
    async getAllMemos() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offline_memos'], 'readonly');
            const store = transaction.objectStore('offline_memos');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
}

export const dbManager = new IndexedDBManager();



