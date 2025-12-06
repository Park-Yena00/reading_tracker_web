/**
 * Service Worker
 * 오프라인 메모 동기화, Background Sync, 네트워크 요청 가로채기, 캐싱 전략 제공
 */

const CACHE_VERSION = 'v1';
const DB_NAME = 'reading-tracker';
const DB_VERSION = 1;

// 1. Background Sync: 페이지 종료 후 동기화
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-memos') {
        event.waitUntil(syncPendingMemos());
    }
});

// 2. 네트워크 요청 가로채기: 메모 관련 요청 제어
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // 메모 관련 요청 처리
    if (url.includes('/api/v1/memos')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // 성공 시 응답 처리
                    if (response.ok && event.request.method === 'GET') {
                        // GET 요청은 선택적으로 캐싱 (최근 메모 조회용)
                        const responseClone = response.clone();
                        caches.open('memos-cache-v1').then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(error => {
                    // 네트워크 실패 시 처리 (Failure Handling)
                    if (event.request.method === 'POST') {
                        return handleFailedPostRequest(event.request);
                    }
                    if (event.request.method === 'PUT') {
                        return handleFailedPutRequest(event.request);
                    }
                    if (event.request.method === 'DELETE') {
                        return handleFailedDeleteRequest(event.request);
                    }
                    // GET 요청의 경우: 캐시에서 반환 또는 에러 처리
                    return handleFailedGetRequest(event.request, error);
                })
        );
    } 
    // 태그 데이터 캐싱: Service Worker의 Stale-While-Revalidate (SWR) 전략 + Etag 기반 검증
    else if (url.includes('/api/v1/tags') && event.request.method === 'GET') {
        event.respondWith(
            caches.open('tags-cache-v1').then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    // 1. 백그라운드에서 네트워크 요청 시작 (최신성 보장)
                    const fetchPromise = fetch(event.request).then(response => {
                        if (response.ok) {
                            // 2. Etag 기반 검증: 캐시된 데이터와 비교
                            const cachedEtag = cachedResponse?.headers.get('ETag');
                            const newEtag = response.headers.get('ETag');
                            
                            // 3. Etag가 다르면 캐시 업데이트 (데이터 변경됨)
                            if (cachedEtag !== newEtag) {
                                cache.put(event.request, response.clone());
                            }
                        }
                        return response;
                    }).catch(error => {
                        console.error('태그 데이터 네트워크 요청 실패:', error);
                        // 네트워크 실패 시 에러는 무시 (캐시 응답 사용)
                    });
                    
                    // 4. 캐시에 있으면 즉시 반환 (Stale 허용 - 오프라인 우선)
                    if (cachedResponse) {
                        // 백그라운드 업데이트는 계속 진행
                        return cachedResponse;
                    }
                    
                    // 5. 캐시가 없으면 네트워크 응답 대기
                    return fetchPromise.then(response => {
                        if (response.ok) {
                            // 네트워크 응답을 캐시에 저장
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(error => {
                        // 네트워크 실패 시 에러 응답
                        return new Response(JSON.stringify({
                            ok: false,
                            error: '태그 데이터를 불러올 수 없습니다.'
                        }), {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                });
            })
        );
    } 
    // 내 서재 정보 캐싱: Service Worker의 Network-First, Fallback to Cache 전략 + Etag 기반 검증
    else if (url.includes('/api/v1/user/books') && event.request.method === 'GET') {
        event.respondWith(
            caches.open('user-shelf-cache-v1').then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    // 1. Network-First: 네트워크 요청을 먼저 시도 (최신성 보장)
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            // 2. Etag 기반 검증: 캐시된 데이터와 비교
                            const cachedEtag = cachedResponse?.headers.get('ETag');
                            const newEtag = response.headers.get('ETag');
                            
                            // 3. Etag가 다르거나 캐시가 없으면 캐시 업데이트
                            if (cachedEtag !== newEtag || !cachedResponse) {
                                cache.put(event.request, response.clone());
                            }
                        }
                        return response;
                    }).catch(error => {
                        // 4. Fallback to Cache: 네트워크 실패 시에만 캐시 사용
                        console.error('내 서재 정보 네트워크 요청 실패:', error);
                        
                        if (cachedResponse) {
                            // 캐시된 데이터를 대체 수단으로 반환 (오프라인 접근성 유지)
                            return cachedResponse;
                        }
                        
                        // 캐시도 없으면 에러 응답
                        return new Response(JSON.stringify({
                            ok: false,
                            error: '내 서재 정보를 불러올 수 없습니다.'
                        }), {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                });
            })
        );
    } 
    else {
        // 기타 요청은 그대로 전달
        event.respondWith(fetch(event.request));
    }
});

