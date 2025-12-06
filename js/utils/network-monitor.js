/**
 * 네트워크 상태 모니터
 * 네트워크 연결 상태 감지 및 자동 동기화 트리거
 * 2단계 헬스체크: 로컬 서버 + 외부 서비스(Aladin API) 연결 가능 여부 확인
 */

import { showToast } from './toast.js';
import { apiClient } from '../services/api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';

class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isLocalServerReachable = false;
        this.isExternalServiceReachable = false;
        this.listeners = [];
        this.init();
    }

    /**
     * 초기화: 네트워크 이벤트 리스너 등록
     */
    init() {
        window.addEventListener('online', () => {
            console.log('네트워크 연결 복구');
            this.isOnline = true;
            this.notifyListeners(true);
            this.onNetworkOnline();
        });

        window.addEventListener('offline', () => {
            console.log('네트워크 연결 끊김');
            this.isOnline = false;
            this.isLocalServerReachable = false;
            this.isExternalServiceReachable = false;
            this.notifyListeners(false);
        });
    }

    /**
     * 네트워크 복구 시 2단계 헬스체크 및 동기화
     * 1단계: 로컬 백엔드 서버 연결 가능 여부 확인
     * 2단계: 외부 서비스(알라딘 API) 연결 가능 여부 확인
     */
    async onNetworkOnline() {
        // 1초 대기 (네트워크 안정화)
        await this.delay(1000);
        
        // 1단계: 로컬 백엔드 서버 연결 가능 여부 확인
        this.isLocalServerReachable = await this.checkServerHealth();
        
        if (!this.isLocalServerReachable) {
            // 로컬 서버 접근 불가
            console.warn('네트워크는 연결되었지만 서버에 접근할 수 없습니다.');
            this.notifyNetworkStatus(false, false);
            // 재시도 예약
            setTimeout(() => this.onNetworkOnline(), 5000);
            return;
        }
        
        // 2단계: 외부 서비스(알라딘 API) 연결 가능 여부 확인
        this.isExternalServiceReachable = await this.checkExternalServiceHealth();
        
        if (this.isExternalServiceReachable) {
            // 모든 서비스 연결 가능 → 동기화 시작 및 도서 검색 활성화
            this.notifyNetworkStatus(true, true);
            // 동기화 완료 후 토스트 메시지 표시
            await this.handleSyncSuccess();
        } else {
            // 로컬 서버는 접근 가능하지만 외부 서비스 접근 불가
            // 동기화는 가능하지만 도서 검색은 제한됨
            console.warn('외부 서비스에 접근할 수 없습니다. 검색 기능이 제한됩니다.');
            this.notifyNetworkStatus(true, false);
            // 외부 서비스 재시도 예약
            setTimeout(() => this.checkExternalServiceHealth(), 5000);
            // 동기화는 진행 (로컬 서버는 접근 가능하므로)
            // 동기화 완료 후 토스트 메시지 표시 (외부 서비스 경고 포함)
            await this.handleSyncSuccess(false);
        }
    }

    /**
     * 1단계: 로컬 백엔드 서버 헬스체크
     * @returns {Promise<boolean>} 서버 연결 가능 여부
     */
    async checkServerHealth() {
        try {
            // API 클라이언트의 baseURL 사용
            const baseURL = apiClient.getBaseURL();
            const healthUrl = baseURL.replace('/api/v1', '') + '/api/v1/health';
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
            
            const response = await fetch(healthUrl, {
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.error('로컬 서버 헬스체크 실패:', error);
            return false;
        }
    }

    /**
     * 2단계: 외부 서비스(알라딘 API) 헬스체크
     * @returns {Promise<boolean>} 외부 서비스 연결 가능 여부
     */
    async checkExternalServiceHealth() {
        try {
            const baseURL = apiClient.getBaseURL();
            const healthUrl = baseURL + '/health/aladin';
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃 (외부 API이므로 더 긴 타임아웃)
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                // 200 OK: 알라딘 API 연결 가능
                return true;
            } else if (response.status === 503) {
                // 503 Service Unavailable: 알라딘 API 연결 불가
                return false;
            } else {
                // 기타 상태 코드
                return false;
            }
        } catch (error) {
            console.error('외부 서비스 헬스체크 실패:', error);
            return false;
        }
    }

    /**
     * 네트워크 상태를 다른 컴포넌트에 알림 (DOM 이벤트)
     * @param {boolean} isLocalServerReachable 로컬 서버 연결 가능 여부
     * @param {boolean} isExternalServiceReachable 외부 서비스 연결 가능 여부
     */
    notifyNetworkStatus(isLocalServerReachable, isExternalServiceReachable) {
        // 커스텀 이벤트 발생
        const event = new CustomEvent('networkStatusChanged', {
            detail: {
                isLocalServerReachable,
                isExternalServiceReachable,
                isFullyOnline: isLocalServerReachable && isExternalServiceReachable
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * 동기화 성공 처리 및 토스트 메시지 표시
     * Heartbeat 성공 후, 모든 백그라운드 동기화 작업이 완료된 직후 호출됨
     * @param {boolean} isExternalServiceAvailable 외부 서비스(알라딘 API) 사용 가능 여부 (기본값: true)
     */
    async handleSyncSuccess(isExternalServiceAvailable = true) {
        try {
            // offlineMemoService 동적 import (순환 참조 방지)
            const { offlineMemoService } = await import('../services/offline-memo-service.js');
            
            // 모든 백그라운드 동기화 작업 실행
            // syncPendingMemos()는 { successCount: number, failedCount: number } 형태의 결과를 반환
            const syncResult = await offlineMemoService.syncPendingMemos();
            
            // 동기화 완료 후 토스트 메시지 표시 (성공 또는 실패 응답을 받은 후)
            if (syncResult && syncResult.successCount > 0) {
                // 동기화 성공 메시지 (우측 하단에 토스트 표시)
                showToast(`✅ ${syncResult.successCount}개의 메모 동기화 완료.`, 'success');
            }
            
            // 외부 서비스 연결 불가 시 경고 메시지
            if (!isExternalServiceAvailable) {
                showToast('⚠️ 외부 서비스 연결 불가. 검색 제한됨.', 'warning');
            }
        } catch (error) {
            console.error('동기화 실패:', error);
            showToast('❌ 동기화 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 지연 함수
     * @param {number} ms 밀리초
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 네트워크 상태 변경 구독
     * @param {Function} callback - 네트워크 상태 변경 시 호출될 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * 구독자에게 네트워크 상태 변경 알림
     * @param {boolean} isOnline - 온라인 상태 여부
     */
    notifyListeners(isOnline) {
        this.listeners.forEach(callback => callback(isOnline));
    }
}

export const networkMonitor = new NetworkMonitor();

