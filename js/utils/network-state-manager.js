/**
 * 네트워크 상태 관리자
 * 이벤트 기반 상태 전환 처리 및 중앙화된 상태 관리
 */

import { eventBus } from './event-bus.js';
import { networkMonitor } from './network-monitor.js';

class NetworkStateManager {
    constructor() {
        // networkMonitor의 초기 상태와 동기화
        this.isOnline = networkMonitor.isOnline;
        this.isLocalServerReachable = networkMonitor.isLocalServerReachable || false;
        this.isExternalServiceReachable = networkMonitor.isExternalServiceReachable || false;
        this.state = this.isOnline ? 'online' : 'offline'; // 'offline', 'online', 'transitioning'
        this.setupEventHandlers();
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        // networkMonitor의 상태 변경 이벤트 구독
        networkMonitor.subscribe((isOnline) => {
            this.handleNetworkStatusChange(isOnline);
        });

        // networkStatusChanged 커스텀 이벤트 구독
        window.addEventListener('networkStatusChanged', (event) => {
            const { isLocalServerReachable, isExternalServiceReachable } = event.detail;
            this.isLocalServerReachable = isLocalServerReachable;
            this.isExternalServiceReachable = isExternalServiceReachable;
            this.isOnline = isLocalServerReachable;
            
            // 이벤트 발행
            if (isLocalServerReachable && !this.isOnline) {
                // 오프라인 → 온라인 전환
                this.transitionToOnline();
            } else if (!isLocalServerReachable && this.isOnline) {
                // 온라인 → 오프라인 전환
                this.transitionToOffline();
            }
        });
    }

    /**
     * 네트워크 상태 변경 처리
     * @param {boolean} isOnline - 온라인 상태 여부
     */
    handleNetworkStatusChange(isOnline) {
        if (isOnline && !this.isOnline) {
            // 오프라인 → 온라인 전환
            this.transitionToOnline();
        } else if (!isOnline && this.isOnline) {
            // 온라인 → 오프라인 전환
            this.transitionToOffline();
        }
    }

    /**
     * 온라인 상태로 전환
     */
    async transitionToOnline() {
        if (this.state === 'transitioning') {
            // 이미 전환 중이면 대기
            return;
        }

        this.state = 'transitioning';
        
        try {
            // 이벤트 발행: 네트워크 온라인 전환 시작
            eventBus.publish('network:online:start', {
                triggerSync: true,
                processQueue: true
            });

            // 상태 변경
            this.isOnline = true;
            this.state = 'online';

            // 이벤트 발행: 네트워크 온라인 전환 완료
            eventBus.publish('network:online', {
                triggerSync: true,
                processQueue: true
            });
        } catch (error) {
            console.error('온라인 전환 실패:', error);
            this.state = 'offline';
            this.isOnline = false;
            
            // 이벤트 발행: 네트워크 온라인 전환 실패
            eventBus.publish('network:online:failed', { error });
        }
    }

    /**
     * 오프라인 상태로 전환
     */
    async transitionToOffline() {
        if (this.state === 'transitioning') {
            // 이미 전환 중이면 대기
            return;
        }

        this.state = 'transitioning';
        
        try {
            // 이벤트 발행: 네트워크 오프라인 전환 시작
            eventBus.publish('network:offline:start', {
                cancelPending: true,
                queueOperations: true
            });

            // 상태 변경
            this.isOnline = false;
            this.isLocalServerReachable = false;
            this.isExternalServiceReachable = false;
            this.state = 'offline';

            // 이벤트 발행: 네트워크 오프라인 전환 완료
            eventBus.publish('network:offline', {
                cancelPending: true,
                queueOperations: true
            });
        } catch (error) {
            console.error('오프라인 전환 실패:', error);
            this.state = 'offline';
            
            // 이벤트 발행: 네트워크 오프라인 전환 실패
            eventBus.publish('network:offline:failed', { error });
        }
    }

    /**
     * 현재 네트워크 상태 반환
     * @returns {Object} 네트워크 상태 정보
     */
    getState() {
        return {
            isOnline: this.isOnline,
            isLocalServerReachable: this.isLocalServerReachable,
            isExternalServiceReachable: this.isExternalServiceReachable,
            state: this.state
        };
    }
}

export const networkStateManager = new NetworkStateManager();

