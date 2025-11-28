/**
 * Event Bus 구현
 * Event-Driven 패턴을 위한 이벤트 발행/구독 시스템
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * 이벤트 구독
   * @param {string} eventType - 이벤트 타입 (예: 'auth:login')
   * @param {Function} callback - 이벤트 발생 시 호출할 콜백 함수
   * @returns {Function} 구독 해제 함수
   */
  subscribe(eventType, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);

    // 구독 해제 함수 반환
    return () => {
      this.unsubscribe(eventType, callback);
    };
  }

  /**
   * 이벤트 구독 해제
   * @param {string} eventType - 이벤트 타입
   * @param {Function} callback - 구독 해제할 콜백 함수
   */
  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
      
      // 리스너가 없으면 맵에서 제거
      if (this.listeners.get(eventType).size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * 이벤트 발행
   * @param {string} eventType - 이벤트 타입
   * @param {*} data - 이벤트 데이터 (선택사항)
   */
  publish(eventType, data = null) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${eventType}":`, error);
        }
      });
    }
  }

  /**
   * 특정 이벤트 타입의 모든 리스너 제거
   * @param {string} eventType - 이벤트 타입
   */
  clear(eventType) {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      // 모든 리스너 제거
      this.listeners.clear();
    }
  }

  /**
   * 특정 이벤트 타입의 리스너 개수 반환
   * @param {string} eventType - 이벤트 타입
   * @returns {number} 리스너 개수
   */
  listenerCount(eventType) {
    return this.listeners.has(eventType) 
      ? this.listeners.get(eventType).size 
      : 0;
  }
}

// 싱글톤 인스턴스 생성 및 export
const eventBus = new EventBus();

export default eventBus;


