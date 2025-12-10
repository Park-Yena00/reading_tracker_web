// 메인 JavaScript 파일
// DOM이 로드된 후 실행

// NetworkStateManager 초기화 (이벤트 기반 상태 전환 처리)
import { networkStateManager } from './utils/network-state-manager.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('독서 기록 사이트가 로드되었습니다.');
    
    // Service Worker 등록
    registerServiceWorker();
    
    // 초기화 함수들
    initializeApp();
    
    // NetworkStateManager 초기화 확인
    console.log('NetworkStateManager 초기화 완료:', networkStateManager.getState());
});

/**
 * Service Worker 등록
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker 등록 성공:', registration.scope);
                
                // 동기화 요청 등록
                if ('sync' in registration) {
                    // Background Sync 지원
                    registration.sync.register('sync-memos')
                        .then(() => {
                            console.log('Background Sync 등록 성공');
                        })
                        .catch(error => {
                            console.warn('Background Sync 등록 실패:', error);
                        });
                } else {
                    // 폴백: online 이벤트 사용
                    console.warn('Background Sync를 지원하지 않습니다. online 이벤트를 사용합니다.');
                    window.addEventListener('online', () => {
                        console.log('네트워크 연결 복구 (online 이벤트)');
                        // 동기화는 NetworkMonitor에서 처리
                    });
                }
            })
            .catch(error => {
                console.error('Service Worker 등록 실패:', error);
            });
    } else {
        console.warn('Service Worker를 지원하지 않는 브라우저입니다.');
    }
}

/**
 * 애플리케이션 초기화
 */
function initializeApp() {
    // API 클라이언트가 로드되었는지 확인
    if (typeof window.apiClient === 'undefined') {
        console.error('API 클라이언트가 로드되지 않았습니다.');
        return;
    }
    
    console.log('API 클라이언트가 준비되었습니다.');
    
    // 예시: 독서 기록 목록 불러오기 (필요시 주석 해제)
    // loadReadingRecords();
}

/**
 * 독서 기록 목록 불러오기 (예시)
 */
async function loadReadingRecords() {
    try {
        const records = await window.apiClient.get('/api/reading-records');
        console.log('독서 기록:', records);
        // DOM에 표시하는 로직 추가
    } catch (error) {
        console.error('독서 기록 로드 실패:', error);
    }
}