// POST 요청 실패 처리: IndexedDB 동기화 큐(Outbox)에 저장
async function handleFailedPostRequest(request) {
    try {
        // 요청 본문 파싱
        const requestBody = await request.clone().json();
        
        // IndexedDB에 동기화 큐 항목으로 저장
        const queueItem = {
            id: generateId(),
            type: 'CREATE',
            localMemoId: null, // Service Worker에서는 localMemoId를 알 수 없음
            serverMemoId: null,
            data: requestBody,
            status: 'PENDING',
            retryCount: 0,
            error: null,
            createdAt: new Date().toISOString(),
            lastRetryAt: null,
            requestUrl: request.url,
            requestMethod: request.method
        };
        
        // IndexedDB에 저장
        await saveToSyncQueue(queueItem);
        
        // Background Sync 등록 (네트워크 복구 시 자동 재시도)
        if ('sync' in self.registration) {
            await self.registration.sync.register('sync-memos');
        }
        
        // 성공 응답 반환 (사용자에게는 성공처럼 보이게)
        return new Response(JSON.stringify({
            ok: true,
            data: {
                message: '메모가 오프라인 모드로 저장되었습니다. 네트워크 복구 시 자동 동기화됩니다.'
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save request to sync queue:', error);
        // 실패 시 원래 에러 반환
        return new Response(JSON.stringify({
            ok: false,
            error: {
                message: '네트워크 오류 및 로컬 저장 실패'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// PUT 요청 실패 처리: IndexedDB 동기화 큐(Outbox)에 저장
async function handleFailedPutRequest(request) {
    try {
        // 요청 본문 파싱
        const requestBody = await request.clone().json();
        
        // URL에서 메모 ID 추출 (예: /api/v1/memos/123)
        const urlParts = request.url.split('/');
        const memoId = urlParts[urlParts.length - 1];
        
        // IndexedDB에 동기화 큐 항목으로 저장
        const queueItem = {
            id: generateId(),
            type: 'UPDATE',
            localMemoId: null,
            serverMemoId: parseInt(memoId),
            data: requestBody,
            status: 'PENDING',
            retryCount: 0,
            error: null,
            createdAt: new Date().toISOString(),
            lastRetryAt: null,
            requestUrl: request.url,
            requestMethod: request.method
        };
        
        // IndexedDB에 저장
        await saveToSyncQueue(queueItem);
        
        // Background Sync 등록 (네트워크 복구 시 자동 재시도)
        if ('sync' in self.registration) {
            await self.registration.sync.register('sync-memos');
        }
        
        // 성공 응답 반환 (사용자에게는 성공처럼 보이게)
        return new Response(JSON.stringify({
            ok: true,
            data: {
                message: '메모 수정이 오프라인 모드로 저장되었습니다. 네트워크 복구 시 자동 동기화됩니다.'
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save PUT request to sync queue:', error);
        return new Response(JSON.stringify({
            ok: false,
            error: {
                message: '네트워크 오류 및 로컬 저장 실패'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// DELETE 요청 실패 처리: IndexedDB 동기화 큐(Outbox)에 저장
async function handleFailedDeleteRequest(request) {
    try {
        // URL에서 메모 ID 추출 (예: /api/v1/memos/123)
        const urlParts = request.url.split('/');
        const memoId = urlParts[urlParts.length - 1];
        
        // IndexedDB에 동기화 큐 항목으로 저장
        const queueItem = {
            id: generateId(),
            type: 'DELETE',
            localMemoId: null,
            serverMemoId: parseInt(memoId),
            data: { id: parseInt(memoId) },
            status: 'PENDING',
            retryCount: 0,
            error: null,
            createdAt: new Date().toISOString(),
            lastRetryAt: null,
            requestUrl: request.url,
            requestMethod: request.method
        };
        
        // IndexedDB에 저장
        await saveToSyncQueue(queueItem);
        
        // Background Sync 등록 (네트워크 복구 시 자동 재시도)
        if ('sync' in self.registration) {
            await self.registration.sync.register('sync-memos');
        }
        
        // 성공 응답 반환 (사용자에게는 성공처럼 보이게)
        return new Response(JSON.stringify({
            ok: true,
            data: {
                message: '메모 삭제가 오프라인 모드로 저장되었습니다. 네트워크 복구 시 자동 동기화됩니다.'
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save DELETE request to sync queue:', error);
        return new Response(JSON.stringify({
            ok: false,
            error: {
                message: '네트워크 오류 및 로컬 저장 실패'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// GET 요청 실패 처리: 캐시에서 반환
async function handleFailedGetRequest(request, error) {
    // 캐시에서 응답 찾기
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    // 캐시가 없으면 에러 반환
    return new Response(JSON.stringify({
        ok: false,
        error: {
            message: '네트워크 오류 및 캐시 없음'
        }
    }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
    });
}

// IndexedDB 동기화 큐에 저장 (Service Worker 컨텍스트에서 실행)
async function saveToSyncQueue(queueItem) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const putRequest = store.put(queueItem);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

function generateId() {
    return 'sync-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 동기화 함수 (Service Worker 컨텍스트에서 실행)
// Sync Strategy: 네트워크 복구 시 순서대로 요청 재전송(Replay)
// 시나리오 2, 5: WAITING 상태 항목 처리 (원본 항목 완료 대기)
async function syncPendingMemos() {
    // 1. 네트워크 상태 확인
    if (!await checkNetworkStatus()) {
        console.log('네트워크가 오프라인 상태입니다. 동기화 대기...');
        return;
    }
    
    // 2. 시나리오 2, 5: WAITING 상태 항목 처리 (원본 항목 완료 대기)
    const waitingQueueItems = await getWaitingQueueItemsFromIndexedDB();
    for (const waitingItem of waitingQueueItems) {
        if (waitingItem.originalQueueId) {
            // 원본 항목 조회
            const originalItem = await getQueueItemFromIndexedDB(waitingItem.originalQueueId);
            
            if (originalItem && originalItem.status === 'SUCCESS') {
                // 원본 항목이 완료되었으면 'PENDING'으로 변경
                waitingItem.status = 'PENDING';
                await updateQueueItemInIndexedDB(waitingItem);
                console.log(`WAITING 항목을 PENDING으로 변경: ${waitingItem.id} (원본 항목 완료: ${waitingItem.originalQueueId})`);
            } else {
                // 아직 원본 항목이 처리 중이면 다음 항목으로
                console.log(`WAITING 항목 대기 중: ${waitingItem.id} (원본 항목: ${waitingItem.originalQueueId}, 상태: ${originalItem?.status || '없음'})`);
            }
        }
    }
    
    // 3. IndexedDB에서 대기 중인 동기화 큐 항목 조회
    const pendingQueueItems = await getPendingQueueItemsFromIndexedDB();
    
    if (pendingQueueItems.length === 0) {
        console.log('동기화할 항목이 없습니다.');
        return;
    }
    
    // 4. 순서 보장: memoStartTime 또는 createdAt 기준 정렬
    pendingQueueItems.sort((a, b) => {
        const timeA = new Date(a.data?.memoStartTime || a.createdAt);
        const timeB = new Date(b.data?.memoStartTime || b.createdAt);
        return timeA - timeB;
    });
    
    console.log(`동기화할 항목 수: ${pendingQueueItems.length}`);
    
    // 5. 순차적으로 동기화 (Replay)
    for (const queueItem of pendingQueueItems) {
        try {
            // 동기화 상태 업데이트
            await updateQueueItemStatus(queueItem.id, 'SYNCING');
            
            // 6. 원본 요청 재현(Replay): 동기화 큐의 데이터로 API 호출
            const response = await replayRequest(queueItem);
            
            if (response.ok) {
                // 성공: 동기화 큐 항목 상태를 SUCCESS로 업데이트
                await updateQueueItemStatus(queueItem.id, 'SUCCESS');
                console.log(`동기화 성공: ${queueItem.id}`);
            } else {
                // 실패: 재시도 로직 적용
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
        } catch (error) {
            console.error(`동기화 실패 (${queueItem.id}):`, error);
            
            // 재시도 로직: Exponential Backoff
            await handleSyncFailure(queueItem, error);
        }
    }
}

// 네트워크 상태 확인 (Service Worker 컨텍스트)
async function checkNetworkStatus() {
    try {
        // 실제 서버 연결 가능 여부 확인 (헬스체크)
        const response = await fetch('/api/v1/health', {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000) // 3초 타임아웃
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// 동기화 큐 항목 조회 (Service Worker 컨텍스트)
async function getPendingQueueItemsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('status');
            const getAllRequest = index.getAll('PENDING');
            getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// WAITING 상태 큐 항목 조회 (Service Worker 컨텍스트, 시나리오 2, 5용)
async function getWaitingQueueItemsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('status');
            const getAllRequest = index.getAll('WAITING');
            getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// 특정 큐 항목 조회 (Service Worker 컨텍스트, 시나리오 2, 5용)
async function getQueueItemFromIndexedDB(queueId) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);
            getRequest.onsuccess = () => resolve(getRequest.result || null);
            getRequest.onerror = () => reject(getRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// 큐 항목 업데이트 (Service Worker 컨텍스트, 시나리오 2, 5용)
async function updateQueueItemInIndexedDB(queueItem) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            queueItem.updatedAt = new Date().toISOString();
            const putRequest = store.put(queueItem);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// 원본 요청 재현(Replay): 동기화 큐의 데이터로 API 호출
async function replayRequest(queueItem) {
    const { type, serverMemoId, data, requestUrl, requestMethod } = queueItem;
    
    let url, method, body;
    
    // 타입에 따라 URL과 메서드 결정
    switch (type) {
        case 'CREATE':
            url = '/api/v1/memos';
            method = 'POST';
            body = JSON.stringify(data);
            break;
        case 'UPDATE':
            url = `/api/v1/memos/${serverMemoId}`;
            method = 'PUT';
            body = JSON.stringify(data);
            break;
        case 'DELETE':
            url = `/api/v1/memos/${serverMemoId}`;
            method = 'DELETE';
            body = null;
            break;
        default:
            // 기존 방식 (requestUrl, requestMethod 사용)
            url = requestUrl || '/api/v1/memos';
            method = requestMethod || 'POST';
            body = data ? JSON.stringify(data) : null;
    }
    
    // 원본 요청의 Authorization 헤더 가져오기
    // Service Worker는 요청을 가로채므로 원본 요청의 헤더를 사용할 수 없음
    // 대신 클라이언트에서 전달한 헤더를 사용하거나, 별도로 토큰을 관리해야 함
    // 여기서는 원본 요청 URL을 사용하여 재현
    const fullUrl = url.startsWith('http') ? url : `${self.location.origin}${url}`;
    
    return fetch(fullUrl, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            // Authorization 헤더는 클라이언트에서 설정된 것을 사용
            // Service Worker가 요청을 가로채므로 원본 요청의 헤더를 그대로 사용할 수 없음
            // 실제 구현에서는 클라이언트와 메시지 통신으로 토큰을 받아야 함
        },
        body: body
    });
}

// 동기화 큐 항목 상태 업데이트
async function updateQueueItemStatus(queueItemId, status) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueItemId);
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
        };
        request.onerror = () => reject(request.error);
    });
}

// 동기화 큐 항목 재시도 정보 업데이트
async function updateQueueItemWithRetry(queueItemId, retryCount, errorMessage) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueItemId);
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.status = 'PENDING';
                    item.retryCount = retryCount;
                    item.error = errorMessage;
                    item.lastRetryAt = new Date().toISOString();
                    const putRequest = store.put(item);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// 동기화 실패 처리: Exponential Backoff 재시도
async function handleSyncFailure(queueItem, error) {
    const retryCount = (queueItem.retryCount || 0) + 1;
    const maxRetries = 3;
    
    if (retryCount < maxRetries) {
        // 재시도 예약: Exponential Backoff (5초, 10초, 20초)
        const delay = 5000 * Math.pow(2, retryCount - 1);
        
        // 큐 항목 업데이트
        await updateQueueItemWithRetry(queueItem.id, retryCount, error.message);
        
        // 지연 후 재시도
        setTimeout(async () => {
            // Background Sync 재등록
            if ('sync' in self.registration) {
                await self.registration.sync.register('sync-memos');
            }
        }, delay);
    } else {
        // 최대 재시도 횟수 초과: 실패 상태로 표시
        await updateQueueItemStatus(queueItem.id, 'FAILED');
        console.error(`동기화 최종 실패 (재시도 ${retryCount}회): ${queueItem.id}`);
    }
}

