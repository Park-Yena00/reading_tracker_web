/**
 * 토스트 메시지 유틸리티
 * 우측 하단에 간결하고 일시적인 알림을 제공
 */

/**
 * 토스트 메시지 표시 유틸리티 함수
 * @param {string} message 표시할 메시지
 * @param {string} type 메시지 타입 ('success', 'warning', 'error', 'info')
 * @param {number} duration 표시 시간 (밀리초, 기본값: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // 토스트 컨테이너가 없으면 생성
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // 토스트 메시지 요소 생성
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background-color: ${getToastColor(type)};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        min-width: 250px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    toast.textContent = message;
    
    // 토스트 컨테이너에 추가
    toastContainer.appendChild(toast);
    
    // 지정된 시간 후 자동 제거
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

/**
 * 토스트 메시지 타입별 색상 반환
 * @param {string} type 메시지 타입
 * @returns {string} CSS 색상 값
 */
function getToastColor(type) {
    const colors = {
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336',
        info: '#2196f3'
    };
    return colors[type] || colors.info;
}

// CSS 애니메이션 추가 (한 번만 추가)
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}



